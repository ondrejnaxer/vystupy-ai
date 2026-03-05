document.addEventListener('DOMContentLoaded', () => {
    const menuList = document.getElementById('menu-list');
    const btnAdd = document.getElementById('btn-add');
    const btnSave = document.getElementById('btn-save');
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const template = document.getElementById('menu-item-template');
    
    const INDENT_SIZE = 40; // Must match CSS --indent-size
    const SCROLL_THRESHOLD = 60; // px from viewport edge to trigger auto-scroll
    const SCROLL_SPEED = 8;      // px per animation frame

    let draggedItem = null;
    let placeholder = null;
    let dragSubtree = []; // descendants of the dragged item
    let autoScrollRAF = null;
    let lastDragY = 0;

    // --- Undo/Redo History ---
    const MAX_HISTORY = 50;
    let historyStack = [];
    let historyIndex = -1;
    let savedIndex = -1;

    function getSnapshot() {
        const items = [...menuList.querySelectorAll('.menu-item:not(.placeholder)')];
        return items.map(item => ({
            id: item.dataset.id,
            title: item.querySelector('.input-title').value,
            url: item.querySelector('.input-url').value,
            depth: parseInt(item.dataset.depth)
        }));
    }

    function pushHistory() {
        const snapshot = getSnapshot();
        const current = historyIndex >= 0 ? historyStack[historyIndex] : null;
        if (current && JSON.stringify(current) === JSON.stringify(snapshot)) {
            return;
        }
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(snapshot);
        if (historyStack.length > MAX_HISTORY) {
            historyStack.shift();
            if (savedIndex >= 0) savedIndex--;
        }
        historyIndex = historyStack.length - 1;
        updateUndoRedoButtons();
        updateAllQuickNavButtons();
    }

    function restoreSnapshot(snapshot) {
        menuList.innerHTML = '';
        snapshot.forEach(data => {
            const item = createMenuItem(data.id, data.title, data.url, data.depth);
            menuList.appendChild(item);
        });
        updateUndoRedoButtons();
        updateAllQuickNavButtons();
    }

    function updateUndoRedoButtons() {
        btnUndo.disabled = historyIndex <= 0;
        btnRedo.disabled = historyIndex >= historyStack.length - 1;
    }

    btnUndo.addEventListener('click', () => {
        if (historyIndex <= 0) return;
        historyIndex--;
        restoreSnapshot(historyStack[historyIndex]);
    });

    btnRedo.addEventListener('click', () => {
        if (historyIndex >= historyStack.length - 1) return;
        historyIndex++;
        restoreSnapshot(historyStack[historyIndex]);
    });

    // --- Unsaved Changes Warning ---
    window.addEventListener('beforeunload', (e) => {
        if (historyIndex !== savedIndex) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Load existing data or start empty
    loadMenu();

    // --- UI Interactions ---
    btnAdd.addEventListener('click', () => {
        const id = 'item_' + Date.now();
        const newItem = createMenuItem(id, 'New Item', '', 0);
        menuList.appendChild(newItem);
        pushHistory();
    });

    btnSave.addEventListener('click', saveMenu);

    function createMenuItem(id, title, url, depth) {
        const clone = template.content.cloneNode(true);
        const li = clone.querySelector('li');
        
        li.dataset.id = id;
        setDepth(li, depth);
        
        li.querySelector('.item-title-display').textContent = title;
        li.querySelector('.input-title').value = title;
        li.querySelector('.input-url').value = url;

        // Setup Accordion Toggle
        li.querySelector('.btn-expand').addEventListener('click', (e) => {
            const settings = li.querySelector('.item-settings');
            settings.classList.toggle('expanded');
            e.target.textContent = settings.classList.contains('expanded') ? '▲' : '▼';
        });

        // Setup Live Title Update
        li.querySelector('.input-title').addEventListener('input', (e) => {
            li.querySelector('.item-title-display').textContent = e.target.value || '(No Label)';
        });

        // Track title/url changes for undo history
        li.querySelector('.input-title').addEventListener('change', () => pushHistory());
        li.querySelector('.input-url').addEventListener('change', () => pushHistory());

        // Setup Remove
        li.querySelector('.btn-remove').addEventListener('click', () => {
            li.remove();
            pushHistory();
        });

        // Setup Drag Events
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragend', handleDragEnd);

        // Dragging is only enabled from the drag handle
        const dragHandle = li.querySelector('.drag-handle');
        dragHandle.addEventListener('mousedown', () => {
            li.draggable = true;
            document.addEventListener('mouseup', () => { li.draggable = false; }, { once: true });
        });

        // Setup Quick Navigation
        li.querySelector('.btn-move-up').addEventListener('click', () => {
            const items = [...menuList.querySelectorAll('.menu-item:not(.placeholder)')];
            const index = items.indexOf(li);
            if (index === 0) return;

            const subtree = getSubtree(li);

            // Determine the new previous item after moving up
            const newPrevItem = index > 1 ? items[index - 2] : null;
            const allowedDepth = newPrevItem
                ? parseInt(newPrevItem.dataset.depth, 10) + 1
                : 0;

            const currentDepth = parseInt(li.dataset.depth, 10);

            // Clamp the depth of the moved item and its subtree so that
            // depth <= newPrevItem.depth + 1 (or 0 if moved to the top)
            if (currentDepth > allowedDepth) {
                const depthDelta = currentDepth - allowedDepth;
                const movedNodes = [li, ...subtree];
                movedNodes.forEach(node => {
                    const nodeDepth = parseInt(node.dataset.depth, 10);
                    setDepth(node, Math.max(0, nodeDepth - depthDelta));
                });
            }

            items[index - 1].before(li, ...subtree);

            // After the move, the displaced item (formerly items[index-1]) now
            // follows the moved block. Clamp it and its subtree so that
            // depth <= newPrevItem.depth + 1 (where newPrevItem is now the last
            // node of the moved block).
            const lastMovedNode = subtree.length > 0 ? subtree[subtree.length - 1] : li;
            const lastMovedDepth = parseInt(lastMovedNode.dataset.depth, 10);
            const displaced = items[index - 1];
            const displacedDepth = parseInt(displaced.dataset.depth, 10);
            if (displacedDepth > lastMovedDepth + 1) {
                const displacedDelta = displacedDepth - (lastMovedDepth + 1);
                const displacedSubtree = getSubtree(displaced);
                [displaced, ...displacedSubtree].forEach(node => {
                    const nodeDepth = parseInt(node.dataset.depth, 10);
                    setDepth(node, Math.max(0, nodeDepth - displacedDelta));
                });
            }

            pushHistory();
        });

        li.querySelector('.btn-move-down').addEventListener('click', () => {
            const items = [...menuList.querySelectorAll('.menu-item:not(.placeholder)')];
            const subtree = getSubtree(li);
            const lastItem = subtree.length > 0 ? subtree[subtree.length - 1] : li;
            const lastIndex = items.indexOf(lastItem);
            if (lastIndex === items.length - 1) return;
            const newPrevItem = items[lastIndex + 1];
            // Move after the entire newPrevItem subtree to avoid splitting it
            const newPrevSubtree = getSubtree(newPrevItem);
            const newPrevBlockLast = newPrevSubtree.length > 0 ? newPrevSubtree[newPrevSubtree.length - 1] : newPrevItem;
            newPrevBlockLast.after(li, ...subtree);
            const newPrevDepth = parseInt(newPrevItem.dataset.depth, 10);
            const currentDepth = parseInt(li.dataset.depth, 10);
            const maxAllowedDepth = newPrevDepth + 1;
            if (currentDepth > maxAllowedDepth) {
                const depthDelta = currentDepth - maxAllowedDepth;
                const movedNodes = [li, ...subtree];
                movedNodes.forEach(node => {
                    const nodeDepth = parseInt(node.dataset.depth, 10);
                    setDepth(node, Math.max(0, nodeDepth - depthDelta));
                });
            }
            pushHistory();
        });

        li.querySelector('.btn-increase-level').addEventListener('click', () => {
            const currentDepth = parseInt(li.dataset.depth, 10);
            const maxDepth = getMaxDepth(li);
            if (currentDepth >= maxDepth) return;
            const depthDelta = 1;
            const subtree = getSubtree(li);
            const itemsToUpdate = [li, ...subtree];
            itemsToUpdate.forEach((item) => {
                const itemDepth = parseInt(item.dataset.depth, 10);
                setDepth(item, Math.max(0, itemDepth + depthDelta));
            });
            pushHistory();
        });

        li.querySelector('.btn-decrease-level').addEventListener('click', () => {
            const currentDepth = parseInt(li.dataset.depth, 10);
            if (currentDepth === 0) return;
            const depthDelta = -1;
            const subtree = getSubtree(li);
            const itemsToUpdate = [li, ...subtree];
            itemsToUpdate.forEach((item) => {
                const itemDepth = parseInt(item.dataset.depth, 10);
                setDepth(item, Math.max(0, itemDepth + depthDelta));
            });
            pushHistory();
        });

        li.querySelector('.btn-to-top').addEventListener('click', () => {
            const subtree = getSubtree(li);
            const movedNodes = [li, ...subtree];
            const currentDepth = parseInt(li.dataset.depth, 10);

            // When moving to the top, the first item must be at depth 0.
            if (currentDepth > 0) {
                const delta = -currentDepth;
                movedNodes.forEach((node) => {
                    const nodeDepth = parseInt(node.dataset.depth, 10);
                    const newDepth = Math.max(0, nodeDepth + delta);
                    setDepth(node, newDepth);
                });
            }

            menuList.prepend(li, ...subtree);
            pushHistory();
        });

        li.querySelector('.btn-to-bottom').addEventListener('click', () => {
            const subtree = getSubtree(li);
            const movedNodes = [li, ...subtree];

            // Determine the previous item after the move (i.e., the last item
            // that is not part of the moved block).
            const allItems = [...menuList.querySelectorAll('.menu-item:not(.placeholder)')];
            const movingSet = new Set(movedNodes);
            const remainingItems = allItems.filter((item) => !movingSet.has(item));
            const prevItem = remainingItems.length > 0 ? remainingItems[remainingItems.length - 1] : null;

            if (prevItem) {
                const allowedDepth = parseInt(prevItem.dataset.depth, 10) + 1;
                const currentDepth = parseInt(li.dataset.depth, 10);

                // Clamp the moved root (and its subtree) so that root depth
                // is not deeper than prevItem.depth + 1.
                if (currentDepth > allowedDepth) {
                    const delta = allowedDepth - currentDepth;
                    movedNodes.forEach((node) => {
                        const nodeDepth = parseInt(node.dataset.depth, 10);
                        const newDepth = Math.max(0, nodeDepth + delta);
                        setDepth(node, newDepth);
                    });
                }
            } else {
                // If there is no previous item (the moved block becomes the first),
                // treat this like "move to top" and clamp root depth to 0.
                const currentDepth = parseInt(li.dataset.depth, 10);
                if (currentDepth > 0) {
                    const delta = -currentDepth;
                    movedNodes.forEach((node) => {
                        const nodeDepth = parseInt(node.dataset.depth, 10);
                        const newDepth = Math.max(0, nodeDepth + delta);
                        setDepth(node, newDepth);
                    });
                }
            }

            menuList.append(li, ...subtree);
            pushHistory();
        });

        return li;
    }

    // --- Drag and Drop Logic ---

    function getSubtree(item) {
        const depth = parseInt(item.dataset.depth);
        const items = [...menuList.querySelectorAll('.menu-item:not(.placeholder)')];
        const startIndex = items.indexOf(item);
        const children = [];
        for (let i = startIndex + 1; i < items.length; i++) {
            if (parseInt(items[i].dataset.depth) > depth) {
                children.push(items[i]);
            } else {
                break;
            }
        }
        return children;
    }

    function startAutoScroll() {
        if (autoScrollRAF) return;
        function scrollStep() {
            const viewportHeight = window.innerHeight;
            if (lastDragY < SCROLL_THRESHOLD) {
                window.scrollBy(0, -SCROLL_SPEED);
                autoScrollRAF = requestAnimationFrame(scrollStep);
            } else if (lastDragY > viewportHeight - SCROLL_THRESHOLD) {
                window.scrollBy(0, SCROLL_SPEED);
                autoScrollRAF = requestAnimationFrame(scrollStep);
            } else {
                autoScrollRAF = null; // outside threshold – stop until dragover restarts
            }
        }
        autoScrollRAF = requestAnimationFrame(scrollStep);
    }

    function stopAutoScroll() {
        if (autoScrollRAF) {
            cancelAnimationFrame(autoScrollRAF);
            autoScrollRAF = null;
        }
    }

    function handleDragStart(e) {
        draggedItem = this;
        dragSubtree = getSubtree(this);
        setTimeout(() => {
            this.classList.add('dragging');
            dragSubtree.forEach(child => child.classList.add('dragging'));
        }, 0);
        
        // Create visual placeholder
        placeholder = document.createElement('li');
        placeholder.className = 'menu-item placeholder';
        placeholder.style.height = `${this.offsetHeight}px`;
        setDepth(placeholder, parseInt(this.dataset.depth));
        
        // Ensure data transfer exists for Firefox compatibility
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ''); 
    }

    function handleDragEnd(e) {
        stopAutoScroll();
        this.draggable = false;
        this.classList.remove('dragging');
        dragSubtree.forEach(child => child.classList.remove('dragging'));
        // dropEffect is 'none' when drag was cancelled (e.g. Escape key or drop outside a valid target)
        const wasCancelled = e.dataTransfer.dropEffect === 'none';
        if (!wasCancelled && placeholder && placeholder.parentNode) {
            const origDepth = parseInt(draggedItem.dataset.depth);
            const newDepth = parseInt(placeholder.dataset.depth);
            const depthDelta = newDepth - origDepth;
            // Apply placeholder's calculated depth to the dropped item
            setDepth(this, newDepth);
            const isMovingDown =
                this.compareDocumentPosition(placeholder) & Node.DOCUMENT_POSITION_FOLLOWING;
            menuList.insertBefore(this, isMovingDown ? placeholder.nextSibling : placeholder);
            // Re-insert children immediately after parent with adjusted depths
            let insertAfter = this;
            dragSubtree.forEach(child => {
                const childDepth = parseInt(child.dataset.depth);
                setDepth(child, Math.max(0, childDepth + depthDelta));
                insertAfter.after(child);
                insertAfter = child;
            });
            placeholder.remove();
            pushHistory();
        } else if (placeholder && placeholder.parentNode) {
            placeholder.remove();
        }
        draggedItem = null;
        placeholder = null;
        dragSubtree = [];
    }

    menuList.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedItem || !placeholder) return;

        lastDragY = e.clientY;
        if (e.clientY < SCROLL_THRESHOLD || e.clientY > window.innerHeight - SCROLL_THRESHOLD) {
            startAutoScroll();
        } else {
            stopAutoScroll();
        }

        // 1. Vertical Sorting: Find element below cursor
        const afterElement = getDragAfterElement(menuList, e.clientY);
        if (afterElement == null) {
            menuList.appendChild(placeholder);
        } else {
            menuList.insertBefore(placeholder, afterElement);
        }

        // 2. Horizontal Indentation (Depth Calculation)
        const listRect = menuList.getBoundingClientRect();
        const offsetX = e.clientX - listRect.left;
        let requestedDepth = Math.floor(offsetX / INDENT_SIZE);
        
        // 3. Apply WordPress Constraints: 
        // Cannot be deeper than (Previous Item's Depth + 1). Root items are 0.
        let maxDepth = 0;
        let prevItem = placeholder.previousElementSibling;
        while (prevItem && prevItem.classList.contains('dragging')) {
            prevItem = prevItem.previousElementSibling;
        }
        
        if (prevItem) {
            maxDepth = parseInt(prevItem.dataset.depth) + 1;
        }

        // Clamp the depth
        let finalDepth = Math.max(0, Math.min(requestedDepth, maxDepth));
        setDepth(placeholder, finalDepth);
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.menu-item:not(.dragging):not(.placeholder)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function setDepth(element, depth) {
        element.dataset.depth = depth;
        element.style.setProperty('--depth', depth);
    }

    function getMaxDepth(li) {
        const items = [...menuList.querySelectorAll('.menu-item:not(.placeholder)')];
        const index = items.indexOf(li);
        const prevItem = index > 0 ? items[index - 1] : null;
        return prevItem ? parseInt(prevItem.dataset.depth) + 1 : 0;
    }

    function updateQuickNavButtons(li) {
        const items = [...menuList.querySelectorAll('.menu-item:not(.placeholder)')];
        const index = items.indexOf(li);
        const subtree = getSubtree(li);
        const lastSubtreeIndex = subtree.length > 0 ? items.indexOf(subtree[subtree.length - 1]) : index;
        const depth = parseInt(li.dataset.depth);

        li.querySelector('.btn-move-up').disabled = index === 0;
        li.querySelector('.btn-to-top').disabled = index === 0;
        li.querySelector('.btn-move-down').disabled = lastSubtreeIndex === items.length - 1;
        li.querySelector('.btn-to-bottom').disabled = lastSubtreeIndex === items.length - 1;
        li.querySelector('.btn-decrease-level').disabled = depth === 0;

        const prevItem = index > 0 ? items[index - 1] : null;
        li.querySelector('.btn-increase-level').disabled = !prevItem || depth >= getMaxDepth(li);
    }

    function updateAllQuickNavButtons() {
        menuList.querySelectorAll('.menu-item:not(.placeholder)').forEach(item => {
            updateQuickNavButtons(item);
        });
    }

    // --- Data Management ---

    function saveMenu() {
        const items = [...menuList.querySelectorAll('.menu-item:not(.placeholder)')];
        const menuData = items.map((item, index) => {
            // Calculate parent based on depth logic
            const depth = parseInt(item.dataset.depth);
            let parentId = null;
            
            // Search upwards for the nearest item with a lesser depth
            for (let i = index - 1; i >= 0; i--) {
                if (parseInt(items[i].dataset.depth) < depth) {
                    parentId = items[i].dataset.id;
                    break;
                }
            }

            return {
                id: item.dataset.id,
                title: item.querySelector('.input-title').value,
                url: item.querySelector('.input-url').value,
                depth: depth,
                parentId: parentId,
                order: index
            };
        });

        localStorage.setItem('customMenuData', JSON.stringify(menuData));
        savedIndex = historyIndex;
        
        // Quick visual feedback
        const originalText = btnSave.textContent;
        btnSave.textContent = 'Saved!';
        btnSave.style.background = '#047857';
        setTimeout(() => {
            btnSave.textContent = originalText;
            btnSave.style.background = 'var(--success-color)';
        }, 1500);
    }

    function loadMenu() {
        const stored = localStorage.getItem('customMenuData');
        if (stored) {
            try {
                const menuData = JSON.parse(stored);
                menuData.forEach(data => {
                    const item = createMenuItem(data.id, data.title, data.url, data.depth);
                    menuList.appendChild(item);
                });
            } catch (e) {
                console.error("Failed to parse menu data", e);
            }
        }
        pushHistory();
        savedIndex = historyIndex; // Loaded state matches what's in localStorage
    }
});

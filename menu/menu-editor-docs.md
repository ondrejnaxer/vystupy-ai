# Custom Vanilla JS Menu Editor Documentation

## Overview
This document describes the current Menu Editor implementation in `menu/` (pure HTML/CSS/Vanilla JS). It provides a quick map of the UI, the underlying flat data model, and the behaviors implemented in the latest `menu/script.js`.

---

## Files
- `menu/index.html` – UI skeleton (top bar, list container, template for a menu item)
- `menu/style.css` – styling, including indentation via CSS variable `--depth` and `--indent-size`
- `menu/script.js` – all behavior (CRUD, accordion, drag & drop, undo/redo, persistence)

---

## 1. Data model: Flat list with depth
The editor stores the menu as a **flat ordered list** of items, each with a numeric nesting depth.

### DOM representation
- Each item is a `<li class="menu-item">` with:
  - `data-id` – unique id (generated in JS)
  - `data-depth` – integer depth (0 = root)
  - CSS variable `--depth` – used for indentation (`margin-left: calc(var(--depth) * var(--indent-size))`)

### Snapshot / history representation
Undo/redo uses snapshots of the current DOM state:
- `getSnapshot()` collects `{ id, title, url, depth }` for every non-placeholder item.
- `pushHistory()` maintains a capped history stack (max 50), deduplicating identical snapshots.
- `restoreSnapshot()` rebuilds the list from a snapshot.
- The “saved” state is tracked by `savedIndex`, and the Save button is enabled only when `isDirty()` is true.

---

## 2. UI/UX
### Top bar actions
Buttons in `index.html`:
- Undo (`#btn-undo`) / Redo (`#btn-redo`) – enabled/disabled based on history index
- Add item (`#btn-add`) – adds a new root item
- Save (`#btn-save`) – serializes to `localStorage` and marks the state as saved

### Menu item card
Each item contains:
- Header (`.item-header`) with drag handle, title display, and expand/collapse arrow.
- Settings panel (`.item-settings`) with inputs for title and URL.
- Quick navigation buttons (move up/down, increase/decrease level, to top/bottom).
- Remove and Duplicate actions.

### Accordion behavior
- Clicking the expand button toggles `.item-settings.expanded`.
- Clicking the header (except buttons) also toggles the accordion.
- While dragging (or immediately after), accordion toggling is suppressed via `isDragging`.

---

## 3. Persistence format (localStorage)
On Save, the editor writes `customMenuData` to `localStorage`.

### Serialization
`saveMenu()` walks the flat list in order and produces:
- `id`
- `title`
- `url`
- `depth`
- `parentId` – computed by scanning upward to find the nearest previous item with a smaller depth
- `order` – array index

This makes the stored data “tree-capable” (via `parentId`) while keeping editing operations simple (flat list + depth).

### Load
`loadMenu()` reads `customMenuData` and recreates items using `createMenuItem(...)`, then initializes history and marks the loaded state as saved.

---

## 4. Undo/Redo + unsaved changes warning
- History is stored client-side in memory.
- A `beforeunload` handler warns the user if `isDirty()` is true.

---

## 5. Drag & drop (two-axis)
The editor uses native HTML5 drag & drop on the `<li>` elements.

### 5.1 Drag start gating (header-only drag)
Dragging is only allowed when the user begins interaction on `.item-header`:
- On `pointerdown` (and `mousedown` fallback / `touchstart`), the code stores `dragStartCandidate` if the start target is inside `.item-header`.
- In `dragstart`, if `dragStartCandidate !== this`, the drag is cancelled with `e.preventDefault()`.

This prevents accidental drags when interacting with inputs/buttons.

### 5.2 Placeholder + subtree dragging
On `dragstart`:
- `dragSubtree = getSubtree(draggedItem)` collects all consecutive descendants (items below with depth greater than the dragged root).
- A placeholder `<li class="menu-item placeholder">` is created, with:
  - same height as the dragged item
  - depth initially matching the dragged item

On `dragend`:
- If the drop was not cancelled (`e.dataTransfer.dropEffect !== 'none'`) and the placeholder is in the list:
  - the dragged root is inserted at the placeholder position
  - the subtree is reinserted immediately after the root
  - subtree depths are adjusted by the delta between placeholder depth and original depth
- The placeholder is removed and a history snapshot is pushed.

### 5.3 Required container events
The list container (`#menu-list`) explicitly handles:
- `dragenter` and `drop` with `e.preventDefault()`
- `dragover` with `e.preventDefault()` and `e.dataTransfer.dropEffect = 'move'`

### 5.4 Vertical ordering
During `dragover`, the editor determines insertion point via `getDragAfterElement(container, mouseY)` and inserts the placeholder before the closest element below the cursor (or appends at the end).

### 5.5 Horizontal indentation (nesting)
Also during `dragover`:
- Requested depth is computed from mouse X offset inside the list:
  - `requestedDepth = floor((clientX - listRect.left) / INDENT_SIZE)`
- Depth is clamped so the placeholder cannot be deeper than **previous non-dragged item depth + 1**.
- The final depth is applied using `setDepth(placeholder, finalDepth)`.

### 5.6 Auto-scroll during drag
While dragging near the top/bottom of the viewport, `startAutoScroll()` scrolls the window using `requestAnimationFrame` until the cursor moves away from the threshold.

---

## 6. Quick navigation controls
Each item exposes quick actions that move the item *together with its subtree*:
- Move up / down (while preventing subtree splitting)
- Increase / decrease level (applies depth delta to root + subtree, within constraints)
- To top / bottom (clamps depth to valid values at the new position)

Button enabled/disabled states are refreshed via `updateQuickNavButtons()` / `updateAllQuickNavButtons()` and are updated whenever history changes.
# Fix Missing Drag Preview and Drop Indicator

When a user drags menu items to reorder them, the drag preview/ghost element is completely ignored by the browser, and the placeholder is not displayed. This is preventing users from visually tracking where an item is being moved to.

## Root Cause Analysis
1. **Ghost Image Issue**: A capturing `dragstart` event listener on each menu item (LI element) checks if `e.target` is the inner `.item-header`. However, for `dragstart` events, `e.target` is always the dragging DOM node itself (the LI with `draggable="true"`). Therefore, `li.closest('.item-header')` always evaluates to false, causing `e.preventDefault()` to trigger and cancel the native browser HTML5 drag-and-drop mechanism.
2. **Missing `dragenter` and `drop` Check**: The container list `menuList` does not handle the `drop` and `dragenter` events. In HTML5 Drag & Drop, failing to `e.preventDefault()` on these events causes the browser to reject the drop area, leading to `e.dataTransfer.dropEffect` evaluating to `none`. 

## Proposed Changes

### javascript logic
#### [MODIFY] [script.js](file:///c:/laragon/www/vystupy-ai/menu/script.js)
1. **Better Drag Delegation**: Replace the capturing `dragstart` listener and `li.draggable = true` initialization with a pattern that tracks where the user started standard pointer events. 
    - E.g., Use `mousedown` and `touchstart` to store `dragTarget`, then inside `dragstart`, check if `dragTarget.closest('.item-header')` exists. If not, cancel the drag, otherwise dispatch [handleDragStart](file:///c:/laragon/www/vystupy-ai/menu/script.js#413-432).
2. **Handle Requisite Drop Events**: Attach `dragenter` and `drop` explicitly to `menuList` calling `e.preventDefault()` to satisfy HTML5 Drag and Drop restrictions.

## Verification Plan

### Manual Verification
- Open [c:\laragon\www\vystupy-ai\menu\index.html](file:///c:/laragon/www/vystupy-ai/menu/index.html) in a web browser.
- Grab a menu item by clicking on its header, and start dragging.
- Verify that a ghost semi-transparent preview of the content appears connected to the cursor.
- Verify that a dashed placeholder outline dynamically displays within the `menuList` corresponding to insertion points.
- Verify that releasing the mouse successfully saves the newly dragged position.

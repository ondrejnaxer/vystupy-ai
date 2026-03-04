# Custom Vanilla JS Menu Editor Documentation

## Overview
This document outlines the architecture, UI/UX design, and technical implementation of a custom menu editor built with pure HTML, CSS, and Vanilla JavaScript. The editor replicates the core functionality of the WordPress menu management system, specifically focusing on two-axis drag-and-drop capabilities (vertical sorting and horizontal nesting) without relying on external libraries like jQuery UI.

---

## 1. Architectural Concept: The Flat-to-Tree Model
While visually representing a hierarchical tree (parents and children), the underlying data is managed as a **flat list**. This mimics the WordPress approach where menu items are individual entities linked by relational metadata, ensuring database extensibility.

* **Client-Side State:** The DOM acts as the source of truth during editing. Items are represented as a flat HTML list (`<ul>`).
* **Relational Depth:** Hierarchy is determined by a `data-depth` attribute on each list item, combined with its vertical position relative to other items.
* **Serialization:** Upon saving, the script iterates through the flat list, calculating parent-child relationships dynamically based on the current depth and order, resulting in a structured JSON payload.

---

## 2. UI/UX Design
The interface utilizes a modern, single-pane workspace optimized for clarity and ease of use.

* **Top Bar:** Contains global actions (Add New Item, Save Menu) to maximize vertical workspace.
* **Workspace:** A vertical list of draggable "Menu Item" cards.
* **Accordion Settings:** Each card features an expandable section (toggled via a dropdown arrow) to edit individual attributes like the "Navigation Label" and "URL" without cluttering the main view.
* **Live Updates:** Editing an item's label dynamically updates the collapsed card's title for immediate visual feedback.

---

## 3. Drag & Drop Mechanics
The core complexity lies in handling a native HTML5 drag-and-drop implementation across two axes simultaneously.



### Vertical Sorting (Order)
* The script calculates the vertical center point of the items currently in the list.
* As the user drags an item over the list, the script determines if the cursor is above or below the center point of the hovered sibling, placing a visual "placeholder" accordingly.

### Horizontal Indentation (Hierarchy)
WordPress-style nesting relies on mouse offset tracking and strict constraints:
* **Detection:** The horizontal `offsetX` of the mouse relative to the container is monitored during the `dragover` event.
* **Depth Calculation:** The requested depth is calculated using the formula: 
  $Depth = \lfloor \frac{CurrentOffset}{PixelsPerLevel} \rfloor$
* **Constraints enforced by the script:**
    1. An item cannot be indented more than one level deeper than the item directly above it ($MaxDepth = Depth_{prev} + 1$).
    2. The first item in the menu list is strictly a root item (Depth 0).
* **Visual Feedback:** The placeholder element dynamically adjusts its left margin to reflect the allowed depth before the user drops the item.

---
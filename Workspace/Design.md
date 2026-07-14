# Design Document: GIF Editor UI

## Overview

A minimal, performant, and "silently efficient" GIF editor. The application balances the structural clarity of Swiss design with the ambient, sophisticated feel of an Aura aesthetic.

## 1. Aesthetic Identity

- **Visual Philosophy**: Swiss-Design. High focus on grid alignment, clear typography, and generous negative space.
- **Aura Style**: Elements feature subtle glassmorphism and ambient light glows (translucent overlays) to provide depth without clutter.
- **Color Themes**:
  - **Light Mode**: High-contrast grays, sharp black typography, and soft, cool-toned aura glows.
  - **Dark Mode**: Deep charcoal backgrounds, off-white typography, and subtle, vibrant aura highlights.

## 2. Interaction Design

- **Philosophy**: "Silently Efficient."
- **Behavior**: Snappy, immediate feedback. Transitions are minimal—focusing on instant state changes rather than decorative animations.
- **Feedback**: High-utility cues. Buttons change state instantly; progress indicators are unobtrusive but clear.

## 3. UI/UX Layout

- **Center Workspace**: Endless Canvas (Fabric.js). The primary focal point, emphasizing the content.
- **Bottom Timeline**: A grid-aligned, horizontal strip. Thumbnails are displayed with high contrast and precise spacing.
- **Sidebar Tools**: Floating, context-aware toolbars that appear only when an object is selected. They maintain a strict alignment with the grid.
- **Header**: Minimalist branding. Includes an "Export" button that transforms into a progress indicator when clicked.

## 4. Technical Constraints & Logic

- **Core Engine**: Fabric.js for canvas manipulation.
- **State Management**: Zustand (single source of truth).
- **Processing**: Web Workers used for all heavy lifting (encoding/compression) to ensure the UI remains responsive and "silently efficient."
- **Optimization Target**: 70% compression efficiency.
  - **Default Path**: Palette optimization and resolution scaling.
  - **Fallback Path**: Frame dropping (only if necessary to meet the 70% target).
- **Dynamic Feedback**: The "Export" button displays real-time estimated reduction, providing instant confirmation that the 70% goal is being met or exceeded.

## 5. User Journey

1.  **Ingress**: Minimalist drop zone; high-utility, immediate file parsing.
2.  **Edit**: Precise, grid-based tools appear on-demand. Interaction is immediate.
3.  **Optimize**: Real-time compression feedback ensures the 70% goal is visible and achievable with a single click.
4.  **Advanced Export**: Optional frame range, playback speed, palette quality, and sprite-sheet export controls stay in the sidebar so they are available without interrupting the canvas workflow.
5.  **Egress**: Immediate export trigger with clear, non-intrusive status tracking.

## 6. Added Export Controls

- **Frame-Level Controls**: Users can select a start and end frame for export. Timeline preview and seeking remain available for inspection.
- **Speed Adjustment**: Users can export at 0.25x to 4x speed. Preview playback uses the same speed multiplier as GIF export.
- **Color Optimization / Palette Reduction**: Users can choose Full color, Balanced, or Compact palette behavior. This maps to encoder quality settings while the automatic size-limit attempts still run.
- **Sprite Sheet Export**: Users choose rows and columns, generate a final preview, then export the selected transformed frame range as a PNG sprite sheet. The sprite sheet uses the same crop, resize, and flip settings as GIF export.

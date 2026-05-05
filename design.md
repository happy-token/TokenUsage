# Design System: TokenUsage

This document outlines the design philosophy, visual identity, and architectural patterns used in the TokenUsage renderer.

## 1. Visual Identity

TokenUsage follows a **"Modern Developer Tool"** aesthetic, prioritizing high information density, professional dark/light modes, and clear semantic feedback.

### Color Palette

The project uses the **Amber Gold (HappyCode)** palette as its primary accent.

| Role | Dark Mode (`#0f0f11`) | Light Mode (`#fafafa`) |
| :--- | :--- | :--- |
| **Accent** | `#f0b429` (Amber) | `#c27a0e` (Deep Amber) |
| **Surface** | `#1a1a1f` (Elevated) | `#ffffff` (White) |
| **Border** | `#2e2b1a` (Subtle) | `#e2e2e8` (Soft Gray) |
| **Success** | `#3dd68c` | `#16a34a` |
| **Warning** | `#f59e0b` | `#c48a00` |
| **Danger** | `#f87171` | `#dc2626` |

### Typography

- **Interface:** `-apple-system`, `Inter`, `Segoe UI`.
- **Data/Code:** `SF Mono`, `JetBrains Mono`.
- **Feature:** Extensive use of `font-variant-numeric: tabular-nums` for financial and token data to ensure perfect vertical alignment in lists and tables.

---

## 2. Component Architecture

The UI is built using a **Composition-over-Inheritance** approach with React.

### Layout
- **Sidebar:** Fixed width (200px), contains global navigation and a scrollable project list.
- **Main Content:** Flexible area with standard padding (`var(--space-lg)`).

### Core Primitives
- **Panel:** A container with a top-accent border and standard rounding (`10px`). Used to group related data.
- **KpiCard:** High-level metric display with an optional **Sparkline** for trend visualization.
- **StatCell:** A compact label-value pair for secondary metrics.

---

## 3. Interaction Patterns

### Visual Feedback
- **Hover Lift:** Interactive cards use a subtle vertical translation and shadow expansion (`.hover-lift`) to indicate clickability.
- **Clickable Scale:** Buttons and links use a slight scale-down effect (`0.96`) on active press to simulate physical feedback.

### Motion
- **Transitions:** Standardized "Spring" animations for layout changes and "Fast" transitions for color/opacity shifts.
- **Entry:** Pages use a `fade-in` animation (upwards translation + opacity) to feel "alive" when navigating.

---

## 4. UI/UX Principles

1.  **High Signal-to-Noise:** Use muted colors for secondary labels and high contrast for primary data.
2.  **Immediate Feedback:** Every action (refresh, navigation, copy) must have a visual or motion-based response.
3.  **Density without Clutter:** Use consistent spacing scales (`var(--space-*)`) to maintain a breathable layout even with large amounts of data.

---

## 5. Future Design Direction (Roadmap)

- [ ] **Iconography:** Replace text-based characters (⬡, ⚙) with a custom SVG icon set (e.g., Lucide).
- [ ] **Data Viz:** Expand Sparklines into full-featured interactive charts for deep-dive analysis.
- [ ] **Responsive Breakpoints:** Implement more robust grid wrapping for smaller Electron window sizes.

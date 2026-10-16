# FlexPT design

Source: Cursor marketing design system (alpha), applied to the trainer app.

CursorGothic is licensed. This app uses **Inter** at weight 400 with tight display tracking, and **JetBrains Mono** on code. Orange (`#f54e00`) is the wordmark and primary buttons only. Numbers, charts, and selected filters use warm ink. Dark mode is the same palette inverted onto warm near-black, not a separate blue-gray theme.

## Colors

| Token | Hex | Use |
|---|---|---|
| primary | `#f54e00` | Wordmark, primary buttons |
| primary-active | `#d04200` | Primary press |
| ink / foreground | `#26251e` | Display, emphasis, selected controls |
| body | `#5a5852` | Running text |
| muted | `#807d72` | Subtitles |
| muted-soft | `#a09c92` | Disabled |
| hairline | `#e6e5e0` | Card borders, dividers |
| hairline-soft | `#efeee8` | Lighter fills |
| hairline-strong | `#cfcdc4` | Stronger outlines |
| canvas | `#f7f7f4` | Page floor, nav, sidebar |
| canvas-soft | `#fafaf7` | Inset panes |
| surface-card | `#ffffff` | Cards |
| surface-strong | `#e6e5e0` | Badges, tags |
| on-primary | `#ffffff` | Text on orange |
| semantic-success | `#1f8a65` | Confirmation |
| semantic-error | `#cf2d56` | Errors |

Timeline pastels stay off general UI. Chart series may use them only when a graph needs more than ink and orange: peach `#dfa88f`, mint `#9fc9a2`, blue `#9fbbe0`, lavender `#c0a8dd`, gold `#c08532`.

## Type

Inter for UI. JetBrains Mono for code.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Display | 26–36px | 400 | negative |
| Title | 16–18px | 600 | 0 |
| Body | 14–16px | 400 | 0 |
| Caption uppercase | 11px | 600 | 0.08em |
| Button / nav | 14px | 500 | 0 |
| Code | 13px | 400 | 0 |

Display stays at weight 400. Do not set dashboard titles or metric numbers to bold.

## Shape and depth

Radius: 4, 6, 8 (buttons, inputs), 12 (cards), 16, pill.

No drop shadows. Depth is a 1px hairline and white cards on the cream canvas.

## App mapping

- Top bar is canvas, 64px. FlexPT is orange.
- Sidebar is canvas with a hairline. The current page is a surface-strong row.
- Primary `Button` is orange, 40px, 8px radius. Press state is `#d04200`.
- Segmented controls invert to ink, not orange.
- Metric numbers are ink, weight 400.

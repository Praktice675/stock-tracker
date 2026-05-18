# Pulse — logo files

Concept 4 (Pierced Point) packaged for production use.

## Files

### SVG (recommended — scales infinitely, transparent background)

| File | Use for |
|---|---|
| `pulse-mark.svg` | Default mark, orange (`#ff6b3d`) on transparent. Use everywhere unless you have a reason not to. |
| `pulse-mark-mono.svg` | Stroke uses `currentColor` — color it via CSS. Best when you want the mark to inherit text color. |
| `pulse-mark-white.svg` | Off-white (`#e8e8e3`) — for dark-background contexts where you don't want the orange. |
| `pulse-mark-black.svg` | Near-black (`#0d0f0d`) — for light-background contexts, print, etc. |
| `pulse-favicon.svg` | Simplified geometry with thicker proportional strokes — only use at 16–32px. Don't use this above 48px. |
| `pulse-lockup.svg` | Horizontal lockup: mark + `PULSE` wordmark. Requires JetBrains Mono loaded on the page for correct rendering (system monospace fallback otherwise). |

### PNG (when you can't use SVG)

`png/pulse-32.png` … `png/pulse-512.png` — transparent, orange.
`png/pulse-white-512.png` — transparent, off-white.
`png/favicon-16.png`, `favicon-32.png`, `favicon-48.png` — uses the simplified favicon geometry.
`png/apple-touch-icon.png` — 180×180, transparent. iOS will composite on whatever background you set in your web app manifest.

## Drop-in usage

### Favicon + Apple touch icon
```html
<link rel="icon" type="image/svg+xml" href="/pulse-favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/png/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/png/favicon-16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/png/apple-touch-icon.png" />
```

### Inline mark in a header
```html
<a href="/" class="brand">
  <img src="/pulse-mark.svg" alt="" width="28" height="28" />
  <span>PULSE</span>
</a>
```

```css
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.18em;
  color: #e8e8e3;
  text-decoration: none;
}
```

The gap between mark and wordmark should be roughly **0.5× the mark height**. The wordmark cap-height should match the mark height.

### Color-tinting via CSS (mono variant)
```html
<span style="color: #ff6b3d">
  <img src="/pulse-mark-mono.svg" alt="Pulse" width="32" height="32" />
</span>
```
…doesn't actually work for `<img>` (SVG loaded via `<img>` can't inherit CSS color). For CSS-tintable behaviour, inline the SVG directly into your markup and use `stroke="currentColor"`:

```html
<svg viewBox="0 0 64 64" fill="none" style="color: var(--brand)" width="32" height="32">
  <circle cx="32" cy="32" r="13" stroke="currentColor" stroke-width="5"/>
  <path d="M 2.5 46 L 20 46 L 32 22 L 61.5 22" stroke="currentColor" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"/>
</svg>
```

## Clear space

Minimum clear space around the mark equals **one-quarter of the mark's height** on all sides. For the 64-unit viewBox, that's 16 units. Don't crop the line ends — the line is meant to exit the frame.

## Color tokens

- Primary mark: `#ff6b3d`
- On dark: `#e8e8e3`
- On light: `#0d0f0d`

Never use the functional gain-green or loss-red as the mark color.

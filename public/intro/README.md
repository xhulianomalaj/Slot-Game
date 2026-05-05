# Intro art slots

The HUD looks for these files at runtime. If a file is missing, the component
hides the `<img>` and falls back to its CSS placeholder — so the boilerplate
runs out of the box without any of them.

| File                  | Used by              | Recommended size  | Notes                                               |
| --------------------- | -------------------- | ----------------- | --------------------------------------------------- |
| `studio-logo.png`     | `Loader.tsx`         | 256×256 transparent | Spins (rotateY) during load. Square, centred.      |
| `platform-logo.png`   | `Loader.tsx`         | 280×56 transparent | Pinned to bottom of loader. Wordmark.              |
| `logo.png`            | `Splash.tsx`         | 720×360 transparent | Game logo on the splash screen.                    |
| `logo-small.png`      | `Header.tsx`         | 240×56 transparent | Compact game wordmark for the top header.          |
| `multifeature.png`    | `Splash.tsx`         | 1040×585 (16:9)   | "Multifeature" panel above the tap-to-start CTA.   |

Drop your own assets in this folder with the exact filenames above. PNG with
alpha is recommended; SVG also works (rename the file extension and update the
`<img src>` in the component).

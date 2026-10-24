# HOT MOTOR MOTION — Motion Design Editor

<p align="center">
  <img src="img/HOT_MOTOR_MOTION_b.png" width="180" alt="HOT MOTOR MOTION">
</p>

<p align="center">
  <b>A motion design editor that runs entirely in the browser.</b><br>
  Timeline, keyframes, acceleration curves, WebM capture and a portable player —
  no build step, no account, no render queue.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="#exports">Exports</a> ·
  <a href="#keyboard-shortcuts">Shortcuts</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#rust-engine">Rust engine</a>
</p>

<p align="center">
  <a href="https://motion.zig-js.com/"><b>▶ Open the web app — motion.zig-js.com</b></a>
</p>

<p align="center">
  <a href="https://github.com/zigmoon/HOTMOTORMOTION/actions/workflows/ci.yml"><img src="https://github.com/zigmoon/HOTMOTORMOTION/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://motion.zig-js.com/"><img src="https://img.shields.io/badge/web%20app-online-1a1a1a" alt="Web app online"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-1a1a1a" alt="MIT"></a>
</p>

> **The web version is live: <https://motion.zig-js.com/>** — the whole engine is
> the page you open. A project is a JSON file you keep on your own disk.

---

## Why HOT MOTOR MOTION

Most browser animation tools compensate for weak interpolation by stacking
keyframes: a hundred positions for one movement, because the engine only knows
how to draw straight lines between them. The result is slow to build, slow to
scrub, and impossible to edit six months later.

This editor goes the other way. It carries **real acceleration curves** — spring,
expo, back, elastic — applied **per keyframe segment**, and it applies them at
render time, in the editor and in every export. One movement is two or three
keyframes. You edit the curve, not the dots.

That choice is enforced, not just documented: the library is validated by a
script that refuses any preset above 20 shapes or 200 keyframes
(`scripts/check-web.mjs`, run in CI).

- **No server, no account.** Files never leave the machine.
- **No build step.** `index.html` + `js/` + `css/` are the app.
- **Exports that keep the timing.** A standalone HTML player, a JS player, a JSON
  project, a WebM capture, and an SVG frame from the Rust engine.

---

## Quick start

```bash
npx serve .        # http://localhost:3000
```

There is no build. Opening `index.html` through any static server is enough.

The Astro version (`astro/`), the Rust engine (`rust/`) and the web app wrap the
**same** engine — one source of truth, not three. See
[Architecture](#architecture).

---

## Features

### Scene and shapes

- **Canvas** 800 × 450, 60 fps preview, zoom 25 % → 400 %, fit-to-window on load.
- **Rectangle, Circle, Text, SVG import** — SVG files are embedded as data URLs,
  so a project stays a single self-contained JSON file.
- **Transform**: x, y, z (draw order), rotation, `rotationX` / `rotationY`
  (approximated perspective), scale X/Y, skew X/Y.
- **Appearance**: fill, opacity, blur, glow with its own colour, hue, saturation,
  brightness, contrast.
- **Text**: family (20 Google Fonts + system), size, weight, colour.

### Timeline

- Adaptive ruler — major and minor ticks, labels switch to `m:SS` past a minute.
- Layer column aligned to the pixel: index, name, type badge, selection, hover.
- **One marker per instant**, not per property: a diamond for linear, a circle for
  a curved segment. Drag to move the whole instant, double-click to delete it.
- **Snapping** within 7 px of any existing keyframe while scrubbing.
- Frame-by-frame stepping, loop mode, duration from 3 s to 5 min.
- Time zoom 0.5× → 5× (`Ctrl` + wheel, or the `−` / `Ajuster` / `+` buttons).

### Curves

Fourteen curves live in the engine and are copied verbatim into the Rust engine:

| Curve | Feel |
|---|---|
| `linear` | constant speed |
| `sineIn` / `sineOut` / `sineInOut` | soft, no overshoot |
| `cubicIn` / `cubicOut` / `cubicInOut` | the everyday default |
| `expoIn` / `expoOut` / `expoInOut` | very fast start or very fast stop |
| `backOut` / `backInOut` | small anticipation / overshoot |
| `elasticOut` | oscillating settle |
| `spring` | critical damping, short overshoot |

The inspector exposes the seven you actually reach for, and applies the chosen
curve to every keyframe of the selected shape in one click.

### Inspecteur

Every numeric field is editable by hand, not only by dragging: position, size,
rotation, scale, skew, effects, and the number of keyframes. Editing a property
that is already animated inserts a keyframe at the playhead, with the curve you
selected — never a silent static write.

### Library

- **36 presets** in six families: Foundations, Typography, Reveals, Loops,
  Showcase, Transitions. Applying one starts playback immediately.
- **16 quick scripts** applied to the current selection (spin, pulse, bounce,
  glitch, slides, wobbles…).
- Search across labels and identifiers; group state is restored when you clear it.

### Undo

50 steps, full-scene snapshots. `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`, ignored while
typing in a field. Presets, scripts, keyframe dragging and AI edits are all
undoable.

---

## Exports

| Output | What you get | Where |
|---|---|---|
| **HTML** | self-contained player: data, curves, styles, controls | `Export JS` → *HTML complet* |
| **JavaScript** | the same player, to paste into an existing page | `Export JS` → *JS seul* |
| **JSON** | the project itself, readable by the editor and by the Rust engine | `Sauvegarder` / `Export JS` → *Data JSON* |
| **WebM** | real-time capture, 640×360 → 3840×2160, 24/30/60 fps | `Exporter WebM` |
| **SVG** | one frame, vector, rendered by the Rust engine | `motion-cli render` |

WebM export is limited to 4K on purpose: above that, the capture canvas exceeds
what a browser will allocate, and the failure mode is a frozen tab rather than an
error message. Higher resolutions are a job for the Rust engine, not for
`MediaRecorder`.

---

## Project format

The saved file is the whole project. Nothing else is needed to reopen it.

```json
{
  "app": "HOT MOTOR MOTION",
  "version": "1.0",
  "name": "HOT MOTOR MOTION Project",
  "created": "2026-10-25T00:00:00.000Z",
  "duration": 10,
  "canvas": { "width": 800, "height": 450 },
  "bgColor": "#121212",
  "shapes": [
    {
      "id": 1,
      "type": "Circle",
      "name": "Dot",
      "x": 120, "y": 225, "z": 0,
      "radius": 6,
      "fill": "#f5c518",
      "opacity": 0.9,
      "rotation": 0,
      "scaleX": 1, "scaleY": 1,
      "blur": 0, "glow": 0,
      "hue": 0, "saturation": 100, "brightness": 100, "contrast": 100,
      "keyframes": {
        "x": [
          { "t": 2.0, "v": 120, "e": "sineInOut" },
          { "t": 3.2, "v": 680, "e": "sineInOut" },
          { "t": 4.4, "v": 120 }
        ]
      }
    }
  ]
}
```

A keyframe is `{ "t": seconds, "v": value, "e": curve }`. The curve belongs to the
segment that **starts** at that keyframe, which is why the last keyframe usually
has none. Missing fields take the same defaults as the editor; unknown fields are
ignored — a hand-written project must open without a tool.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Space` | play / pause |
| `←` / `→` | one frame back / forward (`Shift` = 10 frames) |
| `Home` / `End` | start / end of the timeline |
| `V`, `R`, `C`, `T` | select, rectangle, circle, text |
| `Delete` / `Backspace` | delete the selection |
| `Ctrl+D` | duplicate |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | undo / redo |
| `Ctrl` + `+` / `-` / `0` / `1` | zoom in / out / reset / fit |
| `Ctrl` + wheel | zoom the canvas, or the timeline when the pointer is over it |
| `Escape` | close the open dialog, or clear the library search |

---

## Architecture

### One engine, three layers

```
index.html + js/ + css/        the engine and the app (source of truth)
astro/                          marketing pages + /editor, copies the engine
rust/                           validation, SVG, standalone HTML, CLI
```

The Astro project does not fork the code. `astro/scripts/sync-engine.mjs` copies
`js/`, `css/`, `img/`, `icons/` into `public/assets/motion/`, extracts the body of
`index.html` into `src/generated/editor-shell.html`, and — most importantly —
**copies the list and order of `<script src>` tags** from `index.html`. Two
hand-maintained script lists is exactly how a file gets forgotten and a function
goes missing at runtime.

### Design language

Sober, in the SuperPhoto tradition: ink accent on studio-dark surfaces, one gold
(`#f5c518`) reserved for the brand. Everything is a token in `css/style.css`;
switching theme never re-renders the canvas, because the canvas keeps its own
colours.

| Token group | Dark (default) | Light |
|---|---|---|
| `--bg-base` | `#121214` | `#f8f8f8` |
| `--bg-surface` | `#16161a` | `#ffffff` |
| `--text` | `#ececf1` | `#1a1a1a` |
| `--accent` | `#f0f0f2` (ink inverted) | `#1a1a1a` |
| `--gold` | `#f5c518` | `#b8860b` |

The theme is applied by `js/theme.js` in `<head>`, before first paint: no white
flash on load. `prefers-reduced-motion` is honoured.

### Panels and state

Three panels — inspector, stage, library — plus the timeline. Both side panels can
be hidden from the top bar; the choice is remembered (`hmm:panels`), as is the
theme (`hmm:theme`). On first launch and narrow screens, the library folds away
rather than compressing the stage to nothing.

### JavaScript API

Everything the UI does goes through these objects, exposed for debugging and for
the AI assistant:

```js
window.editor.addShape('Rect');          // add a shape
window.editor.serializeProject();        // the JSON written by « Sauvegarder »
window.editor.generateExportJS('full');  // 'full' | 'js' | 'data'
window.editor.undo();                    // snapshot-based, 50 steps
window.editor.exportWebM(1920, 1080, 60, 10_000_000);
window.editor.timeline.seek(1.5);
window.HMMPresets.get('logoLockup');     // a preset by id
window.HMMPresets.categories;            // the library, for building a UI
```

### AI assistant (optional)

Six providers (Gemini, Claude, GPT, Grok, Mistral, Cohere). The model returns
strict JSON — `action: add | modify | replace` plus shapes and keyframes — which is
normalised before touching the scene: unknown curves are dropped, non-numeric
values rejected, and every edit is undoable.

The API key is yours; it is never stored. In the standalone app, `proxy.php`
relays the call (CORS). In the Astro app, `/api/ai` does it with a host allowlist.
Both refuse any target that is not one of the six known HTTPS endpoints — an open
relay is an SSRF hole, not a convenience.

### Motion control (optional)

A webcam panel moves the selected shape with hand motion. Detection is a
block-difference over a 320 × 240 frame (`MotionDetector`), not a neural model:
no download, no warm-up, and it degrades to nothing rather than to nonsense.

---

## Astro version

```bash
cd astro
npm ci             # exact versions from package-lock.json
npm run dev        # http://localhost:4321
npm run build      # node adapter, standalone
npm start
```

| Route | Content |
|---|---|
| `/` | marketing page |
| `/editor` | the full editor, engine copied by `sync` |
| `/api/health` | service status |
| `/api/ai` | AI relay (allowlisted hosts) |
| `/sitemap.xml` | sitemap |

Details, environment variables and the sync contract:
[`astro/README.md`](astro/README.md).

---

## Rust engine

Zero dependencies — its own JSON reader, its own writer, the same curves.

```bash
cd rust
./scripts/build.ps1        # Windows: MSVC if available, MinGW otherwise
./scripts/build.sh         # Linux / macOS

motion-cli inspect examples/sample.motion.json
motion-cli validate examples/sample.motion.json     # exit 1 on error
motion-cli render examples/sample.motion.json --at 1.2 -o frame.svg
motion-cli to-html examples/sample.motion.json -o animation.html
motion-cli serve .. --port 8787
```

`inspect` reports shapes, keyframes, distinct instants, the widest animated
property and the curves in use. `validate` catches duplicate ids, unknown shape
types, keyframes outside the duration, unknown curves, impossible opacity and
off-screen shapes. The SVG renderer approximates the canvas filters (blur, glow,
hue, saturation, brightness, contrast) and says so — see
[`rust/README.md`](rust/README.md) for the exact fidelity table.

47 tests, offline:

```bash
cargo test --offline
```

---

## Development notes

### Checks before committing

```bash
npm run check      # node scripts/check-web.mjs
```

No dependencies. It compiles the four scripts, verifies that every
`getElementById` in the engine resolves to an id in `index.html` (or is created at
runtime), checks CSS variables and brace balance, verifies every local asset
referenced by the page exists, and **runs every preset in a harness** to enforce
the lightness budget. A preset that grows to 200 shapes fails CI.

### Generated copies

`astro/public/assets/motion/`, `astro/public/manifest.webmanifest` and
`astro/src/generated/` are build products, ignored by Git. Edit `js/`, `css/`,
`img/`, `icons/` or `index.html`, then `npm run sync`.

### What CI runs

| Job | What it proves |
|---|---|
| *Moteur web* | `node scripts/check-web.mjs`: scripts compile, every id resolves, assets exist, every preset stays inside the budget. |
| *Build Astro* | `npm ci` (lockfile still matches `package.json`), `npm run build`, then the built server is booted and `/`, `/editor`, `/api/health`, `/sitemap.xml` and `/assets/motion/js/bundle.js` are fetched over HTTP. |
| *Moteur Rust* | `cargo test` offline, then `inspect` and `render` on the sample project. |

Locally, the same build: `cd astro && npm ci && npm run build && npm start`.

### Hosting in a subdirectory

Every path in `index.html` is relative (`css/style.css`, `js/bundle.js`,
`img/…`), and the manifest uses `start_url: "./"`. The app can be dropped into
`/motion/` on any static server without a rewrite. The Astro build is the
exception: it assumes it owns the root, and serves the engine from
`/assets/motion/`.

### Browser support

Chromium, Firefox and Safari, current versions. WebM capture needs
`MediaRecorder` and `canvas.captureStream`; without them, the editor says so and
points at the JS/HTML export instead of failing silently. Webcam control needs
`getUserMedia` and a secure context.

---

## Roadmap

- **Desktop build** (Tauri): the same engine, offline, with native file dialogs.
- **Offline PWA**: service worker precaching the engine (the manifest is ready).
- **Per-property curves in the timeline**: a curve editor per segment, not only
  the global selector.
- **Rust: video export** via a real encoder, to move beyond `MediaRecorder`’s 4K
  ceiling.

---

## Licence

MIT — see [LICENSE](LICENSE).

HOT MOTOR MOTION, its name and logo belong to Simon Dupont (zigmoon).

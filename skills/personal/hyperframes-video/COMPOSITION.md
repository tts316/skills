# Composition contract

The smallest renderable standalone `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body { margin: 0; background: #0b0f14; }
      #root {
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      #title { margin: 0; color: #f4f4f5; font-size: 96px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0"
         data-width="1920" data-height="1080" data-duration="5">
      <h1 id="title" class="clip" data-start="0" data-duration="5" data-track-index="0">
        Hello HyperFrames
      </h1>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#title", { y: 48, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.2);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
```

## What the runtime requires

- A root `<div>` with `data-composition-id`, `data-width`, `data-height`. Canvas size comes from those attributes — size `#root` with `width/height: 100%`, never hardcoded pixels.
- Render length is the root `data-duration`, not the timeline's length: a longer timeline is cut off, a shorter one holds its last frame.
- Any element with `data-start` + `data-duration` is a **clip**: the runtime shows it only inside that window. `class="clip"` is a layout convention; `data-track-index` is only a Studio display lane.
- **Exactly one** `gsap.timeline({ paused: true })`, registered at `window.__timelines["<data-composition-id>"]` after it is fully built. The runtime creates `window.__timelines`; don't initialise it.
- In the root composition, keep each clip a single top-level element (as `#title` above). A clip that wraps nested content triggers lint's `nested_structure_needs_subcomposition` warning — move that scene into a sub-composition.
- A top-level `index.html` root is **not** wrapped in `<template>` (lint error). Sub-compositions loaded via `data-composition-src` **are** wrapped in `<template>`, with their `<style>`/`<script>` inside the template.

## Lint gotchas that fail a first build

- Don't pair a CSS `transform` with a GSAP tween on the same property — set the start state in `gsap.fromTo` instead. Center with flex/`inset`, or `xPercent`/`yPercent`, not `translate(-50%,-50%)`.
- Never tween `display`, `visibility`, or `autoAlpha` on a `.clip` element; the framework owns clip visibility. Animate a child, or `opacity`.
- Don't add a scene-exit `tl.set(..., { visibility: "hidden" })` — clips already hide themselves.
- No `crossorigin` on `<video>`/`<audio>`.
- Every `<audio>` needs an `id`, or the render is silent.
- A `<video data-start>` must not sit inside another element that also has `data-start` — time the wrapper or the video, not both.
- A named CSS `font-family` needs an in-file `@font-face` pointing to a local font file; otherwise use a system stack.
- Keep every `id` unique across the assembled page (prefix sub-composition ids).
- No `<br>` in body text; transformed elements must be block-level and sized.

## Determinism

The render seeks frame by frame, so the composition must produce the same pixels for the same time:

- No `Date.now()`, `performance.now()`, unseeded `Math.random()`, network fetches at render time, or input/hover state.
- `repeat: -1` only under a finite root `data-duration`; otherwise use a finite repeat count.
- Media playback (`<video>`, `<audio>`) is owned by the framework — set `data-start`, `data-duration`, `data-media-start` and let it seek; never call `.play()`.

For anything beyond this (sub-compositions, variables, tracks, creator edit recipes), install the upstream contract: `npx hyperframes skills update hyperframes-core`.

---
name: hyperframes-video
description: Make, edit, and render videos from HTML with HeyGen's HyperFrames CLI (`npx hyperframes`). Use when the user wants to create a video, animation, motion graphic, title card, explainer, promo, captioned clip, or slideshow as code, render an HTML composition to MP4/WebM/GIF, or mentions HyperFrames.
---

# HyperFrames Video

HyperFrames **renders video from HTML**: a composition is an HTML file whose DOM declares timing with `data-*` attributes, whose animation (usually GSAP) is a single paused, seekable timeline, and whose render is headless Chrome + FFmpeg producing a deterministic MP4.

This skill is a thin wrapper over the `hyperframes` CLI. Run every command as `npx hyperframes …` (or the project's `package.json` scripts, which pin a version). Prefer `--json` on any command that offers it.

## 1. Preflight

```bash
node -v            # must be >= 22
ffmpeg -version    # must exist
npx hyperframes doctor
```

`doctor` marks optional extras (whisper-cpp, Kokoro TTS, MusicGen, Docker) with ✗ too, so its overall `ok` is often false on a machine that renders fine. Gate only on **Node.js, FFmpeg, FFprobe, and Chrome**; if one of those is missing, report exactly which and stop. If the user has no local toolchain, `npx hyperframes cloud render` renders on HeyGen's hosted infrastructure (needs `npx hyperframes auth`).

## 2. Pick the starting state

- **Existing project** (`hyperframes.json` or an `index.html` with `data-composition-id`): do only what was asked. Read the timeline with `npx hyperframes timeline --json` instead of reading every HTML file. Skip to step 4 for edits or step 6 for a render-only request.
- **Fresh video**: confirm the subject, length, aspect ratio, and any source assets (copy, logos, footage, music) if the user has not given them. One short round of questions, then build.

## 3. Scaffold

```bash
npx hyperframes init <project> --non-interactive --resolution=<landscape|portrait|square>
```

Add `-v <video>` or `-a <audio>` to start from existing footage or music (it transcribes speech for captions). Pass `--example=<name>` only when the user names an example.

## 4. Author the composition

Write `index.html` following [COMPOSITION.md](COMPOSITION.md) — the minimal contract and the lint gotchas that fail a first build. Before hand-writing a named effect (glitch, film grain, confetti, headline reveal…), search the local catalog and install a block if one fits:

```bash
npx hyperframes catalog --query "<the effect, in English>" --json
npx hyperframes add <name>
```

## 5. Validate

```bash
npx hyperframes lint      # fast loop while editing
npx hyperframes check     # final gate: lint + runtime + layout + contrast
npx hyperframes snapshot --at 1,3,5   # PNG frames to eyeball
```

Fix every `check` finding before going further. If `check` reports `request_failed … ERR_TUNNEL_CONNECTION_FAILED` (or any failed CDN load) followed by `Cannot read properties of undefined (reading 'timeline')`, headless Chrome can't reach the CDN — common behind a proxy or in a sandbox. Vendor the library into the project and point the `<script>` at it:

```bash
mkdir -p vendor && (cd vendor && npm pack gsap@3.14.2 --silent && tar xzf gsap-*.tgz && cp package/dist/gsap.min.js . && rm -rf package gsap-*.tgz)
# then: <script src="./vendor/gsap.min.js"></script>
```

 A lint **error** silently disables the layout/contrast audits (`0 sample(s)`), so a clean-looking `check` after a lint error means nothing ran. Look at the snapshots yourself — `check` cannot see whether the video looks right.

## 6. Preview, then render

Never render just because checks pass. When a human is around, open the Studio preview and wait for approval:

```bash
npx hyperframes preview --background   # hand the printed URL to the user
```

Then render:

| Need                         | Command                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Fast iteration               | `npx hyperframes render --quality draft -o renders/draft.mp4`        |
| First real encode (default)  | `npx hyperframes render --quality looks -o renders/out.mp4`          |
| Final delivery               | `npx hyperframes render --quality delivery -o renders/out.mp4`       |
| Transparent overlay          | `npx hyperframes render --format webm -o renders/overlay.webm`       |
| GIF for a PR or docs         | `npx hyperframes render --format gif --fps 15 -o renders/out.gif`    |
| One video per data row       | `npx hyperframes render --batch rows.json -o "renders/{name}.mp4"`   |
| No local Chrome/FFmpeg       | `npx hyperframes cloud render`                                       |

## 7. Verify the output

```bash
test -s renders/out.mp4
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate renders/out.mp4
```

Duration must match the root `data-duration`, size must match `data-width`/`data-height`. Report the output path, duration, and resolution to the user.

## Going deeper

HyperFrames ships its own, much larger skill set (workflows for product launches, PR explainers, captions, music videos, Remotion ports; domain skills for animation, audio, media, registry). When a request outgrows this wrapper, install them rather than reconstructing them from memory:

```bash
npx hyperframes skills update <skill-name>   # e.g. hyperframes-core, hyperframes-animation, media-use
npx hyperframes docs                          # inline CLI documentation
```

Docs: https://hyperframes.heygen.com — source: https://github.com/heygen-com/hyperframes

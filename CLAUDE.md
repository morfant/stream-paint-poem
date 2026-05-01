# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**"some-bodies are listening, too"** — an interactive audio-visual poem installation by Jiyeon Kim and Gangil Yi. It streams live radio audio (Jeju Georo station), visualizes the FFT spectrum as a scrolling "paint" effect, and overlays poetic text sentences that appear over time.

## Running the Project

No build step. Open `index.html` directly in a browser (Firefox or Chrome desktop only — Web Audio API + CORS streaming requires a browser with proper support). Serve with any static file server if CORS issues arise:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The site loads p5.js and p5.sound from CDN. No npm, no bundler.

## Architecture

Single-file sketch (`sketch.js`) using the p5.js library. All logic lives in standard p5.js lifecycle functions:

- `preload()` — loads sentence `.txt` files and fonts with cache-busting query strings
- `setup()` — creates canvas (maintaining `ASPECT_RATIO`), wires up Web Audio API graph manually (bypassing p5.sound's output for gain control), sets FFT input
- `draw()` — routes to either `drawStartScreen()` or the main visualization loop

**Audio graph (streaming mode):**
`Audio element` → `MediaElementSourceNode` → two branches:
1. `gainOut` → `destination` (controls output volume; fades in on start)
2. `gainFFT` → `p5.FFT` (separate tap for analysis, does not affect listening volume)

**Main visualization loop (per frame):**
1. `drawMainVisualization()` — draws tiny ellipses at current scan column `cnt` for each FFT band; advances `cnt` left-to-right across canvas width
2. `updateGraphPoints()` — tracks waveform peak sample
3. `drawGraphPoints()` — renders trailing waveform echo
4. `drawCurrentMessage()` — schedules and renders rotated text sentences at the scan position

**Sentence/text cycle:**
- First sentence appears after `FIRST_MESSAGE_DELAY_SEC` (60s)
- Subsequent sentences appear every `MESSAGE_INTERVAL_SEC` (10s)
- Each sentence renders for `MESSAGE_PRINT_FRAMES` frames (fades in via alpha)
- When all sentences shown once (`allMessagesShown = true`), the next full canvas sweep triggers `resetScene()` (full reset, new cycle)

**Language switching:** KOR/ENG buttons on start screen; clicking either button also calls `startAudio()` immediately. `lang` state determines which font is used (Korean regex test per-message at render time).

## Key Config Constants (top of sketch.js)

All user-tunable parameters are in the "사용자 조절 섹션" block at the top of `sketch.js`:

| Constant | Default | Purpose |
|---|---|---|
| `AUDIO_URL` | Jeju Georo stream | Streaming audio source |
| `USE_MIC_INPUT` | `false` | Switch to microphone input |
| `FIRST_MESSAGE_DELAY_SEC` | 60 | Seconds before first sentence |
| `MESSAGE_INTERVAL_SEC` | 10 | Seconds between sentences |
| `MSG_SIZE` | 30 | Text font size |
| `FFT_SMOOTHING` | 0.9 | FFT temporal smoothing |
| `ASPECT_RATIO` | 1280/512 | Canvas aspect ratio |

## Content Files

- `sentences_KOR.txt` — Korean poem text, one sentence per line (blank lines allowed)
- `sentences_ENG.txt` — English translation, parallel structure
- `fonts/` — AppleMyungjo (Korean), Times New Roman (English body), NotoSans variants

Lines are loaded with `loadStrings()`, which splits on newlines including blank lines — blank lines become empty strings that will be rendered as empty text slots.

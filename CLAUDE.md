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
- `setup()` — creates canvas (maintaining `ASPECT_RATIO`), wires up Web Audio API graph manually (bypassing p5.sound's output for gain control), sets FFT input, fetches weather
- `draw()` — routes to either `drawStartScreen()` or the main visualization loop

**Audio graph (streaming mode):**
`Audio element` → `MediaElementSourceNode` → two branches:
1. `gainOut` → `destination` (controls output volume; fades in on start)
2. `gainFFT` → `p5.FFT` (separate tap for analysis, does not affect listening volume)

**Live stream reconnect logic:**
- `audio.loop = false`, `audio.preload = "none"`, URL has `?t=Date.now()` cache-buster
- `ended` / `stalled` / `error` events trigger `scheduleReconnect()` with exponential backoff (1.5s base → 15s cap)
- Successful `playing` event resets backoff delay

**Main visualization loop (per frame):**
1. `drawMainVisualization()` — draws tiny ellipses at current scan column `cnt` for each FFT band; advances `cnt` left-to-right across canvas width
2. `updateGraphPoints()` — tracks waveform peak sample
3. `drawGraphPoints()` — renders trailing waveform echo
4. `drawCurrentMessage()` — schedules and renders rotated text sentences at the scan position

**Sentence/text cycle:**
- First sentence appears after `FIRST_MESSAGE_DELAY_SEC`
- Subsequent sentences appear every `MESSAGE_INTERVAL_SEC × lineCount` (blank lines in source file count as lines, contributing to display duration)
- Each sentence renders for `MESSAGE_PRINT_FRAMES` frames (fades in via alpha)
- When all sentences shown once (`allMessagesShown = true`), the next full canvas sweep triggers `resetScene()` (full reset, new cycle)
- Chunks are split on `/` delimiter in the `.txt` files; blank lines between chunks attach to the *following* chunk's lineCount — so the first chunk (no preceding blank line) has a shorter display time than all others

**Language switching:** KOR/ENG buttons on start screen; clicking either button also calls `startAudio()` immediately. `lang` state determines which font is used (Korean regex test per-message at render time).

**Subtitle (HTML overlay):**
- `subtitleEl` — `position: fixed` div, anchored by `top` to just below the canvas bottom (`updateSubtitlePosition()`)
- Font size scales with canvas width via `updateSubtitleFontSize()`, with `zoomFactor = devicePixelRatio / baseDevicePixelRatio` so browser zoom also scales the subtitle
- Both functions called in `setup()` and `windowResized()`

**Start screen:**
- Title, Korean subtitle, live weather condition, time/location line
- Weather: `weatherIconType` string (e.g. `Rain`, `Clear`) appended to the time line after `·  Jeju Island  ·`
- Time format: `May 30, 2026, 12:30 PM  ·  Jeju Island  ·  Rain`
- Custom p5.js weather icons exist in `drawWeatherIcon()` (6 types, animated) but are currently commented out in favor of text display

**Weather module (`weather-icons.js`):**
- Standalone p5.js module, drop-in for any project via `<script>` tag
- `WeatherIcons.draw(x, y, type, opts)` — draws animated icon centered at (x, y)
- `WeatherIcons.fromWMO(code)` — maps WMO weather code to type string
- `WeatherIcons.fetch(lat, lon, callback, intervalMin)` — fetches from Open-Meteo, auto-refreshes

## Key Config Constants (top of sketch.js)

All user-tunable parameters are in the "사용자 조절 섹션" block at the top of `sketch.js`:

| Constant | Default | Purpose |
|---|---|---|
| `AUDIO_URL` | Jeju Georo stream | Streaming audio source |
| `USE_MIC_INPUT` | `false` | Switch to microphone input |
| `FIRST_MESSAGE_DELAY_SEC` | 60 | Seconds before first sentence |
| `MESSAGE_INTERVAL_SEC` | 10 | Seconds between sentences (× lineCount) |
| `MSG_SIZE` | 30 | Text font size |
| `FFT_SMOOTHING` | 0.9 | FFT temporal smoothing |
| `ASPECT_RATIO` | 1280/512 | Canvas aspect ratio |
| `SUBTITLE_BASE_FONT_PX` | 25 | Subtitle font size at 1280px canvas width |
| `SHOW_SUBTITLE` | `true` | Toggle subtitle overlay |

## Content Files

- `sentences_KOR.txt` — Korean poem text; chunks delimited by `/`; blank lines between chunks affect display timing of the following chunk
- `sentences_ENG.txt` — English translation, parallel structure
- `fonts/` — AppleMyungjo (Korean), Times New Roman (English body), NotoSans variants
- `weather-icons.js` — reusable p5.js weather icon module (see Weather module above)

## Weather Data

Fetched from [Open-Meteo](https://open-meteo.com/) (free, no API key, CORS-friendly) using Jeju Georo coordinates (`lat: 33.499, lon: 126.531`). Refreshes every 10 minutes. Fails silently — weather line simply absent until first successful fetch. WMO weather codes mapped to 6 types: `clear`, `cloudy`, `rain`, `snow`, `fog`, `thunder`.

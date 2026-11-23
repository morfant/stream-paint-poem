# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**"some-bodies are listening, too"** — an interactive audio-visual poem installation by Jiyeon Kim and Gangil Yi. It streams live radio audio (Jeju Georo station), visualizes the FFT spectrum as a scrolling "paint" effect, and overlays poetic text sentences that appear over time.

## Running the Project

No build step, no tests, no linter. Serve the folder with a static server (opening `index.html` via `file://` fails because `loadStrings`/`loadFont` need HTTP). Desktop Firefox or Chrome — Web Audio API + CORS streaming:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The site loads p5.js and p5.sound 1.9.0 from CDN. No npm, no bundler. Remote: `github.com/morfant/stream-paint-poem`.

For quick testing, swap in the commented-out test values next to `FIRST_MESSAGE_DELAY_SEC` (5) and `MESSAGE_INTERVAL_SEC` (2) — revert before committing. `F` key toggles fullscreen (cursor hidden in fullscreen).

## Architecture

Single-file sketch (`sketch.js`) using the p5.js library. All logic lives in standard p5.js lifecycle functions:

- `preload()` — loads sentence `.txt` files and fonts with cache-busting query strings
- `setup()` — creates canvas (maintaining `ASPECT_RATIO`), wires up Web Audio API graph manually (bypassing p5.sound's output for gain control), sets FFT input, fetches weather
- `draw()` — routes to either `drawStartScreen()` or the main visualization loop

**Audio graph (streaming mode):**
[source] → two branches:
1. `gainOut` → `destination` (controls output volume; fades in on start)
2. `gainFFT` → `p5.FFT` (separate tap for analysis, does not affect listening volume)

Two source paths, chosen by `shouldUseStreamDecoder()`:
- **WebKit (Safari, every browser on iOS) → `StreamDecoder`** (`stream-decoder.js`). WebKit plays a live `<audio>` stream through `MediaElementSource` but the analyser gets only zeros (no visuals). So the stream is `fetch()`ed, split into MP3 frames, decoded with WebCodecs `AudioDecoder`, and played from an AudioWorklet ring buffer (resamples 44.1k→context rate, ~1.5s start buffer, own reconnect/stall logic). Falls back to the `<audio>` path if `AudioDecoder`/mp3 is unsupported. **Needs a secure context** (HTTPS or localhost) — on LAN `http://` it silently falls back and visuals stay black.
- **Desktop Chrome/Firefox → `<audio>` + `MediaElementSource`** (`setupMediaElementAudio()`, original path).
- Override with `?decoder=1` / `?decoder=0`. `test-decoder.html` is a bare test page (muted unless `?loud`).

**Small screens:** if canvas width < `DESIGN_W` (1280), the visualization is drawn in virtual 1280×512 coords (`VW`/`VH`) and scaled by `S`; the start screen is scaled around its center by `SS` (mouse hits go through `toStartCoords()`). Wide desktop screens get `S = 1`, i.e. unchanged. Use `VW`/`VH`, not `width`/`height`, inside visualization drawing code. `?nofs` skips the fullscreen request (also skipped where unsupported, e.g. iPhone).

**Live stream reconnect logic (`<audio>` path):**
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
- When all sentences shown once (`allMessagesShown = true`), the next sweep boundary clears any remaining text/subtitle and starts one **empty sweep** (`coolingDown = true`, no text); only when that empty sweep reaches the edge does `resetScene()` run (full reset, new cycle)
- Chunks are split on `/` delimiter in the `.txt` files; blank lines between chunks attach to the *following* chunk's lineCount — so the first chunk (no preceding blank line) has a shorter display time than all others

**Language switching:** KOR/ENG buttons on start screen; clicking either button also calls `startAudio()` immediately. `lang` selects the sentence set; font and size are chosen per message by a Hangul regex test at render time (Korean → `FONT_KO` × `MSG_SIZE_KOR_MUL`).

**Subtitle (HTML overlay):**
- `subtitleEl` — `position: fixed` div, anchored by `top` to just below the canvas bottom (`updateSubtitlePosition()`)
- Font size scales with canvas width via `updateSubtitleFontSize()`, with `zoomFactor = devicePixelRatio / baseDevicePixelRatio` so browser zoom also scales the subtitle
- Both functions called in `setup()` and `windowResized()`

**Start screen:**
- Title, Korean subtitle, live weather condition, time/location line
- Weather: `weatherIconType` string (e.g. `Rain`, `Clear`) appended to the time line after `·  Jeju Island  ·`; shows a `- - - - -` placeholder until the first fetch succeeds
- Time format: `May 30, 2026, 12:30 PM  ·  Jeju Island  ·  Rain`
- Custom p5.js weather icons exist in `drawWeatherIcon()` inside `sketch.js` (6 types, animated) but the call is commented out in favor of text display

**Weather module (`weather-icons.js`):**
- Standalone p5.js module, drop-in for any project via `<script>` tag — **not loaded by this project's `index.html`**; `sketch.js` has its own copy of the icon/WMO code. Edit `sketch.js` for changes to this piece
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
| `MESSAGE_INTERVAL_SEC` | 5 | Seconds per line of the current chunk (× lineCount) |
| `MSG_SIZE` | 31 | Text font size (English baseline) |
| `MSG_SIZE_KOR_MUL` | 0.8 | Korean text size multiplier |
| `FFT_SMOOTHING` | 0.9 | FFT temporal smoothing |
| `ASPECT_RATIO` | 1280/512 | Canvas aspect ratio |
| `SUBTITLE_BASE_FONT_PX` | 25 | Subtitle font size at 1280px canvas width |
| `SUBTITLE_KOR_MUL` / `SUBTITLE_ENG_MUL` | 0.9 / 1.0 | Per-language subtitle size multipliers |
| `SHOW_SUBTITLE` | `true` | Toggle subtitle overlay |

## Content Files

- `sentences_KOR.txt` — Korean poem text; chunks delimited by `/`; blank lines between chunks affect display timing of the following chunk
- `sentences_ENG.txt` — English translation, parallel structure (chunk counts need not match; each language cycles on its own)
- `sentences_ENG_backup.txt` — untracked older copy, not loaded
- `fonts/` — original fonts (AppleMyungjo 18.7MB, Times New Roman, NotoSansKR-Thin, …). **Not loaded by the site.**
- `fonts/web/` — subset fonts the site actually loads (~450KB total), containing only the glyphs found in `sentences_*.txt`, `sketch.js`, `index.html` plus basic Latin/punctuation. Generated by `python3 tools/subset_fonts.py` (`--check` = report missing glyphs only, exit 1 if any; needs `pip install fonttools`). The GitHub Action `.github/workflows/subset-fonts.yml` regenerates and auto-commits `[auto] 웹 폰트 서브셋 갱신` on any push touching those files — so after a text edit, `git pull` before the next local commit. Output is deterministic (no churn commits). A glyph missing from the subset falls back to another typeface until regenerated.
- `weather-icons.js` — reusable p5.js weather icon module (see Weather module above)

## Weather Data

Fetched from [Open-Meteo](https://open-meteo.com/) (free, no API key, CORS-friendly) using Jeju Georo coordinates (`lat: 33.499, lon: 126.531`). Refreshes every 10 minutes. Fails silently — the dash placeholder stays until a fetch succeeds. WMO weather codes mapped to 6 types: `clear`, `cloudy`, `rain`, `snow`, `fog`, `thunder`.

## Parent folder (`../`, not in git)

Exhibition materials for 웨더리포트 2025 〈누군가 듣고 있어〉: the Korean text PDF, edited venue photos (`전시장사진보정_최종/`), and `QR_Generator.py` (makes a QR to the Mixcloud page; needs `pip install qrcode[pil]`).

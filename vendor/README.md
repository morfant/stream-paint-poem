# vendor

- `mpg123-decoder.min.js` — [mpg123-decoder](https://www.npmjs.com/package/mpg123-decoder) 1.0.3 (`dist/`), from [eshaz/wasm-audio-decoders](https://github.com/eshaz/wasm-audio-decoders).
  WebAssembly MP3 decoder. Package license MIT; it contains libmpg123 (LGPL-2.1).
  Loaded by `stream-decoder.js` **only** on browsers without WebCodecs MP3 `AudioDecoder` (e.g. iPad Safari on iPadOS 18.7, which lacks `AudioDecoder`).

- `keepawake.mp4` — 16×16 black, 2 s, no audio (1.5 KB), made with ffmpeg in this repo. Played muted/looping/invisible only when the Screen Wake Lock API is missing or refused (e.g. iPad Chrome), because iOS keeps the screen on while a video plays.

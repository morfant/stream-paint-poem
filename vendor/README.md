# vendor

- `mpg123-decoder.min.js` — [mpg123-decoder](https://www.npmjs.com/package/mpg123-decoder) 1.0.3 (`dist/`), from [eshaz/wasm-audio-decoders](https://github.com/eshaz/wasm-audio-decoders).
  WebAssembly MP3 decoder. Package license MIT; it contains libmpg123 (LGPL-2.1).
  Loaded by `stream-decoder.js` **only** on browsers without WebCodecs MP3 `AudioDecoder` (e.g. iPad Safari on iPadOS 18.7, which lacks `AudioDecoder`).

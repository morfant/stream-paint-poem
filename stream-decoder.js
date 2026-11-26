/**********************
 * StreamDecoder — 라이브 MP3 스트림을 직접 받아 디코딩해 Web Audio로 재생
 *
 * 왜 필요한가: WebKit(Safari, iOS의 모든 브라우저)에서는 <audio> 라이브 스트림을
 * createMediaElementSource로 연결하면 소리는 나지만 분석값(FFT)이 0만 나온다.
 * 그래서 fetch()로 바이트를 받아 MP3 프레임을 잘라 WebCodecs AudioDecoder로 디코딩하고,
 * AudioWorklet 링 버퍼로 재생한다. 소리와 분석이 같은 경로를 지나므로 분석값이 나온다.
 *
 * 사용:
 *   const sd = new StreamDecoder(audioContext, url);
 *   await sd.init();            // 워클릿 로드
 *   sd.output.connect(node);    // 출력 노드(스테레오)
 *   sd.start();                 // 사용자 제스처 안에서 호출 권장
 *   StreamDecoder.isSupported() // AudioDecoder + mp3 + AudioWorklet 지원 여부(Promise<boolean>)
 **********************/

(function (global) {
    // ---- 워클릿: 링 버퍼 + 연속 선형 보간 리샘플러 (청크 경계에서 끊김 없음) ----
    const WORKLET_SRC = `
class StreamDecoderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.size = Math.ceil((o.ringSec || 20) * 48000);
    this.L = new Float32Array(this.size);
    this.R = new Float32Array(this.size);
    this.w = 0;              // 누적 쓰기 위치(소스 샘플)
    this.r = 0;              // 누적 읽기 위치(소스 샘플, 소수)
    this.srcRate = sampleRate;
    this.startSec = o.startSec || 1.5;   // 처음/버퍼 고갈 후 이만큼 쌓이면 재생
    this.maxSec = o.maxSec || 8;         // 이보다 많이 쌓이면 오래된 부분 버림(지연 누적 방지)
    this.playing = false;
    this.underruns = 0;
    this.reportEvery = Math.round(sampleRate / 128 / 2); // 약 0.5초마다 상태 보고
    this.blocks = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'pcm') {
        this.srcRate = d.sampleRate;
        const l = d.l, rr = d.r || d.l, n = l.length;
        for (let i = 0; i < n; i++) {
          const k = (this.w + i) % this.size;
          this.L[k] = l[i]; this.R[k] = rr[i];
        }
        this.w += n;
        const avail = this.w - this.r;
        if (avail > this.size - 1) this.r = this.w - (this.size - 1);
        const maxFrames = this.maxSec * this.srcRate;
        if (avail > maxFrames) this.r = this.w - this.startSec * this.srcRate;
      } else if (d.type === 'flush') {
        this.r = this.w; this.playing = false;
      }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    const oL = out[0], oR = out[1] || out[0];
    const step = this.srcRate / sampleRate;
    const avail = this.w - this.r;
    if (!this.playing && avail >= this.startSec * this.srcRate) this.playing = true;
    for (let i = 0; i < oL.length; i++) {
      if (this.playing && this.w - this.r > 2) {
        const i0 = Math.floor(this.r), f = this.r - i0;
        const a = i0 % this.size, b = (i0 + 1) % this.size;
        oL[i] = this.L[a] + (this.L[b] - this.L[a]) * f;
        oR[i] = this.R[a] + (this.R[b] - this.R[a]) * f;
        this.r += step;
      } else {
        if (this.playing) { this.playing = false; this.underruns++; }
        oL[i] = 0; oR[i] = 0;
      }
    }
    if (++this.blocks >= this.reportEvery) {
      this.blocks = 0;
      this.port.postMessage({ type: 'status', bufferedSec: (this.w - this.r) / this.srcRate, playing: this.playing, underruns: this.underruns });
    }
    return true;
  }
}
registerProcessor('stream-decoder-processor', StreamDecoderProcessor);
`;

    // ---- MP3 프레임 헤더 파싱 ----
    const BR_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const BR_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const SR_V1 = [44100, 48000, 32000];

    function parseHeader(b, i) {
        if (b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) return null;
        const ver = (b[i + 1] >> 3) & 3;      // 0=2.5, 2=MPEG2, 3=MPEG1
        const layer = (b[i + 1] >> 1) & 3;    // 1=Layer III
        if (ver === 1 || layer !== 1) return null;
        const bri = (b[i + 2] >> 4) & 15, sri = (b[i + 2] >> 2) & 3;
        if (bri === 0 || bri === 15 || sri === 3) return null;
        const pad = (b[i + 2] >> 1) & 1;
        const mono = ((b[i + 3] >> 6) & 3) === 3;
        const v1 = ver === 3;
        const kbps = (v1 ? BR_V1_L3 : BR_V2_L3)[bri];
        const sr = SR_V1[sri] / (v1 ? 1 : ver === 2 ? 2 : 4);
        const len = Math.floor((v1 ? 144 : 72) * kbps * 1000 / sr) + pad;
        return { len, sr, ch: mono ? 1 : 2, samples: v1 ? 1152 : 576 };
    }

    // WebCodecs가 없을 때 쓸 WebAssembly MP3 디코더 (필요할 때만 불러옴)
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = src; el.async = true;
            el.onload = resolve; el.onerror = () => reject(new Error('load fail ' + src));
            document.head.appendChild(el);
        });
    }

    class StreamDecoder {
        // 브라우저 내장 MP3 디코더(WebCodecs AudioDecoder) 지원 여부
        static async hasWebCodecsMp3() {
            if (typeof AudioDecoder === 'undefined') return false;
            try {
                const r = await AudioDecoder.isConfigSupported({ codec: 'mp3', sampleRate: 44100, numberOfChannels: 2 });
                return !!r.supported;
            } catch (e) { return false; }
        }

        // 쓸 수 있는가: AudioWorklet + (WebCodecs 또는 WebAssembly 디코더)
        static async isSupported() {
            if (typeof AudioWorkletNode === 'undefined') return false;
            if (await StreamDecoder.hasWebCodecsMp3()) return true;
            return typeof WebAssembly === 'object';
        }

        constructor(ctx, url, opts = {}) {
            this.ctx = ctx;
            this.url = url;
            this.opts = Object.assign({ startSec: 1.5, maxSec: 8, reconnectBaseMs: 1500, reconnectMaxMs: 15000, stallMs: 10000,
                wasmUrl: 'vendor/mpg123-decoder.min.js' }, opts);
            this.output = null;
            this.status = { bufferedSec: 0, playing: false, underruns: 0, connected: false, reconnects: 0 };
            this.running = false;
        }

        async init() {
            // 디코더 선택: 내장(WebCodecs) 우선, 없으면 WebAssembly(mpg123)
            this.backend = (!this.opts.forceWasm && await StreamDecoder.hasWebCodecsMp3()) ? 'webcodecs' : 'wasm';
            if (this.backend === 'wasm') {
                if (!(window['mpg123-decoder'] && window['mpg123-decoder'].MPEGDecoder)) await loadScript(this.opts.wasmUrl);
                this.wasm = new window['mpg123-decoder'].MPEGDecoder();
                await this.wasm.ready;
            }
            this.status.backend = this.backend;
            const blobUrl = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
            await this.ctx.audioWorklet.addModule(blobUrl);
            URL.revokeObjectURL(blobUrl);
            this.node = new AudioWorkletNode(this.ctx, 'stream-decoder-processor', {
                numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
                processorOptions: { startSec: this.opts.startSec, maxSec: this.opts.maxSec, ringSec: 20 },
            });
            this.node.port.onmessage = (e) => {
                if (e.data.type === 'status') {
                    const was = this.status.playing;
                    Object.assign(this.status, e.data);
                    // 실제로 소리가 나오기 시작한 순간 알림 (페이드인 시작 시점용)
                    if (!was && this.status.playing && this.onplaying) this.onplaying();
                }
            };
            this.output = this.node;
        }

        start() {
            if (this.running) return;
            this.running = true;
            this.reconnectDelay = this.opts.reconnectBaseMs;
            this._connect();
        }

        stop() {
            this.running = false;
            clearTimeout(this._reconnectTimer);
            this._teardown();
            if (this.node) this.node.port.postMessage({ type: 'flush' });
        }

        _teardown() {
            clearInterval(this._stallTimer);
            if (this.abort) { try { this.abort.abort(); } catch (e) {} this.abort = null; }
            if (this.decoder && this.decoder.state !== 'closed') { try { this.decoder.close(); } catch (e) {} }
            this.decoder = null;
            this.status.connected = false;
        }

        _scheduleReconnect() {
            if (!this.running || this._reconnectTimer) return;
            this._teardown();
            this._reconnectTimer = setTimeout(() => {
                this._reconnectTimer = null;
                this.status.reconnects++;
                this._connect();
            }, this.reconnectDelay);
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.opts.reconnectMaxMs);
        }

        _makeDecoder(sr, ch) {
            if (this.decoder && this.decoder.state !== 'closed') { try { this.decoder.close(); } catch (e) {} }
            this.decoder = new AudioDecoder({
                output: (ad) => this._onAudioData(ad),
                error: () => this._scheduleReconnect(),
            });
            this.decoder.configure({ codec: 'mp3', sampleRate: sr, numberOfChannels: ch });
            this.cfg = { sr, ch };
        }

        _onAudioData(ad) {
            // 컨텍스트가 멈춰 있으면(iOS 잠금·전화·제스처 대기) 워클릿이 소비하지 못하므로 버린다 → 메모리 누적 방지
            if (this.ctx.state !== 'running') { ad.close(); this.status.dropped = (this.status.dropped || 0) + 1; return; }
            try {
                const n = ad.numberOfFrames, chs = ad.numberOfChannels;
                const l = new Float32Array(n);
                ad.copyTo(l, { planeIndex: 0, format: 'f32-planar' });
                let r = null;
                if (chs > 1) { r = new Float32Array(n); ad.copyTo(r, { planeIndex: 1, format: 'f32-planar' }); }
                const msg = { type: 'pcm', sampleRate: ad.sampleRate, l, r };
                this.node.port.postMessage(msg, r ? [l.buffer, r.buffer] : [l.buffer]);
            } finally {
                ad.close();
            }
        }

        // WebAssembly 디코더로 프레임 묶음 디코딩 → 워클릿으로
        _decodeWasm(frames) {
            if (!frames.length) return;
            let n = 0; for (const f of frames) n += f.length;
            const bytes = new Uint8Array(n);
            let o = 0; for (const f of frames) { bytes.set(f, o); o += f.length; }
            const { channelData, samplesDecoded, sampleRate } = this.wasm.decode(bytes);
            if (!samplesDecoded) return;
            if (this.ctx.state !== 'running') { this.status.dropped = (this.status.dropped || 0) + 1; return; }
            const l = channelData[0].slice(0, samplesDecoded);
            const r = channelData[1] ? channelData[1].slice(0, samplesDecoded) : null;
            this.node.port.postMessage({ type: 'pcm', sampleRate, l, r }, r ? [l.buffer, r.buffer] : [l.buffer]);
        }

        async _connect() {
            const abort = new AbortController();
            this.abort = abort;
            if (this.backend === 'wasm') { try { await this.wasm.reset(); } catch (e) {} }   // 새 연결 = 새 스트림
            let pending = new Uint8Array(0);
            let ts = 0;
            let synced = false;
            let lastData = performance.now();

            this._stallTimer = setInterval(() => {
                if (performance.now() - lastData > this.opts.stallMs) this._scheduleReconnect();
            }, 1000);

            try {
                const sep = this.url.includes('?') ? '&' : '?';
                const res = await fetch(`${this.url}${sep}t=${Date.now()}`, { signal: abort.signal, cache: 'no-store' });
                if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
                this.status.connected = true;
                const reader = res.body.getReader();

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (abort.signal.aborted) return;
                    lastData = performance.now();
                    this.reconnectDelay = this.opts.reconnectBaseMs;

                    // 남은 바이트 + 새 바이트
                    const buf = new Uint8Array(pending.length + value.length);
                    buf.set(pending, 0); buf.set(value, pending.length);

                    let i = 0;
                    const wasmFrames = [];
                    while (i + 4 <= buf.length) {
                        const h = parseHeader(buf, i);
                        if (!h) { i++; synced = false; continue; }
                        if (!synced) {
                            // 잘못된 동기 방지: 다음 프레임 헤더까지 확인되어야 동기
                            if (i + h.len + 4 > buf.length) break;
                            if (!parseHeader(buf, i + h.len)) { i++; continue; }
                            synced = true;
                        }
                        if (i + h.len > buf.length) break;
                        if (this.backend === 'wasm') {
                            wasmFrames.push(buf.subarray(i, i + h.len));
                            i += h.len;
                            continue;
                        }
                        if (!this.decoder || this.decoder.state === 'closed' || !this.cfg || this.cfg.sr !== h.sr || this.cfg.ch !== h.ch) {
                            this._makeDecoder(h.sr, h.ch);
                        }
                        this.decoder.decode(new EncodedAudioChunk({
                            type: 'key', timestamp: ts, data: buf.subarray(i, i + h.len),
                        }));
                        ts += Math.round(h.samples * 1e6 / h.sr);
                        i += h.len;
                    }
                    if (this.backend === 'wasm') this._decodeWasm(wasmFrames);
                    pending = buf.slice(i);
                }
                // 스트림이 끝남(서버가 닫음) → 재연결
                if (this.abort === abort) this._scheduleReconnect();
            } catch (e) {
                if (this.abort === abort) this._scheduleReconnect();
            }
        }
    }

    global.StreamDecoder = StreamDecoder;
})(window);

/**********************
 * 사용자 조절 섹션 (Config)
 **********************/

// ■ 화면/렌더링
let FPS = 30;                         // 프레임레이트
let ASPECT_RATIO = 1280 / 512;        // 캔버스 가로:세로 비율
let BG_COLOR = 0;                     // 배경색 (0=검정, 255=흰색 등)

// ■ 오디오 입력/분석
let USE_MIC_INPUT = false;            // true면 마이크, false면 스트리밍 오디오 사용
let MIC_GAIN = 0.1;                   // 마이크 입력 게인(증폭) 값
let AUDIO_URL = "https://locus.creacast.com:9443/jeju_georo.mp3";  // 스트리밍 소스 URL
let FFT_SMOOTHING = 0.9;              // FFT 스무딩(0.0~1.0): 클수록 부드럽게
let FFT_BANDS = 1024;                 // FFT 해상도 (파형 샘플 수)

// ■ 시각화
let VISUALIZE_MODE = 0;               // 모드 전환용 (필요시 확장)
let VISUALIZE_INTENSITY_MUL = 1.0;    // 시각화 강도 전체 스케일(가로폭과 곱해짐)
let GRAPH_POINT_UPDATE_INTERVAL = 1;  // 그래프 포인트 업데이트 간격(프레임 단위)

// ■ 색상(알파 포함)
let DOT_COLOR = [0, 100, 200, 50];    // 메인 점 색상 RGBA
let DOT_TOP_COLOR = [0, 100, 200, 10];// 위쪽(잔상/그림자) 색상 RGBA

// ■ 텍스트 표시 타이밍
let FIRST_MESSAGE_DELAY_SEC = 60;     // 첫 문장 지연(초)
// let FIRST_MESSAGE_DELAY_SEC = 5;     // 첫 문장 지연(초) for Test

let MESSAGE_INTERVAL_SEC = 5;         // chunk 한 줄당 노출 시간(초)
// let MESSAGE_INTERVAL_SEC = 2;         // chunk 한 줄당 노출 시간(초)

let MESSAGE_PRINT_FRAMES = 30;        // 문장 보여주는 프레임 수 (FPS 기반)

// ■ 오디오 페이드
let START_FADE_IN_MS = 8000;          // 최초/리셋 시 오디오 페이드인 시간(ms)
let FFT_TAP_GAIN = 0.5;               // FFT 분석용 테핑 게인(듣기 음량과 별개)
let OUTPUT_START_GAIN = 0.0;          // 출력 게인 시작 값(무음 권장)
let ENABLE_FADE_IN_ON_RESET = false;  // 리셋 때도 페이드인을 적용할지

// ■ 자막
let SHOW_SUBTITLE = true;             // 자막 표시 여부 (true/false)
let SUBTITLE_DELAY_SEC = 0.8;         // 메인 텍스트 등장 후 자막 딜레이(초)
let SUBTITLE_COLOR = 'rgba(255, 255, 255, 0.5)'; // 자막 색 (예: 'white', 'rgba(255,255,255,0.7)')
let SUBTITLE_BASE_FONT_PX = 25;       // 디자인 기준 너비(1280)에서의 자막 폰트 크기(px)
let SUBTITLE_KOR_MUL = 0.9;           // 한글 자막 크기 배율
let SUBTITLE_ENG_MUL = 1.0;           // 영어 자막 크기 배율
let SUBTITLE_MIN_FONT_PX = 12;        // 작은 화면(모바일)에서 자막 최소 크기(px)
let SUBTITLE_RESERVE_LINES = 2;       // 캔버스 아래 여백이 이 줄 수보다 좁으면(폰 가로) 캔버스를 줄여 자막 자리 확보

// ■ 작은 화면 대응
let DESIGN_W = 1280;                  // 캔버스가 이보다 좁으면 이 폭 기준으로 그린 뒤 축소 (넓으면 그대로)
// 메뉴(시작) 화면 글씨·간격 기본값(px, 넓은 데스크톱 기준). 화면이 designW×designH보다 작으면 비율로 줄이되 최소 크기는 지킴
let START_BASE = {
    designW: 900, designH: 760,
    title: 40, titleKo: 36, date: 28, btnW: 120, btnH: 48, btnText: 26, note: 19, noteKo: 17, email: 19,
    gapTitle: 14, gapAfterTitles: 110, gapBeforeButtons: 34, gapAfterButtons: 40,
};

// ■ 폰트/텍스트 리소스
let MSG_SIZE = 31;
let MSG_SIZE_KOR_MUL = 0.8;   // 한글 메시지 크기 배율 (영어 대비). 1=동일, <1=한글 작게
let SENTENCES_FILE_KOR = "sentences_KOR.txt";
let SENTENCES_FILE_ENG = "sentences_ENG.txt";
let FONT_KO = "fonts/web/AppleMyungjo.ttf";       // 웹용 서브셋 (tools/subset_fonts.py 로 생성)
let FONT_EN = "fonts/web/Times New Roman.ttf";
let FONT_EN_THIN = "fonts/web/NotoSansKR-Thin.otf";

/**********************
 * 내부 상태/런타임 변수 (수정 비권장)
 **********************/

let audio, mic, fft, source, gainOut, gainFFT;
let streamDecoder = null;   // WebKit용 직접 디코딩 경로 (stream-decoder.js)
let audioReady = Promise.resolve();
let spectrum = [];
let cnt = 0;
let points = [];
let radius = [];
let started = false;
let visualizeMul;
let theBlue, theBlueTop;

let startTime;
let lastMessageFrame = -1000;
let lastMessageX = null;
let currentMessage = "";

let sentences = [];
let sentencesKOR = [];
let sentencesENG = [];
let lang = "KOR";           // 기본값
let sentenceIndex = 0;
let jitterAngle = 0;
let loopCount = 0;

let koreanFont, englishFont, englishFont2;
let assetsReady = false;    // 텍스트·폰트 로드 완료 (loadAssets)
let graphPoints = [];

let fadeOutCounter = 0;

let canvas;

let messageCount = 0;          // 출력된 문장 수
let allMessagesShown = false;  // 모든 문장 1회 출력 완료 여부
let coolingDown = false;       // 마지막 문장 후 "텍스트 없는 스윕" 진행 중 여부
let cycleStartMillis = 0;      // 사이클 기준 타이머

let subtitleMessage = "";
let subtitleEl;
let subtitleTimeout = null;
let baseDevicePixelRatio = 1; // 브라우저 줌 감지용 기준값

// 작은 화면 축소 배율: 시각화는 S(가상 크기 VW×VH)
let S = 1, VW = 0, VH = 0;
let canvasTop = 0;            // 캔버스 위쪽 위치(px) — 자막 위치 기준

let weatherIconType = null;   // 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder'
let weatherTempC = null;

let copyrightEl;
let exitBtnEl;
let fullscreenPending = false;
let fsBtnEl;                 // × 옆 '전체화면 다시 들어가기' 버튼 (전체화면이 아닐 때만)
// 전체화면을 쓸 수 없는 브라우저 → 요청·버튼 생략.
// iPad Firefox는 requestFullscreen을 자체 JS로 바꿔 '페이지의 <video>를 전체화면'으로 처리함 →
// 화면 켜 두기용 무음 동영상이 전체화면으로 떠 버림. 내장(native) 함수가 아니면 지원 안 함으로 본다.
let fullscreenBroken = (() => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    return !!req && !/\[native code\]/.test(Function.prototype.toString.call(req));
})();   // 터치 기기: 시작 탭의 touchend에서 전체화면 요청   // 작품 중 메뉴로 돌아가는 × 버튼


let isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;   // 마우스 hover 효과는 터치 기기에서 끔

let ui = {
    kor: null,
    eng: null
    // langLabel: null // (optional, add if you want to reference a label area)
};

function preload() {
    bootLog('preload');
    // 텍스트·폰트는 여기서 불러오지 않는다: p5 preload는 파일 하나만 실패해도 setup으로 넘어가지 않아
    // 화면이 영원히 검게 남는다. 대신 setup에서 loadAssets()가 재시도하며 불러온다.
}

// 텍스트·폰트 불러오기 (실패하면 점점 늦춰 가며 무한 재시도, 다 되면 assetsReady = true)
function loadAssets() {
    const retry = (name, fn) => new Promise((resolve) => {
        let n = 0;
        const attempt = () => {
            n++;
            fn().then((v) => { bootLog('loaded ' + name + (n > 1 ? ' (try ' + n + ')' : '')); resolve(v); })
                .catch((e) => {
                    bootLog('FAIL ' + name + ' try ' + n + ': ' + (e && (e.message || e.type) || e));
                    setTimeout(attempt, Math.min(5000, 700 * n));
                });
        };
        attempt();
    });
    const text = (file) => retry(file, () =>
        fetch(`${file}?${Date.now()}`, { cache: 'no-store' }).then((r) => {   // 캐시 회피
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }));
    const font = (path) => retry(path.split('/').pop(), () => new Promise((res, rej) => loadFont(path, res, rej)));
    // '/' 기준으로 chunk 분리 (chunk 원본 보존 - 빈 줄까지 라인 카운트용)
    const chunks = (t) => t.split(/\r?\n/).join('\n').split('/').filter(s => s.trim().length > 0);

    return Promise.all([
        text(SENTENCES_FILE_KOR), text(SENTENCES_FILE_ENG),
        font(FONT_KO), font(FONT_EN), font(FONT_EN_THIN),
    ]).then(([kor, eng, fKo, fEn, fEnThin]) => {
        sentencesKOR = chunks(kor);
        sentencesENG = chunks(eng);
        sentences = lang === 'ENG' ? sentencesENG : sentencesKOR;
        koreanFont = fKo; englishFont = fEn; englishFont2 = fEnThin;
        assetsReady = true;
        bootLog('assets ready');
    });
}

function setup() {
    bootLog('setup start');
    loadAssets();
    getAudioContext().addEventListener('statechange', () => bootLog('ctx ' + getAudioContext().state));

    // iOS: 소리 허용(사용자 활성화)은 touchstart가 아니라 touchend/click 에서만 인정된다.
    // 시작 화면은 touchStarted에서 넘어가지만, 오디오 컨텍스트 재개는 여기서(손을 뗄 때) 한다.
    // 시작 후에도 계속 걸어 두어 전화·알림 등으로 끊긴 오디오를 탭 한 번으로 되살린다.
    const unlockAudio = (ev) => {
        const c = getAudioContext();
        if (c.state !== 'running') c.resume().then(() => bootLog('unlock → ' + c.state));
        // 화면 켜 두기를 전체화면보다 먼저: Safari는 한 번의 탭(사용자 동작)을 권한이 필요한 요청 하나에만 쓰게 해서
        // 전체화면을 먼저 요청하면 화면 켜 두기가 거절됨 (iPad Safari에서 확인)
        if (started) requestWakeLock();
        if (started && fullscreenPending) requestFullscreenNow(ev.type);   // 시작 탭의 손 뗄 때(실패하면 이어지는 click에서 한 번 더)
        if (started && audio && audio.paused) audio.play().catch(() => {});
    };
    document.addEventListener('touchend', unlockAudio, true);
    document.addEventListener('click', unlockAudio, true);

    // 비율 유지 크기 계산 (+ 자막 자리 확보)
    const lay = computeCanvasLayout();

    baseDevicePixelRatio = window.devicePixelRatio || 1; // 초기 줌 기준값 저장

    canvas = createCanvas(lay.w, lay.h);
    canvas.position(lay.x, lay.y);
    canvasTop = lay.y;
    canvas.style('display', 'block');
    background(BG_COLOR);

    noStroke();
    frameRate(FPS);

    updateScale();
    fft = new p5.FFT(FFT_SMOOTHING, FFT_BANDS);

    theBlue = color(...DOT_COLOR);
    theBlueTop = color(...DOT_TOP_COLOR);

    graphPoints.push({ x: 0, y: 6 });

    if (USE_MIC_INPUT) {
        mic = new p5.AudioIn();
        mic.start(() => {
            let context = getAudioContext();
            let micSource = context.createMediaStreamSource(mic.stream);
            let micGain = context.createGain();
            micGain.gain.value = MIC_GAIN;
            micSource.connect(micGain);
            fft.setInput(micGain);
        });
    } else {
        // 출력/분석 공용 노드: [소스] → gainOut → 스피커, [소스] → gainFFT → FFT
        let context = getAudioContext();
        gainOut = context.createGain();
        gainOut.gain.value = OUTPUT_START_GAIN;
        gainOut.connect(context.destination);

        gainFFT = context.createGain();
        gainFFT.gain.value = FFT_TAP_GAIN;
        fft.setInput(gainFFT);

        // WebKit(Safari, iOS 모든 브라우저)은 <audio> 스트림 분석값이 0 → 직접 디코딩 경로 사용
        if (shouldUseStreamDecoder()) {
            audioReady = StreamDecoder.isSupported().then(async (ok) => {
                bootLog('decoder supported: ' + ok);
                if (!ok) { setupMediaElementAudio(context); return; } // 구형 브라우저: 기존 방식
                streamDecoder = new StreamDecoder(context, AUDIO_URL, { forceWasm: new URLSearchParams(location.search).get('decoder') === 'wasm' });
                await streamDecoder.init();
                bootLog('decoder ready (' + streamDecoder.backend + ')');
                streamDecoder.onplaying = onStreamPlaying;
                streamDecoder.output.connect(gainOut);
                streamDecoder.output.connect(gainFFT);
            }).catch((e) => { bootLog('decoder init fail: ' + e); if (!streamDecoder && !audio) setupMediaElementAudio(context); });
        } else {
            setupMediaElementAudio(context);
            audioReady = Promise.resolve();
        }
    }

    sentences = sentencesKOR;

    fetchWeather();
    setInterval(fetchWeather, 10 * 60 * 1000); // 10분마다 갱신

    subtitleEl = createElement('div', '');
    subtitleEl.style('position', 'fixed');
    subtitleEl.style('left', '0');
    subtitleEl.style('width', '100%');
    subtitleEl.style('text-align', 'center');
    subtitleEl.style('color', SUBTITLE_COLOR);
    subtitleEl.style('line-height', '1.3');
    updateSubtitleFontSize();
    updateSubtitlePosition();
    subtitleEl.style('pointer-events', 'none');
    if (!SHOW_SUBTITLE) subtitleEl.style('display', 'none');

    // 저작권 줄, 그 아래 줄에 아이콘들: 편지봉투(메일) · 공유 모양(홈 화면에 추가 — 휴대폰·태블릿, 홈 화면 앱이 아닐 때만)
    const SHARE_SVG = '<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3.5v11M8.2 7.2 12 3.5l3.8 3.7"/><path d="M8.5 10.5H6v10h12v-10h-2.5"/></svg>';
    const ICON_BTN = 'pointer-events:auto;color:inherit;background:none;border:none;display:inline-flex;align-items:center;padding:0.45em;cursor:pointer;font:inherit';
    copyrightEl = createElement('div',
        '<span>© 2025 - 2026 Weather Report</span>' +
        '<div style="display:flex;justify-content:center;align-items:center;gap:0.4em;margin-top:0.15em">' +
        '<a href="mailto:weatherreport.live@gmail.com" aria-label="Email weatherreport.live@gmail.com" title="weatherreport.live@gmail.com" style="' + ICON_BTN + '">' +
        '<svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">' +
        '<rect x="3" y="5.5" width="18" height="13" rx="1.2"/><path d="M3.6 6.4 12 12.8l8.4-6.4"/></svg></a>' +
        '<button class="a2hs" aria-label="Add to Home Screen" title="Add to Home Screen" style="' + ICON_BTN + ';display:none">' + SHARE_SVG + '</button>' +
        '</div>');
    copyrightEl.style('display', 'flex');
    copyrightEl.style('flex-direction', 'column');
    copyrightEl.style('align-items', 'center');
    setupAddToHomeScreen();

    exitBtnEl = createElement('button',
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
        '<path d="M19 12H5M11 6l-6 6 6 6" stroke-linejoin="round"/></svg>');   // ← (Chrome 전체화면의 ×와 구분)
    exitBtnEl.attribute('aria-label', 'Back to menu');
    exitBtnEl.attribute('title', 'Back to menu');
    exitBtnEl.style('position', 'fixed');
    exitBtnEl.style('top', 'calc(env(safe-area-inset-top, 0px) + 10px)');
    exitBtnEl.style('right', 'calc(env(safe-area-inset-right, 0px) + 10px)');
    exitBtnEl.style('padding', '12px');
    exitBtnEl.style('background', 'rgba(0,0,0,0.35)');
    exitBtnEl.style('border', 'none');
    exitBtnEl.style('border-radius', '50%');
    exitBtnEl.style('color', 'rgba(255,255,255,0.85)');
    exitBtnEl.style('line-height', '0');
    exitBtnEl.style('cursor', 'pointer');
    exitBtnEl.style('z-index', '30');
    exitBtnEl.style('display', 'none');
    exitBtnEl.elt.addEventListener('click', (ev) => { ev.stopPropagation(); returnToMenu(); });

    // 전체화면 다시 들어가기 버튼 (× 왼쪽). 전체화면을 쓸 수 있고 지금 전체화면이 아닐 때만 보임
    fsBtnEl = createElement('button',
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>');
    fsBtnEl.attribute('aria-label', 'Fullscreen');
    fsBtnEl.attribute('title', 'Fullscreen');
    for (const [k, v] of Object.entries({
        position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 10px)', right: 'calc(env(safe-area-inset-right, 0px) + 62px)',
        padding: '12px', background: 'rgba(0,0,0,0.35)', border: 'none', 'border-radius': '50%',
        color: 'rgba(255,255,255,0.85)', 'line-height': '0', cursor: 'pointer', 'z-index': '30', display: 'none',
    })) fsBtnEl.style(k, v);
    fsBtnEl.elt.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (isTouchDevice) { fullscreenTries = 0; requestFullscreenNow('button'); }
        else fullscreen(true);
        hideControls();
    });
    document.addEventListener('fullscreenchange', () => { if (controlsVisible) showControls(); });
    document.addEventListener('webkitfullscreenchange', () => { if (controlsVisible) showControls(); });
    copyrightEl.style('position', 'fixed');
    copyrightEl.style('left', '20px');
    copyrightEl.style('bottom', '20px');
    copyrightEl.style('color', 'white');
    copyrightEl.style('font-family', "'NotoSansKR-Thin', 'Times New Roman', serif");
    copyrightEl.style('font-size', '16px');
    copyrightEl.style('pointer-events', 'none');
    copyrightEl.style('z-index', '10');

    updateStartDomLayout();
    bootLog('setup done');
}

// 기존 방식: <audio> 요소 → MediaElementSource (데스크톱 Chrome/Firefox)
function setupMediaElementAudio(context) {
    // 라이브 스트림: 캐시된 청크를 loop하는 문제 방지 (cache-busting + loop OFF + 끊기면 재연결)
    audio = new Audio(`${AUDIO_URL}?t=${Date.now()}`);
    audio.crossOrigin = "anonymous";
    audio.loop = false;
    audio.preload = "none";
    document.body.appendChild(audio);

    // 재연결 throttle: 폭주 방지 + 실패 시 점진적 backoff
    const RECONNECT_BASE_MS = 1500;
    const RECONNECT_MAX_MS = 15000;
    let reconnectDelay = RECONNECT_BASE_MS;
    let reconnectTimer = null;

    const scheduleReconnect = () => {
        if (!started) return;       // 메뉴로 돌아간 상태면 재연결 안 함
        if (reconnectTimer) return; // 이미 예약돼 있으면 무시
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (!started) return;
            audio.src = `${AUDIO_URL}?t=${Date.now()}`;
            audio.play()
                .then(() => { reconnectDelay = RECONNECT_BASE_MS; }) // 성공 시 지연 리셋
                .catch(() => {
                    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
                    scheduleReconnect();
                });
        }, reconnectDelay);
    };

    audio.addEventListener('ended', scheduleReconnect);
    audio.addEventListener('stalled', scheduleReconnect);
    audio.addEventListener('error', scheduleReconnect);
    // 정상 재생 시작 시 backoff 리셋
    audio.addEventListener('playing', () => { reconnectDelay = RECONNECT_BASE_MS; onStreamPlaying(); });

    source = context.createMediaElementSource(audio);
    source.connect(gainOut);
    source.connect(gainFFT);
}

// 직접 디코딩 경로를 쓸지: ?decoder=1 / ?decoder=0 으로 강제 가능, 기본은 WebKit 엔진일 때
function shouldUseStreamDecoder() {
    const q = new URLSearchParams(location.search).get('decoder');
    if (q === '1' || q === 'wasm') return true;
    if (q === '0') return false;
    const ua = navigator.userAgent;
    const isWebKit = /AppleWebKit/.test(ua) && !/Chrome\/|Chromium|Edg\//.test(ua);
    return isWebKit && typeof StreamDecoder !== 'undefined';
}

function toggleFullscreen() {
    let fs = fullscreen();
    fullscreen(!fs);
}

function keyPressed() {
    if (key === 'f' || key === 'F') {
        toggleFullscreen();
    }
}

// 캔버스 크기·위치: 비율 유지로 화면에 맞추되, 아래 여백이 자막 자리(SUBTITLE_RESERVE_LINES 줄)보다
// 좁으면(폰 가로 모드 등) 캔버스를 줄이고 [캔버스+자막]을 한 덩어리로 세로 가운데 정렬.
// 여백이 충분하면(데스크톱) 기존처럼 화면 가운데.
function computeCanvasLayout() {
    const W = windowWidth, H = windowHeight;
    if (!started) return { w: W, h: H, x: 0, y: 0 };   // 메뉴 화면은 화면 전체
    let w = W, h = H;
    if (w / h > ASPECT_RATIO) w = h * ASPECT_RATIO;
    else h = w / ASPECT_RATIO;
    if (!SHOW_SUBTITLE) return { w, h, x: (W - w) / 2, y: (H - h) / 2 };

    const subPx = (cw) => Math.max(SUBTITLE_MIN_FONT_PX, SUBTITLE_BASE_FONT_PX * cw / 1280);
    let reserve = SUBTITLE_RESERVE_LINES * 1.3 * subPx(w) + 6;
    if ((H - h) / 2 >= reserve) return { w, h, x: (W - w) / 2, y: (H - h) / 2 };

    if (H - h < reserve) {
        h = Math.max(50, H - reserve);
        w = Math.min(W, h * ASPECT_RATIO);
        h = w / ASPECT_RATIO;
        reserve = SUBTITLE_RESERVE_LINES * 1.3 * subPx(w) + 6;
    }
    return { w, h, x: (W - w) / 2, y: Math.max(0, (H - h - reserve) / 2) };
}

function windowResized() {
    bootLog('resize ' + windowWidth + 'x' + windowHeight);
    applyCanvasLayout(started);
}

// 캔버스 크기·위치 다시 맞추기. keepDrawing이면 지금까지의 그림을 새 크기로 옮겨 깐다.
function applyCanvasLayout(keepDrawing) {
    // 작품이 돌고 있으면 크기를 바꾸기 전에 지금까지의 그림을 복사해 둔다 (전체화면 전환·회전 때 흔적 유지)
    let snap = null;
    const oldVW = VW;
    if (keepDrawing) {
        snap = document.createElement('canvas');
        snap.width = canvas.elt.width; snap.height = canvas.elt.height;
        snap.getContext('2d').drawImage(canvas.elt, 0, 0);
    }

    const lay = computeCanvasLayout();
    resizeCanvas(lay.w, lay.h, true);   // noRedraw: 크기 바꾸는 순간 draw()가 끼어들지 않게
    canvas.position(lay.x, lay.y);
    canvasTop = lay.y;
    background(BG_COLOR);

    // 가로폭 바뀌면 스케일 다시 계산
    updateScale();

    if (snap) {
        // 복사해 둔 그림을 새 크기에 맞춰 다시 깔기 (비율은 항상 같아 찌그러지지 않음)
        const ctx = drawingContext;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(snap, 0, 0, snap.width, snap.height, 0, 0, canvas.elt.width, canvas.elt.height);
        ctx.restore();
        // 훑는 위치·마지막 문장 위치도 같은 비율로 옮겨 그 자리에서 이어 그림
        const k = oldVW > 0 ? VW / oldVW : 1;
        cnt = Math.round(cnt * k);
        if (lastMessageX !== null) lastMessageX *= k;
    }
    updateStartDomLayout();
    updateSubtitleFontSize();
    updateSubtitlePosition();
}

// 캔버스 크기에 따라 축소 배율 갱신 (데스크톱처럼 넓으면 S=1 → 기존과 동일)
function updateScale() {
    S = Math.min(1, width / DESIGN_W);
    VW = width / S;
    VH = height / S;
    visualizeMul = VW * VISUALIZE_INTENSITY_MUL;
}

// 시작 화면의 HTML 요소: 이메일 위치·크기는 drawStartScreen()이 매 프레임 맞춘다. 저작권은 왼쪽 아래 여백만.
function updateStartDomLayout() {
    // 이메일·저작권 위치는 drawStartScreen()이 화면 크기에 맞춰 정한다
    if (copyrightEl) copyrightEl.elt.dataset.key = '';
}

// 화면 좌표 → 시작 화면 그리기 좌표 (메뉴는 화면 전체 캔버스에 그대로 그리므로 같음)
function toStartCoords(mx, my) {
    return { x: mx, y: my };
}

function updateSubtitlePosition() {
    if (!subtitleEl) return;
    // 자막 상단을 캔버스 바닥 바로 아래(letterbox)에 고정 → 줄이 늘어도 아래로 자란다
    const margin = 0;
    const topPx = canvasTop + height + margin;
    subtitleEl.style('bottom', 'auto');
    subtitleEl.style('top', topPx + 'px');
}

function updateSubtitleFontSize() {
    if (!subtitleEl) return;
    // 브라우저 줌 시 devicePixelRatio가 올라가고 CSS px 기준 canvas width는 줄어드는데,
    // 이 두 효과가 서로 상쇄돼 자막이 같은 크기로 유지된다.
    // zoomFactor를 곱하면 줌한 만큼 자막도 커진다.
    const zoomFactor = (window.devicePixelRatio || 1) / baseDevicePixelRatio;
    // 자막 언어에 따라 한/영 배율 따로 적용
    const langMul = /[ㄱ-ㆎ가-힣]/.test(subtitleMessage) ? SUBTITLE_KOR_MUL : SUBTITLE_ENG_MUL;
    const px = SUBTITLE_BASE_FONT_PX * width / 1280 * zoomFactor * langMul;
    subtitleEl.style('font-size', Math.max(SUBTITLE_MIN_FONT_PX, px) + 'px');
}

// function mousePressed() {
//     if (getAudioContext().state !== 'running') {
//         getAudioContext().resume().then(() => { if (!started) startAudio(); });
//     } else if (!started) {
//         startAudio();
//     }
// }

function resetMessageStateOnly() {
    sentenceIndex = 0;
    messageCount = 0;
    allMessagesShown = false;
    coolingDown = false;
    currentMessage = "";
    subtitleMessage = "";
    if (subtitleTimeout) { clearTimeout(subtitleTimeout); subtitleTimeout = null; }
    updateSubtitleEl();
    lastMessageFrame = -1000;
    lastMessageX = null;
}

function mousePressed() {
    if (!assetsReady) return;   // 메뉴가 아직 안 그려졌으면 무시
    if (a2hsOpen()) return;     // 홈 화면 추가 안내 창이 열려 있으면 무시
    // 시작 전: 언어 선택 UI 클릭 처리 (선택 즉시 시작)
    if (!started) {
        // 오디오 컨텍스트는 사용자 제스처에서만 resume 가능
        if (getAudioContext().state !== 'running') {
            getAudioContext().resume();
        }

        // ENG
        const sp = toStartCoords(mouseX, mouseY);
        if (hit(sp.x, sp.y, ui.eng)) {
            lang = "ENG";
            sentences = sentencesENG;
            resetMessageStateOnly();
            startAudio();
            return;
        }

        // KOR
        if (hit(sp.x, sp.y, ui.kor)) {
            lang = "KOR";
            sentences = sentencesKOR;
            resetMessageStateOnly();
            startAudio();
            return;
        }

        return;
    }

    // 시작 후: 탭하면 × (메뉴로) 버튼 보이기
    showControls();
    // 시작 후: 오디오가 멈춰 있으면(iOS 전화·알림·세션 끊김 등) 탭으로 다시 깨움
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume().then(() => bootLog('tap resume → ' + getAudioContext().state));
    }
}

function touchStarted(e) {
    // 링크(저작권 옆 편지봉투 등)를 누른 터치는 막지 않는다 — false를 돌려주면 브라우저가 링크로 처리하지 못함
    if (e && e.target && e.target.closest && e.target.closest('a, button, .a2hs-overlay')) return true;
    mousePressed();
    return false;
}

function startAudio() {
    bootLog('startAudio');
    background(BG_COLOR);
    // FFT 분석기는 이전 값을 섞어(smoothing) 기억한다 → 메뉴에서 돌아와 다시 시작하면 직전 소리 값이
    // 첫 프레임에 남아 오른쪽 끝에 점이 찍힘. 지금 입력(무음)으로 한 번 분석해 기억을 비운다.
    if (fft && fft.analyser) {
        const sm = fft.analyser.smoothingTimeConstant;
        fft.analyser.smoothingTimeConstant = 0;
        fft.analyze();
        fft.analyser.smoothingTimeConstant = sm;
    }
    if (!USE_MIC_INPUT) {
        // (iOS 오디오 세션 'playback' 설정은 index.html에서 AudioContext 생성 전에 함)
        getAudioContext().resume().then(() => bootLog('ctx resume → ' + getAudioContext().state));
        if (audio) audio.play();               // 기존 방식은 제스처 안에서 바로 재생
        audioReady.then(() => {
            if (streamDecoder) startDecoderWhenRunning();
            else if (audio && audio.paused) audio.play();
        });
        // 페이드인은 소리가 실제로 나오기 시작할 때(onStreamPlaying) 시작 — 스트림 연결·버퍼링에 몇 초 걸려서
        // 누르는 순간 시작하면 소리가 나올 즈음엔 이미 볼륨이 올라가 있어 갑자기 시작되는 것처럼 들림
        if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
        if (gainOut) gainOut.gain.value = OUTPUT_START_GAIN;
        fadePending = true;
        clearTimeout(fadeFallbackTimer);
        fadeFallbackTimer = setTimeout(onStreamPlaying, 12000);   // 신호를 못 받아도 12초 뒤엔 페이드인
    }
    started = true;
    startTime = new Date();
    cycleStartMillis = millis(); // 사이클 타이머 시작 — 캔버스 전환보다 먼저 (메뉴에 오래 있다 시작해도 첫 문장은 60초 뒤)
    applyCanvasLayout(false);   // 메뉴용 화면 전체 캔버스 → 작품 비율(2.5:1) 캔버스로
    requestWakeLock();          // 보는 동안 화면 켜 두기
    if (copyrightEl) copyrightEl.style('display', 'none');
    // 전체화면: 지원하는 곳에서만 (아이폰 Safari는 요소 전체화면 미지원), ?nofs 로 끌 수 있음
    // 터치 기기(iPad·안드로이드)는 touchstart가 사용자 동작으로 인정되지 않아 거절됨 → 손을 뗄 때(unlockAudio) 한 번 요청
    fullscreenPending = false;
    if (document.fullscreenEnabled && !fullscreenBroken && !new URLSearchParams(location.search).has('nofs')) {
        if (isTouchDevice) { fullscreenPending = true; fullscreenTries = 0; }
        else fullscreen(true);
    }
}

// 디코더는 오디오 컨텍스트가 실제로 running 이 된 뒤에 시작 (iOS에서 resume이 늦게 풀리는 경우 대비)
function startDecoderWhenRunning() {
    const c = getAudioContext();
    if (c.state === 'running') { streamDecoder.start(); return; }
    bootLog('decoder waits for ctx running (now ' + c.state + ')');
    const onState = () => {
        if (c.state !== 'running') return;
        c.removeEventListener('statechange', onState);
        bootLog('decoder start (ctx running)');
        streamDecoder.start();
    };
    c.addEventListener('statechange', onState);
}

let fadeTimer = null, fadePending = false, fadeFallbackTimer = null;
// 스트림 소리가 실제로 나오기 시작함 → (시작 직후 한 번만) 페이드인
function onStreamPlaying() {
    if (!started || !fadePending) return;
    fadePending = false;
    clearTimeout(fadeFallbackTimer);
    bootLog('stream playing → fade in');
    fadeInAudio(START_FADE_IN_MS);
}

function fadeInAudio(durationMillis = 3000) {
    if (!gainOut) return;
    if (fadeTimer) clearInterval(fadeTimer);
    let steps = 30;
    let stepTime = durationMillis / steps;
    let currentStep = 0;
    fadeTimer = setInterval(() => {
        currentStep++;
        let vol = currentStep / steps;
        gainOut.gain.value = constrain(vol, 0, 1);
        if (currentStep >= steps) { clearInterval(fadeTimer); fadeTimer = null; }
    }, stepTime);
}

// 전체화면 요청 (터치 기기용): 성공하면 pending 해제, 실패하면 이유를 기록하고 다음 기회(click)에 재시도
let fullscreenTries = 0;
function requestFullscreenNow(from) {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { fullscreenPending = false; bootLog('fs: no API'); return; }
    if (document.fullscreenElement || document.webkitFullscreenElement) { fullscreenPending = false; return; }
    fullscreenTries++;
    try {
        const p = req.call(el);
        if (p && p.then) {
            p.then(() => { fullscreenPending = false; bootLog('fs ok (' + from + ')'); })
             .catch((e) => { bootLog('fs fail (' + from + '): ' + (e && (e.name + ' ' + e.message))); if (fullscreenTries >= 3) fullscreenPending = false; });
        } else {
            fullscreenPending = false; bootLog('fs requested (' + from + ', no promise)');
        }
    } catch (e) {
        // 예외(throw)는 재시도해도 같음 — 예: iPad Firefox는 전체화면 요청을 <video> 전용(webkitEnterFullscreen)으로
        // 바꿔 처리해서 동영상이 없는 이 페이지에서는 항상 실패 → 더 시도하지 않음
        bootLog('fs throw (' + from + '): ' + e);
        fullscreenPending = false;
        fullscreenBroken = true;
    }
}

// 화면 켜 두기 (Screen Wake Lock): 작품을 보는 동안 기기가 화면을 어둡게·잠그지 않게.
// 다른 앱에 갔다 오면 풀리므로 돌아왔을 때 다시 요청. 지원 안 하는 브라우저는 조용히 넘어감.
let wakeLock = null;
let keepAwakeVideo = null;   // 대체 방법: 눈에 안 보이는 무음 동영상 반복 재생(iOS는 동영상 재생 중 화면을 끄지 않음)
async function requestWakeLock() {
    if (!started) return;
    if (wakeLock && !wakeLock.released) return;
    if (!('wakeLock' in navigator)) { startKeepAwakeVideo('no api'); return; }   // 예: iPad Chrome·Firefox(앱 안 Safari 엔진)
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        bootLog('wakeLock on');
        wakeLock.addEventListener('release', () => bootLog('wakeLock released'));
        stopKeepAwakeVideo();
    } catch (e) {
        bootLog('wakeLock fail: ' + (e && e.name));
        startKeepAwakeVideo('api fail');
    }
}
function startKeepAwakeVideo(why) {
    if (!keepAwakeVideo) {
        const v = document.createElement('video');
        v.src = 'vendor/keepawake.mp4';   // 16×16 검은 화면 2초, 소리 없음 (1.5KB)
        v.muted = true; v.loop = true; v.playsInline = true;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
        // 너무 작거나 투명하면 브라우저가 '안 보이는 동영상'으로 보고 멈춤 → 2px 불투명 검정(검은 바탕이라 눈에는 안 보임)
        Object.assign(v.style, { position: 'fixed', left: '0', bottom: '0', width: '2px', height: '2px', opacity: '1', pointerEvents: 'none', zIndex: '0', background: '#000' });
        document.body.appendChild(v);
        keepAwakeVideo = v;
    }
    if (!keepAwakeVideo.paused) return;
    keepAwakeVideo.play()
        .then(() => bootLog('keepawake video on (' + why + ')'))
        .catch((e) => bootLog('keepawake video fail: ' + (e && e.name)));
}
function stopKeepAwakeVideo() {
    if (keepAwakeVideo && !keepAwakeVideo.paused) keepAwakeVideo.pause();
}
function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    stopKeepAwakeVideo();
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && started) requestWakeLock();
});

// ---- 홈 화면에 추가 ----
// 아이폰은 웹페이지가 대신 추가할 수 없어(Apple 제한) 방법 안내 창을, 안드로이드 Chrome은 설치 창(beforeinstallprompt)을 띄움
let installPromptEvent = null;
let a2hsOverlayEl = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPromptEvent = e; });
const isIOSLike = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;

function setupAddToHomeScreen() {
    const btn = copyrightEl.elt.querySelector('button.a2hs');
    if (!btn) return;
    if (isTouchDevice && !isStandalone()) btn.style.display = 'inline-flex';
    btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (installPromptEvent) {   // 안드로이드 Chrome: 바로 설치 창
            installPromptEvent.prompt();
            installPromptEvent.userChoice.finally(() => { installPromptEvent = null; });
            return;
        }
        showA2hsGuide();
    });
}

function showA2hsGuide() {
    if (!a2hsOverlayEl) {
        const shareIcon = '<svg width="1.15em" height="1.15em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em">' +
            '<path d="M12 3.5v11M8.2 7.2 12 3.5l3.8 3.7"/><path d="M8.5 10.5H6v10h12v-10h-2.5"/></svg>';
        const ios = isIOSLike();
        const stepEn = ios
            ? `Tap ${shareIcon}, then choose “Add to Home Screen”.`
            : 'Open the ⋮ menu, then choose “Add to Home screen”.';
        const stepKo = ios
            ? `${shareIcon} 을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.`
            : '⋮ 메뉴에서 ‘홈 화면에 추가’를 선택하세요.';
        const el = document.createElement('div');
        el.className = 'a2hs-overlay';
        el.setAttribute('role', 'dialog');
        el.innerHTML =
            '<div style="max-width:30em;padding:1.5em;line-height:1.6">' +
            '<div style="font-size:1.15em;margin-bottom:0.8em">Add to Home Screen · 홈 화면에 추가</div>' +
            `<div>${stepEn}</div><div style="margin-bottom:0.8em">${stepKo}</div>` +
            '<div style="opacity:0.7">The work opens full screen, without the address bar.<br>작품이 주소창 없이 전체 화면으로 열립니다.</div>' +
            '<button style="margin-top:1.4em;padding:0.5em 1.6em;color:inherit;background:none;border:1px solid rgba(255,255,255,0.5);border-radius:2em;font:inherit;cursor:pointer">OK</button>' +
            '</div>';
        Object.assign(el.style, {
            position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            background: 'rgba(0,0,0,0.96)', color: 'rgba(255,255,255,0.9)', zIndex: '40',
            fontFamily: "'NotoSansKR-Thin', 'Times New Roman', serif", fontSize: Math.max(14, Math.min(18, windowWidth / 40)) + 'px',
        });
        el.addEventListener('click', (ev) => { ev.stopPropagation(); hideA2hsGuide(); });
        document.body.appendChild(el);
        a2hsOverlayEl = el;
    }
    a2hsOverlayEl.style.display = 'flex';
}
function hideA2hsGuide() { if (a2hsOverlayEl) a2hsOverlayEl.style.display = 'none'; }
const a2hsOpen = () => !!(a2hsOverlayEl && a2hsOverlayEl.style.display !== 'none');

// 작품 → 메뉴로 돌아가기 (× 버튼). 소리 멈추고 상태 초기화, 메뉴 화면(화면 전체 캔버스)으로
function returnToMenu() {
    bootLog('returnToMenu');
    started = false;
    fadePending = false; clearTimeout(fadeFallbackTimer);
    fullscreenPending = false;
    releaseWakeLock();
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    if (gainOut) gainOut.gain.value = 0;
    if (streamDecoder) streamDecoder.stop();
    if (audio) { audio.pause(); audio.src = `${AUDIO_URL}?t=${Date.now()}`; }   // 다음 시작 땐 새로 받음
    hideControls(true);
    resetScene();
    if (fullscreen()) fullscreen(false);
    applyCanvasLayout(false);
    if (copyrightEl) { copyrightEl.style('display', 'flex'); copyrightEl.elt.dataset.key = ''; }
}

// × 버튼: 작품 중 화면을 탭하거나(모바일) 마우스를 움직이면(데스크톱) 3초 동안 보임
let controlsVisible = false, controlsTimer = null;
function showControls() {
    if (!started || !exitBtnEl) return;
    controlsVisible = true;
    exitBtnEl.style('display', 'block');
    if (fsBtnEl) {
        const canFs = (document.fullscreenEnabled || document.webkitFullscreenEnabled) && !fullscreenBroken
            && !new URLSearchParams(location.search).has('nofs');
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        fsBtnEl.style('display', canFs && !isFs ? 'block' : 'none');
    }
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => hideControls(), 3000);
}
function hideControls() {
    controlsVisible = false;
    clearTimeout(controlsTimer);
    if (exitBtnEl) exitBtnEl.style('display', 'none');
    if (fsBtnEl) fsBtnEl.style('display', 'none');
}

function mouseMoved() {
    if (started && !isTouchDevice) showControls();
}

function resetScene() {
    // 화면 클리어
    background(BG_COLOR);

    // 시각화/타임라인 상태 초기화
    cnt = 0;
    loopCount++;
    fadeOutCounter = 0;

    // 데이터 버퍼 초기화
    points = [];
    radius = [];
    graphPoints = [{ x: 0, y: 6 }];

    // 메시지 상태 초기화
    sentenceIndex = 0;
    messageCount = 0;
    allMessagesShown = false;
    coolingDown = false;
    currentMessage = "";
    subtitleMessage = "";
    if (subtitleTimeout) { clearTimeout(subtitleTimeout); subtitleTimeout = null; }
    updateSubtitleEl();
    lastMessageFrame = -1000;
    lastMessageX = null;

    // 타이머 초기화
    startTime = new Date();
    cycleStartMillis = millis();

    // 원하면 리셋 시에도 페이드인
    if (ENABLE_FADE_IN_ON_RESET && !USE_MIC_INPUT) fadeInAudio(START_FADE_IN_MS);
}

// ?debug: 폰에서 상태를 화면 왼쪽 위에 표시 (오디오 경로, 컨텍스트 상태, 분석값, 버퍼, 오류)
const DEBUG = new URLSearchParams(location.search).has('debug');
let debugEl = null, debugErrors = [];
if (DEBUG) {
    window.addEventListener('error', (e) => debugErrors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => debugErrors.push('rej: ' + String(e.reason)));
}
function updateDebug() {
    if (!DEBUG) return;
    if (!debugEl) {
        debugEl = createElement('pre', '');
        debugEl.style('position', 'fixed'); debugEl.style('left', '4px'); debugEl.style('top', '4px');
        debugEl.style('margin', '0'); debugEl.style('color', '#0f0'); debugEl.style('font-size', '10px');
        debugEl.style('z-index', '99'); debugEl.style('pointer-events', 'none');
        debugEl.style('background', 'rgba(0,0,0,0.6)');
    }
    if (frameCount % 15 !== 0) return;
    let spec = '-';
    try { spec = Math.max(...fft.analyze()); } catch (e) {}
    const st = streamDecoder ? streamDecoder.status : null;
    debugEl.html([
        'path: ' + (streamDecoder ? 'decoder/' + streamDecoder.backend : audio ? 'element' : 'none') + '  started: ' + started,
        'ctx: ' + getAudioContext().state + ' @' + getAudioContext().sampleRate + '  spec: ' + spec,
        st ? 'buf: ' + st.bufferedSec.toFixed(2) + 's  playing: ' + st.playing + '  conn: ' + st.connected + '  under: ' + st.underruns + '  reconn: ' + st.reconnects : '',
        audio ? 'audio t: ' + audio.currentTime.toFixed(1) + ' paused: ' + audio.paused : '',
        'canvas: ' + Math.round(width) + 'x' + Math.round(height) + ' top ' + Math.round(canvasTop) + '  win: ' + windowWidth + 'x' + windowHeight,
        'standalone: ' + (navigator.standalone === true) + '  AD: ' + (typeof AudioDecoder) + '  secure: ' + window.isSecureContext + '  fsEnabled: ' + (document.fullscreenEnabled === true) + (fullscreenBroken ? '(shim)' : '') + '  fs: ' + !!document.fullscreenElement + '  wake: ' + (wakeLock && !wakeLock.released ? 'lock' : (keepAwakeVideo && !keepAwakeVideo.paused ? 'video' : 'off')) + ('wakeLock' in navigator ? '' : ' (no api)'),
        debugErrors.slice(-3).join('\n'),
    ].filter(Boolean).join('\n'));
}

function draw() {
    if (frameCount === 1) bootLog('first draw');
    updateDebug();
    if (!assetsReady) { background(BG_COLOR); return; }   // 텍스트·폰트 준비 전에는 검은 화면
    // 풀스크린일 때 커서 숨김, 아니면 표시
    if (fullscreen() && !controlsVisible) noCursor();
    else cursor(ARROW);

    if (!started) {
        drawStartScreen();
        return;
    }

    if (cnt === 0) startTime = new Date();

    spectrum = fft.analyze();

    if (VISUALIZE_MODE === 0) {
        // 작은 화면: DESIGN_W 기준 가상 좌표(VW×VH)로 그린 뒤 S 만큼 축소
        push();
        scale(S);
        drawMainVisualization();
        updateGraphPoints(GRAPH_POINT_UPDATE_INTERVAL);
        drawGraphPoints();
        drawCurrentMessage();
        pop();

        // 스캔이 왼쪽 끝까지 도달했을 때 처리
        if (cnt >= VW) {
            if (allMessagesShown) {
                if (!coolingDown) {
                    // 마지막 문장까지 끝난 첫 경계: 텍스트 없이 한 바퀴 더 흘려보냄
                    coolingDown = true;
                    fadeOutCounter = 30;
                    cnt = 0;
                    // 남은 메시지/자막 제거 → 이 스윕은 완전히 텍스트 없음
                    currentMessage = "";
                    subtitleMessage = "";
                    if (subtitleTimeout) { clearTimeout(subtitleTimeout); subtitleTimeout = null; }
                    updateSubtitleEl();
                } else {
                    resetScene(); // 빈 스윕 한 바퀴까지 끝나면 전체 리셋
                }
            } else {
                fadeOutCounter = 30; // 다음 스윕을 위한 페이드
                cnt = 0;
                loopCount++;
            }
        }

        if (fadeOutCounter > 0) {
            background(BG_COLOR, 2 / 3);
            fadeOutCounter--;
        }
    }
}

function drawStartScreen() {
    background(BG_COLOR);
    // 메뉴 화면은 화면 전체 캔버스에 흐름 배치(위→아래)로 그린다.
    // 기본 크기는 넓은 데스크톱 기준(START_BASE), 화면이 작으면 k로 줄이되 글씨마다 최소 크기를 지킨다.
    // 제목·날짜는 폭에 맞춰 줄이고, 아래 안내 문장은 줄바꿈한다.
    const W = width, H = height, maxW = W * 0.9;
    const B = START_BASE;
    const k = Math.min(1, H / B.designH, W / B.designW);
    const sz = (base, min) => Math.max(min, base * k);
    const weatherSuffix = weatherIconType
        ? '  ·  ' + weatherIconType[0].toUpperCase() + weatherIconType.slice(1)
        : '  ·  ' + '- - - - -'; // 데이터 대기 중: 대시 placeholder (도착하면 날씨 이름으로 교체)

    // 한 줄에 맞추기(줄이기) / 줄바꿈
    const fitSize = (str, font, size) => {
        textFont(font); textSize(size);
        const w = textWidth(str);
        return w > maxW ? size * maxW / w : size;
    };
    const wrap = (str, font, size) => {
        textFont(font); textSize(size);
        if (textWidth(str) <= maxW) return [str];
        const words = str.split(' '), lines = [];
        let cur = '';
        for (const wd of words) {
            const t = cur ? cur + ' ' + wd : wd;
            if (textWidth(t) > maxW && cur) { lines.push(cur); cur = wd; } else cur = t;
        }
        if (cur) lines.push(cur);
        return lines;
    };

    // 배치 항목 만들기
    const items = [];
    const addLine = (str, font, size, opts = {}) => items.push({ type: 'text', str, font, size, ...opts });
    const gap = (g) => items.push({ type: 'gap', g });
    const enT = "Some-bodies are listening, too", koT = "누군가 듣고 있어";
    const dateT = getFormattedKoreanTime() + weatherSuffix;
    addLine(enT, englishFont, fitSize(enT, englishFont, sz(B.title, 22)));
    gap(B.gapTitle);
    addLine(koT, koreanFont, fitSize(koT, koreanFont, sz(B.titleKo, 20)));
    gap(B.gapAfterTitles);
    addLine(dateT, englishFont2, fitSize(dateT, englishFont2, sz(B.date, 14)));
    gap(B.gapBeforeButtons);
    const btnH = Math.max(42, B.btnH * k), btnW = Math.max(104, B.btnW * k), btnGap = Math.max(14, 18 * k);
    items.push({ type: 'buttons', h: btnH });
    // 높이가 낮은 화면(폰 가로 등)에서는 저작권 줄을 버튼 아래 흐름에 넣어 겹치지 않게 (아니면 화면 맨 아래 가운데)
    const copyInFlow = H < 520;
    const copyPx = Math.max(11, 16 * k);
    if (copyInFlow) gap(B.gapAfterButtons);
    const copyH = copyInFlow ? copyPx * 3.4 : 0;   // 저작권 줄 + 아이콘 줄

    // 높이 계산: 글씨 높이는 고정, 넘치면 간격부터 줄임
    const textH = items.reduce((a, it) => a + (it.type === 'text' ? it.size * 1.3 : it.type === 'buttons' ? it.h : 0), 0);
    const gapsBase = items.reduce((a, it) => a + (it.type === 'gap' ? it.g : 0), 0);
    const avail = H * 0.94 - copyH;
    const gk = Math.max(0.15, Math.min(k, (avail - textH) / gapsBase));
    const total = textH + gapsBase * gk + copyH;
    // 모바일(터치 기기): 아래쪽 브라우저 도구 막대 등에 가리지 않게 전체를 글자 두 줄 정도 위로
    const mobileLift = isTouchDevice ? copyPx * 1.6 * 2 : 0;
    let y = Math.max(4, (H - total) / 2 - mobileLift);

    // 그리기
    textAlign(CENTER, CENTER);
    for (const it of items) {
        if (it.type === 'gap') { y += it.g * gk; continue; }
        if (it.type === 'text') {
            const h = it.size * 1.3;
            noStroke(); fill(255);
            strokeWeight(it.note ? 0.3 : 0.1);
            textFont(it.font); textSize(it.size);
            text(it.str, W / 2, y + h / 2);
            y += h;
            continue;
        }
        // ENG / KOR 버튼
        // eng  /  kor — 제목과 같은 세리프(Times)로, 가운데 흐린 '/'. 누를 수 있는 영역은 각 단어 둘레로 넉넉히
        const btnText = Math.max(20, B.btnText * k);
        textFont(englishFont); textSize(btnText);
        const sepGap = btnText * 1.1;                  // 단어와 '/' 사이 간격
        const engW = textWidth('eng'), korW = textWidth('kor'), slashW = textWidth('/');
        const cy = y + btnH / 2 - btnText * 0.1;
        const engCx = W / 2 - slashW / 2 - sepGap - engW / 2;
        const korCx = W / 2 + slashW / 2 + sepGap + korW / 2;
        // 누를 수 있는 영역: 단어 바깥쪽으로 넉넉히, 안쪽은 가운데 '/'에서 끊어 두 영역이 겹치지 않게
        const pad = Math.max(btnW * 0.4, engW / 2 + btnText * 0.8);
        ui.eng = { x: engCx - pad, y, w: (W / 2 - 1) - (engCx - pad), h: btnH };
        ui.kor = { x: W / 2 + 1, y, w: (korCx + pad) - (W / 2 + 1), h: btnH };
        // 기본은 흰색 75% (얇은 글꼴들 사이에서 너무 진해 보이지 않게), 마우스를 올리면 100% + 밑줄
        const overEng = !isTouchDevice && hit(mouseX, mouseY, ui.eng);
        const overKor = !isTouchDevice && hit(mouseX, mouseY, ui.kor);
        const uy = cy + btnText * 0.55;
        noStroke();
        fill(255, overEng ? 255 : 190); text('eng', engCx, cy);
        fill(255, overKor ? 255 : 190); text('kor', korCx, cy);
        fill(255, 100); text('/', W / 2, cy);
        stroke(255); strokeWeight(1);
        if (overEng) line(engCx - engW / 2, uy, engCx + engW / 2, uy);
        if (overKor) line(korCx - korW / 2, uy, korCx + korW / 2, uy);
        noStroke();
        y += btnH;
    }

    if (copyrightEl) {
        const key = copyInFlow + '/' + Math.round(y) + '/' + copyPx + '/' + mobileLift;
        if (copyrightEl.elt.dataset.key !== key) {
            copyrightEl.elt.dataset.key = key;
            copyrightEl.style('font-size', copyPx + 'px');
            if (copyInFlow) {   // 이메일 아래 가운데
                copyrightEl.style('left', '50%');
                copyrightEl.style('transform', 'translateX(-50%)');
                copyrightEl.style('bottom', 'auto');
                copyrightEl.style('top', Math.round(y) + 'px');
                copyrightEl.style('white-space', 'nowrap');
            } else {            // 아래 가운데 (모바일은 두 줄 정도 더 위)
                const m = Math.min(20, Math.max(8, W * 0.02)) + mobileLift;
                copyrightEl.style('left', '50%');
                copyrightEl.style('transform', 'translateX(-50%)');
                copyrightEl.style('top', 'auto');
                copyrightEl.style('bottom', m + 'px');
                copyrightEl.style('white-space', 'nowrap');
            }
        }
    }

    // 커서 처리(풀스크린 아닐 때만)
    if (!fullscreen()) {
        if (hit(mouseX, mouseY, ui.eng) || hit(mouseX, mouseY, ui.kor)) cursor(HAND);
        else cursor(ARROW);
    }
}


// function drawStartScreen() {
//     background(BG_COLOR);
//     fill(255);
//     textAlign(CENTER, CENTER);
//     strokeWeight(0.1);

//     textFont(englishFont);
//     textSize(30);
//     text("Some-bodies are listening, too", width / 2, height / 2 - 220);

//     textFont(englishFont2);
//     textSize(20);
//     text("Jiyeon Kim, Gangil Yi", width / 2, height / 2 - 150);

//     textFont(englishFont2);
//     textSize(15);
//     text(getFormattedKoreanTime(), width / 2, height / 2 + 40);

//     textSize(24);
//     let liveText = "Live";
//     let textW = textWidth(liveText);
//     let boxW = textW + 40;
//     let boxH = 42;
//     let boxX = width / 2 - boxW / 2;
//     let boxY = height / 2 + 100;

//     stroke(255);
//     strokeWeight(2);
//     noFill();
//     rect(boxX, boxY, boxW, boxH, 20);

//     strokeWeight(0.1);
//     fill(255);
//     text(liveText, width / 2, boxY + boxH / 4 + 5);

//     // 풀스크린이 아닐 때만 버튼 hover 커서 변경
//     if (!fullscreen()) {
//         if (mouseX > boxX && mouseX < boxX + boxW && mouseY > boxY && mouseY < boxY + boxH) {
//             cursor(HAND);
//         } else {
//             cursor(ARROW);
//         }
//     }

//     strokeWeight(0.3);
//     textSize(18);
//     text("* This site works only on desktop versions of Firefox and Chrome", width / 2, height / 2 + 230);
// }

function hit(mx, my, r) {
    if (!r) return false;
    return (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h);
}

function drawMainVisualization() {
    push();
    translate(0, -23);

    for (let i = 0; i < FFT_BANDS; i++) {
        noStroke();
        fill(theBlue);
        let y = VH - i;
        let x = constrain(VW - cnt, 0, VW);
        let valMapped = spectrum[i] * visualizeMul * i * random(2);
        ellipse(x, y, valMapped * 0.000001, valMapped * 0.000001);
    }

    pop();

    let maxIdx = maxIndex(spectrum);
    points[cnt] = maxIdx;
    radius[cnt] = map(spectrum[maxIdx], 0, 255, 0, 1);
    cnt++;
}

function updateGraphPoints(interval = 1) {
    if (frameCount % interval !== 0) return;

    let waveform = fft.waveform();
    let sample = waveform.reduce((max, val) => (val > max ? val : max), -Infinity);

    let gx = frameCount % (VW + 1) + random(-1, 1);
    let gy = map(abs(sample), 0, 1, 0, VH);
    graphPoints.push({ x: gx, y: gy });

    if (graphPoints.length > 2) graphPoints.shift();
}

function drawGraphPoints() {
    let rad = 1;
    fill(theBlueTop);
    stroke(theBlueTop);

    for (let pt of graphPoints) {
        strokeWeight(0.1);
        ellipse(pt.x, pt.y, pt.y * rad, pt.y * rad);
    }
}

function drawCurrentMessage() {
    // --- 가드: 모든 문장을 1회 출력했다면, 새 메시지 스케줄 금지 ---
    if (allMessagesShown) {
        // 단, 마지막으로 표시한 문장의 잔상(표시 시간)은 그대로 렌더
        if (frameCount - lastMessageFrame < MESSAGE_PRINT_FRAMES) {
            push();
            translate(lastMessageX, VH - 22);
            rotate(-HALF_PI + jitterAngle);
            textFont(/[ㄱ-ㆎ|가-힣]/.test(currentMessage) ? koreanFont : englishFont);
            const a = constrain((frameCount - lastMessageFrame) / MESSAGE_PRINT_FRAMES * 255, 0, 255);
            fill(0, 0, 0, a);
            noStroke();
            textSize(MSG_SIZE * (/[ㄱ-ㆎ|가-힣]/.test(currentMessage) ? MSG_SIZE_KOR_MUL : 1));
            textAlign(LEFT, CENTER);
            text(currentMessage.replace(/\n/g, ' ').trim(), 0, 0);
            pop();
        }
        return; // ★ 새 문장 생성/스케줄링 로직으로 내려가지 않음
    }

    // --- 아래는 "allMessagesShown === false"일 때만 동작 ---
    let elapsedSeconds = (millis() - cycleStartMillis) / 1000;

    if (sentenceIndex === 0) {
        if (elapsedSeconds >= FIRST_MESSAGE_DELAY_SEC && currentMessage === "") {
            currentMessage = sentences[sentenceIndex];
            syncSubtitleToCurrentMessage();
            lastMessageFrame = frameCount;
            lastMessageX = VW - cnt;
            sentenceIndex = (sentenceIndex + 1) % sentences.length;
            jitterAngle = radians(random(-3, 3));

            messageCount++;
            if (messageCount >= sentences.length) allMessagesShown = true;
        }
    } else {
        let lineCount = ((currentMessage || "").match(/\n/g) || []).length + 1;
        let intervalFrames = FPS * MESSAGE_INTERVAL_SEC * lineCount;
        if ((frameCount - lastMessageFrame) >= intervalFrames && sentences.length > 0) {
            currentMessage = sentences[sentenceIndex];
            syncSubtitleToCurrentMessage();
            lastMessageFrame = frameCount;
            lastMessageX = VW - cnt;
            sentenceIndex = (sentenceIndex + 1) % sentences.length;
            jitterAngle = radians(random(-3, 3));

            messageCount++;
            if (messageCount >= sentences.length) allMessagesShown = true;
        }
    }

    if (frameCount - lastMessageFrame < MESSAGE_PRINT_FRAMES) {
        push();
        translate(lastMessageX, VH - 22);
        rotate(-HALF_PI + jitterAngle);
        textFont(/[ㄱ-ㆎ|가-힣]/.test(currentMessage) ? koreanFont : englishFont);
        const a = constrain((frameCount - lastMessageFrame) / MESSAGE_PRINT_FRAMES * 255, 0, 255);
        fill(0, 0, 0, a);
        noStroke();
        textSize(MSG_SIZE * (/[ㄱ-ㆎ|가-힣]/.test(currentMessage) ? MSG_SIZE_KOR_MUL : 1));
        textAlign(LEFT, CENTER);
        text(currentMessage.replace(/\n/g, ' '), 0, 0);
        pop();
    }
}

// 메인 텍스트 1개당 자막 1개 동기화 (SUBTITLE_DELAY_SEC 후)
function syncSubtitleToCurrentMessage() {
    if (!SHOW_SUBTITLE) return;
    const msg = (currentMessage || "").trim().replace(/\n/g, '<br>');
    if (subtitleTimeout) { clearTimeout(subtitleTimeout); subtitleTimeout = null; }
    subtitleTimeout = setTimeout(() => {
        subtitleMessage = msg;
        updateSubtitleEl();
        subtitleTimeout = null;
    }, SUBTITLE_DELAY_SEC * 1000);
}

function updateSubtitleEl() {
    if (!subtitleEl) return;
    subtitleEl.html(subtitleMessage);
    subtitleEl.style('font-family', /[ㄱ-ㆎ가-힣]/.test(subtitleMessage)
        ? "'AppleMyungjo', serif"
        : "'Times New Roman', Times, serif");
    updateSubtitleFontSize(); // 언어별 배율 반영 위해 크기 재계산
}

function maxIndex(arr) {
    let maxVal = arr[0];
    let idx = 0;
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
            idx = i;
        }
    }
    return idx;
}

function getFormattedKoreanTime() {
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    let now = new Date();
    now.setUTCHours(now.getUTCHours() + 9);
    const h24  = now.getUTCHours();
    const h12  = h24 % 12 || 12;
    const ampm = h24 < 12 ? 'AM' : 'PM';
    const min  = nf(now.getUTCMinutes(), 2);
    return `${MONTHS[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()}, ${h12}:${min} ${ampm}  ·  Jeju Island`;
}

// ─── 날씨 API ────────────────────────────────────────────

function fetchWeather() {
    // Open-Meteo: 제주 제로 인근 좌표, API 키 불필요
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=33.499&longitude=126.531&current=weather_code,temperature_2m';
    fetch(url)
        .then(r => r.json())
        .then(data => {
            weatherTempC = Math.round(data.current.temperature_2m);
            weatherIconType = wmoToIconType(data.current.weather_code);
        })
        .catch(() => {}); // 네트워크 실패 시 조용히 무시
}

function wmoToIconType(code) {
    if (code <= 1)                                   return 'clear';
    if (code <= 3)                                   return 'cloudy';
    if (code === 45 || code === 48)                  return 'fog';
    if ([71,73,75,77,85,86].includes(code))          return 'snow';
    if ([95,96,99].includes(code))                   return 'thunder';
    // 51-55 이슬비, 61-65 비, 80-82 소나기
    return 'rain';
}

// ─── 날씨 아이콘 드로잉 ──────────────────────────────────

function drawWeatherIcon(x, y, type) {
    push();
    translate(x, y);
    stroke(255);
    noFill();
    strokeWeight(0.9);
    strokeCap(ROUND);

    const t = frameCount * 0.03;

    if (type === 'clear')   drawIconClear(t);
    if (type === 'cloudy')  drawIconCloudy(t);
    if (type === 'rain')    drawIconRain(t);
    if (type === 'snow')    drawIconSnow(t);
    if (type === 'fog')     drawIconFog(t);
    if (type === 'thunder') drawIconThunder(t);

    pop();
}

// 맑음: 원 + 8개 방사선 (느리게 회전 + 길이 맥동)
function drawIconClear(t) {
    let r = 9;
    ellipse(0, 0, r * 2);
    let rayLen = 6 + sin(t * 1.4) * 2;
    let rayGap = r + 5;
    for (let i = 0; i < 8; i++) {
        let a = TWO_PI / 8 * i + t * 0.04;
        line(
            cos(a) * rayGap, sin(a) * rayGap,
            cos(a) * (rayGap + rayLen), sin(a) * (rayGap + rayLen)
        );
    }
}

// 흐림: 세 겹 호 (위아래 부드럽게 표류)
function drawIconCloudy(t) {
    let floatY = sin(t * 0.7) * 2.5;
    push();
    translate(0, floatY);
    drawCloudBase();
    pop();
}

// 클라우드 베이스 (비, 눈, 뇌우 공용)
function drawCloudBase() {
    arc(-9, 0, 22, 15, PI, TWO_PI);
    arc(3,  -5, 26, 18, PI, TWO_PI);
    arc(14,  0, 18, 13, PI, TWO_PI);
    line(-20, 0, 23, 0);
}

// 비: 구름 + 대각 빗줄기 낙하 애니메이션
function drawIconRain(t) {
    push(); translate(0, -9); drawCloudBase(); pop();

    let xs = [-14, -6, 2, 10, 18];
    let period = 35;
    for (let i = 0; i < xs.length; i++) {
        let phase = (frameCount + i * 7) % period;
        let prog = phase / period;
        let dy = 4 + prog * 18;
        let alpha = sin(prog * PI) * 255;
        stroke(255, alpha);
        line(xs[i], dy, xs[i] - 3, dy + 6);
    }
}

// 눈: 구름 + 십자 눈송이 낙하 (약간 좌우 표류)
function drawIconSnow(t) {
    push(); translate(0, -9); drawCloudBase(); pop();

    let xs = [-12, -2, 7, 16, -7];
    let period = 55;
    let s = 3.5;
    for (let i = 0; i < xs.length; i++) {
        let phase = (frameCount + i * 11) % period;
        let prog = phase / period;
        let dy = 4 + prog * 18;
        let dx = xs[i] + sin(prog * TWO_PI + i * 1.3) * 2.5;
        let alpha = sin(prog * PI) * 255;
        stroke(255, alpha);
        line(dx - s, dy, dx + s, dy);
        line(dx, dy - s, dx, dy + s);
    }
}

// 안개: 가로선 4개, 길이·위상 다르게 표류
function drawIconFog(t) {
    let layers = [
        { y: -12, len: 38, phase: 0.0 },
        { y:  -3, len: 28, phase: 1.1 },
        { y:   6, len: 36, phase: 0.5 },
        { y:  15, len: 22, phase: 1.8 },
    ];
    for (let l of layers) {
        let xOff = sin(t * 0.7 + l.phase) * 4;
        stroke(255, 200);
        line(-l.len / 2 + xOff, l.y, l.len / 2 + xOff, l.y);
    }
}

// 뇌우: 구름 + 번개 지그재그 (주기적으로 번쩍)
function drawIconThunder(t) {
    push(); translate(0, -9); drawCloudBase(); pop();

    // 60프레임 중 6프레임만 표시 (번쩍 효과)
    let flash = (frameCount % 60) < 6;
    if (flash) {
        strokeWeight(1.2);
        stroke(255);
        beginShape();
        vertex(2,   4);
        vertex(-5,  13);
        vertex(0,   13);
        vertex(-7,  24);
        endShape();
    }
}
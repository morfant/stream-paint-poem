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
let START_DESIGN_W = 820, START_DESIGN_H = 680; // 시작 화면이 잘리지 않는 최소 크기(이보다 작으면 축소)

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

// 작은 화면 축소 배율: 시각화는 S(가상 크기 VW×VH), 시작 화면은 SS
let S = 1, VW = 0, VH = 0, SS = 1;
let canvasTop = 0;            // 캔버스 위쪽 위치(px) — 자막 위치 기준

let weatherIconType = null;   // 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder'
let weatherTempC = null;

let emailLinkEl;
let copyrightEl;
let portraitHintEl;


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
    const unlockAudio = () => {
        const c = getAudioContext();
        if (c.state !== 'running') c.resume().then(() => bootLog('unlock → ' + c.state));
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
                streamDecoder = new StreamDecoder(context, AUDIO_URL);
                await streamDecoder.init();
                bootLog('decoder ready');
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

    emailLinkEl = createA('mailto:weatherreport.live@gmail.com', 'weatherreport.live@gmail.com');
    emailLinkEl.style('position', 'fixed');
    emailLinkEl.style('left', '50%');
    emailLinkEl.style('top', 'calc(50% + 290px)');
    emailLinkEl.style('transform', 'translate(-50%, -50%)');
    emailLinkEl.style('color', 'white');
    emailLinkEl.style('font-family', "'NotoSansKR-Thin', 'Times New Roman', serif");
    emailLinkEl.style('font-size', '18px');
    emailLinkEl.style('text-decoration', 'underline');
    emailLinkEl.style('z-index', '10');

    copyrightEl = createElement('div', '© 2025 - 2026 Weather Report (Jiyeon Kim, Gangil Yi)');
    copyrightEl.style('position', 'fixed');
    copyrightEl.style('left', '20px');
    copyrightEl.style('bottom', '20px');
    copyrightEl.style('color', 'white');
    copyrightEl.style('font-family', "'NotoSansKR-Thin', 'Times New Roman', serif");
    copyrightEl.style('font-size', '16px');
    copyrightEl.style('pointer-events', 'none');
    copyrightEl.style('z-index', '10');

    portraitHintEl = createElement('div', 'Rotate your phone for a larger view · 가로로 돌리면 크게 볼 수 있어요');
    portraitHintEl.style('position', 'fixed');
    portraitHintEl.style('left', '0');
    portraitHintEl.style('width', '100%');
    portraitHintEl.style('top', '24px');
    portraitHintEl.style('text-align', 'center');
    portraitHintEl.style('color', 'rgba(255,255,255,0.7)');
    portraitHintEl.style('font-family', "'NotoSansKR-Thin', 'Times New Roman', serif");
    portraitHintEl.style('font-size', '13px');
    portraitHintEl.style('pointer-events', 'none');
    portraitHintEl.style('z-index', '10');
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
        if (reconnectTimer) return; // 이미 예약돼 있으면 무시
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
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
    audio.addEventListener('playing', () => { reconnectDelay = RECONNECT_BASE_MS; });

    source = context.createMediaElementSource(audio);
    source.connect(gainOut);
    source.connect(gainFFT);
}

// 직접 디코딩 경로를 쓸지: ?decoder=1 / ?decoder=0 으로 강제 가능, 기본은 WebKit 엔진일 때
function shouldUseStreamDecoder() {
    const q = new URLSearchParams(location.search).get('decoder');
    if (q === '1') return true;
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
    // 작품이 돌고 있으면 크기를 바꾸기 전에 지금까지의 그림을 복사해 둔다 (전체화면 전환·회전 때 흔적 유지)
    let snap = null;
    const oldVW = VW;
    if (started) {
        snap = document.createElement('canvas');
        snap.width = canvas.elt.width; snap.height = canvas.elt.height;
        snap.getContext('2d').drawImage(canvas.elt, 0, 0);
    }

    const lay = computeCanvasLayout();
    resizeCanvas(lay.w, lay.h);
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
    SS = Math.min(1, width / START_DESIGN_W, height / START_DESIGN_H);
}

// 시작 화면의 HTML 요소(이메일·저작권)도 시작 화면 배율에 맞춤
function updateStartDomLayout() {
    if (emailLinkEl) {
        emailLinkEl.style('top', `calc(50% + ${324 * SS}px)`);
        emailLinkEl.style('font-size', Math.max(11, 18 * SS) + 'px');
    }
    if (copyrightEl) {
        copyrightEl.style('left', Math.max(8, 20 * SS) + 'px');
        copyrightEl.style('bottom', Math.max(8, 20 * SS) + 'px');
        copyrightEl.style('font-size', Math.max(10, 16 * SS) + 'px');
    }
    updatePortraitHint();
}

// 세로 화면(폰)일 때 가로로 돌려 보라는 안내 (막지는 않음)
function updatePortraitHint() {
    if (!portraitHintEl) return;
    const isPortraitTouch = windowHeight > windowWidth && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    portraitHintEl.style('display', isPortraitTouch && !started ? 'block' : 'none');
}

// 화면 좌표 → 시작 화면 그리기 좌표 (중심 기준 SS 축소 역변환)
function toStartCoords(mx, my) {
    return { x: (mx - width / 2) / SS + width / 2, y: (my - height / 2) / SS + height / 2 };
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

    // 시작 후: 오디오가 멈춰 있으면(iOS 전화·알림·세션 끊김 등) 탭으로 다시 깨움
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume().then(() => bootLog('tap resume → ' + getAudioContext().state));
    }
}

function touchStarted() {
    mousePressed();
    return false;
}

function startAudio() {
    bootLog('startAudio');
    background(BG_COLOR);
    if (!USE_MIC_INPUT) {
        // (iOS 오디오 세션 'playback' 설정은 index.html에서 AudioContext 생성 전에 함)
        getAudioContext().resume().then(() => bootLog('ctx resume → ' + getAudioContext().state));
        if (audio) audio.play();               // 기존 방식은 제스처 안에서 바로 재생
        audioReady.then(() => {
            if (streamDecoder) startDecoderWhenRunning();
            else if (audio && audio.paused) audio.play();
        });
        fadeInAudio(START_FADE_IN_MS);
    }
    started = true;
    startTime = new Date();
    cycleStartMillis = millis(); // 사이클 타이머 시작
    if (emailLinkEl) emailLinkEl.style('display', 'none');
    if (copyrightEl) copyrightEl.style('display', 'none');
    if (portraitHintEl) portraitHintEl.style('display', 'none');
    // 전체화면: 지원하는 곳에서만 (아이폰 Safari는 요소 전체화면 미지원), ?nofs 로 끌 수 있음
    if (document.fullscreenEnabled && !new URLSearchParams(location.search).has('nofs')) fullscreen(true);
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

function fadeInAudio(durationMillis = 3000) {
    if (!gainOut) return;
    let steps = 30;
    let stepTime = durationMillis / steps;
    let currentStep = 0;
    let fadeInterval = setInterval(() => {
        currentStep++;
        let vol = currentStep / steps;
        gainOut.gain.value = constrain(vol, 0, 1);
        if (currentStep >= steps) clearInterval(fadeInterval);
    }, stepTime);
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
        'path: ' + (streamDecoder ? 'decoder' : audio ? 'element' : 'none') + '  started: ' + started,
        'ctx: ' + getAudioContext().state + ' @' + getAudioContext().sampleRate + '  spec: ' + spec,
        st ? 'buf: ' + st.bufferedSec.toFixed(2) + 's  playing: ' + st.playing + '  conn: ' + st.connected + '  under: ' + st.underruns + '  reconn: ' + st.reconnects : '',
        audio ? 'audio t: ' + audio.currentTime.toFixed(1) + ' paused: ' + audio.paused : '',
        'canvas: ' + Math.round(width) + 'x' + Math.round(height) + ' top ' + Math.round(canvasTop) + '  win: ' + windowWidth + 'x' + windowHeight,
        'standalone: ' + (navigator.standalone === true) + '  AD: ' + (typeof AudioDecoder) + '  secure: ' + window.isSecureContext,
        debugErrors.slice(-3).join('\n'),
    ].filter(Boolean).join('\n'));
}

function draw() {
    if (frameCount === 1) bootLog('first draw');
    updateDebug();
    if (!assetsReady) { background(BG_COLOR); return; }   // 텍스트·폰트 준비 전에는 검은 화면
    // 풀스크린일 때 커서 숨김, 아니면 표시
    if (fullscreen()) noCursor();
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
    // 작은 화면: 중심 기준으로 SS 만큼 축소 (넓은 화면은 SS=1 → 기존과 동일)
    push();
    translate(width / 2 * (1 - SS), height / 2 * (1 - SS));
    scale(SS);
    fill(255);
    textAlign(CENTER, CENTER);
    strokeWeight(0.1);

    textFont(englishFont);
    textSize(30);
    text("Some-bodies are listening, too", width / 2, height / 2 - 220);

    textFont(koreanFont);
    textSize(28);
    text("누군가 듣고 있어", width / 2, height / 2 - 160);

    // [아이콘 테스트용 — 필요시 주석 해제]
    // const _iconTypes = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'thunder'];
    // const _testIcon = _iconTypes[Math.floor(millis() / 5000) % _iconTypes.length];
    // drawWeatherIcon(width / 2, height / 2 - 98, _testIcon);

    // textFont(englishFont2);
    // textSize(20);
    // text("Jiyeon Kim, Gangil Yi", width / 2, height / 2 - 150);

    textFont(englishFont2);
    textSize(25);
    noStroke();
    fill(255);
    const weatherSuffix = weatherIconType
        ? '  ·  ' + weatherIconType[0].toUpperCase() + weatherIconType.slice(1)
        : '  ·  ' + '- - - - -'; // 데이터 대기 중: 대시 placeholder (도착하면 날씨 이름으로 교체)
    text(getFormattedKoreanTime() + weatherSuffix, width / 2, height / 2 + 40);

    // --- Live (텍스트, 버튼 아님) ---
    textFont(englishFont2);
    textSize(24);
    noStroke();
    fill(255);
    // text("Live", width / 2, height / 2 + 110);

    // --- 설명 라인 ---
    textSize(14);
    // text("Select language", width / 2, height / 2 + 145);

    // --- ENG / KOR 버튼 (설명 아래) ---
    let langY = height / 2 + 170;
    let btnW = 90, btnH = 34, gap = 14;
    let totalW = btnW * 2 + gap;
    let leftX = width / 2 - totalW / 2;

    ui.eng = { x: leftX, y: langY - 80, w: btnW, h: btnH };
    ui.kor = { x: leftX + btnW + gap, y: langY - 80, w: btnW, h: btnH };

    // ENG (항상 비어있는 버튼, 선택 시 테두리 두께만 변경)
    noFill();
    stroke(255);
    strokeWeight(lang === "ENG" ? 1.5 : 1.5);
    rect(ui.eng.x, ui.eng.y, ui.eng.w, ui.eng.h, 16);

    noStroke();
    fill(255);
    textFont(englishFont2);
    textSize(16);
    text("ENG", ui.eng.x + ui.eng.w / 2, ui.eng.y + ui.eng.h / 2 - 3);

    // KOR (항상 비어있는 버튼, 선택 시 테두리 두께만 변경)
    noFill();
    stroke(255);
    strokeWeight(lang === "KOR" ? 1.5 : 1.5);
    rect(ui.kor.x, ui.kor.y, ui.kor.w, ui.kor.h, 16);

    noStroke();
    fill(255);
    text("KOR", ui.kor.x + ui.kor.w / 2, ui.kor.y + ui.kor.h / 2 - 3);

    // 커서 처리(풀스크린 아닐 때만)
    if (!fullscreen()) {
        const sp = toStartCoords(mouseX, mouseY);
        let overEng = hit(sp.x, sp.y, ui.eng);
        let overKor = hit(sp.x, sp.y, ui.kor);
        if (overEng || overKor) cursor(HAND);
        else cursor(ARROW);
    }

    strokeWeight(0.3);
    fill(255);
    textSize(18);
    text("* Works on desktop and mobile browsers. On a phone, landscape view is recommended", width / 2, height / 2 + 216);
    textSize(16);
    text("* 데스크톱과 모바일 브라우저에서 볼 수 있습니다. 휴대폰은 가로 화면을 권장합니다.", width / 2, height / 2 + 240);
    textSize(18);
    text("** For the intended layout and subtitle scale, please view at default browser zoom (100%)", width / 2, height / 2 + 268);
    textSize(16);
    text("** 의도한 레이아웃과 자막 크기로 보려면 브라우저 확대/축소를 기본값(100%)으로 해 주세요.", width / 2, height / 2 + 292);
    pop();
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
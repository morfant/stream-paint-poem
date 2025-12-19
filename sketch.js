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
let MESSAGE_INTERVAL_SEC = 10;        // 문장 간격(초)
let MESSAGE_PRINT_FRAMES = 30;        // 문장 보여주는 프레임 수 (FPS 기반)

// ■ 오디오 페이드
let START_FADE_IN_MS = 8000;          // 최초/리셋 시 오디오 페이드인 시간(ms)
let FFT_TAP_GAIN = 0.5;               // FFT 분석용 테핑 게인(듣기 음량과 별개)
let OUTPUT_START_GAIN = 0.0;          // 출력 게인 시작 값(무음 권장)
let ENABLE_FADE_IN_ON_RESET = false;  // 리셋 때도 페이드인을 적용할지

// ■ 폰트/텍스트 리소스
let MSG_SIZE = 30;
let SENTENCES_FILE_KOR = "sentences_KOR.txt";
let SENTENCES_FILE_ENG = "sentences_ENG.txt";
let FONT_KO = "fonts/AppleMyungjo.ttf";
let FONT_EN = "fonts/Times New Roman.ttf";
let FONT_EN_THIN = "fonts/NotoSansKR-Thin.otf";

/**********************
 * 내부 상태/런타임 변수 (수정 비권장)
 **********************/

let audio, mic, fft, source, gainOut;
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
let graphPoints = [];

let fadeOutCounter = 0;

let canvas;

let messageCount = 0;          // 출력된 문장 수
let allMessagesShown = false;  // 모든 문장 1회 출력 완료 여부
let cycleStartMillis = 0;      // 사이클 기준 타이머


let ui = {
    kor: null,
    eng: null
    // langLabel: null // (optional, add if you want to reference a label area)
};

function preload() {
    // 캐시 회피 쿼리 부착
    sentencesKOR = loadStrings(`${SENTENCES_FILE_KOR}?${millis()}`);
    sentencesENG = loadStrings(`${SENTENCES_FILE_ENG}?${millis()}`);

    koreanFont = loadFont(FONT_KO);
    englishFont = loadFont(FONT_EN);
    englishFont2 = loadFont(FONT_EN_THIN);
}

function setup() {
    // 비율 유지 크기 계산
    let w = windowWidth;
    let h = windowHeight;
    if (w / h > ASPECT_RATIO) w = h * ASPECT_RATIO;
    else h = w / ASPECT_RATIO;

    canvas = createCanvas(w, h);
    canvas.position((windowWidth - w) / 2, (windowHeight - h) / 2);
    canvas.style('display', 'block');
    background(BG_COLOR);

    noStroke();
    frameRate(FPS);

    visualizeMul = width * VISUALIZE_INTENSITY_MUL;
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
        audio = new Audio(AUDIO_URL);
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        document.body.appendChild(audio);

        let context = getAudioContext();
        source = context.createMediaElementSource(audio);

        gainOut = context.createGain();
        gainOut.gain.value = OUTPUT_START_GAIN;
        source.connect(gainOut);
        gainOut.connect(context.destination);

        let gainFFT = context.createGain();
        gainFFT.gain.value = FFT_TAP_GAIN;
        source.connect(gainFFT);
        fft.setInput(gainFFT);
    }

    sentences = sentencesKOR;

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

function windowResized() {
    let w = windowWidth;
    let h = windowHeight;
    if (w / h > ASPECT_RATIO) w = h * ASPECT_RATIO;
    else h = w / ASPECT_RATIO;

    resizeCanvas(w, h);
    canvas.position((windowWidth - w) / 2, (windowHeight - h) / 2);
    background(BG_COLOR);

    // 가로폭 바뀌면 스케일 다시 계산
    visualizeMul = width * VISUALIZE_INTENSITY_MUL;
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
    currentMessage = "";
    lastMessageFrame = -1000;
    lastMessageX = null;
}

function mousePressed() {
    // 시작 전: 언어 선택 UI 클릭 처리 (선택 즉시 시작)
    if (!started) {
        // 오디오 컨텍스트는 사용자 제스처에서만 resume 가능
        if (getAudioContext().state !== 'running') {
            getAudioContext().resume();
        }

        // ENG
        if (hit(mouseX, mouseY, ui.eng)) {
            lang = "ENG";
            sentences = sentencesENG;
            resetMessageStateOnly();
            startAudio();
            return;
        }

        // KOR
        if (hit(mouseX, mouseY, ui.kor)) {
            lang = "KOR";
            sentences = sentencesKOR;
            resetMessageStateOnly();
            startAudio();
            return;
        }

        return;
    }

    // 시작 후(기존 동작 유지): 필요하면 여기에서 추가 동작
}

function touchStarted() {
    mousePressed();
    return false;
}

function startAudio() {
    background(BG_COLOR);
    if (!USE_MIC_INPUT) {
        audio.play();
        fadeInAudio(START_FADE_IN_MS);
    }
    started = true;
    startTime = new Date();
    cycleStartMillis = millis(); // 사이클 타이머 시작
    fullscreen(true);
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
    currentMessage = "";
    lastMessageFrame = -1000;
    lastMessageX = null;

    // 타이머 초기화
    startTime = new Date();
    cycleStartMillis = millis();

    // 원하면 리셋 시에도 페이드인
    if (ENABLE_FADE_IN_ON_RESET && !USE_MIC_INPUT) fadeInAudio(START_FADE_IN_MS);
}

function draw() {
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
        drawMainVisualization();
        updateGraphPoints(GRAPH_POINT_UPDATE_INTERVAL);
        drawGraphPoints();
        drawCurrentMessage();

        // 스캔이 왼쪽 끝까지 도달했을 때 처리
        if (cnt >= width) {
            if (allMessagesShown) {
                resetScene(); // 모든 문장 1회 표시 완료 후엔 전체 리셋
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
    fill(255);
    textAlign(CENTER, CENTER);
    strokeWeight(0.1);

    textFont(englishFont);
    textSize(30);
    text("Some-bodies are listening, too", width / 2, height / 2 - 220);

    textFont(englishFont2);
    textSize(20);
    text("Jiyeon Kim, Gangil Yi", width / 2, height / 2 - 150);

    textFont(englishFont2);
    textSize(25);
    text(getFormattedKoreanTime(), width / 2, height / 2 + 40);

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
        let overEng = hit(mouseX, mouseY, ui.eng);
        let overKor = hit(mouseX, mouseY, ui.kor);
        if (overEng || overKor) cursor(HAND);
        else cursor(ARROW);
    }

    strokeWeight(0.3);
    fill(255);
    textSize(18);
    text("* This site works only on desktop versions of Firefox and Chrome", width / 2, height / 2 + 230);
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
        let y = height - i;
        let x = constrain(width - cnt, 0, width);
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

    let gx = frameCount % (width + 1) + random(-1, 1);
    let gy = map(abs(sample), 0, 1, 0, height);
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
            translate(lastMessageX, height - 22);
            rotate(-HALF_PI + jitterAngle);
            textFont(/[ㄱ-ㆎ|가-힣]/.test(currentMessage) ? koreanFont : englishFont);
            const a = constrain((frameCount - lastMessageFrame) / MESSAGE_PRINT_FRAMES * 255, 0, 255);
            fill(0, 0, 0, a);
            noStroke();
            textSize(MSG_SIZE);
            textAlign(LEFT, CENTER);
            text(currentMessage, 0, 0);
            pop();
        }
        return; // ★ 새 문장 생성/스케줄링 로직으로 내려가지 않음
    }

    // --- 아래는 "allMessagesShown === false"일 때만 동작 ---
    let elapsedSeconds = (millis() - cycleStartMillis) / 1000;

    if (sentenceIndex === 0) {
        if (elapsedSeconds >= FIRST_MESSAGE_DELAY_SEC && currentMessage === "") {
            currentMessage = sentences[sentenceIndex];
            lastMessageFrame = frameCount;
            lastMessageX = width - cnt;
            sentenceIndex = (sentenceIndex + 1) % sentences.length;
            jitterAngle = radians(random(-3, 3));

            messageCount++;
            if (messageCount >= sentences.length) allMessagesShown = true;
        }
    } else {
        let intervalFrames = FPS * MESSAGE_INTERVAL_SEC;
        if ((frameCount - lastMessageFrame) >= intervalFrames && sentences.length > 0) {
            currentMessage = sentences[sentenceIndex];
            lastMessageFrame = frameCount;
            lastMessageX = width - cnt;
            sentenceIndex = (sentenceIndex + 1) % sentences.length;
            jitterAngle = radians(random(-3, 3));

            messageCount++;
            if (messageCount >= sentences.length) allMessagesShown = true;
        }
    }

    if (frameCount - lastMessageFrame < MESSAGE_PRINT_FRAMES) {
        push();
        translate(lastMessageX, height - 22);
        rotate(-HALF_PI + jitterAngle);
        textFont(/[ㄱ-ㆎ|가-힣]/.test(currentMessage) ? koreanFont : englishFont);
        const a = constrain((frameCount - lastMessageFrame) / MESSAGE_PRINT_FRAMES * 255, 0, 255);
        fill(0, 0, 0, a);
        noStroke();
        textSize(MSG_SIZE);
        textAlign(LEFT, CENTER);
        text(currentMessage, 0, 0);
        pop();
    }
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
    let now = new Date();
    now.setUTCHours(now.getUTCHours() + 9);
    return `UTC+9 ${now.getUTCFullYear()}-${nf(now.getUTCMonth() + 1, 2)}-${nf(now.getUTCDate(), 2)} ${nf(now.getUTCHours(), 2)}:${nf(now.getUTCMinutes(), 2)}:${nf(now.getUTCSeconds(), 2)}`;
}
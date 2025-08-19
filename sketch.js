let audio, mic, fft, source, gainOut;
let spectrum = [];
let cnt = 0;
let bands = 1024;
let points = [];
let radius = [];
let started = false;
let visualizeMul;
let bgColor = 0;
let fps = 30;
let visualizeMode = 0;
let useMicInput = false;
let micAmp = 0.1;
let theBlue, theBlueTop;

let graphPointUpdateInterval = 1;
let startTime;
let lastMessageFrame = -1000;
let lastMessageX = null;
let currentMessage = "";

let firstMessageDelaySeconds = 60;
let messageIntervalSeconds = 10;
let messagePrintFrames = 30;
let sentences = [];
let sentenceIndex = 0;
let jitterAngle = 0;
let isInRange = false;
let loopCount = 0;

let koreanFont, englishFont, englishFont2;
let graphPoints = [];

let fadeOutCounter = 0;

let aspectRatio = 1280 / 512;
let canvas;
let fullscreenButton;

let messageCount = 0;        // 출력된 문장 수
let allMessagesShown = false; // 모든 문장 1회 출력 완료 여부

function preload() {
    // Load the sentences from the text file
    sentences = loadStrings("sentences_KOR.txt?" + millis());
    koreanFont = loadFont("fonts/AppleMyungjo.ttf");
    englishFont = loadFont("fonts/Times New Roman.ttf");
    englishFont2 = loadFont("fonts/NotoSansKR-Thin.otf");
}

function setup() {
    // 비율을 유지한 크기 계산
    let w = windowWidth;
    let h = windowHeight;
    if (w / h > aspectRatio) {
        w = h * aspectRatio;
    } else {
        h = w / aspectRatio;
    }

    canvas = createCanvas(w, h);
    canvas.position((windowWidth - w) / 2, (windowHeight - h) / 2);  // 화면 중앙 정렬
    canvas.style('display', 'block');
    background(bgColor);

    // createCanvas(1280, 512);
    // createCanvas(windowWidth, windowHeight);
    // background(bgColor);
    noStroke();
    frameRate(fps);

    visualizeMul = width;
    fft = new p5.FFT(0.9, bands);

    theBlue = color(0, 100, 200, 50);
    // theBlue = color(0, 0, 0, 50);
    theBlueTop = color(0, 100, 200, 10);
    // theBlueTop = color(255, 255, 255, 10);

    graphPoints.push({ x: 0, y: 6 });

    if (useMicInput) {
        mic = new p5.AudioIn();
        mic.start(() => {
            let context = getAudioContext();
            let micSource = context.createMediaStreamSource(mic.stream);
            let micGain = context.createGain();
            micGain.gain.value = micAmp;
            micSource.connect(micGain);
            fft.setInput(micGain);
        });
    } else {
        audio = new Audio("https://locus.creacast.com:9443/jeju_georo.mp3");
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        document.body.appendChild(audio);

        let context = getAudioContext();
        source = context.createMediaElementSource(audio);

        gainOut = context.createGain();
        gainOut.gain.value = 0.0; // 처음에는 무음으로 시작
        source.connect(gainOut);
        gainOut.connect(context.destination);

        let gainFFT = context.createGain();
        gainFFT.gain.value = 0.5;
        source.connect(gainFFT);
        fft.setInput(gainFFT);
    }

    // fullscreenButton
    // fullscreenButton = createButton('Toggle Fullscreen');
    // fullscreenButton.position(20, 20); // 좌측 상단에 위치
    // fullscreenButton.style('padding', '8px 16px');
    // fullscreenButton.style('font-size', '16px');
    // fullscreenButton.mousePressed(toggleFullscreen);

}

function toggleFullscreen() {
    let fs = fullscreen();
    fullscreen(!fs); // 현재 상태의 반대로 설정
}

function keyPressed() {
    if (key === 'f' || key === 'F') {
        toggleFullscreen();
    }
}

function windowResized() {
    let w = windowWidth;
    let h = windowHeight;
    if (w / h > aspectRatio) {
        w = h * aspectRatio;
    } else {
        h = w / aspectRatio;
    }

    resizeCanvas(w, h);
    canvas.position((windowWidth - w) / 2, (windowHeight - h) / 2);
    background(bgColor);
}

function mousePressed() {
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume().then(() => { if (!started) startAudio(); });
    } else if (!started) {
        startAudio();
    }
}

function touchStarted() {
    mousePressed();
    return false;
}

function startAudio() {
    background(bgColor);
    if (!useMicInput) {
        audio.play();
        fadeInAudio(8000); // 실제로 gainOut을 점점 키움
    }
    started = true;
    startTime = new Date();
}

function fadeInAudio(durationMillis = 3000) {
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
    background(bgColor);

    // 시각화/타임라인 상태 초기화
    cnt = 0;
    loopCount++;
    fadeOutCounter = 0;

    // 데이터 버퍼 초기화
    points = [];
    radius = [];
    graphPoints = [{ x: 0, y: 6 }];

    // 메시지 상태 초기화 (다시 처음부터)
    sentenceIndex = 0;
    messageCount = 0;
    allMessagesShown = false;
    currentMessage = "";
    lastMessageFrame = -1000;
    lastMessageX = null;

    // 타이머 초기화
    startTime = new Date();

    // 원하면 오디오 페이드인 재적용 가능
    if (!useMicInput) fadeInAudio(8000);
}

function draw() {
    cursor(ARROW);
    if (!started) {
        drawStartScreen();
        return;
    }


    if (started)
    {
        if (fullscreen()) {
            noCursor(); // 포인터 숨김
        } else {
            cursor(ARROW); // 일반 화살표 표시
        }
    }


    if (cnt === 0) startTime = new Date();

    spectrum = fft.analyze();

    if (visualizeMode === 0) {
        drawMainVisualization();
        updateGraphPoints(graphPointUpdateInterval);
        drawGraphPoints();
        drawCurrentMessage();

        if (cnt >= width) {
            if (allMessagesShown) {
                resetScene(); // 전체 초기화
            } else {
                fadeOutCounter = 30;
                cnt = 0;
                loopCount++;
            }
        }

        if (fadeOutCounter > 0) {
            background(bgColor, 2 / 3);
            fadeOutCounter--;
        }
    }
}

function drawStartScreen() {
    background(bgColor);
    fill(255);
    textAlign(CENTER, CENTER);
    strokeWeight(0.1);

    textFont(englishFont);
    textSize(30);
    text("Some-bodies are listening, too", width / 2, height / 2 - 220);

    // Author names
    textFont(englishFont2);
    textSize(20);
    text("Jiyeon Kim, Gangil Yi", width / 2, height / 2 - 150);

    textFont(englishFont2);
    textSize(15);
    text(getFormattedKoreanTime(), width / 2, height / 2 + 40);

    textSize(24);
    let liveText = "Live";
    let textW = textWidth(liveText);
    let boxW = textW + 40;
    let boxH = 42;
    let boxX = width / 2 - boxW / 2;
    let boxY = height / 2 + 100;

    stroke(255);
    strokeWeight(2);
    noFill();
    rect(boxX, boxY, boxW, boxH, 20);

    strokeWeight(0.1);
    fill(255);
    text(liveText, width / 2, boxY + boxH / 4 + 5);

    if (mouseX > boxX && mouseX < boxX + boxW && mouseY > boxY && mouseY < boxY + boxH) {
        cursor(HAND);
    }

    strokeWeight(0.3);
    textSize(18);
    text("* This site works only on desktop versions of Firefox and Chrome", width / 2, height / 2 + 230);
}

function drawMainVisualization() {
    push();
    translate(0, -23);

    for (let i = 0; i < bands; i++) {
        noStroke();
        // fill(255);
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

    if (graphPoints.length > 2) {
        graphPoints.shift();
    }
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
    let elapsedSeconds = millis() / 1000;

    if (sentenceIndex === 0) {
        if (elapsedSeconds >= firstMessageDelaySeconds && currentMessage === "") {
            currentMessage = sentences[sentenceIndex];
            lastMessageFrame = frameCount;
            lastMessageX = width - cnt;
            sentenceIndex = (sentenceIndex + 1) % sentences.length;
            jitterAngle = radians(random(-3, 3));

            messageCount++;
            if (messageCount >= sentences.length) allMessagesShown = true;

        }
    } else {
        let intervalFrames = fps * messageIntervalSeconds;
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

    if (frameCount - lastMessageFrame < messagePrintFrames) {
        push();
        translate(lastMessageX, height - 22);
        rotate(-HALF_PI + jitterAngle);
        textFont(/[ㄱ-ㆎ|가-힣]/.test(currentMessage) ? koreanFont : englishFont);
        fill(0, 0, 0, constrain((frameCount - lastMessageFrame) / messagePrintFrames * 255, 0, 255));
        // fill(255, 255, 255, constrain((frameCount - lastMessageFrame) / messagePrintFrames * 255, 0, 255));
        // fill(255, 255, 255, 8);
        // fill(0, 0, 0, 20);
        noStroke();
        textSize(24);
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
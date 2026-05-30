/**
 * WeatherIcons — p5.js weather icon module
 *
 * Usage:
 *   1. Include after p5.js in your HTML:
 *      <script src="weather-icons.js"></script>
 *
 *   2. Fetch and draw:
 *      let icon = null, temp = null;
 *
 *      WeatherIcons.fetch(33.499, 126.531, (type, tempC) => {
 *          icon = type;
 *          temp = tempC;
 *      });
 *
 *      // inside draw():
 *      if (icon) WeatherIcons.draw(x, y, icon);
 *
 * Icon types (can also be set manually):
 *   'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder'
 *
 * WMO code lookup:
 *   let type = WeatherIcons.fromWMO(95); // → 'thunder'
 */

const WeatherIcons = (() => {

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Draw a weather icon centered at (x, y).
     * Call inside p5.js draw(). Uses global frameCount for animation.
     *
     * @param {number} x
     * @param {number} y
     * @param {'clear'|'cloudy'|'rain'|'snow'|'fog'|'thunder'} type
     * @param {object} [opts]
     * @param {number}  [opts.size=1]         - scale multiplier
     * @param {number}  [opts.r=255]          - stroke red
     * @param {number}  [opts.g=255]          - stroke green
     * @param {number}  [opts.b=255]          - stroke blue
     * @param {number}  [opts.weight=0.9]     - strokeWeight
     */
    function draw(x, y, type, opts = {}) {
        const { size = 1, r = 255, g = 255, b = 255, weight = 0.9 } = opts;

        push();
        translate(x, y);
        scale(size);
        stroke(r, g, b);
        noFill();
        strokeWeight(weight);
        strokeCap(ROUND);

        const t = frameCount * 0.03;

        if (type === 'clear')   _drawClear(t, r, g, b);
        if (type === 'cloudy')  _drawCloudy(t);
        if (type === 'rain')    _drawRain(r, g, b);
        if (type === 'snow')    _drawSnow(r, g, b);
        if (type === 'fog')     _drawFog(t, r, g, b);
        if (type === 'thunder') _drawThunder(r, g, b);

        pop();
    }

    /**
     * Map a WMO weather code to an icon type string.
     * @param {number} code
     * @returns {'clear'|'cloudy'|'rain'|'snow'|'fog'|'thunder'}
     */
    function fromWMO(code) {
        if (code <= 1)                               return 'clear';
        if (code <= 3)                               return 'cloudy';
        if (code === 45 || code === 48)              return 'fog';
        if ([71,73,75,77,85,86].includes(code))      return 'snow';
        if ([95,96,99].includes(code))               return 'thunder';
        return 'rain'; // 51-55 drizzle, 61-65 rain, 80-82 showers
    }

    /**
     * Fetch current weather from Open-Meteo (free, no API key).
     * Refreshes automatically every `intervalMin` minutes.
     *
     * @param {number}   lat
     * @param {number}   lon
     * @param {function} callback  - called with (type, tempC) on success
     * @param {number}   [intervalMin=10]
     */
    function fetch(lat, lon, callback, intervalMin = 10) {
        const _fetch = () => {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m`;
            window.fetch(url)
                .then(r => r.json())
                .then(data => {
                    const type = fromWMO(data.current.weather_code);
                    const tempC = Math.round(data.current.temperature_2m);
                    callback(type, tempC);
                })
                .catch(() => {});
        };
        _fetch();
        setInterval(_fetch, intervalMin * 60 * 1000);
    }

    // ── Private drawing functions ───────────────────────────────────────────

    // 맑음: 원 + 8개 방사선 (느린 회전 + 길이 맥동)
    function _drawClear(t, r, g, b) {
        const radius = 9;
        ellipse(0, 0, radius * 2);
        const rayLen = 6 + sin(t * 1.4) * 2;
        const rayGap = radius + 5;
        for (let i = 0; i < 8; i++) {
            const a = TWO_PI / 8 * i + t * 0.04;
            line(
                cos(a) * rayGap,             sin(a) * rayGap,
                cos(a) * (rayGap + rayLen),  sin(a) * (rayGap + rayLen)
            );
        }
    }

    // 흐림: 3겹 호 구름 (위아래 표류)
    function _drawCloudy(t) {
        push();
        translate(0, sin(t * 0.7) * 2.5);
        _cloudBase();
        pop();
    }

    // 비: 구름 + 대각 빗줄기 낙하
    function _drawRain(r, g, b) {
        push(); translate(0, -9); _cloudBase(); pop();

        const xs = [-14, -6, 2, 10, 18];
        const period = 35;
        for (let i = 0; i < xs.length; i++) {
            const prog = ((frameCount + i * 7) % period) / period;
            stroke(r, g, b, sin(prog * PI) * 255);
            line(xs[i], 4 + prog * 18, xs[i] - 3, 10 + prog * 18);
        }
    }

    // 눈: 구름 + 십자 눈송이 낙하 (좌우 표류)
    function _drawSnow(r, g, b) {
        push(); translate(0, -9); _cloudBase(); pop();

        const xs = [-12, -2, 7, 16, -7];
        const period = 55;
        const s = 3.5;
        for (let i = 0; i < xs.length; i++) {
            const prog = ((frameCount + i * 11) % period) / period;
            const dx = xs[i] + sin(prog * TWO_PI + i * 1.3) * 2.5;
            const dy = 4 + prog * 18;
            stroke(r, g, b, sin(prog * PI) * 255);
            line(dx - s, dy, dx + s, dy);
            line(dx, dy - s, dx, dy + s);
        }
    }

    // 안개: 가로선 4개, 위상 다르게 표류
    function _drawFog(t, r, g, b) {
        const layers = [
            { y: -12, len: 38, phase: 0.0 },
            { y:  -3, len: 28, phase: 1.1 },
            { y:   6, len: 36, phase: 0.5 },
            { y:  15, len: 22, phase: 1.8 },
        ];
        for (const l of layers) {
            const xOff = sin(t * 0.7 + l.phase) * 4;
            stroke(r, g, b, 200);
            line(-l.len / 2 + xOff, l.y, l.len / 2 + xOff, l.y);
        }
    }

    // 뇌우: 구름 + 번개 지그재그 (주기적 번쩍)
    function _drawThunder(r, g, b) {
        push(); translate(0, -9); _cloudBase(); pop();

        if ((frameCount % 60) < 6) {
            strokeWeight(1.2);
            stroke(r, g, b);
            beginShape();
            vertex(2,  4);
            vertex(-5, 13);
            vertex(0,  13);
            vertex(-7, 24);
            endShape();
        }
    }

    // 구름 베이스 (흐림/비/눈/뇌우 공용, 좌표 원점 기준)
    function _cloudBase() {
        arc(-9,  0, 22, 15, PI, TWO_PI);
        arc( 3, -5, 26, 18, PI, TWO_PI);
        arc(14,  0, 18, 13, PI, TWO_PI);
        line(-20, 0, 23, 0);
    }

    return { draw, fromWMO, fetch };

})();

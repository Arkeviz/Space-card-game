
// Портал для перехода между экранами: круг с крутящейся белой каймой, синими вихрями внутри и мягким синим ореолом
// снаружи. Прозрачный холст: цвет предумножен на альфу, свечение добавляется к тому, что под холстом.
//
// Uniform-переменные задаёт приложение:
//   uAppear - рост портала от точки (0) до полного размера (1; можно чуть больше, для «пружины»);
//   uOpen   - раскрытие: внутренность становится прозрачной (там виден новый экран), а кайма разлетается за края окна;
//   uBlack  - непрозрачный чёрный фон вокруг портала (0-1).

uniform float uAppear;
uniform float uOpen;
uniform float uBlack;

const float PI = 3.14159265;
/** Радиус портала в долях меньшей стороны окна (диаметр - 72%: в центр помещается строка с именами). */
const float PORTAL_RADIUS = 0.36;
/** До какого радиуса кайма разлетается при раскрытии: больше половины диагонали окна. */
const float OPEN_RADIUS = 1.7;

float pow2(float x) {
	return x * x;
}

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * noise(p);
		p *= 2.03;
		a *= 0.5;
	}
	return v;
}

// Шум, замкнутый по углу: без шва на границе -PI / PI.
float angularNoise(float angle, float radial, float cells, float t) {
	float a = angle / (2.0 * PI) * cells;
	float f = fract(a);
	float i = floor(a);
	float n0 = noise(vec2(mod(i, cells), radial + t));
	float n1 = noise(vec2(mod(i + 1.0, cells), radial + t));
	f = f * f * (3.0 - 2.0 * f);
	return mix(n0, n1, f);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	vec2 P = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
	float t = iTime;
	float dist = length(P);
	float ang = atan(P.y, P.x);

	// Радиус каймы: растёт от точки до PORTAL_RADIUS, при раскрытии разлетается дальше.
	float open = clamp(uOpen, 0.0, 1.0);
	float baseR = PORTAL_RADIUS * max(uAppear, 0.0);
	float R = mix(baseR, OPEN_RADIUS, open);
	float d = dist - R;
	float rr = clamp(dist / max(R, 0.0001), 0.0, 1.0);
	float live = smoothstep(0.0, 0.03, R);

	// Белая кайма: тонкая яркая линия с двумя бегущими по кругу вспышками, толщина растёт вместе с порталом.
	float ringW = 0.008 + 0.014 * min(R / PORTAL_RADIUS, 1.0);
	float core = exp(-pow2(d / (ringW * 0.5)));
	float body = exp(-pow2(d / (ringW * 1.8)));
	float arcs = pow(max(0.0, cos(ang - t * 3.2)), 6.0) + pow(max(0.0, cos(ang + PI * 0.8 - t * 3.2)), 6.0) * 0.8;
	float flicker = 0.8 + 0.2 * angularNoise(ang, 1.0, 14.0, -t * 6.0);
	vec3 white = (vec3(1.0) * core * (1.1 + 1.8 * arcs) + vec3(0.62, 0.82, 1.0) * body * (0.5 + 1.0 * arcs)) * flicker;

	// Синее свечение снаружи (затухает от каймы) и тонкое внутри каймы.
	float glowOut = exp(-max(d, 0.0) / (0.05 + 0.07 * min(R / PORTAL_RADIUS, 1.0)));
	float glowIn = exp(-max(-d, 0.0) / 0.07);
	vec3 halo = vec3(0.18, 0.5, 1.0) * (glowOut * step(0.0, d) * 0.85 + glowIn * step(d, 0.0) * 0.6) * live;

	// Вихри внутри: логарифмическая спираль из синих рукавов, к центру темнее, чтобы читался текст.
	// Угол спирали идёт через cos/sin, поэтому шум замкнут по кругу и на границе углов (слева) шва нет.
	float spin = ang + log(rr + 0.06) * 3.4 - t * 1.0;
	float spiral = fbm(vec2(cos(spin), sin(spin)) * 1.7 + vec2(rr * 3.2 - t * 0.35, rr * 2.3 + t * 0.2));
	float arms = smoothstep(0.35, 0.85, spiral);
	vec3 deep = vec3(0.01, 0.04, 0.22);
	vec3 blue = vec3(0.16, 0.55, 1.0);
	vec3 inner = mix(deep, blue, arms * smoothstep(0.25, 1.0, rr) * 0.8);
	inner += vec3(0.35, 0.75, 1.0) * pow(max(rr, 0.0), 6.0) * 0.5;
	float insideMask = 1.0 - smoothstep(-0.004, 0.004, d);
	float interiorAlpha = insideMask * mix(0.94, 0.0, smoothstep(0.0, 0.2, open)) * live;

	// Чёрный фон вокруг портала.
	float blackAlpha = clamp(uBlack, 0.0, 1.0) * (1.0 - insideMask);

	vec3 light = white + halo;
	float lum = max(light.r, max(light.g, light.b));
	float alpha = clamp(max(max(blackAlpha, interiorAlpha), lum * 0.5), 0.0, 1.0);
	fragColor = vec4(inner * interiorAlpha + light, alpha);
}

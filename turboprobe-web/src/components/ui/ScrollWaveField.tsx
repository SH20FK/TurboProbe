import * as React from "react"
import { useEffect, useRef } from "react"

const FIELD_W = 3600
const FIELD_D = 7000
const CAM_Z0 = 700
const FOV = 60
const DPR_CAP = 1.5
const TAU = Math.PI * 2
const MAX_COLORS = 8
const DEFAULT_COLORS = ["#ffffff", "#71717a", "#27272a"]
const WAVE_DIRECTION = 0
const WAVE_DIR_X = Math.sin((WAVE_DIRECTION * Math.PI) / 180)
const WAVE_DIR_Z = -Math.cos((WAVE_DIRECTION * Math.PI) / 180)

const CAM_Y_FULL = 550
const CAM_REF_AREA = 1200 * 800
const CAM_SCALE_MIN = 0.5
const CAM_SCALE_MAX = 2.5

const VERT = `
precision highp float;

attribute vec2 aGrid;
attribute vec2 aSeed;

uniform vec2  uRes;
uniform float uFocal;
uniform float uTime;
uniform float uAmp;
uniform float uScatter;
uniform float uFreq;
uniform vec2  uDir;
uniform float uFlow;
uniform float uDepth;
uniform float uCamY;
uniform float uCamZ;
uniform float uPitch;
uniform float uRoll;
uniform float uDot;
uniform float uColorCount;
uniform vec2  uJit;
uniform vec3  uColors[8];

varying vec3  vCol;
varying float vA;
varying float vHot;

vec3 pickColor(float sel) {
    float idx = floor(sel * uColorCount);
    vec3 c = uColors[0];
    for (int i = 1; i < 8; i++) {
        if (float(i) >= uColorCount) break;
        if (float(i) == idx) c = uColors[i];
    }
    return c;
}

float surf(vec2 q) {
    return sin(q.x) * 0.55
         + sin(q.x * 0.55 + q.y * 1.15) * 0.30
         + sin(q.y * 0.75) * 0.22;
}

void main() {
    vec2 w = aGrid + (aSeed - 0.5) * uJit;
    w.y = uCamZ + mod(w.y - uFlow - uCamZ, uDepth);
    float h3 = fract(sin(dot(aSeed, vec2(91.37, 47.13))) * 12345.678);
    float h = surf(w * uFreq - uDir * uTime) * uAmp + (h3 - 0.5) * uScatter;

    vec3 p = vec3(w.x, h - uCamY, w.y - uCamZ);
    float c = cos(uPitch);
    float s = sin(uPitch);
    float ry = p.y * c + p.z * s;
    float rz = -p.y * s + p.z * c;

    if (rz < 40.0) {
        gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
        gl_PointSize = 0.0;
        vCol = uColors[0];
        vA = 0.0;
        vHot = 0.0;
        return;
    }

    float cr = cos(uRoll);
    float sr = sin(uRoll);
    float rx = p.x * cr - ry * sr;
    float ryr = p.x * sr + ry * cr;

    float sx = rx * uFocal / rz;
    float sy = ryr * uFocal / rz;
    gl_Position = vec4(sx / (uRes.x * 0.5), sy / (uRes.y * 0.5), 0.0, 1.0);

    float rad = max(uDot * uFocal / rz, 0.55);
    gl_PointSize = clamp(rad * 2.0, 1.0, 220.0);

    float bri = 0.28 + h3 * 0.72;
    vec2 bq = w * vec2(0.0040, 0.0032) - uDir * uTime * 0.30;
    float band = sin(bq.x) + sin(bq.y);
    float sel = fract((band + 2.0) * 0.25 + (aSeed.y - 0.5) * 0.55);

    vCol = pickColor(sel);
    float lum = dot(vCol, vec3(0.299, 0.587, 0.114));
    vHot = (0.25 + 0.75 * lum) * bri * bri * 0.7;

    float fog = (1.0 - smoothstep(2800.0, 6400.0, rz))
              * smoothstep(70.0, 240.0, rz);

    vA = bri * fog;
}
`

const FRAG = `
precision highp float;

varying vec3  vCol;
varying float vA;
varying float vHot;

void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;

    float a = (1.0 - smoothstep(0.90, 1.0, d)) * vA;
    vec3 col = vCol + vec3(1.0) * pow(1.0 - d, 10.0) * vHot * 0.9;
    gl_FragColor = vec4(col * a, a);
}
`

function parseColor(input: string): [number, number, number] {
    if (!input) return [0, 0, 0]
    const s = input.trim()
    const fn = s.match(/rgba?\(([^)]+)\)/i)
    if (fn) {
        const p = fn[1].split(",").map((v) => parseFloat(v.trim()))
        return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255]
    }
    let h = s.replace("#", "")
    if (h.length === 3 || h.length === 4) {
        h = h.split("").map((c) => c + c).join("")
    }
    h = h.padEnd(6, "0")
    return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
    ]
}

function mulberry32(a: number) {
    return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn("ScrollWaveField shader:", gl.getShaderInfoLog(sh))
    }
    return sh
}

interface WaveGroup {
    waveHeight: number
    waveLength: number
    waveSpeed: number
}
interface TiltGroup {
    tiltStart: number
    rollStart: number
}

interface Props {
    background?: string
    colors?: string[]
    density?: number
    dotSize?: number
    scatter?: number
    cameraHeight?: number
    wave?: Partial<WaveGroup>
    tilt?: Partial<TiltGroup>
    flowSpeed?: number
    className?: string
    style?: React.CSSProperties
}

const FLOW_PER_WAVE = 260 / 160

function ScrollWaveFieldBase(props: Props) {
    const {
        background = "transparent",
        colors: colorsProp,
        density = 160,
        dotSize = 2.2,
        scatter = 240,
        cameraHeight = 55,
        wave = { waveSpeed: 80, waveHeight: 160, waveLength: 3500 },
        tilt = { rollStart: 0, tiltStart: 7 },
        flowSpeed: flowSpeedLegacy,
        className,
        style,
    } = props

    const { waveHeight = 160, waveLength = 3500, waveSpeed = 80 } = wave
    const colors = colorsProp ?? DEFAULT_COLORS
    const { tiltStart = 7, rollStart = 0 } = tilt
    const flowSpeed = flowSpeedLegacy ?? waveSpeed * FLOW_PER_WAVE

    const hostRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const live = useRef({
        colors,
        density,
        dotSize,
        waveHeight,
        scatter,
        waveLength,
        waveSpeed,
        flowSpeed,
        tiltStart,
        rollStart,
        cameraHeight,
    })
    useEffect(() => {
        live.current = {
            colors,
            density,
            dotSize,
            waveHeight,
            scatter,
            waveLength,
            waveSpeed,
            flowSpeed,
            tiltStart,
            rollStart,
            cameraHeight,
        };
    }, [colors, density, dotSize, waveHeight, scatter, waveLength, waveSpeed, flowSpeed, tiltStart, rollStart, cameraHeight]);

    useEffect(() => {
        const host = hostRef.current
        const canvas = canvasRef.current
        if (!host || !canvas) return

        const gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: false,
            premultipliedAlpha: true,
            depth: false,
        }) as WebGLRenderingContext | null
        if (!gl) return

        const prog = gl.createProgram()!
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.warn("ScrollWaveField link:", gl.getProgramInfoLog(prog))
            return
        }
        gl.useProgram(prog)

        const aGrid = gl.getAttribLocation(prog, "aGrid")
        const aSeed = gl.getAttribLocation(prog, "aSeed")
        const U = (n: string) => gl.getUniformLocation(prog, n)
        const u = {
            res: U("uRes"),
            focal: U("uFocal"),
            time: U("uTime"),
            amp: U("uAmp"),
            scatter: U("uScatter"),
            freq: U("uFreq"),
            dir: U("uDir"),
            flow: U("uFlow"),
            depth: U("uDepth"),
            camY: U("uCamY"),
            camZ: U("uCamZ"),
            pitch: U("uPitch"),
            roll: U("uRoll"),
            dot: U("uDot"),
            colorCount: U("uColorCount"),
            jit: U("uJit"),
            colors: U("uColors[0]"),
        }

        const gridBuf = gl.createBuffer()!
        const seedBuf = gl.createBuffer()!
        const palBuf = new Float32Array(MAX_COLORS * 3)

        let builtDensity = -1
        let count = 0
        let spacingX = 1
        let spacingZ = 1

        const buildGrid = (d: number) => {
            const cols = Math.max(8, Math.round(d))
            const rows = Math.max(8, Math.round(d * 2))
            count = cols * rows
            spacingX = FIELD_W / (cols - 1)
            spacingZ = FIELD_D / (rows - 1)

            const grid = new Float32Array(count * 2)
            const seed = new Float32Array(count * 2)
            const rnd = mulberry32(0x5eed)
            let i = 0
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    grid[i * 2] = -FIELD_W / 2 + (c + 0.5) * spacingX
                    grid[i * 2 + 1] = r * spacingZ
                    seed[i * 2] = rnd()
                    seed[i * 2 + 1] = rnd()
                    i++
                }
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf)
            gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW)
            gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf)
            gl.bufferData(gl.ARRAY_BUFFER, seed, gl.STATIC_DRAW)
            builtDensity = d
        }

        gl.disable(gl.DEPTH_TEST)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)

        let cssW = 0
        let cssH = 0
        let dpr = 1
        let areaScale = 1
        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
            cssW = canvas.clientWidth || host.clientWidth || window.innerWidth
            cssH = canvas.clientHeight || host.clientHeight || window.innerHeight
            areaScale =
                cssW > 0 && cssH > 0
                    ? Math.min(
                          CAM_SCALE_MAX,
                          Math.max(
                              CAM_SCALE_MIN,
                              Math.sqrt((cssW * cssH) / CAM_REF_AREA)
                          )
                      )
                    : 1
            const w = Math.max(1, Math.round(cssW * dpr))
            const h = Math.max(1, Math.round(cssH * dpr))
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w
                canvas.height = h
            }
            gl.viewport(0, 0, w, h)
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)

        let raf = 0
        let last = performance.now()
        let phase = 0
        let flow = 0

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = Math.min((now - last) / 1000, 0.05)
            last = now

            if (cssW <= 0 || cssH <= 0) {
                resize()
                if (cssW <= 0 || cssH <= 0) return
            }

            const L = live.current
            if (L.density !== builtDensity) buildGrid(L.density)
            if (count === 0) return

            phase += dt * (L.waveSpeed / 100)
            flow = (flow + dt * L.flowSpeed) % FIELD_D

            const pitch = (L.tiltStart * Math.PI) / 180
            const roll = (-L.rollStart * Math.PI) / 180
            const camY =
                (Math.min(100, Math.max(0, L.cameraHeight)) / 100) *
                CAM_Y_FULL *
                areaScale
            const camZ = CAM_Z0

            const wDev = canvas.width
            const hDev = canvas.height
            const focal = hDev / (2 * Math.tan(((FOV / 2) * Math.PI) / 180))

            const pal =
                Array.isArray(L.colors) && L.colors.length > 0
                    ? L.colors.slice(0, 8)
                    : DEFAULT_COLORS
            for (let i = 0; i < pal.length; i++) {
                const [cr2, cg2, cb2] = parseColor(pal[i])
                palBuf[i * 3] = cr2
                palBuf[i * 3 + 1] = cg2
                palBuf[i * 3 + 2] = cb2
            }

            gl.uniform2f(u.res, wDev, hDev)
            gl.uniform1f(u.focal, focal)
            gl.uniform1f(u.time, phase)
            gl.uniform1f(u.amp, L.waveHeight)
            gl.uniform1f(u.scatter, L.scatter)
            gl.uniform1f(u.freq, TAU / Math.max(50, L.waveLength))
            gl.uniform2f(u.dir, WAVE_DIR_X, WAVE_DIR_Z)
            gl.uniform1f(u.flow, flow)
            gl.uniform1f(u.depth, FIELD_D)
            gl.uniform1f(u.camY, camY)
            gl.uniform1f(u.camZ, camZ)
            gl.uniform1f(u.pitch, pitch)
            gl.uniform1f(u.roll, roll)
            gl.uniform1f(u.dot, L.dotSize)
            gl.uniform1f(u.colorCount, pal.length)
            gl.uniform2f(u.jit, spacingX * 0.25, spacingZ * 0.7)
            gl.uniform3fv(u.colors, palBuf)

            gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf)
            gl.enableVertexAttribArray(aGrid)
            gl.vertexAttribPointer(aGrid, 2, gl.FLOAT, false, 0, 0)
            gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf)
            gl.enableVertexAttribArray(aSeed)
            gl.vertexAttribPointer(aSeed, 2, gl.FLOAT, false, 0, 0)

            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT)
            gl.drawArrays(gl.POINTS, 0, count)
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [])

    return (
        <div
            ref={hostRef}
            className={className}
            style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                background,
                pointerEvents: "none",
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />
        </div>
    )
}

const __originkitPresetProps: Props = {
  colors: [
    "#ffffff",
    "#71717a",
    "#27272a"
  ],
  density: 180,
  dotSize: 2.2,
  scatter: 260,
  cameraHeight: 57,
  wave: {
    waveSpeed: 75,
    waveHeight: 160,
    waveLength: 3800
  },
  tilt: {
    rollStart: 0,
    tiltStart: 7
  },
};

export const ScrollWaveField = React.memo(function ScrollWaveField(props: Props) {
  return <ScrollWaveFieldBase {...__originkitPresetProps} {...props} />;
});

export default ScrollWaveField;

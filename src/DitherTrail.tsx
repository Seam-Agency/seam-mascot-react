import { useEffect, useRef, type RefObject } from "react";

export interface DitherTrailSource {
  x: number;
  y: number;
  active: boolean;
}

interface DitherTrailProps {
  sourceRef: RefObject<DitherTrailSource>;
  intensity: number;
  color: string;
}

interface RenderTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
}

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const SIMULATION_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uPreviousMouse;
  uniform sampler2D uPreviousState;
  uniform vec2 uResolution;
  uniform float uRadius;
  uniform float uDecay;
  uniform float uIntensity;
  uniform float uSpeed;

  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865187,
      0.366025403784,
      -0.57735026919,
      0.024390243902
    );
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0)) +
      i.x + vec3(0.0, i1.x, 1.0)
    );
    vec3 m = max(
      0.5 - vec3(
        dot(x0, x0),
        dot(x12.xy, x12.xy),
        dot(x12.zw, x12.zw)
      ),
      0.0
    );
    m *= m;
    m *= m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.792842842 - 0.853734721 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  vec2 curl(vec2 p) {
    float epsilon = 0.1;
    float top = snoise(p + vec2(0.0, epsilon));
    float bottom = snoise(p - vec2(0.0, epsilon));
    float right = snoise(p + vec2(epsilon, 0.0));
    float left = snoise(p - vec2(epsilon, 0.0));
    return vec2(
      (right - left) / (2.0 * epsilon),
      -(top - bottom) / (2.0 * epsilon)
    );
  }

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec2 velocity = curl(vUv * 0.5 + uTime * 0.1);
    vec2 advectedUv = vUv - velocity * 0.001;

    float center = texture2D(uPreviousState, advectedUv).r;
    float top = texture2D(
      uPreviousState,
      advectedUv + vec2(0.0, texel.y)
    ).r;
    float bottom = texture2D(
      uPreviousState,
      advectedUv - vec2(0.0, texel.y)
    ).r;
    float left = texture2D(
      uPreviousState,
      advectedUv - vec2(texel.x, 0.0)
    ).r;
    float right = texture2D(
      uPreviousState,
      advectedUv + vec2(texel.x, 0.0)
    ).r;
    float diffused = (center + top + bottom + left + right) / 5.0;

    float aspect = uResolution.x / uResolution.y;
    vec2 aspectCorrection = vec2(aspect, 1.0);
    vec2 point = (vUv - uPreviousMouse) * aspectCorrection;
    vec2 segment = (uMouse - uPreviousMouse) * aspectCorrection;
    float segmentLengthSquared = max(dot(segment, segment), 0.0000001);
    float segmentProgress = clamp(
      dot(point, segment) / segmentLengthSquared,
      0.0,
      1.0
    );
    float distanceToTrail = length(point - segment * segmentProgress);
    float brush = exp(-pow(distanceToTrail / uRadius, 2.0));
    float speedFactor = smoothstep(0.0, 0.01, uSpeed);
    brush *= uIntensity * speedFactor * 0.5;

    float value = min(0.95, diffused + brush) - uDecay;
    gl_FragColor = vec4(vec3(max(0.0, value)), 1.0);
  }
`;

const DISPLAY_SHADER = `
  precision highp float;

  uniform sampler2D uSimulationState;
  uniform float uDitherSize;
  uniform float uExponent;
  uniform vec3 uColor;
  varying vec2 vUv;

  float bayer2(vec2 position) {
    vec2 cell = mod(floor(position), 2.0);
    return 2.0 * cell.x + 3.0 * cell.y - 4.0 * cell.x * cell.y;
  }

  float bayer4(vec2 position) {
    vec2 cell = mod(floor(position), 4.0);
    return 4.0 * bayer2(mod(cell, 2.0)) + bayer2(floor(cell / 2.0));
  }

  float bayer8(vec2 position) {
    vec2 cell = mod(floor(position), 8.0);
    return (
      4.0 * bayer4(mod(cell, 4.0)) +
      bayer2(floor(cell / 4.0))
    ) / 64.0;
  }

  void main() {
    float signal = texture2D(uSimulationState, vUv).r;
    signal = pow(signal, uExponent);
    float threshold = bayer8(gl_FragCoord.xy / uDitherSize);
    if (signal < 0.01 || signal < threshold) discard;
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.error(
    "SeamMascot dither shader compilation failed:",
    gl.getShaderInfoLog(shader)
  );
  gl.deleteShader(shader);
  return null;
}

function createProgram(
  gl: WebGLRenderingContext,
  fragmentSource: string
) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  console.error(
    "SeamMascot dither shader linking failed:",
    gl.getProgramInfoLog(program)
  );
  gl.deleteProgram(program);
  return null;
}

function createRenderTarget(
  gl: WebGLRenderingContext,
  width: number,
  height: number
): RenderTarget | null {
  const framebuffer = gl.createFramebuffer();
  const texture = gl.createTexture();
  if (!framebuffer || !texture) return null;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer, texture };
}

function deleteRenderTarget(
  gl: WebGLRenderingContext,
  target: RenderTarget | null
) {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

function parseColor(color: string) {
  const value = color.replace("#", "");
  const expanded = value.length === 3
    ? value.split("").map(character => character + character).join("")
    : value.padEnd(6, "f").slice(0, 6);
  return [
    Number.parseInt(expanded.slice(0, 2), 16) / 255,
    Number.parseInt(expanded.slice(2, 4), 16) / 255,
    Number.parseInt(expanded.slice(4, 6), 16) / 255
  ] as const;
}

export function DitherTrail({
  sourceRef,
  intensity,
  color
}: DitherTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  const colorRef = useRef(color);
  intensityRef.current = intensity;
  colorRef.current = color;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false
    });
    if (!gl) {
      canvas.dataset.ditherStatus = "unavailable";
      return;
    }

    const simulationProgram = createProgram(gl, SIMULATION_SHADER);
    const displayProgram = createProgram(gl, DISPLAY_SHADER);
    const quad = gl.createBuffer();
    if (!simulationProgram || !displayProgram || !quad) {
      canvas.dataset.ditherStatus = "shader-error";
      return;
    }
    canvas.dataset.ditherStatus = "ready";

    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    const simulationPosition = gl.getAttribLocation(
      simulationProgram,
      "aPosition"
    );
    const displayPosition = gl.getAttribLocation(displayProgram, "aPosition");
    const simulationUniforms = {
      previousState: gl.getUniformLocation(simulationProgram, "uPreviousState"),
      time: gl.getUniformLocation(simulationProgram, "uTime"),
      mouse: gl.getUniformLocation(simulationProgram, "uMouse"),
      previousMouse: gl.getUniformLocation(simulationProgram, "uPreviousMouse"),
      resolution: gl.getUniformLocation(simulationProgram, "uResolution"),
      radius: gl.getUniformLocation(simulationProgram, "uRadius"),
      decay: gl.getUniformLocation(simulationProgram, "uDecay"),
      intensity: gl.getUniformLocation(simulationProgram, "uIntensity"),
      speed: gl.getUniformLocation(simulationProgram, "uSpeed")
    };
    const displayUniforms = {
      simulationState: gl.getUniformLocation(displayProgram, "uSimulationState"),
      ditherSize: gl.getUniformLocation(displayProgram, "uDitherSize"),
      exponent: gl.getUniformLocation(displayProgram, "uExponent"),
      color: gl.getUniformLocation(displayProgram, "uColor")
    };

    let width = 0;
    let height = 0;
    let readTarget: RenderTarget | null = null;
    let writeTarget: RenderTarget | null = null;
    let frameId = 0;
    let sourceInitialized = false;
    let previousX = 0.5;
    let previousY = 0.5;
    let smoothedSpeed = 0;
    const startedAt = performance.now();
    const bindQuad = (program: WebGLProgram, location: number) => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, Math.round(bounds.width * dpr));
      const nextHeight = Math.max(1, Math.round(bounds.height * dpr));
      if (nextWidth === width && nextHeight === height) return true;

      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      deleteRenderTarget(gl, readTarget);
      deleteRenderTarget(gl, writeTarget);
      readTarget = createRenderTarget(gl, width, height);
      writeTarget = createRenderTarget(gl, width, height);
      sourceInitialized = false;
      return Boolean(readTarget && writeTarget);
    };

    const render = (now: number) => {
      frameId = requestAnimationFrame(render);
      if (!resize() || !readTarget || !writeTarget) return;

      const source = sourceRef.current;
      const normalizedIntensity = clamp01(intensityRef.current);
      const ditherSize = 5.5 - normalizedIntensity * 3.3;
      const radius = 0.045 + normalizedIntensity * 0.1;
      const exponent = 1.7 + normalizedIntensity * 1.4;
      const decay = 0.018 - normalizedIntensity * 0.01;
      const brushIntensity = 0.2 + normalizedIntensity * 0.68;
      const rgb = parseColor(colorRef.current);
      const sourceX = clamp01(source.x);
      const sourceY = clamp01(source.y);
      if (!source.active) {
        sourceInitialized = false;
        smoothedSpeed *= 0.82;
      } else if (!sourceInitialized) {
        previousX = sourceX;
        previousY = sourceY;
        sourceInitialized = true;
      }

      const distance = source.active
        ? Math.hypot(sourceX - previousX, sourceY - previousY)
        : 0;
      smoothedSpeed += (distance * 28 - smoothedSpeed) * 0.18;
      const speed = source.active && distance > 0.00001
        ? Math.max(smoothedSpeed, 0.025)
        : smoothedSpeed;

      gl.bindFramebuffer(gl.FRAMEBUFFER, writeTarget.framebuffer);
      gl.viewport(0, 0, width, height);
      bindQuad(simulationProgram, simulationPosition);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readTarget.texture);
      gl.uniform1i(
        simulationUniforms.previousState,
        0
      );
      gl.uniform1f(
        simulationUniforms.time,
        (now - startedAt) / 1000
      );
      gl.uniform2f(
        simulationUniforms.mouse,
        sourceX,
        sourceY
      );
      gl.uniform2f(
        simulationUniforms.previousMouse,
        previousX,
        previousY
      );
      gl.uniform2f(
        simulationUniforms.resolution,
        width,
        height
      );
      gl.uniform1f(simulationUniforms.radius, radius);
      gl.uniform1f(simulationUniforms.decay, decay);
      gl.uniform1f(
        simulationUniforms.intensity,
        brushIntensity
      );
      gl.uniform1f(simulationUniforms.speed, speed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      bindQuad(displayProgram, displayPosition);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, writeTarget.texture);
      gl.uniform1i(
        displayUniforms.simulationState,
        0
      );
      gl.uniform1f(
        displayUniforms.ditherSize,
        ditherSize
      );
      gl.uniform1f(
        displayUniforms.exponent,
        exponent
      );
      gl.uniform3f(
        displayUniforms.color,
        rgb[0],
        rgb[1],
        rgb[2]
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (source.active) {
        previousX = sourceX;
        previousY = sourceY;
      }
      [readTarget, writeTarget] = [writeTarget, readTarget];
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      deleteRenderTarget(gl, readTarget);
      deleteRenderTarget(gl, writeTarget);
      gl.deleteBuffer(quad);
      gl.deleteProgram(simulationProgram);
      gl.deleteProgram(displayProgram);
      delete canvas.dataset.ditherStatus;
    };
  }, [sourceRef]);

  return (
    <canvas
      ref={canvasRef}
      data-seam-dither-canvas=""
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      }}
    />
  );
}

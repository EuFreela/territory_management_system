import { useEffect, useRef } from 'react';

const VERTEX_SHADER = /* glsl */ `
  #version 300 es
  precision mediump float;
  in vec2 position;
  uniform vec2 u_resolution;
  out vec2 fragCoord;
  void main() {
    gl_Position = vec4(position, 1.0);
    fragCoord = (position.xy + 1.0) * 0.5 * u_resolution;
    fragCoord.y = u_resolution.y - fragCoord.y;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #version 300 es
  precision mediump float;
  in vec2 fragCoord;

  uniform float u_time;
  uniform float u_opacities[10];
  uniform vec3 u_colors[6];
  uniform float u_total_size;
  uniform float u_dot_size;
  uniform vec2 u_resolution;
  uniform int u_reverse;

  out vec4 fragColor;

  float PHI = 1.61803398874989484820459;
  float random(vec2 xy) {
    return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
  }

  void main() {
    vec2 st = fragCoord.xy;
    st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
    st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

    float opacity = step(0.0, st.x) * step(0.0, st.y);

    vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

    float frequency = 5.0;
    float show_offset = random(st2);
    float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
    opacity *= u_opacities[int(rand * 10.0)];
    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

    vec3 color = u_colors[int(show_offset * 6.0)];

    float animation_speed_factor = 3.0;
    vec2 center_grid = u_resolution / 2.0 / u_total_size;
    float dist_from_center = distance(center_grid, st2);

    float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);

    float current_timing_offset = timing_offset_intro;
    opacity *= step(current_timing_offset, u_time * animation_speed_factor);
    opacity *= clamp(
      (1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25,
      1.0,
      1.25
    );

    fragColor = vec4(color, opacity);
    fragColor.rgb *= fragColor.a;
  }
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Falha ao criar shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'erro desconhecido';
    gl.deleteShader(shader);
    throw new Error(`Falha ao compilar shader: ${info}`);
  }
  return shader;
}

function buildProgram(gl: WebGL2RenderingContext) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Falha ao criar programa.');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'position');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Falha ao linkar programa: ${gl.getProgramInfoLog(program) || ''}`);
  }
  return program;
}

/**
 * Fundo animado de pontos WebGL (extraído do modern-login-signup).
 * Renderiza canvas + vinheta; o conteúdo da página fica por cima (z-index).
 * Implementação em WebGL2 puro (sem three.js) para manter o login leve.
 * Se o WebGL falhar, o fundo não é renderizado e a página segue normal.
 */
export function DotGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
    if (!gl) return;

    let active = true;
    let animationId = 0;

    try {
      const program = buildProgram(gl);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      // Triângulo fullscreen cobre a tela inteira (mesma projeção do quad original)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      const u = {
        time: gl.getUniformLocation(program, 'u_time'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        opacities: gl.getUniformLocation(program, 'u_opacities'),
        colors: gl.getUniformLocation(program, 'u_colors'),
        totalSize: gl.getUniformLocation(program, 'u_total_size'),
        dotSize: gl.getUniformLocation(program, 'u_dot_size'),
        reverse: gl.getUniformLocation(program, 'u_reverse'),
      };

      gl.useProgram(program);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      gl.uniform1fv(u.opacities, [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0]);
      gl.uniform3fv(u.colors, [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      ]);
      gl.uniform1f(u.totalSize, 20.0);
      gl.uniform1f(u.dotSize, 6.0);
      gl.uniform1i(u.reverse, 0);

      const setSize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.uniform2f(u.resolution, window.innerWidth * 2, window.innerHeight * 2);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      setSize();
      window.addEventListener('resize', setSize);

      const startTime = performance.now();
      const animate = () => {
        if (!active) return;
        animationId = requestAnimationFrame(animate);
        gl.uniform1f(u.time, (performance.now() - startTime) / 1000.0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      animate();

      return () => {
        active = false;
        window.removeEventListener('resize', setSize);
        cancelAnimationFrame(animationId);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    } catch {
      return undefined;
    }
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(circle at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
        }}
      />
    </>
  );
}
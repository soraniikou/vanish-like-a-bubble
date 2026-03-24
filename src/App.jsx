import { useState, useRef, useEffect, useCallback } from "react";

const PETAL = {
  pale: "#f0e8f0",
  blush: "#ddc0dd",
  violet: "#c8a0c8",
  deep: "#8b5a8b",
  core: "#5a2d5a",
};

/**
 * 背景ローテーション：黒 → 濃い紫 → 濃い紺 → 紺 → 青 → 深い緑 → 黄緑 → 淡いピンク →（ループ）
 * 各セグメント 10 秒、隣り合う色の RGB を smoothstep で補間
 */
const BG_ROTATION_RGB = [
  [0, 0, 0],
  [42, 18, 72],
  [10, 24, 48],
  [26, 48, 92],
  [37, 78, 180],
  [12, 72, 48],
  [118, 168, 52],
  [252, 231, 243],
];

const BG_SEGMENT_MS = 10_000;

function smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function backgroundRgbAtTime(nowMs, startMs) {
  const n = BG_ROTATION_RGB.length;
  const cycle = n * BG_SEGMENT_MS;
  const elapsed = (((nowMs - startMs) % cycle) + cycle) % cycle;
  const seg = Math.floor(elapsed / BG_SEGMENT_MS);
  const localRaw = (elapsed % BG_SEGMENT_MS) / BG_SEGMENT_MS;
  const u = smoothstep01(localRaw);
  const from = BG_ROTATION_RGB[seg];
  const to = BG_ROTATION_RGB[(seg + 1) % n];
  return {
    r: lerp(from[0], to[0], u),
    g: lerp(from[1], to[1], u),
    b: lerp(from[2], to[2], u),
  };
}

const BURST_SECOND_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const BURST_FPS = 60;
const BURST_DURATIONS = BURST_SECOND_OPTIONS.map((s) => s * BURST_FPS);

const BUBBLE_MOTION_SCALE = 0.5;

/** 5秒ごとに装飾泡を 2〜3 個ランダムに割る */
const AUTO_POP_INTERVAL_MS = 5000;

class AmbientBubble {
  constructor(W, H) {
    this.reset(W, H, true);
  }

  reset(W, H, scatterY) {
    this.depth = Math.random();
    const base = Math.min(W, H);
    this.r = base * (0.01 + this.depth * 0.06 + Math.random() * 0.028);
    this.x = Math.random() * W;
    this.y = scatterY
      ? Math.random() * (H + base * 0.5) - base * 0.25
      : H + this.r * 2 + Math.random() * base * 0.15;
    this.vy =
      -(0.22 + this.depth * 1.05 + Math.random() * 0.42) * BUBBLE_MOTION_SCALE;
    this.vx =
      (Math.random() - 0.5) *
      (0.28 + this.depth * 0.35) *
      BUBBLE_MOTION_SCALE;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed =
      (0.012 + Math.random() * 0.028) * BUBBLE_MOTION_SCALE;
    this.wobbleAmp = 0.35 + this.depth * 1.1;
    this.alpha = 0.12 + this.depth * 0.52;
    this.rot = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.004 * BUBBLE_MOTION_SCALE;
  }

  update(W, H) {
    this.wobble += this.wobbleSpeed;
    this.rot += this.rotSpeed;
    this.x +=
      this.vx +
      Math.sin(this.wobble) * (this.wobbleAmp * (0.06 + this.depth * 0.05));
    this.y += this.vy;
    this.vx += (Math.random() - 0.5) * 0.012 * BUBBLE_MOTION_SCALE;
    this.vx *= 0.997;

    const margin = this.r * 3;
    if (this.y < -margin) {
      this.reset(W, H, false);
      this.x = Math.random() * W;
    }
    if (this.x < -margin) this.x = W + margin;
    if (this.x > W + margin) this.x = -margin;
  }

  draw(ctx) {
    const { x, y, r } = this;
    ctx.save();
    ctx.globalAlpha = this.alpha;

    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.55);
    glow.addColorStop(0, "rgba(255,255,255,0.14)");
    glow.addColorStop(0.45, "rgba(200,230,255,0.06)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
    ctx.fill();

    const film = ctx.createRadialGradient(
      x - r * 0.38,
      y - r * 0.38,
      r * 0.06,
      x,
      y,
      r
    );
    film.addColorStop(0, "rgba(255,255,255,0.42)");
    film.addColorStop(0.35, "rgba(255,220,240,0.08)");
    film.addColorStop(0.65, "rgba(200,235,255,0.12)");
    film.addColorStop(0.9, "rgba(255,245,200,0.1)");
    film.addColorStop(1, "rgba(255,255,255,0.18)");
    ctx.fillStyle = film;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (typeof ctx.createConicGradient === "function") {
      const cg = ctx.createConicGradient(this.rot, x, y);
      cg.addColorStop(0, "rgba(255,170,200,0.55)");
      cg.addColorStop(0.17, "rgba(255,240,160,0.45)");
      cg.addColorStop(0.35, "rgba(170,245,210,0.5)");
      cg.addColorStop(0.52, "rgba(160,210,255,0.55)");
      cg.addColorStop(0.7, "rgba(220,180,255,0.48)");
      cg.addColorStop(0.88, "rgba(255,200,220,0.5)");
      cg.addColorStop(1, "rgba(255,170,200,0.55)");
      ctx.strokeStyle = cg;
    } else {
      ctx.strokeStyle = "rgba(255,220,240,0.45)";
    }
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.stroke();

    ctx.restore();
  }
}

function ambientCountForViewport(W, H) {
  return Math.min(47, Math.max(17, Math.floor((W * H) / 29000)));
}

/** 定期割れ用の破裂パーティクル（装飾泡と同系の見た目） */
class AmbientPopBurst {
  constructor(x, y) {
    this.particles = [];
    const n = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      const ang = ((Math.PI * 2) / n) * i + Math.random() * 0.55;
      const sp = (0.4 + Math.random() * 2.2) * BUBBLE_MOTION_SCALE;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 0.35,
        opacity: 0.8 + Math.random() * 0.18,
        size: 1.4 + Math.random() * 2.6,
        glow: 1,
        color: [PETAL.pale, PETAL.blush, PETAL.violet, "#ffffff"][
          Math.floor(Math.random() * 4)
        ],
      });
    }
    this.life = 50 + Math.floor(Math.random() * 24);
  }

  update() {
    const fadeSpeed = 1 / this.life;
    this.particles.forEach((p) => {
      p.x += p.vx * BUBBLE_MOTION_SCALE;
      p.y += p.vy * BUBBLE_MOTION_SCALE;
      p.vy += 0.06 * BUBBLE_MOTION_SCALE;
      p.vx *= 0.97;
      p.opacity -= fadeSpeed * 0.88;
      p.size *= 0.991;
      p.glow = Math.max(0, p.glow - fadeSpeed * 0.5);
    });
    this.particles = this.particles.filter((p) => p.opacity > 0.03);
  }

  draw(ctx) {
    this.particles.forEach((p) => {
      ctx.save();
      if (p.glow > 0) {
        ctx.globalAlpha = p.opacity * p.glow * 0.38;
        const g = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.size * 3.5
        );
        g.addColorStop(0, p.color);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(
          p.x - p.size * 3.5,
          p.y - p.size * 3.5,
          p.size * 7,
          p.size * 7
        );
      }
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  isAlive() {
    return this.particles.length > 0;
  }
}

class Bubble {
  constructor(x, y, text, size) {
    this.id = Math.random();
    this.x = x;
    this.y = y;
    this.text = text;
    this.size = size;
    this.vx = (Math.random() - 0.5) * 0.8 * BUBBLE_MOTION_SCALE;
    this.vy = -(0.4 + Math.random() * 0.6) * BUBBLE_MOTION_SCALE;
    this.opacity = 1;
    this.phase = "float";
    this.burstParticles = [];
    this.age = 0;
    this.maxAge = 180 + Math.random() * 120;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = (0.02 + Math.random() * 0.02) * BUBBLE_MOTION_SCALE;
    this.burstDuration =
      BURST_DURATIONS[Math.floor(Math.random() * BURST_DURATIONS.length)];
  }

  update(onBurst) {
    this.age++;
    this.wobble += this.wobbleSpeed;

    if (this.phase === "float") {
      this.x +=
        this.vx + Math.sin(this.wobble) * 0.3 * BUBBLE_MOTION_SCALE;
      this.y += this.vy;
      this.vy *= 0.995;
      if (this.age >= this.maxAge) {
        this.burst();
        if (onBurst) onBurst();
      }
    } else {
      const fadeSpeed = 1 / this.burstDuration;
      this.burstParticles.forEach((p) => {
        p.x += p.vx * BUBBLE_MOTION_SCALE;
        p.y += p.vy * BUBBLE_MOTION_SCALE;
        p.vy += 0.08 * BUBBLE_MOTION_SCALE;
        p.vx *= 0.98;
        p.opacity -= fadeSpeed * (0.8 + Math.random() * 0.4);
        p.size *= 0.995;
        p.glow = Math.max(0, p.glow - fadeSpeed * 0.5);
      });
      this.burstParticles = this.burstParticles.filter((p) => p.opacity > 0);
      if (this.burstParticles.length === 0) {
        this.opacity = 0;
      }
    }
  }

  burst() {
    this.phase = "burst";
    const count = 20 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const angle = ((Math.PI * 2) / count) * i + Math.random() * 0.4;
      const speed = 0.5 + Math.random() * 3.0;
      this.burstParticles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        opacity: 0.9 + Math.random() * 0.1,
        size: 2 + Math.random() * 4,
        glow: 1.2,
        color: [PETAL.pale, PETAL.blush, PETAL.violet, "#ffffff"][
          Math.floor(Math.random() * 4)
        ],
      });
    }
  }

  drawFloat(ctx) {
    const r = this.size / 2;
    ctx.save();
    ctx.globalAlpha = this.opacity;

    const glow = ctx.createRadialGradient(
      this.x,
      this.y,
      r * 0.5,
      this.x,
      this.y,
      r * 1.4
    );
    glow.addColorStop(0, `rgba(200,160,200,0.08)`);
    glow.addColorStop(1, `rgba(200,160,200,0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(
      this.x - r * 0.3,
      this.y - r * 0.3,
      r * 0.1,
      this.x,
      this.y,
      r
    );
    grad.addColorStop(0, `rgba(255,255,255,0.25)`);
    grad.addColorStop(0.4, `rgba(220,190,230,0.1)`);
    grad.addColorStop(0.8, `rgba(180,140,200,0.15)`);
    grad.addColorStop(1, `rgba(140,100,160,0.3)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(220,190,220,${0.35 * this.opacity})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.globalAlpha = this.opacity * 0.85;
    ctx.fillStyle = PETAL.pale;
    ctx.font = `${Math.max(10, r * 0.38)}px 'Hiragino Kaku Gothic Pro', 'Yu Gothic', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const maxWidth = r * 1.4;
    ctx.fillText(this.text, this.x, this.y, maxWidth);

    ctx.restore();
  }

  drawBurst(ctx) {
    this.burstParticles.forEach((p) => {
      ctx.save();
      if (p.glow > 0) {
        ctx.globalAlpha = p.opacity * p.glow * 0.4;
        const g = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.size * 4
        );
        g.addColorStop(0, p.color);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(
          p.x - p.size * 4,
          p.y - p.size * 4,
          p.size * 8,
          p.size * 8
        );
      }
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  isAlive() {
    return this.opacity > 0;
  }
}

export default function App() {
  const canvasRef = useRef(null);
  const bubblesRef = useRef([]);
  const ambientRef = useRef([]);
  const ambientTargetRef = useRef(0);
  const ambientReleasedRef = useRef(false);
  const ambientSpawnAccRef = useRef(0);
  const lastViewportRef = useRef({ w: 0, h: 0 });
  const animRef = useRef(null);
  const bgClockStartRef = useRef(null);
  const autoPopBurstsRef = useRef([]);
  const lastAutoPopTimeRef = useRef(null);

  const [text, setText] = useState("");
  const [launched, setLaunched] = useState(false);
  const [hint, setHint] = useState(true);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    if (bgClockStartRef.current == null) {
      bgClockStartRef.current = performance.now();
    }
    const { r, g, b } = backgroundRgbAtTime(
      performance.now(),
      bgClockStartRef.current
    );
    const r0 = Math.round(r);
    const g0 = Math.round(g);
    const b0 = Math.round(b);
    const r1 = Math.round(r * 0.82);
    const g1 = Math.round(g * 0.82);
    const b1 = Math.round(b * 0.82);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `rgb(${r0},${g0},${b0})`);
    sky.addColorStop(1, `rgb(${r1},${g1},${b1})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (
      W !== lastViewportRef.current.w ||
      H !== lastViewportRef.current.h
    ) {
      lastViewportRef.current = { w: W, h: H };
      ambientTargetRef.current = ambientCountForViewport(W, H);
      if (ambientReleasedRef.current) {
        while (ambientRef.current.length > ambientTargetRef.current) {
          ambientRef.current.pop();
        }
      }
    }

    if (
      ambientReleasedRef.current &&
      ambientRef.current.length < ambientTargetRef.current
    ) {
      ambientSpawnAccRef.current += 0.4;
      while (
        ambientSpawnAccRef.current >= 1 &&
        ambientRef.current.length < ambientTargetRef.current
      ) {
        ambientSpawnAccRef.current -= 1;
        ambientRef.current.push(new AmbientBubble(W, H));
      }
    }

    ambientRef.current.forEach((a) => {
      a.update(W, H);
    });

    if (ambientReleasedRef.current && ambientRef.current.length > 0) {
      const nowPop = performance.now();
      if (lastAutoPopTimeRef.current == null) {
        lastAutoPopTimeRef.current = nowPop;
      }
      if (nowPop - lastAutoPopTimeRef.current >= AUTO_POP_INTERVAL_MS) {
        lastAutoPopTimeRef.current = nowPop;
        const arr = ambientRef.current;
        const want = 2 + Math.floor(Math.random() * 2);
        const nPop = Math.min(want, arr.length);
        const removeIdx = new Set();
        while (removeIdx.size < nPop) {
          removeIdx.add(Math.floor(Math.random() * arr.length));
        }
        removeIdx.forEach((idx) => {
          const dead = arr[idx];
          autoPopBurstsRef.current.push(
            new AmbientPopBurst(dead.x, dead.y)
          );
        });
        ambientRef.current = arr.filter((_, i) => !removeIdx.has(i));
      }
    }

    ambientRef.current.forEach((a) => {
      a.draw(ctx);
    });

    autoPopBurstsRef.current.forEach((burst) => {
      burst.update();
      burst.draw(ctx);
    });
    autoPopBurstsRef.current = autoPopBurstsRef.current.filter((b) =>
      b.isAlive()
    );

    bubblesRef.current.forEach((b) => {
      b.update(null);
      if (b.phase === "float") {
        b.drawFloat(ctx);
      } else {
        b.drawBurst(ctx);
      }
    });

    bubblesRef.current = bubblesRef.current.filter((b) => b.isAlive());
    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [draw]);

  const launch = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const size = Math.min(W, H) * (0.18 + Math.random() * 0.12);
    const x = W * 0.2 + Math.random() * W * 0.6;
    const y = H * 0.75 + Math.random() * H * 0.1;
    bubblesRef.current.push(new Bubble(x, y, t, size));
    ambientReleasedRef.current = true;
    lastAutoPopTimeRef.current = null;
    setText("");
    setLaunched(true);
    setHint(false);
    setTimeout(() => setLaunched(false), 600);
  }, [text]);

  const handleKey = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        launch();
      }
    },
    [launch]
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#000000",
        position: "relative",
        fontFamily: "'Hiragino Kaku Gothic Pro', 'Yu Gothic', sans-serif",
      }}
    >
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />

      <div
        style={{
          position: "absolute",
          top: "5%",
          left: 0,
          right: 0,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            color: "#9333ea",
            fontSize: "clamp(22px, 4vw, 28px)",
            letterSpacing: "0.12em",
            fontWeight: 600,
            fontFamily:
              "'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive",
          }}
        >
          vanish like a bubble
        </div>
      </div>

      {hint && (
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: 0,
            right: 0,
            textAlign: "center",
            pointerEvents: "none",
            color: "rgba(220,190,220,0.28)",
            fontSize: "clamp(12px, 2.5vw, 16px)",
            letterSpacing: "0.15em",
            lineHeight: 2,
          }}
        >
          <div>手放したい言葉を</div>
          <div>泡に込めて、空へ</div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          width: "min(90vw, 420px)",
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Write your words here…"
          rows={2}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(220,190,220,0.25)",
            borderRadius: "16px",
            color: PETAL.pale,
            fontSize: "clamp(14px, 3.5vw, 17px)",
            padding: "14px 20px",
            outline: "none",
            resize: "none",
            backdropFilter: "blur(8px)",
            boxSizing: "border-box",
            letterSpacing: "0.08em",
            lineHeight: 1.7,
            caretColor: PETAL.blush,
            fontFamily: "inherit",
          }}
        />

        <button
          type="button"
          onClick={launch}
          style={{
            background: launched
              ? "rgba(200,160,200,0.35)"
              : "rgba(140,90,140,0.22)",
            border: "1px solid rgba(220,190,220,0.4)",
            borderRadius: "50px",
            color: PETAL.pale,
            fontSize: "clamp(13px, 3vw, 15px)",
            padding: "12px 40px",
            cursor: "pointer",
            letterSpacing: "0.25em",
            backdropFilter: "blur(8px)",
            transition: "all 0.3s ease",
            outline: "none",
            fontFamily: "inherit",
            transform: launched ? "scale(0.96)" : "scale(1)",
          }}
        >
          Release as a bubble
        </button>
      </div>

      <style>{`
        textarea::placeholder { color: rgba(255,255,255,0.9); }
        textarea:focus { border-color: rgba(220,190,220,0.5); background: rgba(255,255,255,0.07); }
        button:hover { background: rgba(180,120,180,0.35) !important; border-color: rgba(220,190,220,0.65) !important; }
      `}</style>
    </div>
  );
}

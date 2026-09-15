import { useEffect, useRef } from "react";

// The moving background shared by every learning portal page: three drifting
// colour orbs, a faint grid, a slow light sweep, and a canvas of dots that
// join up when they drift close together.
//
// Three things it is careful about, because participants sit assessments on
// mid range phones:
//   - the dot count scales with the screen and is capped
//   - it stops completely when the browser tab is not visible
//   - it does nothing at all if the person has asked their device to
//     reduce motion

export default function LiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const canvas = canvasRef.current;
    if (reduce || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let running = true;
    let frame = 0;
    let points: { x: number; y: number; vx: number; vy: number; r: number }[] =
      [];

    function size() {
      if (!canvas || !ctx) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(64, Math.round((width * height) / 26000));
      points = [];
      for (let i = 0; i < target; i++) {
        points.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.5 + 0.6,
        });
      }
    }

    function draw() {
      if (!running || !ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        for (let j = i + 1; j < points.length; j++) {
          const q = points[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 128) {
            ctx.strokeStyle = `rgba(245,110,15,${0.2 * (1 - d / 128)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = "rgba(23,23,23,.22)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    }

    function onVisibility() {
      running = !document.hidden;
      if (running) frame = requestAnimationFrame(draw);
    }

    size();
    draw();
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__orb bg__orb--1" />
      <div className="bg__orb bg__orb--2" />
      <div className="bg__orb bg__orb--3" />
      <canvas className="bg__canvas" ref={canvasRef} />
      <div className="bg__grid" />
      <div className="bg__scan" />
    </div>
  );
}

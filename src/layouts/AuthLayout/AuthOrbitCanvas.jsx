import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 34;

const getCssColor = (name, fallback) => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
};

export default function AuthOrbitCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return undefined;

    const context = canvas.getContext("2d");

    if (!context) return undefined;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let animationFrame = null;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let particles = [];

    const buildParticles = () => {
      particles = Array.from(
        {
          length: PARTICLE_COUNT,
        },
        (_, index) => {
          const lane = index % 4;
          const angle =
            (Math.PI * 2 * index) /
            PARTICLE_COUNT;

          return {
            angle,
            lane,
            radiusOffset:
              lane * 20 +
              Math.sin(index * 1.7) * 8,
            size:
              1.6 +
              (index % 5) * 0.35,
            speed:
              0.00018 +
              lane * 0.000045,
            alpha:
              0.28 +
              (index % 6) * 0.045,
          };
        },
      );
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        2,
      );

      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0,
      );
    };

    const draw = (time = 0) => {
      const primary = getCssColor(
        "--color-primary",
        "#2563eb",
      );
      const insights = getCssColor(
        "--color-insights",
        "#9333ea",
      );
      const border = getCssColor(
        "--color-border",
        "#e5e7eb",
      );

      const centerX =
        width * (document.dir === "rtl" ? 0.34 : 0.66);
      const centerY = height * 0.5;
      const baseRadius = Math.min(width, height) * 0.24;

      context.clearRect(0, 0, width, height);

      const halo = context.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.2,
        centerX,
        centerY,
        baseRadius * 1.65,
      );

      halo.addColorStop(0, `${primary}22`);
      halo.addColorStop(0.42, `${insights}12`);
      halo.addColorStop(1, "transparent");

      context.fillStyle = halo;
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        baseRadius * 1.75,
        0,
        Math.PI * 2,
      );
      context.fill();

      context.strokeStyle = `${border}aa`;
      context.lineWidth = 1;

      [0.68, 0.92, 1.16, 1.4].forEach(
        (scale, index) => {
          context.globalAlpha =
            0.22 - index * 0.025;
          context.beginPath();
          context.arc(
            centerX,
            centerY,
            baseRadius * scale,
            0,
            Math.PI * 2,
          );
          context.stroke();
        },
      );

      particles.forEach((particle, index) => {
        const animatedAngle =
          particle.angle +
          (reduceMotion.matches
            ? 0
            : time * particle.speed);

        const radius =
          baseRadius * (0.68 + particle.lane * 0.24) +
          particle.radiusOffset;
        const x = centerX + Math.cos(animatedAngle) * radius;
        const y = centerY + Math.sin(animatedAngle) * radius;
        const color = index % 3 === 0 ? insights : primary;

        context.globalAlpha = particle.alpha;
        context.fillStyle = color;
        context.beginPath();
        context.arc(
          x,
          y,
          particle.size,
          0,
          Math.PI * 2,
        );
        context.fill();

        context.globalAlpha = particle.alpha * 0.2;
        context.beginPath();
        context.arc(
          x,
          y,
          particle.size * 4,
          0,
          Math.PI * 2,
        );
        context.fill();
      });

      context.globalAlpha = 1;

      if (!reduceMotion.matches) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    const start = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      resize();
      buildParticles();
      draw();
    };

    start();

    window.addEventListener("resize", start);
    reduceMotion.addEventListener("change", start);

    return () => {
      window.removeEventListener("resize", start);
      reduceMotion.removeEventListener("change", start);

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="auth-orbit-canvas"
      aria-hidden="true"
    />
  );
}

import { useEffect, useRef } from "react";

import HeroSection from "./components/HeroSection";
import FeaturesSection from "./components/FeaturesSection";
import AISection from "./components/AISection";
import StepsSection from "./components/StepsSection";
import SecuritySection from "./components/SecuritySection";
import DashboardPreview from "./components/DashboardPreview";
import FAQSection from "./components/FAQSection";
import HomeBackgroundDecor from "./components/HomeBackgroundDecor";

import "./Home.css";
import Ready from "./components/Ready";

const revealGroups = [
  { selector: ".home-section-header", variant: "fade-up", stagger: 0 },
  { selector: ".feature-card", variant: "scale-in", stagger: 70 },
  { selector: ".ai-home-section__content", variant: "from-start", stagger: 0 },
  { selector: ".ai-workspace", variant: "from-end", stagger: 0 },
  { selector: ".step-card", variant: "fade-up", stagger: 85 },
  { selector: ".security-section__content", variant: "from-start", stagger: 0 },
  { selector: ".security-card", variant: "from-end", stagger: 65 },
  { selector: ".dashboard-stage", variant: "fade-in", stagger: 0 },
  { selector: ".faq-section__intro", variant: "from-start", stagger: 0 },
  { selector: ".faq-item", variant: "fade-up", stagger: 55 },
];

export default function Home() {
  const pageRef = useRef(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;

    const elements = revealGroups.flatMap(({ selector, stagger, variant }) =>
      Array.from(page.querySelectorAll(selector)).map((element, index) => {
        element.classList.add("home-reveal", `home-reveal--${variant}`);
        element.style.setProperty("--reveal-delay", `${index * stagger}ms`);
        return element;
      }),
    );

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    if (reduceMotion.matches || !precisePointer.matches) return undefined;

    let animationFrame = 0;

    const updateParallax = (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 16;
      const y = (event.clientY / window.innerHeight - 0.5) * 11;

      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        page.style.setProperty("--home-parallax-x", `${x.toFixed(2)}px`);
        page.style.setProperty("--home-parallax-y", `${y.toFixed(2)}px`);
        page.style.setProperty("--home-parallax-x-inverse", `${(-x * 0.68).toFixed(2)}px`);
        page.style.setProperty("--home-parallax-y-inverse", `${(-y * 0.68).toFixed(2)}px`);
      });
    };

    const resetParallax = () => {
      page.style.setProperty("--home-parallax-x", "0px");
      page.style.setProperty("--home-parallax-y", "0px");
      page.style.setProperty("--home-parallax-x-inverse", "0px");
      page.style.setProperty("--home-parallax-y-inverse", "0px");
    };

    page.addEventListener("pointermove", updateParallax, { passive: true });
    page.addEventListener("pointerleave", resetParallax);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      page.removeEventListener("pointermove", updateParallax);
      page.removeEventListener("pointerleave", resetParallax);
    };
  }, []);

  return (
    <div ref={pageRef} className="home-page">
      <HomeBackgroundDecor />

      <main>
        <HeroSection />
        <FeaturesSection />
        <AISection />
        <StepsSection />
        <SecuritySection />
        <DashboardPreview />
        <FAQSection />
        <Ready />
      </main>
    </div>
  );
}

import { ArrowDown, Pause, Play } from "lucide-react";

import { HOME_SECTIONS } from "../homeAnchors";
import { useLanding } from "../landingContext";
import GravityStars from "./GravityStars";
import { Kerned, Logo, PlatformLink, SectionLink, Wordmark } from "./Shared";

const delay = (ms) => ({ "--d": `${ms}ms` });

/*
 * Star settings per theme. The component tints stars towards pale, near-white
 * endpoints, which suits a night sky but vanishes on a light background. Light
 * mode therefore uses a deep brand blue, almost no tint, a tighter glow and
 * slightly larger cores, so stars read as crisp points and links stay visible.
 */
const STARS = {
  dark: { color: "#b9cbe8", tint: 0.65, glow: 5.5, starSize: 1.5, connectDistance: 120, count: 240, twinkle: 0.55 },
  light: { color: "#1a44c6", tint: 0.06, glow: 3.4, starSize: 1.8, connectDistance: 146, count: 250, twinkle: 0.4 },
};

export default function Hero() {
  const { t, theme, animated, reduced, toggleMotion } = useLanding();
  return <section className="hero" id={HOME_SECTIONS.TOP} aria-labelledby="hero-title">
    <span className="hero-sentinel" data-header-sentinel aria-hidden="true" />
    <div className="hero-light" aria-hidden="true"><i className="hero-beam" /><i className="hero-halo" /></div>
    <div className="hero-geometry" aria-hidden="true"><i /><i /><i /></div>
    <GravityStars className="hero-stars" {...STARS[theme === "light" ? "light" : "dark"]} paused={!animated}>
      <div className="hero-inner container">
        <div className="hero-lockup enter" style={delay(0)}>
          <span className="hero-logo"><span className="hero-logo-ring" aria-hidden="true" /><Logo size={96} /></span>
          <Wordmark className="hero-wordmark" />
          <span className="hero-kicker">{t("hero.kicker")}</span>
        </div>

        <h1 id="hero-title" className="hero-title">
          <span className="hero-line enter" style={delay(120)}><Kerned text={t("hero.line")} /></span>
          <span className="hero-line hero-line-accent enter" style={delay(220)}><span>{t("hero.accent")}</span></span>
        </h1>

        <p className="hero-lede enter" style={delay(320)}>{t("hero.lede")}</p>

        <div className="hero-actions enter" style={delay(400)}>
          <PlatformLink />
          <SectionLink className="btn btn-ghost" section={HOME_SECTIONS.EXPERIENCE}><span>{t("hero.demo")}</span><span className="btn-icon" aria-hidden="true"><ArrowDown size={15} /></span></SectionLink>
        </div>
      </div>

      <div className="hero-foot container enter" style={delay(520)}>
        <SectionLink section={HOME_SECTIONS.EXPERIENCE} className="scroll-cue"><span className="scroll-cue-line" aria-hidden="true" /><span>{t("hero.scrollCue")}</span></SectionLink>
        <button className="motion-toggle" onClick={toggleMotion} disabled={reduced} aria-pressed={!animated}>
          {animated ? <Pause size={12} /> : <Play size={12} />}
          <span>{reduced ? t("hero.motionReduced") : animated ? t("hero.motionPause") : t("hero.motionPlay")}</span>
        </button>
      </div>
    </GravityStars>
    <div className="hero-horizon" aria-hidden="true" />
  </section>;
}

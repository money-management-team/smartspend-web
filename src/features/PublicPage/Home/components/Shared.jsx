import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowUpRight, X } from "lucide-react";

/* A 256px resample of the SmartSpend logo for display. */
import logo from "../../../../assets/smartspend-logo-256.png";
import { getHomeSectionPath } from "../homeAnchors";
import { useLanding } from "../landingContext";
import { cx, usePlatformDestination } from "../landingUi";

/** The SmartSpend name, always set left-to-right and never translated. */
export function Wordmark({ className }) {
  return <span className={cx("wordmark", className)} dir="ltr" translate="no">Smart<span>Spend</span></span>;
}

export function Logo({ size = 40, className }) {
  return <img className={cx("logo", className)} src={logo} alt="" width={size} height={size} decoding="async" />;
}

/** Logo and name lockup. */
export function Brand({ size = "md", showName = true, className }) {
  const pixels = size === "lg" ? 56 : size === "sm" ? 30 : 38;
  return <span className={cx("brand", `brand-${size}`, className)} dir="ltr">
    <Logo size={pixels} />
    {showName && <Wordmark />}
  </span>;
}

/** Trailing icon nested in its own circle, the "button in a button". */
export function ButtonIcon({ children }) {
  return <span className="btn-icon" aria-hidden="true">{children}</span>;
}

/** A link to a section of the home page, through the router. */
export function SectionLink({ section, children, ...rest }) {
  return <Link to={getHomeSectionPath(section)} {...rest}>{children}</Link>;
}

/** The main call to action: "Start with SmartSpend" (sign-up), or "Open SmartSpend" (dashboard) once signed in. */
export function PlatformLink({ children, variant = "primary", className, onClick }) {
  const { t } = useLanding();
  const { to, signedIn } = usePlatformDestination();
  return <Link to={to} className={cx("btn", `btn-${variant}`, className)} onClick={onClick}>
    <span>{children ?? (signedIn ? t("cta.open") : t("cta.start"))}</span>
    <ButtonIcon><ArrowUpRight size={16} className="flip-rtl" /></ButtonIcon>
  </Link>;
}

export function Eyebrow({ children, className }) {
  return <span className={cx("eyebrow", className)}><i aria-hidden="true" />{children}</span>;
}

/** Visible label for illustrative data. It stays on every interactive example. */
export function SampleBadge({ children, className }) {
  return <span className={cx("sample-badge", className)}><i aria-hidden="true" />{children}</span>;
}

/** Trailing punctuation gets optical kerning, since tight display tracking leaves it floating. */
export function Kerned({ text }) {
  const match = text.match(/^([\s\S]*?)([.,،]+)$/);
  if (!match) return <>{text}</>;
  return <>{match[1]}<span className="punct">{match[2]}</span></>;
}

/** Two-line headings: a firm statement, then a softer accent line. */
export function Heading({ id, title, accent, level = 2, className }) {
  const Tag = level === 2 ? "h2" : "h3";
  return <Tag id={id} className={cx("heading", className)}>
    <span className="heading-line"><Kerned text={title} /></span>
    {accent && <> <span className="heading-accent">{accent}</span></>}
  </Tag>;
}

export function SectionIntro({ id, eyebrow, title, accent, description, align = "center", className }) {
  return <div className={cx("section-intro", align === "center" && "section-intro-center", className)} data-reveal>
    <Eyebrow>{eyebrow}</Eyebrow>
    <Heading id={id} title={title} accent={accent} />
    {description && <p className="lede">{description}</p>}
  </div>;
}

/** Double-bezel enclosure: a hairline shell holding an inner core with its own light. */
export function Bezel({ children, className, coreClassName, ...rest }) {
  return <div className={cx("bezel", className)} {...rest}><div className={cx("bezel-core", coreClassName)}>{children}</div></div>;
}

export function Progress({ value, label, tone = "brand", className }) {
  const clamped = Math.max(0, Math.min(100, value));
  return <span className={cx("progress", tone === "warn" && "progress-warn", className)} role={label ? "progressbar" : undefined}
    aria-label={label} aria-valuenow={label ? Math.round(clamped) : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined}
    aria-hidden={label ? undefined : true}>
    <span style={{ transform: `scaleX(${clamped / 100})` }} />
  </span>;
}

/*
 * Dialogs render outside #root (which turns inert while one is open), into a
 * layer that carries the landing's scope so its styles still apply.
 */
function useDialogLayer(open) {
  const [layer] = useState(() => {
    const element = document.createElement("div");
    element.className = "smartspend-landing smartspend-landing--layer";
    return element;
  });
  useEffect(() => {
    if (!open) return undefined;
    document.body.appendChild(layer);
    return () => layer.remove();
  }, [open, layer]);
  return layer;
}

export function Dialog({ open, onClose, title, children, className = "" }) {
  const { t } = useLanding();
  const titleId = useId();
  const panel = useRef(null);
  const close = useRef(onClose);
  const layer = useDialogLayer(open);

  useEffect(() => {
    close.current = onClose;
  });

  // Runs after the layer is attached (useDialogLayer's effect is declared first).
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(panel.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex="0"]',
    ) ?? []);
    focusables()[0]?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const nodes = focusables();
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); panel.current?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      if (root) root.inert = wasInert;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, layer]);

  if (!open) return null;
  return createPortal(<div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={cx("dialog", className)} ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-btn" onClick={onClose} aria-label={t("close")}><X size={18} /></button></div>
      {children}
    </div>
  </div>, layer);
}

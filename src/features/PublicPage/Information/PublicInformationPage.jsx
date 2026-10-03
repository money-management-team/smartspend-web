import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LuArrowRight,
  LuArrowUpRight,
  LuCalendarDays,
  LuChartNoAxesCombined,
  LuCheck,
  LuChevronDown,
  LuCircleHelp,
  LuCopy,
  LuEye,
  LuHistory,
  LuInfo,
  LuLayers,
  LuLockKeyhole,
  LuMail,
  LuMic,
  LuPenLine,
  LuReceipt,
  LuRefreshCcw,
  LuScanLine,
  LuSearch,
  LuShieldCheck,
  LuSlidersHorizontal,
  LuSparkles,
  LuTarget,
  LuWallet,
  LuX,
  LuGlobe,
} from "react-icons/lu";
import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { POLICY_SUPPORT_EMAIL } from "../../../components/AccessExperience/policyContent";
import { AUTH_INTENT, getAccountTypePath, PATH } from "../../../routes/Path";
import {
  PUBLIC_INFORMATION_PAGES,
  publicInformationContent,
} from "./publicInformationContent";
import "./PublicInformation.css";

const icons = {
  wallet: LuWallet,
  receipt: LuReceipt,
  calendar: LuCalendarDays,
  target: LuTarget,
  chart: LuChartNoAxesCombined,
  mic: LuMic,
  scan: LuScanLine,
  sparkles: LuSparkles,
  sliders: LuSlidersHorizontal,
  lock: LuLockKeyhole,
  shield: LuShieldCheck,
  check: LuCheck,
  layers: LuLayers,
  history: LuHistory,
  eye: LuEye,
  globe: LuGlobe,
  refresh: LuRefreshCcw,
  pen: LuPenLine,
  info: LuInfo,
  help: LuCircleHelp,
};
const heroIcons = {
  features: LuLayers,
  pricing: LuWallet,
  security: LuShieldCheck,
  about: LuSparkles,
  contact: LuMail,
  support: LuCircleHelp,
};

export default function PublicInformationPage({ pageKey }) {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuthContext();
  const language = (i18n.resolvedLanguage || i18n.language || "en").startsWith(
    "ar",
  )
    ? "ar"
    : "en";
  const copy = publicInformationContent[language];
  const common = copy.common;
  const page = copy[pageKey];
  const headingRef = useRef(null);
  const navigationRef = useRef(null);
  const actionPath = isAuthenticated
    ? PATH.USER.DASHBOARD
    : getAccountTypePath(AUTH_INTENT.REGISTER);
  const actionLabel = isAuthenticated ? common.dashboard : common.start;
  const HeroIcon = heroIcons[pageKey];

  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content");
    const description = meta || document.createElement("meta");
    if (!meta) {
      description.setAttribute("name", "description");
      document.head.appendChild(description);
    }
    document.title = `${common.nav[pageKey]} | SmartSpend`;
    description.setAttribute("content", page.intro);
    return () => {
      document.title = previousTitle;
      if (!meta) description.remove();
      else if (previousDescription === null)
        description.removeAttribute("content");
      else description.setAttribute("content", previousDescription);
    };
  }, [common.nav, page.intro, pageKey]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [pageKey]);

  useEffect(() => {
    const navigation = navigationRef.current;
    const active = navigation?.querySelector('[aria-current="page"]');
    if (!active || navigation.scrollWidth <= navigation.clientWidth) return;
    const box = navigation.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    // Scroll the mobile tabs only, without moving the page away from its hero.
    navigation.scrollBy({
      left: item.left + item.width / 2 - box.left - box.width / 2,
      behavior: "instant",
    });
  }, [pageKey, language]);

  return (
    <main
      className={`public-info public-info--${pageKey}`}
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div className="public-info__atmosphere" aria-hidden="true">
        <i />
        <i />
        <span />
      </div>
      <a className="public-info__skip" href="#public-info-content">
        {common.skip}
      </a>
      <div className="home-container public-info__inner">
        <div className="public-info__breadcrumb">
          <Link to={PATH.HOME}>{common.home}</Link>
          <span aria-hidden="true">/</span>
          <span>{common.nav[pageKey]}</span>
        </div>
        <header className="public-info__hero">
          <div className="public-info__hero-copy">
            <span className="public-info__eyebrow">
              <HeroIcon aria-hidden="true" />
              {page.eyebrow}
            </span>
            <h1 ref={headingRef} tabIndex={-1}>
              {page.title.split("\n").map((line, i) => (
                <span
                  key={line}
                  className={i ? "public-info__title-accent" : ""}
                >
                  {line}
                </span>
              ))}
            </h1>
            <p>{page.intro}</p>
            <div className="public-info__actions">
              <Link className="home-primary-button" to={actionPath}>
                {actionLabel}
                <LuArrowUpRight
                  className="public-info__arrow"
                  aria-hidden="true"
                />
              </Link>
              <Link
                className="public-info__text-link"
                to={
                  pageKey === "support"
                    ? PATH.PUBLIC.CONTACT
                    : PATH.PUBLIC.SUPPORT
                }
              >
                {pageKey === "support" ? common.contact : common.support}
                <LuArrowRight
                  className="public-info__arrow"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
          <aside
            className="public-info__hero-visual"
            aria-label={common.visualLabel}
          >
            <div className="public-info__orb" aria-hidden="true">
              <span />
              <span />
              <HeroIcon />
            </div>
            <span className="public-info__eyebrow">{common.product}</span>
            <h2>{common.visualTitle}</h2>
            <p>{common.visualBody}</p>
            <div className="public-info__visual-steps">
              {common.visualSteps.map((step, i) => (
                <span key={step}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  {step}
                  <LuCheck aria-hidden="true" />
                </span>
              ))}
            </div>
          </aside>
        </header>
        <nav
          ref={navigationRef}
          className="public-info__navigation"
          aria-label={common.navigation}
        >
          {PUBLIC_INFORMATION_PAGES.map((key) => (
            <NavLink key={key} to={PATH.PUBLIC[key.toUpperCase()]}>
              {common.nav[key]}
            </NavLink>
          ))}
        </nav>
        <div
          id="public-info-content"
          className="public-info__content"
          tabIndex={-1}
        >
          <PageContent
            key={pageKey}
            pageKey={pageKey}
            page={page}
            common={common}
            actionPath={actionPath}
            actionLabel={actionLabel}
          />
        </div>
        <section className="public-info__cta">
          <div>
            <span className="public-info__eyebrow">{common.next}</span>
            <h2>{common.ctaTitle}</h2>
            <p>{common.ctaBody}</p>
          </div>
          <Link to={actionPath} className="home-primary-button">
            {actionLabel}
            <LuArrowUpRight className="public-info__arrow" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </main>
  );
}

function PageContent(props) {
  switch (props.pageKey) {
    case "features":
      return <FeaturesContent {...props} />;
    case "pricing":
      return <PricingContent {...props} />;
    case "security":
      return <SecurityContent {...props} />;
    case "about":
      return <AboutContent {...props} />;
    case "contact":
      return <ContactContent {...props} />;
    case "support":
      return <SupportContent {...props} />;
    default:
      return null;
  }
}

function Cards({ items, className = "" }) {
  return (
    <div className={`public-info__cards ${className}`}>
      {items.map((item, i) => {
        const Icon = icons[item.icon] || LuInfo;
        return (
          <article
            key={item.title}
            className="public-info__card"
            style={{ "--info-order": Math.min(i, 5) }}
          >
            <div className="public-info__card-top">
              <span className="public-info__icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="public-info__number" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        );
      })}
    </div>
  );
}

function SectionHeading({ title, body }) {
  return (
    <div className="public-info__section-heading">
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}

function Filters({ filters, selected, onSelect, label }) {
  return (
    <div className="public-info__filters" role="group" aria-label={label}>
      {Object.entries(filters).map(([value, text]) => (
        <button
          key={value}
          type="button"
          aria-pressed={selected === value}
          onClick={() => onSelect(value)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Note({ children }) {
  return (
    <div className="public-info__note">
      <LuInfo aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

function FeaturesContent({ page }) {
  const [filter, setFilter] = useState("all");
  return (
    <>
      <SectionHeading title={page.section} body={page.sectionBody} />
      <Filters
        filters={page.filters}
        selected={filter}
        onSelect={setFilter}
        label={page.section}
      />
      <Cards
        items={page.items.filter(
          (item) => filter === "all" || item.group === filter,
        )}
      />
      <section className="public-info__panel">
        <SectionHeading title={page.flowTitle} body={page.flowBody} />
        <ol className="public-info__steps">
          {page.flow.map((step, i) => (
            <li key={step}>
              <b>{String(i + 1).padStart(2, "0")}</b>
              <h3>{step}</h3>
            </li>
          ))}
        </ol>
      </section>
      <Note>{page.note}</Note>
    </>
  );
}

function PricingContent({ page, actionPath, actionLabel }) {
  return (
    <>
      <div className="public-info__pricing-grid">
        <article className="public-info__plan">
          <span className="public-info__badge">
            <LuCheck aria-hidden="true" />
            {page.badge}
          </span>
          <h2>{page.plan}</h2>
          <p>{page.planBody}</p>
          <ul className="public-info__checklist">
            {page.included.map((item) => (
              <li key={item}>
                <LuCheck aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <Link to={actionPath} className="home-primary-button">
            {actionLabel}
            <LuArrowUpRight className="public-info__arrow" aria-hidden="true" />
          </Link>
          <div className="public-info__availability">
            <strong>{page.availability}</strong>
            <p>{page.availabilityBody}</p>
          </div>
        </article>
        <section className="public-info__quota">
          <span className="public-info__icon">
            <LuSparkles aria-hidden="true" />
          </span>
          <h2>{page.quotaTitle}</h2>
          <p>{page.quotaBody}</p>
          <div className="public-info__quota-numbers">
            <div>
              <LuMic aria-hidden="true" />
              <strong>10</strong>
              <span>{page.voice}</span>
            </div>
            <div>
              <LuScanLine aria-hidden="true" />
              <strong>10</strong>
              <span>{page.receipts}</span>
            </div>
          </div>
          <Note>{page.reset}</Note>
        </section>
      </div>
      <Cards items={page.rules} />
    </>
  );
}

function SecurityContent({ page, common }) {
  return (
    <>
      <SectionHeading title={page.section} body={page.sectionBody} />
      <Cards items={page.items} />
      <section className="public-info__panel public-info__privacy-panel">
        <div>
          <span className="public-info__icon">
            <LuShieldCheck aria-hidden="true" />
          </span>
          <h2>{page.controlTitle}</h2>
          <div className="public-info__actions">
            <a href="/privacy.html" className="public-info__text-link">
              {common.privacy}
              <LuArrowUpRight
                className="public-info__arrow"
                aria-hidden="true"
              />
            </a>
            <a href="/terms.html" className="public-info__text-link">
              {common.terms}
            </a>
          </div>
        </div>
        <ul className="public-info__checklist">
          {page.controls.map((item) => (
            <li key={item}>
              <LuCheck aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function AboutContent({ page }) {
  return (
    <>
      <section className="public-info__mission">
        <span className="public-info__icon">
          <LuTarget aria-hidden="true" />
        </span>
        <div>
          <h2>{page.mission}</h2>
          <p>{page.missionBody}</p>
        </div>
      </section>
      <Cards items={page.items} />
      <section className="public-info__panel">
        <SectionHeading title={page.journeyTitle} />
        <ol className="public-info__steps">
          {page.journey.map((step, i) => (
            <li key={step.title}>
              <b>{String(i + 1).padStart(2, "0")}</b>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
      <Note>{page.note}</Note>
    </>
  );
}

function ContactContent({ page }) {
  const [topic, setTopic] = useState("general");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const fieldRef = useRef(null);
  const emailHref = `mailto:${POLICY_SUPPORT_EMAIL}`;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(POLICY_SUPPORT_EMAIL);
      setCopyNotice("copied");
    } catch {
      setCopyNotice("copyFailed");
    }
  };
  const openEmail = (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setNotice("formRequired");
      fieldRef.current?.focus();
      return;
    }
    // Encode user input as mailto data. Never send a request or report delivery.
    const subject = `SmartSpend — ${page.topics[topic]}`;
    const body = `${page.topic}: ${page.topics[topic]}\n${name.trim() ? `${page.name}: ${name.trim()}\n` : ""}\n${message.trim()}`;
    window.location.href = `${emailHref}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setNotice("opened");
  };

  return (
    <div className="public-info__contact-grid">
      <aside className="public-info__contact-side">
        <section className="public-info__panel public-info__email-card">
          <span className="public-info__icon">
            <LuMail aria-hidden="true" />
          </span>
          <h2>{page.emailTitle}</h2>
          <p>{page.emailBody}</p>
          <a className="public-info__email" href={emailHref}>
            <bdi dir="ltr">{POLICY_SUPPORT_EMAIL}</bdi>
          </a>
          <button
            type="button"
            className="public-info__secondary-button"
            onClick={copyEmail}
          >
            <LuCopy aria-hidden="true" />
            {page.copy}
          </button>
          <p className="public-info__status" role="status">
            {copyNotice ? page[copyNotice] : ""}
          </p>
        </section>
        <h2 className="public-info__side-title">{page.routesTitle}</h2>
        {page.routes.map((route) => {
          const Icon = icons[route.icon];
          return (
            <Link
              className="public-info__resource-link"
              key={route.page}
              to={PATH.PUBLIC[route.page.toUpperCase()]}
            >
              <Icon aria-hidden="true" />
              <div>
                <h3>{route.title}</h3>
                <p>{route.body}</p>
              </div>
              <LuArrowUpRight
                className="public-info__arrow"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </aside>
      <form
        className="public-info__panel public-info__contact-form"
        onSubmit={openEmail}
      >
        <SectionHeading title={page.formTitle} body={page.formBody} />
        <label htmlFor="contact-topic">{page.topic}</label>
        <select
          id="contact-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        >
          {Object.entries(page.topics).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="contact-name">{page.name}</label>
        <input
          id="contact-name"
          type="text"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <label htmlFor="contact-message">{page.message}</label>
        <textarea
          ref={fieldRef}
          id="contact-message"
          rows={6}
          maxLength={1500}
          required
          placeholder={page.placeholder}
          value={message}
          aria-describedby="contact-hint"
          onChange={(event) => {
            setMessage(event.target.value);
            setNotice("");
          }}
        />
        <p id="contact-hint" className="public-info__field-hint">
          {page.messageHint}
        </p>
        <div className="public-info__actions">
          <button className="home-primary-button" type="submit">
            <LuMail aria-hidden="true" />
            {page.submit}
          </button>
          <a className="public-info__text-link" href={emailHref}>
            {page.emailFallback}
          </a>
        </div>
        <p className="public-info__status" role="status">
          {notice ? page[notice] : ""}
        </p>
      </form>
    </div>
  );
}

function SupportContent({ page, common }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const searchRef = useRef(null);
  const normalize = (text) =>
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
      .toLocaleLowerCase()
      .replace(/[أإآ]/g, "ا")
      .trim();
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const results = page.questions.filter(
    (item) =>
      (filter === "all" || filter === item.group) &&
      words.every((word) => normalize(`${item.q} ${item.a}`).includes(word)),
  );
  return (
    <>
      <div className="public-info__help-search">
        <label htmlFor="help-search">{page.search}</label>
        <div>
          <LuSearch aria-hidden="true" />
          <input
            ref={searchRef}
            id="help-search"
            type="search"
            maxLength={120}
            placeholder={page.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label={page.clear}
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
            >
              <LuX aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <Filters
        filters={page.filters}
        selected={filter}
        onSelect={setFilter}
        label={page.search}
      />
      <p className="public-info__results" role="status">
        {page.results}: {results.length}
      </p>
      <div className="public-info__help-layout">
        <div className="public-info__faq-list">
          {results.map((item) => (
            <details className="public-info__faq" key={item.id}>
              <summary>
                <span>{item.q}</span>
                <LuChevronDown aria-hidden="true" />
              </summary>
              <div>
                <p>{item.a}</p>
              </div>
            </details>
          ))}
          {!results.length && (
            <div className="public-info__empty">
              <LuSearch aria-hidden="true" />
              <h2>{page.empty}</h2>
              <p>{page.emptyBody}</p>
              <Link className="public-info__text-link" to={PATH.PUBLIC.CONTACT}>
                {common.contact}
                <LuArrowUpRight
                  className="public-info__arrow"
                  aria-hidden="true"
                />
              </Link>
            </div>
          )}
        </div>
        <aside className="public-info__help-aside">
          <span className="public-info__icon">
            <LuCircleHelp aria-hidden="true" />
          </span>
          <h2>{common.contact}</h2>
          <p>{page.safety}</p>
          <Link
            to={PATH.PUBLIC.CONTACT}
            className="public-info__secondary-button"
          >
            <LuMail aria-hidden="true" />
            {common.contact}
          </Link>
          <a className="public-info__text-link" href="/privacy.html">
            {common.privacy}
          </a>
        </aside>
      </div>
    </>
  );
}

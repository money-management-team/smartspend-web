import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMatch, useNavigate } from "react-router-dom";
import { PATH } from "../../../routes/Path";
import { FiGrid, FiUsers, FiBriefcase, FiCreditCard, FiLifeBuoy, FiZap, FiShield, FiSettings, FiHelpCircle, FiSidebar, FiGlobe, FiMoon, FiSun, FiBell, FiSearch, FiMenu, FiX } from "react-icons/fi";
import { useThemeContext } from "../../../contexts/theme/useThemeContext";
import { useLanguageContext } from "../../../contexts/language/useLanguageContext";
import logo from "../../../assets/smart-spend-logo.png";

const sections = [
  { label: "overviewGroup", items: [{ key: "overview", icon: FiGrid }] },
  { label: "products", items: [{ key: "personal", icon: FiUsers }, { key: "business", icon: FiBriefcase }] },
  { label: "operations", items: [{ key: "billing", icon: FiCreditCard }, { key: "support", icon: FiLifeBuoy, badge: 4 }, { key: "ai", icon: FiZap }, { key: "security", icon: FiShield, badge: 2 }] },
  { label: "system", items: [{ key: "settings", icon: FiSettings }] },
];

export default function AdminShell({ children, openDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const personalMatch = useMatch({ path: PATH.ADMIN_PERSONAL, end: true });
  const activeSection = personalMatch ? "personal" : "overview";
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${t(activeSection === "personal" ? "admin.personalPage.title" : "admin.title")} | SmartSpend`;
    return () => { document.title = previousTitle; };
  }, [activeSection, t]);
  const { isDark, toggleTheme } = useThemeContext();
  const { language, changeLanguage } = useLanguageContext();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const drawerRef = useRef(null);
  const closeDrawerRef = useRef(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement;
    const drawer = drawerRef.current;
    const media = window.matchMedia("(max-width: 760px)");
    closeDrawerRef.current?.focus();
    function containFocus(event) {
      if (event.key !== "Tab" || document.querySelector("dialog[open]")) return;
      const controls = [...drawer.querySelectorAll("a[href], button")].filter(element => element.offsetParent !== null);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    function handleResize() { if (!media.matches) setMobileOpen(false); }
    document.addEventListener("keydown", containFocus);
    media.addEventListener("change", handleResize);
    return () => {
      document.removeEventListener("keydown", containFocus);
      media.removeEventListener("change", handleResize);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobileOpen]);
  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);
  const items = sections.flatMap(section => section.items);
  const matches = items.filter(item => t(`admin.${item.key}`).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  function selectSection(key) {
    setMobileOpen(false);
    setSearch("");
    setSearchFocused(false);
    if (key === "overview" || key === "personal") {
      if (key === activeSection) document.getElementById("admin-main").focus();
      else navigate(key === "personal" ? PATH.ADMIN_PERSONAL : PATH.ADMIN);
    } else openDetail(key, "comingSoon");
  }

  return (
    <div className={`admin-app${collapsed ? " admin-app--collapsed" : ""}`}>
      <a className="admin-skip" href="#admin-main">{t("admin.skip")}</a>
      {mobileOpen && <button className="admin-backdrop" aria-label={t("admin.close")} onClick={() => setMobileOpen(false)} />}
      <aside ref={drawerRef} className={`admin-sidebar${mobileOpen ? " admin-sidebar--open" : ""}`} aria-label={t("admin.platformAdmin")} role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined}>
        <a href="#admin-main" className="admin-brand" aria-label="SmartSpend" onClick={() => setMobileOpen(false)}>
          <img src={logo} alt="" />
          <span className="admin-sidebar-label"><strong>SmartSpend</strong><small>{t("admin.platformAdmin")}</small></span>
        </a>
        <button ref={closeDrawerRef} className="admin-icon-button admin-mobile-close" aria-label={t("admin.close")} onClick={() => setMobileOpen(false)}><FiX /></button>
        <div className="admin-system-health" title={t("admin.normal")}><i className="admin-dot" /><div className="admin-sidebar-label"><strong>{t("admin.normal")}</strong><small>{t("admin.productScope")}</small></div></div>
        <nav aria-label={t("admin.menu")} className="admin-nav">
          {sections.map(section => <div className="admin-nav__group" key={section.label}>
            <h2 className="admin-sidebar-label">{t(`admin.${section.label}`)}</h2>
            {section.items.map(({ key, icon: Icon, badge }) => <button key={key} title={t(`admin.${key}`)}
              className={`admin-nav__item${key === activeSection ? " admin-nav__item--active" : ""}`}
              aria-current={key === activeSection ? "page" : undefined} onClick={() => selectSection(key)}>
              <Icon /><span className="admin-sidebar-label">{t(`admin.${key}`)}</span>
              {badge && <span className="admin-nav__badge admin-sidebar-label">{badge}</span>}
            </button>)}
          </div>)}
        </nav>
        <div className="admin-sidebar__footer">
          <button className="admin-nav__item" title={t("admin.help")} onClick={() => openDetail("help", "helpText")}><FiHelpCircle /><span className="admin-sidebar-label">{t("admin.help")}</span></button>
          <button className="admin-nav__item admin-collapse" aria-label={t(collapsed ? "admin.expand" : "admin.collapse")} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><FiSidebar /><span className="admin-sidebar-label">{t("admin.collapse")}</span></button>
        </div>
      </aside>
      <div className="admin-workspace" inert={mobileOpen || undefined}>
        <header className="admin-header">
          <button className="admin-icon-button admin-mobile-menu" aria-label={t(mobileOpen ? "admin.close" : "admin.menu")} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <FiX /> : <FiMenu />}</button>
          <div className="admin-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false); }}>
            <FiSearch />
            <input ref={searchRef} aria-label={t("admin.searchLabel")} placeholder={t("admin.search")} value={search} onChange={event => setSearch(event.target.value)} onFocus={() => setSearchFocused(true)} onKeyDown={event => {
              if (event.key === "Escape") setSearchFocused(false);
              if (event.key === "Enter" && search.trim() && matches.length) {
                // Prevent Enter from activating the dialog's newly focused close button.
                event.preventDefault();
                selectSection(matches[0].key);
              }
            }} />
            <span className="admin-search__hint" aria-hidden="true">⌘ K</span>
            {searchFocused && search.trim() && <div className="admin-search__results">
              {matches.length ? matches.map(({ key, icon: Icon }) => <button key={key} onClick={() => selectSection(key)}><Icon />{t(`admin.${key}`)}</button>) : <p>{t("admin.noResults")}</p>}
            </div>}
          </div>
          <div className="admin-header__actions">
            <button className="admin-icon-button admin-language" aria-label={t("admin.language")} onClick={changeLanguage}><FiGlobe /><span>{language === "ar" ? "EN" : "AR"}</span></button>
            <button className="admin-icon-button" aria-label={t("admin.theme")} aria-pressed={isDark} onClick={toggleTheme}>{isDark ? <FiSun /> : <FiMoon />}</button>
            <button className="admin-icon-button admin-notification" aria-label={t("admin.notifications")} onClick={() => openDetail("notifications", "notificationText")}><FiBell /><span>3</span></button>
            <button className="admin-profile" aria-label={t("admin.profile")} onClick={() => openDetail("profile", "profileText")}><span className="admin-avatar">LS</span><span className="admin-profile__text"><strong>{t("admin.name")}</strong><small>{t("admin.role")}</small></span></button>
          </div>
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

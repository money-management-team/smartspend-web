import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import "../admin-motion.css";
import "../admin-select.css";
import { FiLogOut as FiArrowExit } from "react-icons/fi";
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
  const location = useLocation();
  const [accountOpen,setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const accountButtonRef = useRef(null);
  useEffect(()=>{
    if(!accountOpen)return;
    function outside(event){if(!accountRef.current?.contains(event.target))setAccountOpen(false);}
    function keyboard(event){if(event.key==="Escape"){setAccountOpen(false);accountButtonRef.current?.focus();}}
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",keyboard);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",keyboard);};
  },[accountOpen]);
  useEffect(()=>{setAccountOpen(false);},[location.pathname,location.search]);
  const [notificationsOpen,setNotificationsOpen] = useState(false);
  const [readNotifications,setReadNotifications] = useState([]);
  const notificationRef = useRef(null);
  const bellRef = useRef(null);
  const { i18n } = useTranslation();
  const notificationArabic = i18n.language.startsWith("ar");
  const notifications = [
    {id:1,title:notificationArabic?"فشل تجديد اشتراك":"Subscription renewal failed",body:notificationArabic?"Orbit Media بحاجة إلى متابعة الدفع.":"Orbit Media needs payment follow-up.",time:notificationArabic?"منذ ٥ دقائق":"5 minutes ago",path:PATH.ADMIN_BILLING+"?tab=payments",icon:FiCreditCard,tone:"orange"},
    {id:2,title:notificationArabic?"تنبيه أمني جديد":"New security alert",body:notificationArabic?"محاولات دخول متكررة تحتاج إلى مراجعة.":"Repeated sign-in attempts need review.",time:notificationArabic?"منذ ١٢ دقيقة":"12 minutes ago",path:PATH.ADMIN_SECURITY,icon:FiShield,tone:"red"},
    {id:3,title:notificationArabic?"تذكرة دعم حرجة":"Critical support ticket",body:notificationArabic?"التذكرة TKT-1842 بانتظار المتابعة.":"Ticket TKT-1842 is waiting for follow-up.",time:notificationArabic?"منذ ٢٥ دقيقة":"25 minutes ago",path:PATH.ADMIN_SUPPORT,icon:FiLifeBuoy,tone:"blue"},
  ];
  useEffect(()=>{
    if(!notificationsOpen)return;
    function outside(event){if(!notificationRef.current?.contains(event.target))setNotificationsOpen(false);}
    function escape(event){if(event.key==="Escape"){setNotificationsOpen(false);bellRef.current?.focus();}}
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[notificationsOpen]);
  useEffect(()=>{setNotificationsOpen(false);},[location.pathname,location.search]);
  const personalMatch = useMatch({ path: `${PATH.ADMIN_PERSONAL}/*`, end: false });
  const businessMatch = useMatch({ path: `${PATH.ADMIN_BUSINESS}/*`, end: false });
  const billingMatch = useMatch({ path: PATH.ADMIN_BILLING, end: true });
  const supportMatch = useMatch({ path: PATH.ADMIN_SUPPORT, end: true });
  const aiMatch = useMatch({ path: PATH.ADMIN_AI, end: true });
  const securityMatch = useMatch({ path: PATH.ADMIN_SECURITY, end: true });
  const settingsMatch = useMatch({ path: PATH.ADMIN_SETTINGS, end: true });
  const activeSection = settingsMatch ? "settings" : securityMatch ? "security" : aiMatch ? "ai" : supportMatch ? "support" : billingMatch ? "billing" : personalMatch ? "personal" : businessMatch ? "business" : "overview";
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${t(activeSection === "support" ? "admin.support" : activeSection === "billing" ? "admin.billing" : activeSection === "personal" ? "admin.personalPage.title" : activeSection === "business" ? "admin.businessPage.title" : "admin.title")} | SmartSpend`;
    return () => { document.title = previousTitle; };
  }, [activeSection, t]);
  const { isDark, toggleTheme } = useThemeContext();
  const { language, changeLanguage } = useLanguageContext();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("smartspend-admin-sidebar-collapsed") === "true"; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("smartspend-admin-sidebar-collapsed", String(collapsed)); }
    catch { /* Keep the toggle usable when browser storage is unavailable. */ }
  }, [collapsed]);
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
      if (event.ctrlKey && !event.altKey && !event.shiftKey && (event.code === "KeyQ" || event.key.toLowerCase() === "q") && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchFocused(true);
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
    if (["overview", "personal", "business", "billing", "support", "ai", "security", "settings"].includes(key)) {
      if (key === activeSection) document.getElementById("admin-main").focus();
      else navigate(key === "settings" ? PATH.ADMIN_SETTINGS : key === "security" ? PATH.ADMIN_SECURITY : key === "ai" ? PATH.ADMIN_AI : key === "support" ? PATH.ADMIN_SUPPORT : key === "billing" ? PATH.ADMIN_BILLING : key === "personal" ? PATH.ADMIN_PERSONAL : key === "business" ? PATH.ADMIN_BUSINESS : PATH.ADMIN);
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
              {badge && <span className="admin-nav__badge">{badge}</span>}
            </button>)}
          </div>)}
        </nav>
        <div className="admin-sidebar__footer">
          <button className="admin-nav__item admin-collapse" title={t(collapsed ? "admin.expand" : "admin.collapse")} aria-label={t(collapsed ? "admin.expand" : "admin.collapse")} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><FiSidebar /><span className="admin-sidebar-label">{t("admin.collapse")}</span></button>
          <button className="admin-nav__item" title={t("admin.help")} onClick={() => openDetail("help", "helpText")}><FiHelpCircle /><span className="admin-sidebar-label">{t("admin.help")}</span></button>
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
            <span className="admin-search__hint" aria-hidden="true">Ctrl + Q</span>
            {searchFocused && <div className="admin-search__results">
              {matches.length ? matches.map(({ key, icon: Icon }) => <button key={key} onClick={() => selectSection(key)}><Icon />{t(`admin.${key}`)}</button>) : <p>{t("admin.noResults")}</p>}
            </div>}
          </div>
          <div className="admin-header__actions">
            <button className="admin-icon-button admin-language" aria-label={t("admin.language")} onClick={changeLanguage}><FiGlobe /><span>{language === "ar" ? "EN" : "AR"}</span></button>
            <button className="admin-icon-button" aria-label={t("admin.theme")} aria-pressed={isDark} onClick={toggleTheme}>{isDark ? <FiSun /> : <FiMoon />}</button>
            <div className="admin-notifications-wrap" ref={notificationRef} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setNotificationsOpen(false);}}>
              <button ref={bellRef} className="admin-icon-button admin-notification" aria-label={t("admin.notifications")} aria-expanded={notificationsOpen} aria-controls="admin-notifications-panel" onClick={()=>setNotificationsOpen(value=>!value)}><FiBell />{readNotifications.length<notifications.length&&<span>{notifications.length-readNotifications.length}</span>}</button>
              {notificationsOpen&&<section id="admin-notifications-panel" className="admin-notifications-panel" aria-label={t("admin.notifications")}><header><h2>{t("admin.notifications")}</h2><button type="button" onClick={()=>setReadNotifications(notifications.map(item=>item.id))}>{notificationArabic?"تحديد الكل كمقروء":"Mark all as read"}</button></header><div className="admin-notifications-list">{notifications.map(({id,title,body,time,path,icon:Icon,tone})=><button key={id} type="button" className={`admin-notifications-item${readNotifications.includes(id)?" is-read":""}`} onClick={()=>{setReadNotifications(ids=>ids.includes(id)?ids:[...ids,id]);setNotificationsOpen(false);navigate(path);}}><span className={`admin-icon-tile admin-icon-tile--${tone}`}><Icon/></span><span className="admin-notifications-copy"><strong>{title}</strong><span>{body}</span><small>{time}</small></span>{!readNotifications.includes(id)&&<i className="admin-notifications-unread" aria-label={notificationArabic?"غير مقروء":"Unread"}/>}</button>)}</div><footer>{notificationArabic?"إشعارات المعاينة المحلية":"Local preview notifications"}</footer></section>}
            </div>
            <div className="admin-account-wrap" ref={accountRef} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setAccountOpen(false);}}>
              <button ref={accountButtonRef} className="admin-profile" aria-label={t("admin.profile")} aria-expanded={accountOpen} aria-controls="admin-account-panel" onClick={()=>{setAccountOpen(value=>!value);setNotificationsOpen(false);}}><span className="admin-avatar">LS</span><span className="admin-profile__text"><strong>{t("admin.name")}</strong><small>{t("admin.role")}</small></span></button>
              {accountOpen&&<section id="admin-account-panel" className="admin-account-panel" aria-label={t("admin.profile")}><header><span className="admin-avatar">LS</span><div><strong>{t("admin.name")}</strong><small>{t("admin.role")}</small><bdi>lina@smartspend.admin</bdi></div></header><div className="admin-account-links"><button type="button" onClick={()=>{setAccountOpen(false);navigate(PATH.ADMIN_SETTINGS+"?tab=access");}}><FiUsers/>{notificationArabic?"حسابي وصلاحياتي":"My account & access"}</button><button type="button" onClick={()=>{setAccountOpen(false);navigate(PATH.ADMIN_SETTINGS);}}><FiSettings/>{t("admin.settings")}</button><button type="button" onClick={()=>{setAccountOpen(false);navigate(PATH.ADMIN_SECURITY+"?tab=audit");}}><FiShield/>{notificationArabic?"سجل الأمان والتدقيق":"Security & audit log"}</button></div><div className="admin-account-links"><button type="button" onClick={changeLanguage}><FiGlobe/>{notificationArabic?"اللغة":"Language"}<span>{language==="ar"?"English":"العربية"}</span></button><button type="button" onClick={toggleTheme} aria-pressed={isDark}>{isDark?<FiSun/>:<FiMoon/>}{notificationArabic?"المظهر":"Appearance"}<span>{isDark?(notificationArabic?"داكن":"Dark"):(notificationArabic?"فاتح":"Light")}</span></button></div><div className="admin-account-links"><button type="button" className="admin-account-exit" onClick={()=>{setAccountOpen(false);navigate(PATH.HOME);}}><FiArrowExit/>{notificationArabic?"الخروج من معاينة الأدمن":"Exit admin preview"}</button></div></section>}
            </div>
          </div>
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}><div className="admin-page-transition" key={`${location.pathname}${location.search}`}>{children}</div></main>
      </div>
    </div>
  );
}

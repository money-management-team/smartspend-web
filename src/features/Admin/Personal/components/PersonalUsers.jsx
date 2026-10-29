import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiCheckCircle, FiAlertCircle, FiSearch, FiFilter, FiDownload } from "react-icons/fi";

// Synthetic identities only. No customer API or personal financial fields.
const users = [
  { id: "lina", initials: "LS", email: "lina@smartspend.demo", plan: "pro", verified: true, status: "active", ago: 8, unit: "minutesAgo" },
  { id: "omar", initials: "OK", email: "omar.khalil@example.com", plan: "plus", verified: true, status: "active", ago: 24, unit: "minutesAgo" },
  { id: "sarah", initials: "SA", email: "sarah.a@example.com", plan: "free", verified: false, status: "active", ago: 2, unit: "hoursAgo" },
  { id: "yousef", initials: "YN", email: "yousef.n@example.com", plan: "pro", verified: true, status: "suspended", ago: 3, unit: "daysAgo" },
  { id: "maya", initials: "MS", email: "maya.saleh@example.com", plan: "plus", verified: true, status: "active", ago: 5, unit: "hoursAgo" },
  { id: "adam", initials: "AM", email: "adam.m@example.com", plan: "free", verified: true, status: "inactive", ago: 16, unit: "daysAgo" },
];

export default function PersonalUsers({ fullList, onViewAll }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const p = (key, options) => t(`admin.personalPage.${key}`, options);
  const filtered = users.filter(user => !fullList || (`${p(`names.${user.id}`)} ${user.email}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (status === "all" || user.status === status)));
  return <section className={`admin-panel admin-personal-users${fullList ? " admin-personal-users--full" : ""}`} aria-labelledby="admin-personal-users-title">
    <div className="admin-panel__header"><div><h2 id="admin-personal-users-title">{p(fullList ? "users" : "recentTitle")}</h2><p>{p(fullList ? "fullUsersHint" : "recentHint")}</p></div>
      {!fullList && <button className="admin-text-link" onClick={onViewAll}>{p("viewAll")}<FiArrowUpRight /></button>}
    </div>
    {fullList && <div className="admin-personal-users__tools"><label className="admin-personal-users__search"><FiSearch /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={p("searchUsers")} aria-label={p("searchUsers")} /></label><label className="admin-personal-users__filter"><FiFilter /><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Status"><option value="all">{p("allStatuses")}</option><option value="active">{p("active")}</option><option value="inactive">{p("inactive")}</option><option value="suspended">{p("suspended")}</option></select></label><button className="admin-button" type="button"><FiDownload />{p("export")}</button><span role="status">{p("usersCount", { count: filtered.length })}</span></div>}
    <div className="admin-personal-users__scroll" role="region" aria-label={p("recentTitle")} tabIndex={0}>
      <table>
        <thead><tr>{["user", "plan", "verification", "status", "risk", "lastSignIn", ""].map(key => <th scope="col" key={key}>{key ? p(key) : ""}</th>)}</tr></thead>
        <tbody>{filtered.map(user => <tr key={user.id}>
          <th scope="row"><div className="admin-personal-user"><span className="admin-avatar">{user.initials}</span><div><strong>{p(`names.${user.id}`)}</strong><span><bdi>{user.email}</bdi></span></div></div></th>
          <td><span className={`admin-pill admin-personal-plan${user.plan === "free" ? " admin-personal-plan--free" : ""}`}>{p(user.plan)}</span></td>
          <td><span className={`admin-personal-verification${user.verified ? "" : " admin-personal-verification--pending"}`}>{user.verified ? <FiCheckCircle /> : <FiAlertCircle />}{p(user.verified ? "verified" : "pending")}</span></td>
          <td><span className={`admin-pill${user.status === "suspended" ? " admin-personal-suspended" : ""}`}>{p(user.status)}</span></td>
          <td><span className={`admin-pill admin-personal-risk admin-personal-risk--${user.status === "suspended" ? "high" : user.verified ? "low" : "medium"}`}>{p(user.status === "suspended" ? "high" : user.verified ? "low" : "medium")}</span></td>
          <td className="admin-personal-last-signin">{p(user.unit, { count: user.ago })}</td>
          <td><button className="admin-icon-button admin-personal-row-link" aria-label={`${p("names." + user.id)} details`}><FiArrowUpRight /></button></td>
        </tr>)}
          {!filtered.length && <tr><td colSpan={7} className="admin-personal-users__empty">{p("noUsers")}</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}

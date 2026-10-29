import { useState } from "react";
import AdminToast from "../components/AdminToast";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiLifeBuoy, FiFileText, FiBell, FiShield, FiClock, FiCheckCircle, FiRefreshCw, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import AdminShell from "../components/AdminShell";
import "../admin.css";
import "./support.css";

const initialTickets = [
  ["TKT-1842","Failed company subscription renewal","Orbit Media","Critical","Open","Mona H."],
  ["TKT-1841","Receipt AI extracted wrong currency","Sarah Ahmad","High","In_progress","Ahmad K."],
  ["TKT-1837","Need ownership transfer assistance","Nova Commerce","High","Waiting","Lina A."],
  ["TKT-1833","Cannot export monthly report","Maya Saleh","Medium","Open","—"],
  ["TKT-1821","Question about budget warnings","Greenline NGO","Low","Resolved","Omar S."],
];
const initialJobs = [
  ["JOB-99144","Receipt OCR","Sarah Ahmad","Vision OCR","Failed","—"],
  ["JOB-99143","Bank statement","Acme Studio","Document AI","Processing","18s"],
  ["JOB-99142","Receipt OCR","Nova Commerce","Vision OCR","Completed","3.2s"],
  ["JOB-99141","Report export","Lina Sakalla","Internal","Completed","1.8s"],
  ["JOB-99140","AI categorization","Cedar Labs","OpenAI","Completed","2.4s"],
];
const initialTemplates = [
  ["Welcome","Email + In-app","Personal + Business","Active","20 Sep 2026"],
  ["Payment failed","Email + In-app","Paid users","Active","18 Sep 2026"],
  ["Security alert","Email + In-app","All","Active","16 Sep 2026"],
  ["Subscription expiring","Email","Trials","Active","11 Sep 2026"],
  ["Budget threshold","In-app","Business","Active","9 Sep 2026"],
];
const translations = {
  Support:"الدعم",Processing:"المعالجة",Notifications:"الإشعارات",Ticket:"التذكرة",Subject:"الموضوع",Priority:"الأولوية",Status:"الحالة",Assigned:"المسؤول",Resolve:"حل التذكرة",Critical:"حرجة",High:"مرتفعة",Medium:"متوسطة",Low:"منخفضة",Open:"مفتوحة",In_progress:"قيد التنفيذ",Waiting:"بانتظار الرد",Resolved:"محلولة",Job:"المهمة",Type:"النوع",Owner:"المالك",Provider:"المزود",Duration:"المدة",Retry:"إعادة المحاولة",Failed:"فشلت",Completed:"مكتملة",Template:"القالب",Channel:"القناة",Audience:"الجمهور",Updated:"آخر تحديث",Active:"نشط",Welcome:"ترحيب","Payment failed":"فشل الدفع","Security alert":"تنبيه أمني","Subscription expiring":"انتهاء الاشتراك","Budget threshold":"حد الميزانية","Email + In-app":"البريد + داخل التطبيق",Email:"البريد الإلكتروني","In-app":"داخل التطبيق","Personal + Business":"الأفراد + الأعمال","Paid users":"المشتركون",All:"الجميع",Trials:"الحسابات التجريبية",Business:"الأعمال","Receipt OCR":"قراءة الإيصالات","Bank statement":"كشف حساب بنكي","Report export":"تصدير تقرير","AI categorization":"تصنيف ذكي",Internal:"داخلي",
  "Failed company subscription renewal":"فشل تجديد اشتراك الشركة","Receipt AI extracted wrong currency":"استخراج عملة خاطئة من الإيصال","Need ownership transfer assistance":"طلب مساعدة لنقل الملكية","Cannot export monthly report":"تعذر تصدير التقرير الشهري","Question about budget warnings":"استفسار حول تنبيهات الميزانية",
};

export default function Support() {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const tr = value => ar ? translations[value] || value : value;
  const [params,setParams] = useSearchParams();
  const tab = ["support","processing","notifications"].includes(params.get("tab")) ? params.get("tab") : "support";
  const [tickets,setTickets] = useState(initialTickets);
  const [jobs,setJobs] = useState(initialJobs);
  const [templates,setTemplates] = useState(initialTemplates);
  const [editing,setEditing] = useState(null);
  const [draft,setDraft] = useState("");
  const [notice,setNotice] = useState("");
  const badge = value => <span className={`support-badge support-badge--${value.toLowerCase()}`}>{tr(value)}</span>;
  function resolve(id) { setTickets(rows=>rows.map(row=>row[0]===id?row.map((v,i)=>i===4?"Resolved":v):row));setNotice(ar?"تم حل التذكرة محليًا":"Ticket resolved locally"); }
  function retry(id) { setJobs(rows=>rows.map(row=>row[0]===id?row.map((v,i)=>i===4?"Processing":i===5?"0s":v):row));setNotice(ar?"أُعيدت المهمة إلى المعالجة محليًا":"Job queued for processing locally"); }
  function panel(title,hint,headers,children) { return <section className="admin-panel support-panel"><header><h2>{title}</h2><p>{hint}</p></header><div className="support-scroll"><table><thead><tr>{headers.map((label,i)=><th key={i}>{tr(label)}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>; }
  return <AdminShell openDetail={()=>setNotice(ar?"هذه معاينة محلية للدعم":"This is a local support preview")}><div className="support-page"><div className="admin-preview-note">{ar?"معاينة محلية للإدارة؛ التغييرات لا تؤثر على المستخدمين أو الشركات الفعلية.":"Local admin preview; changes do not affect real users or companies."}</div><div className="support-heading"><span className="admin-eyebrow">{ar?"العمليات":"Operations"}</span><h1>{ar?"الدعم والعمليات":"Support and operations"}</h1><p>{ar?"الدعم ومهام المعالجة وقوالب الإشعارات الأساسية في مكان واحد.":"Support, processing jobs and essential notification templates in one place."}</p></div><nav className="admin-panel support-tabs" aria-label={ar?"أقسام الدعم":"Support sections"}>{[["support","Support",FiLifeBuoy],["processing","Processing",FiFileText],["notifications","Notifications",FiBell]].map(([key,label,Icon])=><button key={key} className={tab===key?"active":""} aria-current={tab===key?"page":undefined} onClick={()=>{setParams(key==="support"?{}:{tab:key});setNotice("");}}><Icon/>{tr(label)}</button>)}</nav><AdminToast message={notice} onDismiss={()=>setNotice("")}/>
  {tab==="support"&&<><div className="support-metrics">{[[tr("Open"),String(24-(tickets.filter(r=>r[4]==="Resolved").length-1)),ar?"٤ دون مسؤول":"4 unassigned",FiLifeBuoy,"blue"],[tr("Critical"),"4",ar?"الأقدم ٥٢ دقيقة":"Oldest 52m",FiShield,"red"],[ar?"متوسط الاستجابة":"Avg response","11m",ar?"الهدف أقل من ١٥ دقيقة":"Target <15m",FiClock,"green"],["CSAT","94.2%",ar?"٣٠ يومًا":"30 days",FiCheckCircle,"purple"]].map(([label,value,note,Icon,color])=><article className="admin-panel" key={label}><span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon/></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>)}</div>{panel(ar?"طابور الدعم":"Support queue",tr("Personal + Business"),["Ticket","Subject","Priority","Status","Assigned",""],tickets.map(([id,subject,customer,priority,status,assigned])=><tr key={id}><td><span className="support-id">{id}</span></td><td><strong>{tr(subject)}</strong><small>{customer}</small></td><td>{badge(priority)}</td><td>{badge(status)}</td><td>{assigned}</td><td><button className="admin-button" disabled={status==="Resolved"} onClick={()=>resolve(id)}><FiCheck/>{tr("Resolve")}</button></td></tr>))}</>}
  {tab==="processing"&&panel(ar?"مهام المعالجة":"Processing jobs",ar?"التعرف على المستندات والكشوفات والتقارير وخدمات الخلفية":"Document recognition, statements, reports and background services",["Job","Type","Owner","Provider","Status","Duration",""],jobs.map(([id,type,owner,provider,status,duration])=><tr key={id}><td><span className="support-id">{id}</span></td><td>{tr(type)}</td><td>{owner}</td><td>{tr(provider)}</td><td>{badge(status)}</td><td>{duration}</td><td>{status==="Failed"&&<button className="admin-button" onClick={()=>retry(id)}><FiRefreshCw/>{tr("Retry")}</button>}</td></tr>))}
  {tab==="notifications"&&panel(ar?"قوالب الإشعارات":"Notification templates",ar?"القوالب الأساسية فقط":"Essential templates only",["Template","Channel","Audience","Status","Updated",""],templates.map(([name,channel,audience,status,updated],index)=><tr key={index}><td>{editing===index?<form className="support-edit" onSubmit={event=>{event.preventDefault();if(!draft.trim())return;setTemplates(rows=>rows.map((r,i)=>i===index?[draft.trim(),...r.slice(1,4),new Intl.DateTimeFormat(ar?"ar":"en-GB",{dateStyle:"medium"}).format(new Date())]:r));setEditing(null);setNotice(ar?"تم حفظ القالب محليًا":"Template saved locally");}}><input aria-label={ar?"اسم القالب":"Template name"} value={draft} onChange={event=>setDraft(event.target.value)} required autoFocus/><button className="admin-icon-button" aria-label={ar?"حفظ":"Save"}><FiCheck/></button><button type="button" className="admin-icon-button" aria-label={ar?"إلغاء":"Cancel"} onClick={()=>setEditing(null)}><FiX/></button></form>:<strong>{tr(name)}</strong>}</td><td>{tr(channel)}</td><td>{tr(audience)}</td><td>{badge(status)}</td><td>{updated}</td><td><button className="admin-icon-button" aria-label={`${ar?"تعديل":"Edit"} ${tr(name)}`} onClick={()=>{setEditing(index);setDraft(name);}}><FiEdit2/></button></td></tr>))}</div></AdminShell>;
}

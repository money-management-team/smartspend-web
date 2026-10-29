import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiShield, FiLock, FiRotateCcw, FiCheckCircle, FiCheck, FiDownload } from "react-icons/fi";
import AdminShell from "../components/AdminShell";
import "../admin.css";
import "../Support/support.css";
import "./security.css";

const initialEvents = [
  ["Multiple failed sign-ins","Yousef Nasser","High","Amman, JO","185.14.22.19","Open"],
  ["Large data export","Acme Studio","Medium","Admin network","10.0.4.21","Reviewed"],
  ["Company role elevated","Atlas Engineering","Medium","Dubai, AE","94.201.12.81","Reviewed"],
  ["Suspicious session","Personal account","Critical","Unknown","193.8.11.7","Contained"],
];
const signins = [
  ["Lina Sakalla","Admin","Success","Chrome · Windows","Gaza, PS","10.0.1.20","27 Sep · 17:01"],
  ["Yousef Nasser","Personal","Failed","Safari · iPhone","Amman, JO","185.14.22.19","27 Sep · 16:59"],
  ["Acme Studio / Omar","Business","Success","Chrome · macOS","Ramallah, PS","82.102.44.17","27 Sep · 16:51"],
  ["Unknown","Personal","Blocked","Firefox · Linux","Unknown","193.8.11.7","27 Sep · 16:43"],
];
const initialAudit = [
  ["Lina Sakalla","Super Admin","plan.updated","Business Growth","Changed AI monthly limit","27 Sep · 16:42"],
  ["Mona H.","Support Admin","ticket.assigned","TKT-1842","Assigned critical billing ticket","27 Sep · 16:30"],
  ["Ahmad K.","Security Admin","session.revoked","USR-10328","Revoked suspicious session","27 Sep · 15:58"],
  ["System","Automation","invoice.failed","INV-2026-1041","Payment retry scheduled","27 Sep · 14:06"],
];
const arabic = {"Threshold alerts":"تنبيهات الحدود","Sign in":"تسجيل الدخول","Audit log":"سجل التدقيق",Event:"الحدث",Severity:"الخطورة",Location:"الموقع",Status:"الحالة",Review:"مراجعة",Reviewed:"تمت المراجعة",Contained:"تم الاحتواء",Open:"مفتوح",High:"مرتفعة",Medium:"متوسطة",Critical:"حرجة",User:"المستخدم",Type:"النوع",Result:"النتيجة",Device:"الجهاز",Time:"الوقت",Success:"ناجح",Failed:"فشل",Blocked:"محظور",Actor:"المنفذ",Action:"الإجراء",Target:"الهدف",Details:"التفاصيل",Admin:"إدارة",Personal:"أفراد",Business:"أعمال",Unknown:"غير معروف","Multiple failed sign-ins":"محاولات دخول فاشلة متكررة","Large data export":"تصدير كمية كبيرة من البيانات","Company role elevated":"ترقية دور في الشركة","Suspicious session":"جلسة مشبوهة","Personal account":"حساب شخصي","Admin network":"شبكة الإدارة","Super Admin":"مدير عام","Support Admin":"مدير الدعم","Security Admin":"مدير الأمان",System:"النظام",Automation:"أتمتة","Changed AI monthly limit":"تغيير الحد الشهري للذكاء الاصطناعي","Assigned critical billing ticket":"إسناد تذكرة فوترة حرجة","Revoked suspicious session":"إلغاء جلسة مشبوهة","Payment retry scheduled":"جدولة إعادة محاولة الدفع"};

export default function Security() {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const tr = value => ar ? arabic[value] || value : value;
  const [params,setParams] = useSearchParams();
  const tab = ["alerts","signin","audit"].includes(params.get("tab")) ? params.get("tab") : "alerts";
  const [events,setEvents] = useState(initialEvents);
  const [audit,setAudit] = useState(initialAudit);
  const [notice,setNotice] = useState("");
  function review(index) {
    if(events[index][5]!=="Open") {setNotice(ar?"تمت مراجعة هذا الحدث مسبقًا":"This event has already been reviewed");return;}
    setEvents(rows=>rows.map((row,i)=>i===index?[...row.slice(0,5),"Reviewed"]:row));
    setAudit(rows=>[["Lina Sakalla","Super Admin","security.reviewed",events[index][0],ar?"مراجعة الحدث الأمني محليًا":"Security event reviewed locally",new Intl.DateTimeFormat(ar?"ar":"en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date())],...rows]);
    setNotice(ar?"تمت مراجعة الحدث محليًا":"Event reviewed locally");
  }
  function exportAudit() {
    const rows = [["Actor","Role","Action","Target","Details","Time"],...audit];
    const csv = "\ufeff" + rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a");link.href=url;link.download="platform-audit-log.csv";link.click();URL.revokeObjectURL(url);
  }
  const badge = value => <span className={`support-badge support-badge--${value.toLowerCase()} security-badge--${value.toLowerCase()}`}>{tr(value)}</span>;
  const ip = value => <bdi className="support-id">{value}</bdi>;
  function panel(title,hint,headers,rows) {return <section className="admin-panel support-panel"><header><h2>{title}</h2>{hint&&<p>{hint}</p>}</header><div className="support-scroll"><table><thead><tr>{headers.map((h,i)=><th key={i}>{tr(h)}</th>)}</tr></thead><tbody>{rows}</tbody></table></div></section>;}
import AdminToast from "../components/AdminToast";
  return <AdminShell openDetail={()=>{}}><div className="security-page"><div className="admin-preview-note">{ar?"معاينة محلية للإدارة؛ التغييرات لا تؤثر على المستخدمين أو الشركات الفعلية.":"Local admin preview; changes do not affect real users or companies."}</div><div className="security-heading"><div className="support-heading"><span className="admin-eyebrow">{ar?"الأمان":"Security"}</span><h1>{ar?"الأمان والتدقيق":"Security & audit"}</h1><p>{ar?"الأحداث الحساسة والجلسات وسجلات تدقيق الإدارة في مكان واحد.":"Sensitive events, sessions and admin audit logs in one place."}</p></div><button className="admin-button" onClick={exportAudit}><FiDownload/>{ar?"تصدير سجل التدقيق":"Export audit log"}</button></div><nav className="admin-panel support-tabs" aria-label={ar?"أقسام الأمان":"Security sections"}>{[["alerts","Threshold alerts",FiShield],["signin","Sign in",FiLock],["audit","Audit log",FiRotateCcw]].map(([key,label,Icon])=><button key={key} className={tab===key?"active":""} aria-current={tab===key?"page":undefined} onClick={()=>{setParams(key==="alerts"?{}:{tab:key});setNotice("");}}><Icon/>{tr(label)}</button>)}</nav><AdminToast message={notice} onDismiss={()=>setNotice("")}/>
  {tab==="alerts"&&<><div className="support-metrics">{[[ar?"تنبيهات مفتوحة":"Open alerts",String(2-(initialEvents.filter(r=>r[5]==="Open").length-events.filter(r=>r[5]==="Open").length)),events.some(r=>r[5]==="Open"&&r[2]==="High")?(ar?"١ مرتفع":"1 high"):(ar?"تمت مراجعة التنبيهات المرتفعة":"High alerts reviewed"),FiShield,"red"],[ar?"محاولات محظورة":"Blocked attempts","18",ar?"٢٤ ساعة":"24 hours",FiLock,"orange"],[ar?"التحقق الثنائي للإدارة":"Admin MFA","80%",ar?"إجراء واحد مطلوب":"1 action required",FiShield,"orange"],[ar?"مستوى المخاطر":"Risk posture",ar?"منخفض":"Low",ar?"لم يُكتشف اختراق":"No breach detected",FiCheckCircle,"green"]].map(([label,value,note,Icon,color])=><article className="admin-panel" key={label}><span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon/></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>)}</div>{panel(ar?"الأحداث الأمنية":"Security events","",["Event","Severity","Location","IP","Status",""],events.map(([name,owner,severity,location,address,status],index)=><tr key={name}><td><strong>{tr(name)}</strong><small>{tr(owner)}</small></td><td>{badge(severity)}</td><td>{tr(location)}</td><td>{ip(address)}</td><td>{badge(status)}</td><td><button className="admin-button" onClick={()=>review(index)}><FiCheck/>{tr("Review")}</button></td></tr>))}</>}
  {tab==="signin"&&panel(ar?"نشاط تسجيل الدخول":"Sign-in activity",ar?"الإدارة + الأفراد + الأعمال":"Admin + Personal + Business",["User","Type","Result","Device","Location","IP","Time"],signins.map(([user,type,result,device,location,address,time])=><tr key={user}><td><strong>{tr(user)}</strong></td><td>{tr(type)}</td><td>{badge(result)}</td><td>{device}</td><td>{tr(location)}</td><td>{ip(address)}</td><td><bdi>{time}</bdi></td></tr>))}
  {tab==="audit"&&panel(ar?"سجل تدقيق المنصة":"Platform audit log",ar?"الإجراءات الإدارية الحساسة":"Sensitive administrative actions",["Actor","Action","Target","Details","Time"],audit.map(([actor,role,action,target,details,time],i)=><tr key={i}><td><strong>{tr(actor)}</strong><small>{tr(role)}</small></td><td><bdi className="support-id">{action}</bdi></td><td>{tr(target)}</td><td>{tr(details)}</td><td><bdi>{time}</bdi></td></tr>))}</div></AdminShell>;
}

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiZap, FiMessageSquare, FiCpu, FiCheckCircle, FiActivity, FiDollarSign, FiFileText, FiX } from "react-icons/fi";
import AdminShell from "../components/AdminShell";
import "../admin.css";
import "../Support/support.css";
import "./ai.css";

const feedback = [
  ["Receipt extraction","Sarah Ahmad","Negative","62%","Currency detected as USD instead of AED.","New"],
  ["AI Copilot","Acme Studio","Positive","94%","Budget pressure explanation was useful.","Reviewed"],
  ["Smart categorization","Nova Commerce","Negative","71%","Supplier expense suggested the wrong category.","New"],
  ["Anomaly hint","Maya Saleh","Positive","89%","Caught a duplicate subscription charge.","Reviewed"],
];
const jobs = [
  ["JOB-99144","Receipt OCR","Sarah Ahmad","Vision OCR","Failed"],
  ["JOB-99143","Bank statement","Acme Studio","Document AI","Processing"],
  ["JOB-99142","Receipt OCR","Nova Commerce","Vision OCR","Completed"],
  ["JOB-99140","AI categorization","Cedar Labs","OpenAI","Completed"],
];
const arabic = {Overview:"نظرة عامة",Feedback:"التقييمات",Jobs:"المهام",Feature:"الميزة",Customer:"العميل",Rating:"التقييم",Confidence:"الثقة",Status:"الحالة",Negative:"سلبي",Positive:"إيجابي",New:"جديد",Reviewed:"تمت المراجعة",Job:"المهمة",Type:"النوع",Owner:"المالك",Provider:"المزود",Failed:"فشلت",Processing:"قيد المعالجة",Completed:"مكتملة",Logs:"السجلات","Receipt extraction":"استخراج الإيصالات","AI Copilot":"المساعد الذكي","Smart categorization":"التصنيف الذكي","Anomaly hint":"تنبيه غير اعتيادي","Receipt OCR":"قراءة الإيصالات","Bank statement":"كشف حساب بنكي","AI categorization":"تصنيف ذكي","Currency detected as USD instead of AED.":"تم اكتشاف العملة بالدولار بدل الدرهم.","Budget pressure explanation was useful.":"كان شرح ضغط الميزانية مفيدًا.","Supplier expense suggested the wrong category.":"تم اقتراح تصنيف خاطئ لمصروف المورد.","Caught a duplicate subscription charge.":"تم اكتشاف رسوم اشتراك مكررة."};

export default function AI() {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const tr = value => ar ? arabic[value] || value : value;
  const [params,setParams] = useSearchParams();
  const tab = ["overview","feedback","jobs"].includes(params.get("tab")) ? params.get("tab") : "overview";
  const [selected,setSelected] = useState(null);
  const dialog = useRef(null);
  useEffect(()=>{if(selected)dialog.current?.showModal();else dialog.current?.close();},[selected]);
  const badge = value => <span className={`support-badge support-badge--${value.toLowerCase()} ai-badge--${value.toLowerCase()}`}>{tr(value)}</span>;
  function panel(title,hint,headers,rows) { return <section className="admin-panel support-panel"><header><h2>{title}</h2><p>{hint}</p></header><div className="support-scroll"><table><thead><tr>{headers.map((h,i)=><th key={i}>{tr(h)}</th>)}</tr></thead><tbody>{rows}</tbody></table></div></section>; }
  return <AdminShell openDetail={()=>{}}><div className="ai-page"><div className="admin-preview-note">{ar?"معاينة محلية للإدارة؛ التغييرات لا تؤثر على المستخدمين أو الشركات الفعلية.":"Local admin preview; changes do not affect real users or companies."}</div><div className="support-heading"><span className="admin-eyebrow">{ar?"إدارة الذكاء الاصطناعي":"AI control"}</span><h1>{ar?"الذكاء الاصطناعي":"AI"}</h1><p>{ar?"مراقبة استخدام الذكاء الاصطناعي والجودة وأخطاء المعالجة مع بقاء التحكم بيد المستخدمين.":"Monitor AI usage, quality and processing errors while people retain control."}</p></div><nav className="admin-panel support-tabs" aria-label={ar?"أقسام الذكاء الاصطناعي":"AI sections"}>{[["overview","Overview",FiZap],["feedback","Feedback",FiMessageSquare],["jobs","Jobs",FiCpu]].map(([key,label,Icon])=><button key={key} className={tab===key?"active":""} aria-current={tab===key?"page":undefined} onClick={()=>setParams(key==="overview"?{}:{tab:key})}><Icon/>{tr(label)}</button>)}</nav>
  {tab==="overview"&&<><div className="support-metrics">{[[ar?"طلبات اليوم":"Today's requests","108.6K",ar?"الأفراد + الأعمال":"Personal + Business",FiZap,"blue"],[ar?"معدل النجاح":"Success rate","98.7%",ar?"مستقر":"Stable",FiCheckCircle,"green"],[ar?"متوسط الاستجابة":"Avg latency","1.8s",ar?"ضمن الهدف":"Within target",FiActivity,"blue"],[ar?"التكلفة التقديرية":"Est. cost","$318",ar?"اليوم":"Today",FiDollarSign,"purple"]].map(([label,value,note,Icon,color])=><article className="admin-panel" key={label}><span className={`admin-icon-tile admin-icon-tile--${color}`}><Icon/></span><div><small>{label}</small><strong><bdi>{value}</bdi></strong><p>{note}</p></div></article>)}</div><section className="admin-panel support-panel"><header><h2>{ar?"الاستخدام خلال آخر ٧ أيام":"Usage over the last 7 days"}</h2><p>{ar?"الإيصالات + الكشوفات + المساعد + التصنيف":"Receipt + Statement + Copilot + Categorization"}</p></header><div className="ai-chart" role="img" aria-label={ar?"رسم استخدام الذكاء الاصطناعي خلال أسبوع":"AI usage over seven days"}><div className="ai-chart-axis">{["2K","1.5K","1K","500","0"].map(v=><span key={v}>{v}</span>)}</div><div><svg viewBox="0 0 1200 280" preserveAspectRatio="none">{[0,70,140,210,280].map(y=><line key={y} x1="0" x2="1200" y1={y} y2={y} stroke="var(--admin-border)" strokeDasharray="4 4"/>)}<polyline points="0,151 200,134 400,142 600,110 800,91 1000,73 1200,103" fill="none" stroke="var(--admin-accent)" strokeWidth="2.5"/><polyline points="0,195 200,184 400,182 600,170 800,163 1000,153 1200,157" fill="none" stroke="var(--admin-purple)" strokeWidth="2.5"/></svg><div className="ai-chart-dates">{[21,22,23,24,25,26,27].map(day=><span key={day}>{day} {ar?"سبتمبر":"Sep"}</span>)}</div></div></div></section></>}
  {tab==="feedback"&&panel(ar?"تقييمات الذكاء الاصطناعي":"AI Feedback",ar?"مراجعة التقييمات السلبية أولًا":"Review negative feedback first",["Feature","Customer","Rating","Confidence","Feedback","Status"],feedback.map(([feature,customer,rating,confidence,comment,status])=><tr key={feature}><td><strong>{tr(feature)}</strong></td><td>{customer}</td><td>{badge(rating)}</td><td>{confidence}</td><td>{tr(comment)}</td><td>{badge(status)}</td></tr>))}
  {tab==="jobs"&&panel(ar?"مهام الذكاء الاصطناعي وقراءة المستندات":"AI & OCR jobs",ar?"الأخطاء والمزود":"Errors and provider",["Job","Type","Owner","Provider","Status",""],jobs.map(row=><tr key={row[0]}><td><span className="support-id">{row[0]}</span></td><td>{tr(row[1])}</td><td>{row[2]}</td><td>{row[3]}</td><td>{badge(row[4])}</td><td><button className="admin-button" onClick={()=>setSelected(row)}><FiFileText/>{tr("Logs")}</button></td></tr>))}
  <dialog ref={dialog} className="admin-dialog" aria-labelledby="ai-log-title" onClose={()=>setSelected(null)} onClick={event=>{if(event.target===dialog.current)setSelected(null);}}><div className="admin-dialog__head"><h2 id="ai-log-title">{tr("Logs")} {selected?.[0]}</h2><button className="admin-icon-button" aria-label={ar?"إغلاق":"Close"} onClick={()=>setSelected(null)}><FiX/></button></div>{selected&&<><p>{tr(selected[1])} · {selected[3]}</p>{badge(selected[4])}<pre className="ai-log-content">{selected[4]==="Failed"?(ar?"تعذر إكمال استخراج المستند.\nيلزم مراجعة نتيجة التعرف والمحاولة مجددًا.":"Document extraction could not be completed.\nReview recognition output and retry processing."):selected[4]==="Processing"?(ar?"تم استلام المهمة.\nالمعالجة قيد التنفيذ.":"Job received.\nProcessing is in progress."):(ar?"اكتملت المعالجة بنجاح.":"Processing completed successfully.")}</pre><small>{ar?"سجل توضيحي محلي":"Local demo log"}</small></>}</dialog></div></AdminShell>;
}

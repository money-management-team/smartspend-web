import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiX } from "react-icons/fi";
import "./admin-toast.css";

export default function AdminToast({ message, onDismiss }) {
  const { i18n } = useTranslation();
  const [visible,setVisible] = useState(false);
  const [paused,setPaused] = useState(false);
  useEffect(()=>{setVisible(Boolean(message));},[message]);
  useEffect(()=>{
    if(!message || paused || !visible)return;
    const timer=setTimeout(()=>{setVisible(false);onDismiss?.();},4500);
    return ()=>clearTimeout(timer);
  },[message,paused,visible,onDismiss]);
  if(!visible || !message)return null;
  return <div className="admin-toast" role="status" aria-live="polite" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={()=>setPaused(false)}><FiCheckCircle className="admin-toast__icon"/><span>{message}</span><button type="button" aria-label={i18n.language.startsWith("ar")?"إغلاق الإشعار":"Dismiss notification"} onClick={()=>{setVisible(false);onDismiss?.();}}><FiX/></button><i className="admin-toast__progress" style={{animationPlayState:paused?"paused":"running"}}/></div>;
}

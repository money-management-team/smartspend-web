import { LuRefreshCw } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import IconButton from "./IconButton.jsx";

/* A list's one line of context: how many of how many are shown, and a quiet way to read the list again. */
export default function ListMeta({ shown, text, refreshing, onRefresh }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <div className="sm-list-meta">
      <p className="sm-text sm-muted sm-fine" data-sm-count={shown}>{text}</p>
      <IconButton label={t(refreshing ? "home.refreshing" : "home.refresh")} icon={LuRefreshCw} spinning={refreshing} onClick={onRefresh} disabled={refreshing} aria-busy={refreshing} />
    </div>
  );
}

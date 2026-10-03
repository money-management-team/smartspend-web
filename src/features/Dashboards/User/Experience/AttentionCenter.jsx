import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuCircleAlert, LuRefreshCw, LuScanLine, LuMic } from "react-icons/lu";
import { PATH, getAiExpenseCapturePath } from "../../../../routes/Path";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { calendarApi } from "../api/calendarApi";
import { aiExpenseCapturesApi } from "../api/aiExpenseCapturesApi";
import { aiVoiceExpenseCapturesApi } from "../api/aiVoiceExpenseCapturesApi";
import { parseCapturesPage } from "../AiExpenseCaptures/captureHelpers";
import { parseVoiceCapturesPage } from "../FinancialOperations/voiceCaptureContract";
import {
  getTodayIso,
  addDays,
  parseCalendarResponse,
  getEventDate,
} from "../Calendar/calendarHelpers";
import CalendarEvent from "../Calendar/components/CalendarEvent/CalendarEvent";
import FinancialAlerts from "../Dashboard/components/FinancialAlerts/FinancialAlerts";
import { dataError, attentionEvents, readyDraftsPage } from "./experienceData";
import PrivateMoney from "./PrivateMoney";

function DraftList({ title, result, voice = false, onRetry, t }) {
  return (
    <section className="exp-card">
      <header className="exp-toolbar">
        {voice ? (
          <LuMic aria-hidden="true" />
        ) : (
          <LuScanLine aria-hidden="true" />
        )}
        <h2>{title}</h2>
      </header>
      {!result ? (
        <p className="exp-state" role="status">
          {t("loading")}
        </p>
      ) : result.error ? (
        <div className="exp-state" role="alert">
          <p>{t("error")}</p>
          <button
            className="exp-button exp-button--subtle"
            type="button"
            onClick={onRetry}
          >
            {t("refresh")}
          </button>
        </div>
      ) : (
        <>
          <p className="exp-muted">
            {t("displayed", { count: result.page.items.length })} ·{" "}
            {t("draftLimit")}
            {!voice && <> {t("receiptScope")}</>}
          </p>
          {!result.page.items.length ? (
            <p className="exp-state">{t("empty")}</p>
          ) : (
            <ul className="exp-list">
              {result.page.items.map((item) => (
                <li className="exp-list-item" key={item.id}>
                  <div className="exp-list-copy">
                    <h3>{t("draft", { id: item.id })}</h3>
                    <p className="exp-muted">
                      <PrivateMoney>
                        {item.review_values?.description ||
                          item.description ||
                          item.original_filename ||
                          item.created_at?.slice(0, 10) ||
                          "—"}
                      </PrivateMoney>
                    </p>
                  </div>
                  <Link
                    className="exp-button exp-button--subtle"
                    to={
                      voice
                        ? `${PATH.USER.FINANCIAL_OPERATIONS}?voice_capture=${item.id}&voice_workspace=${item.workspace_id}`
                        : getAiExpenseCapturePath(item.id)
                    }
                  >
                    {t("open")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            className="exp-button exp-button--subtle"
            style={{ marginTop: 16 }}
            to={
              voice
                ? PATH.USER.FINANCIAL_OPERATIONS
                : PATH.USER.AI_EXPENSE_CAPTURES
            }
          >
            {t("showMore")}
          </Link>
        </>
      )}
    </section>
  );
}
export default function AttentionCenter() {
  const { t } = useTranslation("experience"),
    { workspace } = useAuthContext();
  const [refresh, setRefresh] = useState(0),
    [filter, setFilter] = useState("all");
  const [result, setResult] = useState({ key: null, sections: {} });
  const today = getTodayIso(workspace?.timezone),
    key = `${workspace?.id}:${today}:${refresh}`;
  useEffect(() => {
    const controller = new AbortController(),
      sections = {};
    const request = async (name, fetch, parse) => {
      try {
        const response = await fetch();
        const page = parse(response);
        if (!page) throw dataError();
        sections[name] = { page };
      } catch (error) {
        if (!controller.signal.aborted) sections[name] = { error };
      }
      if (!controller.signal.aborted)
        setResult({ key, sections: { ...sections } });
    };
    void request(
      "calendar",
      () =>
        calendarApi.get(
          {
            from: addDays(today, -30),
            to: addDays(today, 30),
            view: "month",
            workspace_id: workspace?.id,
          },
          { signal: controller.signal },
        ),
      parseCalendarResponse,
    );
    void request(
      "receipts",
      () =>
        aiExpenseCapturesApi.list(
          { status: "ready_for_review", per_page: 20, page: 1 },
          { signal: controller.signal },
        ),
      (response) => readyDraftsPage(parseCapturesPage(response)),
    );
    void request(
      "voice",
      () =>
        aiVoiceExpenseCapturesApi.list(
          {
            workspace_id: workspace?.id,
            status: "ready_for_review",
            per_page: 20,
            page: 1,
          },
          { signal: controller.signal },
        ),
      (response) =>
        readyDraftsPage(parseVoiceCapturesPage(response), workspace?.id),
    );
    return () => controller.abort();
  }, [key, today, workspace?.id]);
  const sections = result.key === key ? result.sections : {},
    reload = () => setRefresh((value) => value + 1);
  const events = attentionEvents(
    sections.calendar?.page?.events ?? [],
    filter,
    today,
  );
  return (
    <div className="exp-page">
      <header className="exp-hero">
        <div>
          <span className="exp-kicker">SMARTSPEND · FOCUS</span>
          <h1>{t("attention")}</h1>
          <p>{t("attentionHint")}</p>
        </div>
        <span className="exp-hero-icon">
          <LuCircleAlert aria-hidden="true" />
        </span>
      </header>
      <div className="exp-toolbar">
        <p className="exp-muted">{t("attentionPeriod")}</p>
        <button
          className="exp-button exp-button--subtle"
          type="button"
          onClick={reload}
        >
          <LuRefreshCw aria-hidden="true" />
          {t("refresh")}
        </button>
      </div>
      <section className="exp-card">
        <header className="exp-toolbar">
          <h2>{t("commitments")}</h2>
          <label className="exp-field">
            <span className="exp-sr-only">{t("filterAttention")}</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              {["all", "overdue", "upcoming"].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
          <Link
            className="exp-button exp-button--subtle"
            to={PATH.USER.CALENDAR}
          >
            {t("showMore")}
          </Link>
        </header>
        {!sections.calendar ? (
          <p className="exp-state" role="status">
            {t("loading")}
          </p>
        ) : sections.calendar.error ? (
          <p className="exp-error" role="alert">
            {t("error")}
          </p>
        ) : !events.length ? (
          <p className="exp-state">{t("empty")}</p>
        ) : (
          <ul className="exp-list">
            {events.map((event, index) => (
              <li key={event.id ?? index} style={{ listStyle: "none" }}>
                <p className="exp-muted" style={{ marginBottom: 5 }}>
                  {getEventDate(event)}
                </p>
                <ul style={{ padding: 0, listStyle: "none" }}>
                  <CalendarEvent event={event} />
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
      <FinancialAlerts
        key={`${workspace?.id}:${refresh}`}
        workspaceId={workspace?.id}
        variant="full"
      />
      <div className="exp-grid">
        <DraftList
          title={t("receiptDrafts")}
          result={sections.receipts}
          onRetry={reload}
          t={t}
        />
        <DraftList
          title={t("voiceDrafts")}
          result={sections.voice}
          voice
          onRetry={reload}
          t={t}
        />
      </div>
    </div>
  );
}

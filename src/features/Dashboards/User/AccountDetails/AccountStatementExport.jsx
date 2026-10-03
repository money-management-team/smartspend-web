import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFileDown } from "react-icons/lu";
import { transactionsApi } from "../api/transactionsApi";
import { getTodayIso, monthStart } from "../Calendar/calendarHelpers";
import { fetchAccountStatement, statementCsv } from "./accountStatement";
import { movementTypeLabel } from "./accountMovementHelpers";
import { useExperience } from "../Experience/useExperience";
import { downloadBlob } from "../Experience/experienceData";

export default function AccountStatementExport({ account, locale, timeZone }) {
  const { t, i18n } = useTranslation("experience"),
    { t: movementT } = useTranslation("accountMovements");
  const { preferences } = useExperience();
  const today = getTodayIso(timeZone),
    [year, month] = today.split("-").map(Number);
  const [dates, setDates] = useState({
    from: monthStart(year, month),
    to: today,
  });
  const [progress, setProgress] = useState(null),
    [message, setMessage] = useState(null);
  const request = useRef(null);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [account.id, account.currency_code, account.workspace_id],
  );
  useEffect(() => {
    if (preferences.hiddenMoney) request.current?.abort();
  }, [preferences.hiddenMoney]);
  const typeLabel = (row) =>
    movementT(`types.${movementTypeLabel(row)}`, {
      defaultValue: row.transaction.type,
    });
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setProgress(null);
    setMessage(null);
  };
  const run = async (format) => {
    if (request.current || preferences.hiddenMoney) return;
    const controller = new AbortController();
    request.current = controller;
    setProgress({ done: 0, total: 0 });
    setMessage(null);
    try {
      const statement = await fetchAccountStatement(account, dates, {
        list: transactionsApi.list,
        signal: controller.signal,
        onProgress: (value) => {
          if (!controller.signal.aborted) setProgress(value);
        },
      });
      let blob;
      if (format === "csv")
        blob = new Blob(
          [
            statementCsv(
              statement,
              t("statementColumns", { returnObjects: true }),
              typeLabel,
            ),
          ],
          { type: "text/csv;charset=utf-8" },
        );
      else {
        const { generateAccountStatementPdf } =
          await import("./statement/generateAccountStatementPdf");
        blob = await generateAccountStatementPdf({
          statement,
          t,
          typeLabel,
          locale,
          language: i18n.language,
          signal: controller.signal,
        });
      }
      if (controller.signal.aborted) return;
      downloadBlob(
        blob,
        `SmartSpend-account-${account.id}-${dates.from}-${dates.to}.${format}`,
      );
      setMessage("exportComplete");
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessage(
        {
          STATEMENT_DATES_INVALID: "exportDates",
          STATEMENT_LIMIT: "exportLimit",
          STATEMENT_CHANGED: "exportChanged",
        }[error.code] ?? "exportError",
      );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setProgress(null);
      }
    }
  };
  return (
    <section
      className="exp-card"
      aria-labelledby="account-statement-title"
      aria-busy={Boolean(progress)}
    >
      <header className="exp-toolbar">
        <LuFileDown aria-hidden="true" />
        <h2 id="account-statement-title">{t("statement")}</h2>
      </header>
      <p className="exp-muted">{t("statementHint")}</p>
      <div className="exp-form">
        {["from", "to"].map((key) => (
          <label className="exp-field" key={key}>
            {t(key)}
            <input
              type="date"
              value={dates[key]}
              disabled={Boolean(progress)}
              onChange={(event) =>
                setDates((value) => ({ ...value, [key]: event.target.value }))
              }
            />
          </label>
        ))}
        <div className="exp-toolbar exp-wide">
          <button
            className="exp-button"
            type="button"
            disabled={Boolean(progress) || preferences.hiddenMoney}
            onClick={() => run("pdf")}
          >
            {t("exportPDF")}
          </button>
          <button
            className="exp-button exp-button--subtle"
            type="button"
            disabled={Boolean(progress) || preferences.hiddenMoney}
            onClick={() => run("csv")}
          >
            {t("exportCSV")}
          </button>
          {progress && (
            <button
              className="exp-button exp-button--subtle"
              type="button"
              onClick={cancel}
            >
              {t("cancel")}
            </button>
          )}
        </div>
      </div>
      {preferences.hiddenMoney && (
        <p className="exp-muted">{t("exportPrivacy")}</p>
      )}
      {progress && (
        <div role="status">
          <progress
            className="exp-progress"
            value={progress.total ? progress.done : undefined}
            max={progress.total || 1}
          />
          <p className="exp-muted">{t("exporting", progress)}</p>
        </div>
      )}
      {message && (
        <p
          className={message === "exportComplete" ? "exp-success" : "exp-error"}
          role="status"
        >
          {t(message)}
        </p>
      )}
      <p className="exp-muted">
        {t("dateUTC")} {t("statementNote")}
      </p>
    </section>
  );
}

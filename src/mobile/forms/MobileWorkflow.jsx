import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";

import { accountLoader, budgetLoader, debtLoader, goalLoader, keys, paymentsLoader, ruleLoader, transactionLoader, transferLoader } from "../data/loaders.js";
import { isAccountId, sessionWorkspace } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { MOBILE_PREFIX, accountDetailPath, activityDetailPath, backPathFrom, budgetDetailPath, debtDetailPath, goalDetailPath, recurringDetailPath, transferDetailPath } from "../navigation.js";
import MobileNotAvailable from "../screens/MobileNotAvailable.jsx";
import Chevron from "../ui/Chevron.jsx";
import { useDevicePreferences } from "../preferences/deviceStore.js";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import DraftForm from "./DraftForm.jsx";
import { useFormChoices } from "./useFormChoices.js";
import { todayIn } from "./validation.js";
import { NEW_FORM_IDS, RECORD_PICKERS, WORKFLOWS } from "./workflows.js";

const NOT_FOUND = Object.freeze({ code: "NOT_FOUND" });
const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/*
 * Where each kind of record comes from (the reads the record pages already
 * make), which address parameter names it, and the page "Back" returns to.
 * A debt payment has no read of its own: it is looked for in the debt's latest
 * page of payments, and one that is not there is reported as not found.
 */
const RECORD_SOURCES = {
  transaction: { param: "transactionId", key: keys.transaction, loader: transactionLoader, back: activityDetailPath },
  transfer: { param: "transferId", key: keys.transfer, loader: transferLoader, back: transferDetailPath },
  account: { param: "accountId", key: keys.account, loader: accountLoader, back: accountDetailPath },
  budget: { param: "budgetId", key: keys.budget, loader: budgetLoader, back: budgetDetailPath },
  goal: { param: "goalId", key: keys.goal, loader: goalLoader, back: goalDetailPath },
  rule: { param: "ruleId", key: keys.rule, loader: ruleLoader, back: recurringDetailPath },
  debt: { param: "debtId", key: keys.debt, loader: debtLoader, back: debtDetailPath },
  payment: { param: "paymentId", parent: "debtId", key: (debtId) => keys.payments(debtId, 1), loader: (debtId) => paymentsLoader(debtId, 1), back: debtDetailPath, envelope: true },
};

const today = () => todayIn(sessionWorkspace()?.timezone);

function BackLink({ to, label }) {
  return (
    <Link className="sm-link-row sm-back" to={to}>
      <Chevron back />
      <span>{label}</span>
    </Link>
  );
}

function FlowHeader({ workflow }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  return (
    <div className="sm-card sm-flow-head">
      <h2 className="sm-card-title">{t(`forms.flows.${workflow.id}.title`)}</h2>
      <p className="sm-text sm-muted">{t(`forms.flows.${workflow.id}.intro`)}</p>
    </div>
  );
}

/* The record a change is about, as the backend sent it: what would be reversed, confirmed or archived. */
function RecordSummary({ summary }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  if (!summary) return null;

  const rows = [
    summary.name && ["name", <bdi key="n" dir="auto" className="sm-user-text">{summary.name}</bdi>],
    summary.amount && ["amount", <Money key="a" plain value={summary.amount} currency={summary.currency ?? undefined} />],
    summary.date && ["date", <bdi key="d">{formatDay(summary.date, locale, "UTC") ?? summary.date}</bdi>],
    summary.account && ["account", <bdi key="c" dir="auto" className="sm-user-text">{summary.account}</bdi>],
    summary.from && ["from", <bdi key="f" dir="auto" className="sm-user-text">{summary.from}</bdi>],
    summary.to && ["to", <bdi key="t" dir="auto" className="sm-user-text">{summary.to}</bdi>],
  ].filter(Boolean);

  return (
    <dl className="sm-stats sm-stats-stacked" data-sm-summary="record">
      {rows.map(([name, value]) => (
        <div key={name} className="sm-stat">
          <dt>{t(`forms.summaryFields.${name}`)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FormWithChoices({ workflow, ctx, backTo }) {
  const choices = useFormChoices(workflow.needs);
  const summary = workflow.summary ? <RecordSummary summary={workflow.summary(ctx)} /> : null;
  return <DraftForm workflow={workflow} ctx={ctx} choices={choices} backTo={backTo} recordSummary={summary} />;
}

/* /m/add/:workflow: a new entry (expense, income, transfer, account, budget, goal, recurring rule, debt). */
export function MobileNewEntry() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { workflow: id } = useParams();
  const location = useLocation();
  const workflow = NEW_FORM_IDS.includes(id) ? WORKFLOWS[id] : null;
  const { templates } = useDevicePreferences();
  // The router state names a template by its id only; the template itself is read from this identity's own preferences.
  const templateId = typeof location.state?.template === "string" ? location.state.template : null;
  const template = templates.find((item) => item.id === templateId && item.type === id) ?? null;
  const ctx = useMemo(() => ({ today: today(), template }), [template]);
  const backTo = backPathFrom(location.state, MOBILE_PREFIX);

  if (!workflow) return <MobileNotAvailable />;

  return (
    <section className="sm-page" data-sm-screen="workflow" data-sm-workflow={workflow.id} data-sm-template={template?.id}>
      <BackLink to={backTo} label={t("forms.back")} />
      <FlowHeader workflow={workflow} />
      {template && <p className="sm-text sm-muted sm-fine" data-sm-note="from-template">{t("templates.applied", { name: template.name })}</p>}
      <FormWithChoices key={`${workflow.id}:${template?.id ?? ""}`} workflow={workflow} ctx={ctx} backTo={backTo} />
    </section>
  );
}

/* A change to one record: the record is read first, and only one this change applies to gets a form. */
export function MobileRecordAction({ workflowId }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const params = useParams();
  const location = useLocation();
  const workflow = WORKFLOWS[workflowId];
  const source = RECORD_SOURCES[workflow.record];
  const recordId = params[source.param];
  const parentId = source.parent ? params[source.parent] : null;
  const valid = isAccountId(recordId) && (!source.parent || isAccountId(parentId));
  const loadId = source.parent ? parentId : recordId;
  const loader = useMemo(() => source.loader(loadId), [source, loadId]);
  const resource = useResource(source.key(loadId), loader, { enabled: valid });
  const raw = source.envelope ? resource.data?.data : resource.data;
  const record = useMemo(() => (valid && raw !== undefined ? RECORD_PICKERS[workflow.record](raw, recordId) : null), [valid, raw, workflow.record, recordId]);
  const ctx = useMemo(() => (record ? { today: today(), record, debtId: parentId } : null), [record, parentId]);
  const backTo = backPathFrom(location.state, source.back(loadId));

  const page = (state, children) => (
    <section className="sm-page" data-sm-screen="workflow" data-sm-workflow={workflow.id} data-sm-state={state} data-sm-record={record?.id}>
      <BackLink to={backTo} label={t("forms.back")} />
      {children}
    </section>
  );

  if (!valid) return page("error", <ErrorPanel error={NOT_FOUND} />);
  if (resource.loading) return page("loading", <Skeleton lines={5} label={t("forms.loadingRecord")} />);
  if (resource.status === "error" || !record) return page("error", <ErrorPanel error={resource.error ?? (raw !== undefined && source.envelope ? NOT_FOUND : MALFORMED)} onRetry={resource.reload} retrying={resource.refreshing} hideExistence />);

  const reason = workflow.eligible?.(record);
  if (reason) {
    return page(
      "ineligible",
      <>
        <FlowHeader workflow={workflow} />
        <div className="sm-card" role="note" data-sm-note="ineligible" data-sm-reason={reason}>
          <p className="sm-text">{t(`forms.ineligible.${reason}`)}</p>
        </div>
      </>,
    );
  }

  return page(
    resource.stale ? "stale" : "ready",
    <>
      <FlowHeader workflow={workflow} />
      <FormWithChoices key={`${workflow.id}:${record.id}`} workflow={workflow} ctx={ctx} backTo={backTo} />
    </>,
  );
}

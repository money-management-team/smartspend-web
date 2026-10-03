import PrivateMoney from "../Experience/PrivateMoney";
import Loading from "../../../../components/Loading/Loading";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { accountsApi } from "../api/accountsApi";
import { categoriesApi } from "../api/categoriesApi";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { getApiErrorMessage } from "../api/apiClient";
import { importsApi, newImportKey } from "../api/importsApi";
import { PATH } from "../../../../routes/Path";
import "./Imports.css";

const FIELDS = [
  "date",
  "description",
  "amount",
  "debit",
  "credit",
  "type",
  "currency",
  "category",
  "reference",
];
const PROCESSING = ["confirmed", "processing"];
const REVIEWABLE = ["ready_for_review", "partially_valid"];
const BATCH_STATUSES = [
  "uploaded",
  "mapping_required",
  "validating",
  "ready_for_review",
  "partially_valid",
  "confirmed",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "reversed",
];
const ROW_STATUSES = [
  "pending",
  "valid",
  "invalid",
  "duplicate",
  "ignored",
  "imported",
  "failed",
  "reversed",
];
const path = (id) => `${PATH.USER.IMPORTS}/${encodeURIComponent(id)}`;

export default function Imports() {
  const { importId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const x = "dashboard.imports";
  const [workspaceId, setWorkspaceId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState(null);
  const [batches, setBatches] = useState([]);
  const [listPage, setListPage] = useState(null);
  const [listStatus, setListStatus] = useState("");
  const [listAccountId, setListAccountId] = useState("");
  const [batch, setBatch] = useState(null);
  const batchStatus = batch?.status;
  const [mapping, setMapping] = useState({});
  const [expenseCategory, setExpenseCategory] = useState("");
  const [incomeCategory, setIncomeCategory] = useState("");
  const [rows, setRows] = useState([]);
  const [rowPage, setRowPage] = useState(null);
  const [rowStatus, setRowStatus] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [edit, setEdit] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  // The first load (workspace, accounts, categories, batch) failed: show a
  // retry instead of a half-empty page.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const busyRef = useRef(false);
  const keys = useRef({});

  const loadList = useCallback(
    async (page = 1, signal) => {
      const result = (
        await importsApi.list(
          {
            page,
            per_page: 20,
            status: listStatus || undefined,
            account_id: listAccountId || undefined,
          },
          { signal },
        )
      ).data?.imports;
      if (signal?.aborted) return;
      setBatches((old) =>
        page === 1 ? (result?.data ?? []) : [...old, ...(result?.data ?? [])],
      );
      setListPage(result);
    },
    [listStatus, listAccountId],
  );

  const loadBatch = useCallback(async (id, signal) => {
    const data = (await importsApi.get(id, { signal })).data;
    setBatch(data?.import ?? null);
    setMapping(data?.import?.mapping ?? data?.suggested_mapping ?? {});
    setAccountId(String(data?.import?.account_id ?? ""));
    setExpenseCategory(
      String(data?.import?.options?.default_expense_category_id ?? ""),
    );
    setIncomeCategory(
      String(data?.import?.options?.default_income_category_id ?? ""),
    );
  }, []);

  const loadRows = useCallback(
    async (id, page = 1, signal) => {
      const data = (
        await importsApi.preview(
          id,
          { page, per_page: 50, status: rowStatus || undefined },
          { signal },
        )
      ).data;
      if (signal?.aborted) return;
      setRows(data?.rows?.data ?? []);
      setRowPage(data?.rows ?? null);
      if (data?.import) setBatch(data.import);
    },
    [rowStatus],
  );

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      resolveWorkspaceId({ signal: controller.signal }),
      accountsApi.list({}, { signal: controller.signal }),
      categoriesApi.list({}, { signal: controller.signal }),
      importId
        ? importsApi.get(importId, { signal: controller.signal })
        : Promise.resolve(null),
    ])
      .then(
        ([workspace, accountResponse, categoryResponse, importResponse]) => {
          if (controller.signal.aborted) return;
          setWorkspaceId(workspace);
          setAccounts(accountResponse.data?.accounts ?? []);
          setCategories(categoryResponse.data?.categories ?? []);
          if (importId) {
            const detail = importResponse.data;
            setBatch(detail?.import ?? null);
            setMapping(
              detail?.import?.mapping ?? detail?.suggested_mapping ?? {},
            );
            setAccountId(String(detail?.import?.account_id ?? ""));
            setExpenseCategory(
              String(
                detail?.import?.options?.default_expense_category_id ?? "",
              ),
            );
            setIncomeCategory(
              String(detail?.import?.options?.default_income_category_id ?? ""),
            );
          }
        },
      )
      .catch((failure) => {
        if (failure.name === "AbortError") return;
        setError(getApiErrorMessage(failure, t));
        setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [importId, t, reloadKey]);

  const retryLoad = () => {
    setError("");
    setLoadFailed(false);
    setLoading(true);
    setReloadKey((current) => current + 1);
  };

  useEffect(() => {
    if (importId || loading) return;
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) return loadList(1, controller.signal);
      })
      .catch((failure) => {
        if (failure.name !== "AbortError")
          setError(getApiErrorMessage(failure, t));
      });
    return () => controller.abort();
  }, [importId, loading, loadList, t]);

  useEffect(() => {
    if (
      !importId ||
      ![...REVIEWABLE, "completed", "failed", "reversed"].includes(batchStatus)
    )
      return;
    const controller = new AbortController();
    importsApi
      .preview(
        importId,
        { page: 1, per_page: 50, status: rowStatus || undefined },
        { signal: controller.signal },
      )
      .then((response) => {
        if (controller.signal.aborted) return;
        setRows(response.data?.rows?.data ?? []);
        setRowPage(response.data?.rows ?? null);
      })
      .catch((failure) => {
        if (failure.name !== "AbortError")
          setError(getApiErrorMessage(failure, t));
      });
    return () => controller.abort();
    // Only a batch status transition should start a new preview load.
  }, [importId, batchStatus, rowStatus, t]);

  useEffect(() => {
    if (!importId || !PROCESSING.includes(batchStatus)) return;
    const timer = setInterval(
      () =>
        loadBatch(importId).catch((failure) =>
          setError(getApiErrorMessage(failure, t)),
        ),
      5000,
    );
    return () => clearInterval(timer);
  }, [importId, batchStatus, loadBatch, t]);

  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      setError(getApiErrorMessage(failure, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function upload(event) {
    event.preventDefault();
    if (!file || !workspaceId) return;
    await run(async () => {
      const result = await importsApi.upload(
        file,
        workspaceId,
        accountId || null,
      );
      navigate(path(result.data.import.id));
    });
  }

  async function saveMapping(event) {
    event.preventDefault();
    await run(async () => {
      const payload = {
        mapping: Object.fromEntries(
          Object.entries(mapping)
            .filter(([, column]) => column !== "" && column != null)
            .map(([field, column]) => [field, Number(column)]),
        ),
        account_id: Number(accountId),
      };
      if (expenseCategory)
        payload.default_expense_category_id = Number(expenseCategory);
      if (incomeCategory)
        payload.default_income_category_id = Number(incomeCategory);
      await importsApi.mapping(importId, payload);
      await loadBatch(importId);
      setNotice(t(`${x}.mapped`));
    });
  }

  async function mutate(action, message) {
    await run(async () => {
      const result = await action();
      if (result?.data?.import) setBatch(result.data.import);
      await loadBatch(importId);
      if (message) setNotice(t(`${x}.${message}`));
    });
  }

  function operationKey(kind) {
    if (!keys.current[kind]) keys.current[kind] = newImportKey();
    return keys.current[kind];
  }

  return (
    <div className="imports-page">
      <header>
        <h1>{t(`${x}.title`)}</h1>
        <p>{t(`${x}.subtitle`)}</p>
      </header>
      {error && (
        <p role="alert" className="imports-page__error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loadFailed && !loading && (
        <button
          type="button"
          className="imports-page__retry"
          onClick={retryLoad}
        >
          {t("common.retry")}
        </button>
      )}
      {loading ? (
        <Loading message={t(`${x}.loading`)} />
      ) : loadFailed ? null : !importId ? (
        <>
          <form
            onSubmit={upload}
            className="imports-page__card imports-page__form"
          >
            <h2>{t(`${x}.upload`)}</h2>
            <label>
              {t(`${x}.account`)}{" "}
              <select
                required
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">{t(`${x}.select`)}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency_code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t(`${x}.file`)}{" "}
              <input
                required
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button disabled={busy || !workspaceId} type="submit">
              {t(`${x}.upload`)}
            </button>
          </form>
          <section className="imports-page__cards">
            <h2>{t(`${x}.history`)}</h2>
            <div className="imports-page__filters">
              <label>
                {t(`${x}.filterStatus`)}{" "}
                <select
                  value={listStatus}
                  onChange={(event) => {
                    setBatches([]);
                    setListPage(null);
                    setListStatus(event.target.value);
                  }}
                >
                  <option value="">{t(`${x}.allStatuses`)}</option>
                  {BATCH_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`${x}.statuses.${status}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(`${x}.filterAccount`)}{" "}
                <select
                  value={listAccountId}
                  onChange={(event) => {
                    setBatches([]);
                    setListPage(null);
                    setListAccountId(event.target.value);
                  }}
                >
                  <option value="">{t(`${x}.allAccounts`)}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency_code})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!batches.length && (
              <p>{listPage ? t(`${x}.empty`) : t(`${x}.loading`)}</p>
            )}
            {batches.map((item) => (
              <Link
                className="imports-page__card"
                key={item.id}
                to={path(item.id)}
              >
                <strong>{item.original_filename}</strong>
                <span>{t(`${x}.statuses.${item.status}`)}</span>
                <span>{item.created_at?.slice(0, 10)}</span>
              </Link>
            ))}
            {listPage?.current_page < listPage?.last_page && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => loadList(listPage.current_page + 1))}
              >
                {t(`${x}.more`)}
              </button>
            )}
          </section>
        </>
      ) : (
        <>
          <Link to={PATH.USER.IMPORTS}>{t(`${x}.back`)}</Link>
          {!batch ? (
            <p>{t(`${x}.notFound`)}</p>
          ) : (
            <>
              <section className="imports-page__card">
                <h2>{batch.original_filename}</h2>
                <p>
                  {t(`${x}.status`)}: {t(`${x}.statuses.${batch.status}`)}
                </p>
                <p>{t(`${x}.counts`, batch.counts)}</p>
                {batch.failure_reason && (
                  <p role="alert">{batch.failure_reason}</p>
                )}
                {PROCESSING.includes(batch.status) && (
                  <p role="status">{t(`${x}.processing`)}</p>
                )}
              </section>
              {batch.is_editable && (
                <form
                  onSubmit={saveMapping}
                  className="imports-page__card imports-page__form"
                >
                  <h3>{t(`${x}.mapping`)}</h3>
                  <p>{t(`${x}.mappingHelp`)}</p>
                  <label>
                    {t(`${x}.account`)}{" "}
                    <select
                      required
                      value={accountId}
                      onChange={(event) => setAccountId(event.target.value)}
                    >
                      <option value="">{t(`${x}.select`)}</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.currency_code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="imports-page__mapping">
                    {FIELDS.map((field) => (
                      <label key={field}>
                        {t(`${x}.fields.${field}`)}
                        <select
                          value={mapping[field] ?? ""}
                          onChange={(event) =>
                            setMapping((old) => ({
                              ...old,
                              [field]: event.target.value,
                            }))
                          }
                        >
                          <option value="">{t(`${x}.unmapped`)}</option>
                          {batch.headers?.map((header, index) => (
                            <option key={index} value={index}>
                              {index + 1}. {header}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <label>
                    {t(`${x}.expenseCategory`)}{" "}
                    <select
                      value={expenseCategory}
                      onChange={(event) =>
                        setExpenseCategory(event.target.value)
                      }
                    >
                      <option value="">{t(`${x}.select`)}</option>
                      {categories
                        .filter((c) => c.type === "expense")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t(`${x}.incomeCategory`)}{" "}
                    <select
                      value={incomeCategory}
                      onChange={(event) =>
                        setIncomeCategory(event.target.value)
                      }
                    >
                      <option value="">{t(`${x}.select`)}</option>
                      {categories
                        .filter((c) => c.type === "income")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button type="submit" disabled={busy}>
                    {t(`${x}.saveMapping`)}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      mutate(() => importsApi.validate(importId), "validated")
                    }
                  >
                    {t(`${x}.validate`)}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t(`${x}.cancelConfirm`)))
                        mutate(() => importsApi.cancel(importId), "cancelled");
                    }}
                  >
                    {t(`${x}.cancel`)}
                  </button>
                </form>
              )}
              {REVIEWABLE.includes(batch.status) && (
                <section className="imports-page__card">
                  <p>{t(`${x}.reviewWarning`)}</p>
                  <button
                    type="button"
                    disabled={busy || !batch.counts?.valid}
                    onClick={() => {
                      if (window.confirm(t(`${x}.confirmPrompt`)))
                        mutate(
                          () =>
                            importsApi.confirm(
                              importId,
                              operationKey("confirm"),
                            ),
                          "confirmed",
                        );
                    }}
                  >
                    {t(`${x}.confirm`)}
                  </button>
                </section>
              )}
              {batch.status === "completed" && (
                <section className="imports-page__card">
                  <label>
                    {t(`${x}.reverseReason`)}{" "}
                    <input
                      value={edit.reason ?? ""}
                      onChange={(event) =>
                        setEdit((old) => ({
                          ...old,
                          reason: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || (edit.reason ?? "").trim().length < 3}
                    onClick={() => {
                      if (window.confirm(t(`${x}.reversePrompt`)))
                        mutate(
                          () =>
                            importsApi.reverse(
                              importId,
                              edit.reason.trim(),
                              operationKey("reverse"),
                            ),
                          "reversed",
                        );
                    }}
                  >
                    {t(`${x}.reverse`)}
                  </button>
                </section>
              )}
              {[...REVIEWABLE, "completed", "failed", "reversed"].includes(
                batch.status,
              ) && (
                <section className="imports-page__cards">
                  <h2>{t(`${x}.preview`)}</h2>
                  <div className="imports-page__filters">
                    <label>
                      {t(`${x}.filterRows`)}{" "}
                      <select
                        value={rowStatus}
                        onChange={(event) => {
                          setRows([]);
                          setRowPage(null);
                          setEditRow(null);
                          setRowStatus(event.target.value);
                        }}
                      >
                        <option value="">{t(`${x}.allStatuses`)}</option>
                        {ROW_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(`${x}.rowStatuses.${status}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {!rows.length && (
                    <p>
                      {rowPage ? t(`${x}.noMatchingRows`) : t(`${x}.loading`)}
                    </p>
                  )}
                  {rows.map((row) => (
                    <article className="imports-page__card" key={row.id}>
                      <strong>
                        #{row.row_number} —{" "}
                        {t(`${x}.rowStatuses.${row.status}`)}
                      </strong>
                      <p>
                        <bdi>
                          {row.transaction_date} · {row.transaction_type} ·{" "}
                          <PrivateMoney>
                            {row.amount} {row.currency}
                          </PrivateMoney>
                        </bdi>{" "}
                        — {row.description}
                      </p>
                      {row.errors?.length > 0 && (
                        <ul>
                          {row.errors.map((item, index) => (
                            <li key={index}>
                              {typeof item === "string"
                                ? item
                                : JSON.stringify(item)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {row.duplicate_of_transaction_id && (
                        <p>
                          {t(`${x}.duplicate`)} #
                          {row.duplicate_of_transaction_id}
                        </p>
                      )}
                      {batch.is_editable && (
                        <div className="imports-page__actions">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditRow(row.id);
                              setEdit({
                                transaction_date: row.transaction_date ?? "",
                                transaction_type:
                                  row.transaction_type ?? "expense",
                                amount: row.amount ?? "",
                                currency: row.currency ?? "",
                                description: row.description ?? "",
                                category_id: row.category_id ?? "",
                                status:
                                  row.status === "duplicate"
                                    ? "valid"
                                    : row.status === "ignored"
                                      ? "valid"
                                      : "",
                              });
                            }}
                          >
                            {t(`${x}.edit`)}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              mutate(async () => {
                                const result = await importsApi.ignoreRow(
                                  importId,
                                  row.id,
                                );
                                await loadRows(
                                  importId,
                                  rowPage?.current_page ?? 1,
                                );
                                return result;
                              }, "saved")
                            }
                          >
                            {t(`${x}.ignore`)}
                          </button>
                        </div>
                      )}
                      {editRow === row.id && (
                        <form
                          className="imports-page__form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            run(async () => {
                              await importsApi.updateRow(importId, row.id, {
                                ...edit,
                                category_id: edit.category_id
                                  ? Number(edit.category_id)
                                  : null,
                                status: edit.status || undefined,
                              });
                              await loadRows(
                                importId,
                                rowPage?.current_page ?? 1,
                              );
                              setEditRow(null);
                              setNotice(t(`${x}.saved`));
                            });
                          }}
                        >
                          {[
                            "transaction_date",
                            "amount",
                            "currency",
                            "description",
                          ].map((field) => (
                            <label key={field}>
                              {t(`${x}.rowFields.${field}`)}
                              <input
                                value={edit[field] ?? ""}
                                onChange={(event) =>
                                  setEdit((old) => ({
                                    ...old,
                                    [field]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          ))}
                          <label>
                            {t(`${x}.rowFields.transaction_type`)}{" "}
                            <select
                              value={edit.transaction_type}
                              onChange={(event) =>
                                setEdit((old) => ({
                                  ...old,
                                  transaction_type: event.target.value,
                                }))
                              }
                            >
                              <option value="income">{t(`${x}.income`)}</option>
                              <option value="expense">
                                {t(`${x}.expense`)}
                              </option>
                            </select>
                          </label>
                          <label>
                            {t(`${x}.rowFields.category_id`)}{" "}
                            <select
                              value={edit.category_id}
                              onChange={(event) =>
                                setEdit((old) => ({
                                  ...old,
                                  category_id: event.target.value,
                                }))
                              }
                            >
                              <option value="">{t(`${x}.select`)}</option>
                              {categories
                                .filter((c) => c.type === edit.transaction_type)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <button type="submit" disabled={busy}>
                            {t(`${x}.save`)}
                          </button>
                        </form>
                      )}
                    </article>
                  ))}
                  {rowPage && (
                    <div className="imports-page__actions">
                      <button
                        type="button"
                        disabled={busy || rowPage?.current_page <= 1}
                        onClick={() =>
                          run(() =>
                            loadRows(importId, rowPage.current_page - 1),
                          )
                        }
                      >
                        {t(`${x}.previous`)}
                      </button>
                      <span>
                        {rowPage?.current_page} / {rowPage?.last_page}
                      </span>
                      <button
                        type="button"
                        disabled={
                          busy || rowPage?.current_page >= rowPage?.last_page
                        }
                        onClick={() =>
                          run(() =>
                            loadRows(importId, rowPage.current_page + 1),
                          )
                        }
                      >
                        {t(`${x}.next`)}
                      </button>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

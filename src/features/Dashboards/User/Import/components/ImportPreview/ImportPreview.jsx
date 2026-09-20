import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { ApiError, getStoredWorkspace } from "../../../api/apiClient";
import { categoriesApi } from "../../../api/categoriesApi";
import { importsApi } from "../../../api/importsApi";
import {
  DEFAULT_PREVIEW_PER_PAGE,
  PREVIEW_PER_PAGE_OPTIONS,
  getImportErrorMessage,
  isImportEditable,
  parsePreviewResponse,
  parseRowUpdateResponse,
} from "../../importHelpers";
import ImportPanel from "../ImportPanel/ImportPanel";
import ImportRowCard from "../ImportRowCard/ImportRowCard";
import ImportRowEditor from "../ImportRowEditor/ImportRowEditor";

import "./ImportPreview.css";

/*
 * Step 4: GET /imports/{id}/preview (per_page, page). `data.rows` is a Laravel
 * paginator (`data.rows.data` holds the rows); `data.import` refreshes the
 * counts. No status filter is sent: its parameter isn't confirmed.
 *
 * A corrected row is replaced by the backend's revalidated row, and the
 * import's counts by the ones returned with it.
 */
export default function ImportPreview({ importRecord, onImportChange }) {
  const { t } = useTranslation();
  const importId = importRecord.id;
  const editable = isImportEditable(importRecord);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PREVIEW_PER_PAGE);
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${importId}:${page}:${perPage}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });
  const [editingRowId, setEditingRowId] = useState(null);
  const onImportChangeRef = useRef(onImportChange);

  useEffect(() => {
    onImportChangeRef.current = onImportChange;
  });

  useEffect(() => {
    const controller = new AbortController();

    importsApi
      .preview(importId, { per_page: perPage, page }, { signal: controller.signal })
      .then((response) => {
        const parsed = parsePreviewResponse(response);

        if (!parsed) {
          setResult({ key: requestKey, page: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) });
          return;
        }

        setResult({ key: requestKey, page: parsed.page, error: null });
        if (parsed.import) onImportChangeRef.current(parsed.import);
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [importId, page, perPage, requestKey]);

  /* ---------- Categories for corrections ---------- */

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (!editable) return undefined;

    const controller = new AbortController();
    const workspaceId = importRecord.workspace_id ?? getStoredWorkspace()?.id;

    categoriesApi
      .list({ workspace_id: workspaceId }, { signal: controller.signal })
      .then((response) => setCategories((response.data?.categories ?? []).filter((category) => category?.id != null)))
      // Without categories the editor still corrects the other fields.
      .catch(() => {});

    return () => controller.abort();
  }, [editable, importRecord.workspace_id]);

  const isLoading = result.key !== requestKey;
  const rowsPage = isLoading ? null : result.page;
  const error = isLoading ? null : result.error;
  const rows = rowsPage?.items ?? [];

  const handleRowSaved = (row, updatedImport) => {
    setResult((current) =>
      current.page
        ? { ...current, page: { ...current.page, items: current.page.items.map((item) => (item.id === row.id ? row : item)) } }
        : current,
    );
    if (updatedImport) onImportChange(updatedImport);
    setEditingRowId(null);
  };

  /* ---------- Ignore a row (POST .../rows/{rowId}/ignore) ---------- */

  const [ignoringRowId, setIgnoringRowId] = useState(null);
  const [ignoreError, setIgnoreError] = useState(null);

  /*
   * The row stays in the list: the backend returns it with `status: "ignored"`
   * and the import's updated counts, and both replace what is shown. Nothing
   * is removed locally, so the review stays a faithful audit of the file.
   */
  const handleIgnore = async (row) => {
    if (ignoringRowId != null) return;

    setIgnoringRowId(row.id);
    setIgnoreError(null);

    try {
      const parsed = parseRowUpdateResponse(await importsApi.ignoreRow(importId, row.id));
      if (!parsed) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      handleRowSaved(parsed.row, parsed.import);
    } catch (error) {
      setIgnoreError(error);
    } finally {
      setIgnoringRowId(null);
    }
  };

  const goToPage = (next) => {
    setEditingRowId(null);
    setPage(next);
  };

  return (
    <ImportPanel title={t("dashboard.importPage.review.title")} hint={t("dashboard.importPage.review.hint")}>
      <div className="import-preview__toolbar">
        <label className="import-panel__field">
          <span>{t("dashboard.reports.filters.perPage")}</span>
          <select
            value={perPage}
            onChange={(event) => {
              setEditingRowId(null);
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
          >
            {PREVIEW_PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <Loading message={t("dashboard.importPage.review.loading")} />}

      {!isLoading && error && (
        <div className="import-panel__alert" role="alert">
          <p>{getImportErrorMessage(error, t, "preview")}</p>
          <button type="button" className="import-panel__secondary" onClick={() => setReloadKey((key) => key + 1)}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <div className="import-preview__empty">
          <p>{rowsPage && rowsPage.total > 0 && page > 1 ? t("dashboard.importPage.review.emptyPage") : t("dashboard.importPage.review.empty")}</p>
          {rowsPage && rowsPage.total > 0 && page > 1 && (
            <button type="button" className="import-panel__secondary" onClick={() => goToPage(1)}>
              {t("dashboard.transactions.pagination.first")}
            </button>
          )}
        </div>
      )}

      {ignoreError && (
        <div className="import-panel__alert" role="alert">
          <p>{getImportErrorMessage(ignoreError, t, "ignore")}</p>
        </div>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <div className="import-preview__rows">
          {rows.map((row) => (
            <ImportRowCard
              key={row.id}
              row={row}
              importRecord={importRecord}
              canEdit={editable}
              isEditing={editingRowId === row.id}
              onEdit={() => setEditingRowId(row.id)}
              onIgnore={() => handleIgnore(row)}
              isIgnoring={ignoringRowId === row.id}
            >
              {editingRowId === row.id && (
                <ImportRowEditor
                  row={row}
                  importRecord={importRecord}
                  categories={categories}
                  onSaved={handleRowSaved}
                  onCancel={() => setEditingRowId(null)}
                />
              )}
            </ImportRowCard>
          ))}
        </div>
      )}

      {!isLoading && !error && rowsPage && rowsPage.total > 0 && (
        <footer className="import-preview__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", { from: rowsPage.from, to: rowsPage.to, total: rowsPage.total })}
          </span>
          {rowsPage.lastPage > 1 && (
            <div className="import-preview__pages">
              <button
                type="button"
                onClick={() => goToPage(rowsPage.page - 1)}
                disabled={rowsPage.page <= 1}
                aria-label={t("dashboard.transactions.pagination.previous")}
              >
                <LuChevronLeft aria-hidden="true" />
              </button>
              <span aria-live="polite">
                {t("dashboard.transactions.pagination.page", { page: rowsPage.page, lastPage: rowsPage.lastPage })}
              </span>
              <button
                type="button"
                onClick={() => goToPage(rowsPage.page + 1)}
                disabled={rowsPage.page >= rowsPage.lastPage}
                aria-label={t("dashboard.transactions.pagination.next")}
              >
                <LuChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </footer>
      )}
    </ImportPanel>
  );
}

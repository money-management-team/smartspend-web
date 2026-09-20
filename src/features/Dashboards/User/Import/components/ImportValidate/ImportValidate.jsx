import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuListChecks } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { importsApi } from "../../../api/importsApi";
import {
  getFieldMessages,
  getImportErrorMessage,
  isImportEditable,
  normalizeMapping,
  parseImportResponse,
} from "../../importHelpers";
import ImportPanel from "../ImportPanel/ImportPanel";

import "./ImportValidate.css";

/*
 * Step 3: POST /imports/{id}/validate (no body). The backend rebuilds the
 * rows from the file with the saved mapping and classifies each one (valid /
 * invalid / duplicate). It creates no transaction and changes no balance.
 */
export default function ImportValidate({ importRecord, onValidated }) {
  const { t, i18n } = useTranslation();
  const [request, setRequest] = useState({ pending: false, error: null });
  const pendingRef = useRef(false);
  const headers = Array.isArray(importRecord.headers) ? importRecord.headers : [];
  const mapping = Object.entries(normalizeMapping(importRecord.mapping));
  const editable = isImportEditable(importRecord);

  const handleValidate = async () => {
    if (pendingRef.current || !editable) return;

    pendingRef.current = true;
    setRequest({ pending: true, error: null });

    try {
      const validated = parseImportResponse(await importsApi.validate(importRecord.id));
      if (!validated) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      setRequest({ pending: false, error: null });
      onValidated(validated);
    } catch (error) {
      setRequest({ pending: false, error });
    } finally {
      pendingRef.current = false;
    }
  };

  const fieldMessages = getFieldMessages(request.error);

  return (
    <ImportPanel title={t("dashboard.importPage.validate.title")} hint={t("dashboard.importPage.validate.hint")}>
      {mapping.length > 0 && (
        <dl className="import-validate__mapping">
          {mapping.map(([field, index]) => {
            const fieldKey = `dashboard.importPage.mappingFields.${field}`;

            return (
              <div key={field}>
                <dt>{i18n.exists(fieldKey) ? t(fieldKey) : field}</dt>
                <dd dir="auto">
                  {t("dashboard.importPage.mapping.column", {
                    number: index + 1,
                    name: headers[index] ?? t("dashboard.importPage.mapping.unnamed"),
                  })}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {request.error && (
        <div className="import-panel__alert" role="alert">
          <p>{getImportErrorMessage(request.error, t, "validate")}</p>
          {fieldMessages.length > 0 && (
            <ul>
              {fieldMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="import-panel__actions">
        <button
          type="button"
          className="import-panel__primary"
          onClick={handleValidate}
          disabled={!editable || request.pending}
          aria-busy={request.pending}
        >
          <LuListChecks aria-hidden="true" />
          {request.pending ? t("dashboard.importPage.validate.validating") : t("dashboard.importPage.validate.submit")}
        </button>
      </div>
    </ImportPanel>
  );
}

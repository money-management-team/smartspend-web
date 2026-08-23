import {
  useRef,
  useState,
} from "react";

import {
  LuFileSpreadsheet,
  LuUpload,
  LuX,
  LuFileText,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./UploadStatement.css";

const ALLOWED_EXTENSIONS = [
  "pdf",
  "xlsx",
  "xls",
  "csv",
];

export default function UploadStatement() {
  const { t } = useTranslation();

  const fileInputRef = useRef(null);

  const [isDragging, setIsDragging] =
    useState(false);

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [account, setAccount] =
    useState("checking");

  const isValidFile = (file) => {
    if (!file) return false;

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase();

    return ALLOWED_EXTENSIONS.includes(
      extension,
    );
  };

  const selectFile = (file) => {
    if (!isValidFile(file)) {
      return;
    }

    setSelectedFile(file);
  };

  const handleInputChange = (event) => {
    const file =
      event.target.files?.[0];

    selectFile(file);
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = (event) => {
    event.preventDefault();

    setIsDragging(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();

    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();

    if (
      event.currentTarget ===
      event.target
    ) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();

    setIsDragging(false);

    const file =
      event.dataTransfer.files?.[0];

    selectFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <section className="upload-statement">
      {/* ==========================
          CARD HEADER
      ========================== */}

      <header className="upload-statement__header">
        <h2>
          {t(
            "dashboard.importPage.upload.title",
          )}
        </h2>

        <p>
          {t(
            "dashboard.importPage.upload.supported",
          )}
        </p>
      </header>

      {/* ==========================
          BODY
      ========================== */}

      <div className="upload-statement__body">
        <input
          ref={fileInputRef}
          className="upload-statement__input"
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          onChange={handleInputChange}
        />

        {/* Drop Zone */}

        <div
          className={`upload-drop-zone ${
            isDragging
              ? "upload-drop-zone--dragging"
              : ""
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!selectedFile ? (
            <>
              <LuFileSpreadsheet className="upload-drop-zone__main-icon" />

              <strong>
                {t(
                  "dashboard.importPage.upload.dropTitle",
                )}
              </strong>

              <span>
                {t(
                  "dashboard.importPage.upload.supported",
                )}
              </span>

              <button
                type="button"
                className="upload-drop-zone__browse"
                onClick={handleBrowse}
              >
                <LuUpload />

                <span>
                  {t(
                    "dashboard.importPage.upload.browse",
                  )}
                </span>
              </button>
            </>
          ) : (
            <div className="upload-selected-file">
              <span className="upload-selected-file__icon">
                <LuFileText />
              </span>

              <div className="upload-selected-file__copy">
                <strong>
                  {selectedFile.name}
                </strong>

                <span>
                  {(
                    selectedFile.size /
                    1024 /
                    1024
                  ).toFixed(2)}{" "}
                  MB
                </span>
              </div>

              <button
                type="button"
                className="upload-selected-file__remove"
                onClick={handleRemoveFile}
                aria-label={t(
                  "dashboard.importPage.upload.remove",
                )}
              >
                <LuX />
              </button>
            </div>
          )}
        </div>

        {/* ==========================
            DETECTED ACCOUNT
        ========================== */}

        <label className="detected-account">
          <span>
            {t(
              "dashboard.importPage.account.label",
            )}
          </span>

          <select
            value={account}
            onChange={(event) =>
              setAccount(
                event.target.value,
              )
            }
          >
            <option value="checking">
              {t(
                "dashboard.importPage.account.checking",
              )}
            </option>

            <option value="savings">
              {t(
                "dashboard.importPage.account.savings",
              )}
            </option>

            <option value="wallet">
              {t(
                "dashboard.importPage.account.wallet",
              )}
            </option>

            <option value="cash">
              {t(
                "dashboard.importPage.account.cash",
              )}
            </option>
          </select>
        </label>
      </div>
    </section>
  );
}
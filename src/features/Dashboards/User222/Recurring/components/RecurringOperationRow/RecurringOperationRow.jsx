import {
  LuTrendingUp,
  LuTrendingDown,
  LuCalendarClock,
  LuPencil,
  LuTrash2,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./RecurringOperationRow.css";

export default function RecurringOperationRow({
  item,
}) {
  const { t } = useTranslation();

  const isIncome =
    item.type === "income";

  const TrendIcon =
    isIncome
      ? LuTrendingUp
      : LuTrendingDown;

  const formatAmount = () => {
    const amount =
      Math.abs(item.amount).toLocaleString(
        "en-US",
      );

    if (isIncome) {
      return `+$${amount}`;
    }

    return `-$${amount}`;
  };

  const handleConfirm = () => {
    console.log(
      "Confirm recurring:",
      item.id,
    );
  };

  const handleSchedule = () => {
    console.log(
      "Schedule:",
      item.id,
    );
  };

  const handleEdit = () => {
    console.log(
      "Edit recurring:",
      item.id,
    );
  };

  const handleDelete = () => {
    console.log(
      "Delete recurring:",
      item.id,
    );
  };

  return (
    <article className="recurring-row">
      {/* =================================
          ICON
      ================================= */}

      <span
        className={`recurring-row__trend recurring-row__trend--${
          isIncome
            ? "income"
            : "expense"
        }`}
      >
        <TrendIcon />
      </span>

      {/* =================================
          COPY
      ================================= */}

      <div className="recurring-row__copy">
        <strong className="recurring-row__name">
          {t(
            `dashboard.recurring.items.${item.key}`,
          )}
        </strong>

        <span className="recurring-row__meta">
          {t(
            `dashboard.recurring.categories.${item.category}`,
          )}
          {" · "}
          {t(
            `dashboard.recurring.accounts.${item.account}`,
          )}
          {" · "}
          {t(
            `dashboard.recurring.frequency.${item.frequency}`,
          )}
        </span>

        <span
          className={`recurring-row__next ${
            item.status === "overdue"
              ? "recurring-row__next--overdue"
              : ""
          }`}
        >
          {t(
            "dashboard.recurring.next",
          )}:{" "}
          <bdi>
            {item.nextDate}
          </bdi>

          {item.status === "overdue" && (
            <>
              {" · "}
              {t(
                "dashboard.recurring.overdue",
              )}
            </>
          )}

          {item.days && (
            <>
              {" · "}
              {t(
                "dashboard.recurring.inDays",
                {
                  count:
                    item.days,
                },
              )}
            </>
          )}
        </span>

        {item.previousAmount && (
          <span className="recurring-row__previous">
            {t(
              "dashboard.recurring.previousAmount",
            )}
            :{" "}
            <bdi>
              $
              {item.previousAmount.toLocaleString(
                "en-US",
              )}
            </bdi>
          </span>
        )}
      </div>

      {/* =================================
          AMOUNT
      ================================= */}

      <strong
        className={`recurring-row__amount recurring-row__amount--${
          isIncome
            ? "income"
            : "expense"
        }`}
        dir="ltr"
      >
        {formatAmount()}
      </strong>

      {/* =================================
          CONFIRM
      ================================= */}

      <button
        type="button"
        className="recurring-row__confirm"
        onClick={handleConfirm}
      >
        {t(
          isIncome
            ? "dashboard.recurring.confirmDeposit"
            : "dashboard.recurring.confirmDeduction",
        )}
      </button>

      {/* =================================
          ACTIONS
      ================================= */}

      <div className="recurring-row__actions">
        <button
          type="button"
          onClick={handleSchedule}
          aria-label={t(
            "dashboard.recurring.actions.schedule",
          )}
        >
          <LuCalendarClock />
        </button>

        <button
          type="button"
          onClick={handleEdit}
          aria-label={t(
            "dashboard.recurring.actions.edit",
          )}
        >
          <LuPencil />
        </button>

        <button
          type="button"
          className="recurring-row__delete"
          onClick={handleDelete}
          aria-label={t(
            "dashboard.recurring.actions.delete",
          )}
        >
          <LuTrash2 />
        </button>
      </div>
    </article>
  );
}
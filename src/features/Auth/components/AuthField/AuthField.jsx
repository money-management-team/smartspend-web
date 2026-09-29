import "./AuthField.css";

/*
 * Labeled text input for the auth forms.
 *
 * - `errors`: array of messages (e.g. ApiError.errors[field]); rendered
 *   under the input and linked through aria-describedby (`${id}-error`).
 * - `invalid`: overrides aria-invalid when the error comes from local logic.
 * - `describedBy`: extra ids to describe the input (e.g. a hint block).
 * - `labelAction`: node shown at the end of the label row (e.g. a link).
 * - `icon`: decorative icon at the inline-end of the input.
 * - `action`: interactive control at the inline-end (e.g. show/hide).
 * Any other prop is passed to the <input>.
 */
export default function AuthField({
  id,
  label,
  labelAction,
  icon,
  action,
  errors,
  invalid,
  describedBy,
  ...inputProps
}) {
  const messages = Array.isArray(errors) ? errors : errors ? [errors] : [];
  const errorId = messages.length ? `${id}-error` : undefined;
  const ariaDescribedBy =
    [describedBy, errorId].filter(Boolean).join(" ") || undefined;
  const hasEndSlot = Boolean(icon || action);

  return (
    <div className="auth-field">
      <div className="auth-field__heading">
        <label className="auth-field__label" htmlFor={id}>
          {label}
        </label>

        {labelAction}
      </div>

      <div className="auth-field__control">
        <input
          id={id}
          className={`auth-field__input${hasEndSlot ? " auth-field__input--end" : ""}`}
          aria-invalid={invalid ?? messages.length > 0}
          aria-describedby={ariaDescribedBy}
          {...inputProps}
        />

        {icon && (
          <span className="auth-field__icon" aria-hidden="true">
            {icon}
          </span>
        )}

        {action}
      </div>

      {errorId && (
        <div className="auth-field__errors" id={errorId}>
          {messages.map((message) => (
            <small key={message}>{message}</small>
          ))}
        </div>
      )}
    </div>
  );
}

import { CheckIcon } from "../AuthIcons";

import "./AuthCheckbox.css";

/*
 * Custom checkbox with a visually hidden native input.
 * `children` is the label content (may include a link).
 * `errors` renders under the control and is linked via aria-describedby.
 * Any other prop is passed to the <input>.
 */
export default function AuthCheckbox({ id, errors, children, ...inputProps }) {
  const messages = Array.isArray(errors) ? errors : errors ? [errors] : [];
  const errorId = messages.length ? `${id}-error` : undefined;

  return (
    <div className="auth-checkbox">
      <label className="auth-checkbox__control">
        <input
          id={id}
          className="auth-checkbox__input"
          type="checkbox"
          aria-invalid={messages.length > 0 || undefined}
          aria-describedby={errorId}
          {...inputProps}
        />

        <span className="auth-checkbox__box" aria-hidden="true">
          <CheckIcon />
        </span>

        <span className="auth-checkbox__label">{children}</span>
      </label>

      {errorId && (
        <div className="auth-checkbox__errors" id={errorId}>
          {messages.map((message) => (
            <small key={message}>{message}</small>
          ))}
        </div>
      )}
    </div>
  );
}

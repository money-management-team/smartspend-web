import "./AuthAlert.css";

/*
 * Form-level message. An error (default) is announced immediately
 * (role="alert"); `variant="success"` is announced politely (role="status").
 * `dir="auto"`: backend messages can be in the other UI language (staging
 * answers in Arabic), so each message takes its own text direction.
 */
export default function AuthAlert({ variant = "error", children }) {
  const isSuccess = variant === "success";

  return (
    <p
      className={`auth-alert${isSuccess ? " auth-alert--success" : ""}`}
      role={isSuccess ? "status" : "alert"}
      dir="auto"
    >
      {children}
    </p>
  );
}

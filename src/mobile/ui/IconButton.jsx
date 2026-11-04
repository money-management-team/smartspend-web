/* A round icon button whose name is real text (visually hidden), so assistive technology and tests read it. */
export default function IconButton({ label, icon: Icon, spinning = false, buttonRef, ...props }) {
  return (
    <button type="button" ref={buttonRef} className={`sm-icon-button${spinning ? " sm-icon-spin" : ""}`} {...props}>
      <Icon aria-hidden="true" />
      <span className="sm-sr">{label}</span>
    </button>
  );
}

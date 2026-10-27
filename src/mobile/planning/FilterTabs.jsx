/*
 * One filter, as a group of buttons where exactly one is pressed. The choice is
 * not kept here: the screen puts it in the address (replace, so Back leaves the
 * screen, not the filter), which is why Back from a record returns to the same view.
 */
export default function FilterTabs({ label, value, options, onChange }) {
  return (
    <div className="sm-field" role="group" aria-label={label}>
      <div className="sm-segment sm-segment-wrap">
        {options.map((option) => (
          <button key={option.value || "all"} type="button" className="sm-segment-button" aria-pressed={option.value === value} onClick={() => option.value !== value && onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

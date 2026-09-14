export interface ChipOption {
  value: string;
  label: string;
}

export interface ChipGroupProps {
  legend: string;
  name: string;
  type: 'radio' | 'checkbox';
  options: ChipOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  hint?: string;
}

/** DESIGN.md "Chips (check-in)": a visually hidden input with a styled
 * sibling label; no accent colour — a check-in answer is not a reading. */
export function ChipGroup({ legend, name, type, options, value, onChange, hint }: ChipGroupProps) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);

  function toggle(optValue: string) {
    if (type === 'radio') {
      onChange(optValue);
      return;
    }
    const next = new Set(selected);
    if (next.has(optValue)) next.delete(optValue);
    else next.add(optValue);
    onChange([...next]);
  }

  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((opt) => (
          <label className="chip" key={opt.value}>
            <input type={type} name={name} checked={selected.has(opt.value)} onChange={() => toggle(opt.value)} />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  );
}

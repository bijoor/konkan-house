// Small, styled form field primitives used by every object editor.
// Debounced-commit numeric input so live-typing doesn't push a state
// update per keystroke (feeds the 3D/SVG previews).

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useConfigStore } from "../state/configStore";
import { formulaFieldError } from "../param/resolve";

interface BaseProps {
  // Optional so grouped rows (e.g. polyline point editors) can omit the
  // label on all but the first field. FieldRow renders `{label}`, which
  // is a no-op when undefined.
  label?: string;
  hint?: string;
  error?: string;
}

interface NumberFieldProps extends BaseProps {
  value: number | undefined;
  onCommit: (n: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}

// Number input with local buffer + debounced commit. The stored value
// is number|undefined; the input works on strings so partial inputs
// (e.g. `-`, `.`, empty during a rewrite) don't clobber the value.
export function NumberField({
  label,
  hint,
  error,
  value,
  onCommit,
  step,
  min,
  max,
  suffix,
  disabled,
  allowEmpty,
}: NumberFieldProps) {
  const [buf, setBuf] = useState<string>(value === undefined ? "" : String(value));

  // Sync outward changes (undo/redo, external replace) back to buffer.
  const lastOutward = useRef(value);
  useEffect(() => {
    if (value !== lastOutward.current) {
      setBuf(value === undefined ? "" : String(value));
      lastOutward.current = value;
    }
  }, [value]);

  const commit = (next: string) => {
    if (next === "" || next === "-" || next === ".") {
      if (allowEmpty) onCommit(undefined);
      return;
    }
    const n = Number(next);
    if (!Number.isFinite(n)) return;
    if (min !== undefined && n < min) return;
    if (max !== undefined && n > max) return;
    onCommit(n);
    lastOutward.current = n;
  };

  // step is a legacy prop — with type="text" browsers ignore it. Kept
  // in the signature so callers don't have to change; consumed here
  // just to silence unused-var lint.
  void step;

  // Use type="text" with inputMode="decimal" instead of type="number".
  // type="number" empties `e.target.value` mid-typing when the string
  // is briefly not-a-number (e.g. "86." with a lone trailing period),
  // which appears as a blanking field to the user.
  return (
    <FieldRow label={label} hint={hint} error={error}>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={buf}
          onChange={(e) => {
            // Filter to a permissive decimal-string pattern:
            // optional leading -, digits, single '.', more digits.
            const v = e.target.value;
            if (v === "" || /^-?\d*\.?\d*$/.test(v)) {
              setBuf(v);
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={inputStyle(!!error, !!disabled)}
        />
        {suffix && (
          <span className="text-[10px] text-slate-500">{suffix}</span>
        )}
      </div>
    </FieldRow>
  );
}

// ---- MeasureField: a number field that also accepts an "= formula" -------
// (plans/object-relationships-plan.md, Phase 2). A value starting with "="
// is stored as a formula; anything else is a literal number. When a formula
// drives the field the input shows the formula source (editable) with an "fx"
// badge and the resolved number as a hint. Most callers use the
// `ObjectMeasureField` wrapper below, which reads/writes the object's
// `formulas` map for them.

interface MeasureFieldProps extends BaseProps {
  value: number | undefined; // resolved numeric value
  formula: string | undefined; // "= expr" when a formula drives the field
  // Non-null when the current formula fails to evaluate (unknown variable /
  // syntax error). Shown as an error icon + tooltip under the field; the value
  // above stays at the last valid number.
  formulaError?: string;
  onCommitNumber: (n: number | undefined) => void; // sets literal, clears formula
  onCommitFormula: (src: string) => void; // sets/updates the formula
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}

const isFormulaText = (s: string) => s.trimStart().startsWith("=");

export function MeasureField({
  label,
  hint,
  error,
  value,
  formula,
  formulaError,
  onCommitNumber,
  onCommitFormula,
  min,
  max,
  suffix,
  disabled,
  allowEmpty,
}: MeasureFieldProps) {
  const display = formula ?? (value === undefined ? "" : String(value));
  const [buf, setBuf] = useState<string>(display);

  // Sync outward changes (undo/redo, external replace, resolver rewrite) back
  // to the buffer. Keyed on the display string (formula wins over number).
  const lastOutward = useRef(display);
  useEffect(() => {
    if (display !== lastOutward.current) {
      setBuf(display);
      lastOutward.current = display;
    }
  }, [display]);

  const commit = (next: string) => {
    const t = next.trim();
    if (isFormulaText(t)) {
      onCommitFormula(t);
      lastOutward.current = t;
      return;
    }
    if (t === "" || t === "-" || t === ".") {
      if (allowEmpty) {
        onCommitNumber(undefined);
        lastOutward.current = "";
      } else {
        // revert to the last committed display
        setBuf(lastOutward.current);
      }
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      setBuf(lastOutward.current);
      return;
    }
    if (min !== undefined && n < min) return;
    if (max !== undefined && n > max) return;
    onCommitNumber(n);
    lastOutward.current = String(n);
  };

  const driven = formula !== undefined;

  return (
    <FieldRow label={label} hint={hint} error={error}>
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            type="text"
            inputMode={driven || isFormulaText(buf) ? "text" : "decimal"}
            disabled={disabled}
            value={buf}
            onChange={(e) => {
              const v = e.target.value;
              // Allow formula characters once the buffer looks like a formula;
              // otherwise keep the permissive decimal filter.
              if (isFormulaText(v)) {
                if (/^=[\sA-Za-z0-9_+\-*/().]*$/.test(v)) setBuf(v);
              } else if (v === "" || /^-?\d*\.?\d*$/.test(v)) {
                setBuf(v);
              } else if (v === "=") {
                setBuf(v);
              }
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={clsx(inputStyle(!!error || !!formulaError, !!disabled), driven && "pr-7")}
            title={driven && value !== undefined ? `= ${value}` : undefined}
          />
          {driven && (
            <span
              className={clsx(
                "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-[9px] font-semibold italic",
                formulaError
                  ? "bg-red-900/70 text-red-300"
                  : "bg-emerald-900/70 text-emerald-300",
              )}
              title={formulaError ?? "driven by a formula"}
            >
              fx
            </span>
          )}
        </div>
        {suffix && <span className="text-[10px] text-slate-500">{suffix}</span>}
      </div>
      {driven && formulaError && (
        <div
          className="mt-0.5 flex items-center gap-1 text-[10px] text-red-400"
          title={formulaError}
        >
          <span aria-hidden>⚠</span>
          <span className="truncate">{formulaError}</span>
        </div>
      )}
      {driven && value !== undefined && (
        <div className="mt-0.5 text-[10px] text-slate-500">
          = {value}
          {formulaError ? " (last valid)" : ""}
        </div>
      )}
    </FieldRow>
  );
}

// Object-bound wrapper: reads `object[field]` (resolved number) and
// `object.formulas[field]` (formula source), and produces the right patch on
// commit — setting a formula writes into the object's `formulas` map; setting
// a number clears that field's formula. `patch` merges into the object (the
// same `(next) => replace(selection, {...object, ...next})` each form defines).
export function ObjectMeasureField({
  object,
  field,
  label,
  hint,
  patch,
  min,
  max,
  suffix,
  allowEmpty,
  disabled,
  integer,
}: {
  object: Record<string, unknown>;
  field: string;
  label?: string;
  hint?: string;
  patch: (p: Record<string, unknown>) => void;
  min?: number;
  max?: number;
  suffix?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  // Whole-number field (e.g. num_steps): a typed literal is rounded on commit.
  // Formula results are rounded by the resolver (INTEGER_FIELDS), so both paths
  // stay integral.
  integer?: boolean;
}) {
  const value = object[field] as number | undefined;
  const formulas = object.formulas as Record<string, string> | undefined;
  const formula = formulas?.[field];

  // Flag a formula that references an unknown variable or has a syntax error.
  // Evaluated against the same scope the resolver uses; the numeric value above
  // stays at the last valid number (the resolver leaves it untouched on error).
  const config = useConfigStore((s) => s.config);
  const formulaError = useMemo(
    () => formulaFieldError(config, formula) ?? undefined,
    [config, formula],
  );

  const setFormula = (src: string) =>
    patch({ formulas: { ...(formulas ?? {}), [field]: src } });

  const setNumber = (n: number | undefined) => {
    const nf = { ...(formulas ?? {}) };
    delete nf[field];
    const cleaned = Object.keys(nf).length > 0 ? nf : undefined;
    const v = integer && n !== undefined ? Math.round(n) : n;
    patch({ [field]: v, formulas: cleaned });
  };

  return (
    <MeasureField
      label={label}
      hint={hint}
      value={value}
      formula={formula}
      formulaError={formulaError}
      onCommitNumber={setNumber}
      onCommitFormula={setFormula}
      min={min}
      max={max}
      suffix={suffix}
      allowEmpty={allowEmpty}
      disabled={disabled}
    />
  );
}

// An Enable switch for any object: a manual checkbox, plus an optional
// `= formula` that drives it (0 = removed, non-zero = kept). A DISABLED object is
// removed from the model entirely (not merely hidden). The formula lives in
// `object.formulas.enabled`; a manual toggle writes `object.enabled` and clears
// the formula. This is what makes template rooms switch-off-able.
export function EnabledField({
  object,
  patch,
}: {
  object: Record<string, unknown>;
  patch: (p: Record<string, unknown>) => void;
}) {
  const formulas = object.formulas as Record<string, string> | undefined;
  const formula = formulas?.enabled;
  const config = useConfigStore((s) => s.config);
  const formulaError = useMemo(() => formulaFieldError(config, formula) ?? undefined, [config, formula]);

  const raw = object.enabled;
  const shown = !(raw === false || raw === 0);

  const withoutFormula = () => {
    const nf = { ...(formulas ?? {}) };
    delete nf.enabled;
    return Object.keys(nf).length > 0 ? nf : undefined;
  };
  const setManual = (checked: boolean) => patch({ enabled: checked, formulas: withoutFormula() });
  const setFormula = (src: string) =>
    src.trim()
      ? patch({ formulas: { ...(formulas ?? {}), enabled: src } })
      : patch({ enabled: shown, formulas: withoutFormula() });

  return (
    <div className="mb-3">
      <label className="mb-0.5 block text-xs font-medium text-slate-300">Enable</label>
      <label className="flex items-center gap-2 text-xs text-slate-200">
        <input
          type="checkbox"
          checked={shown}
          disabled={!!formula}
          onChange={(e) => setManual(e.target.checked)}
          className="h-3.5 w-3.5 accent-emerald-500"
        />
        <span>
          {shown ? "Enabled" : "Disabled"}
          {formula ? " · driven by formula" : ""}
        </span>
      </label>
      <input
        type="text"
        defaultValue={formula ?? ""}
        key={formula ?? ""}
        onBlur={(e) => setFormula(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="or drive by = formula, e.g. = has_pooja"
        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-emerald-500"
      />
      {formulaError && <div className="mt-0.5 text-[10px] text-red-400">{formulaError}</div>}
      <div className="mt-0.5 text-[10px] text-slate-500">
        A disabled object is removed from the model entirely — 2D, 3D, roof, bounds — not just hidden. Drive it by a
        variable (0 = removed, non-zero = kept) for switch-off template rooms.
      </div>
    </div>
  );
}

interface TextFieldProps extends BaseProps {
  value: string | undefined;
  onCommit: (s: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  value,
  onCommit,
  placeholder,
  disabled,
}: TextFieldProps) {
  const [buf, setBuf] = useState<string>(value ?? "");
  const lastOutward = useRef(value);
  useEffect(() => {
    if (value !== lastOutward.current) {
      setBuf(value ?? "");
      lastOutward.current = value;
    }
  }, [value]);
  return (
    <FieldRow label={label} hint={hint} error={error}>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={buf}
        onChange={(e) => setBuf(e.target.value)}
        onBlur={() => {
          onCommit(buf);
          lastOutward.current = buf;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={inputStyle(!!error, !!disabled)}
      />
    </FieldRow>
  );
}

interface SelectFieldProps<T extends string> extends BaseProps {
  value: T | undefined;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
}

export function SelectField<T extends string>({
  label,
  hint,
  error,
  value,
  onChange,
  options,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <FieldRow label={label} hint={hint} error={error}>
      <select
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as T)}
        className={inputStyle(!!error, !!disabled)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

function FieldRow({
  label,
  hint,
  error,
  children,
}: BaseProps & { children: React.ReactNode }) {
  return (
    <label className="mb-2 block">
      <div className="mb-0.5 flex items-baseline gap-2">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
      {error && (
        <div className="mt-0.5 text-[10px] text-red-400">{error}</div>
      )}
    </label>
  );
}

function inputStyle(hasError: boolean, disabled: boolean) {
  return clsx(
    "w-full rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none",
    hasError ? "border-red-500" : "border-slate-700 focus:border-emerald-500",
    disabled && "cursor-not-allowed opacity-60",
  );
}

// Compact section header used inside forms to group related fields.
export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <fieldset className="mb-3 rounded border border-slate-800 bg-slate-900/40 p-2">
      <div className="mb-2 flex items-center justify-between">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </legend>
        {actions}
      </div>
      {children}
    </fieldset>
  );
}

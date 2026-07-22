# Phase 1 — Parametric engine + schema (implementation spec)

Detail for Phase 1 of [`object-relationships-plan.md`](object-relationships-plan.md).
Goal: the config can carry `variables`, `points`, and per-object `formulas`; a single
directional pass resolves them to concrete numbers on every store mutation and on load;
errors surface as non-blocking warnings. **No UI beyond raw JSON in this phase** — the
milestone is a headless-verified engine.

All file paths are under `editor/`.

## Deliverables

1. Schema fields (`src/schema/houseConfig.ts`)
2. Expression evaluator (`src/param/formula.ts`)
3. Resolver (`src/param/resolve.ts`)
4. Store seam — wrap `set` (`src/state/configStore.ts`)
5. Warning channel (reuse the geometry-warning pattern)
6. Tests (`src/param/*.test.ts`) + a headless fixture

## 1. Schema additions — `src/schema/houseConfig.ts`

A value is a formula iff it is a **string starting with `=`**; otherwise a literal
`number`. Encode as a small reusable piece:

```ts
// number literal, or a formula string (must start with "=", validated leniently here;
// the resolver reports evaluation errors, not Zod).
const numOrFormula = z.union([z.number(), z.string()]);
const formulaMap = z.record(z.string(), z.string()); // field name -> "= expr"
```

Top-level (`HouseConfig`, add before `_walls_expanded`):

```ts
variables: z.record(z.string(), numOrFormula).optional(),
points: z.record(z.string(),
  z.object({ x: numOrFormula, y: numOrFormula }).strict()).optional(),
```

Per object: add `formulas: formulaMap.optional()` to **each strict member**
(`floorSlab, pillar, beam, room, wall, staircase, door, windowObj, kitchenPlatform`).
The roof members are `.catchall(z.unknown())` so they already accept it; add it anyway
to `roofV2` for symmetry when we later drive roof footprints. Keep them optional so old
files still pass the `.strict()` load gate (no migration exists).

Mirror the two top-level keys into `schema/house_config.schema.json` (the CI parity
reference), even though the Python builder is retired — the mirror check still runs.

**Note on `numOrFormula` and existing numeric fields:** in Phase 1 the *object* numeric
fields (`x`, `width`, …) stay pure `z.number()`. Formulas for them live only in the
`formulas` map; the numeric field holds the resolved value. So we do **not** widen every
field to `number|string` — `numOrFormula` is only for `variables`/`points` entries,
whose whole purpose is to be authored as formulae.

## 2. Expression evaluator — `src/param/formula.ts`

Pure, dependency-free, no `eval`. Public API:

```ts
export interface Scope { [symbol: string]: number } // resolved variables + "P.x"/"P.y"
export interface EvalResult { value: number | null; error?: string; deps: string[] }

// Parse+evaluate one formula string (with or without the leading "="). `deps` lists
// the symbols it references (used by the resolver for topological ordering), even when
// evaluation fails for another reason.
export function evalFormula(src: string, scope: Scope): EvalResult;

// Dependency extraction only (no scope needed) — used to build the graph before values
// exist. Returns [] on parse error (the error resurfaces at eval time).
export function formulaDeps(src: string): string[];
```

Grammar (recursive-descent or shunting-yard):
- tokens: number literals (`123`, `1.5`), identifiers (`[A-Za-z_][A-Za-z0-9_]*`,
  dotted for point fields: `P_LivingNW.x`), operators `+ - * /`, unary `-`, parens.
- identifiers resolve against `scope`; unknown identifier → `error: "unknown: <name>"`,
  value `null`.
- divide-by-zero → `error`, value `null`. Parse error → `error`, value `null`.
- strip a single leading `=` (and surrounding whitespace) before tokenizing.

Keep it ~150 lines; unit-tested in isolation (§6).

## 3. Resolver — `src/param/resolve.ts`

```ts
export interface FormulaWarning { where: string; formula: string; message: string }
export interface ResolveResult { config: HouseConfig; warnings: FormulaWarning[] }

export function resolveParametric(config: HouseConfig): ResolveResult;
```

Algorithm:
1. **Fast path** — if `config.variables`/`config.points` are absent/empty AND no object
   has a non-empty `formulas`, return `{ config, warnings: [] }` with the **same config
   reference** (zero overhead + no spurious re-render for non-parametric houses).
2. **Build symbol table** — one node per variable (`name`) and per point field
   (`P.x`, `P.y`). Each node's formula = its string value if it starts with `=`, else a
   literal. Compute `deps` via `formulaDeps`.
3. **Topological order** with cycle detection (DFS/Kahn). A node in a cycle → value
   stays at any prior literal or `NaN`, push a warning `where: "variables/<name>"`.
4. **Evaluate symbols** in order into `scope: Scope`. Literals pass through; formula
   nodes call `evalFormula(src, scope)`; error → warning + keep the field's current
   literal value if it had one (else leave the symbol undefined; downstream refs to it
   warn).
5. **Evaluate object formulas** — clone the config; for each floor/object, for each
   `[field, src]` in `formulas`, `evalFormula(src, scope)`; on success write the number
   into `object[field]`; on failure push a warning `where:
   "floor<f>/obj<i>/<field>"` and leave the object's existing numeric value.
6. Return the new (or same, per fast path) config + warnings.

Purity/robustness: never throws (wrap the whole body in try/catch → on unexpected error
return original config + one warning). Idempotent: resolving an already-resolved config
yields identical numbers.

Vertical/`z_offset` unaffected — it's just another numeric field a formula *may* target,
but resolution is orthogonal to the z-band computation downstream.

## 4. Store seam — `src/state/configStore.ts`

Wrap `set` once at the creator entry so **every** mutation (typed actions, `loadConfig`,
`duplicateObject`, external watcher writes) is resolved, and the resolved config lands in
the **same** `set` → one undo snapshot (the 250 ms `handleSet` debounce already coalesces
bursts). Rename the creator's `set` param to `rawSet` and define:

```ts
(rawSet, get) => {
  const set: typeof rawSet = ((partial: unknown, replace?: boolean) => {
    const wrap = (patch: unknown) => {
      if (patch && typeof patch === "object" && "config" in patch &&
          (patch as { config?: unknown }).config) {
        const { config, warnings } = resolveParametric((patch as { config: HouseConfig }).config);
        reportFormulaWarnings(warnings);
        return { ...(patch as object), config };
      }
      return patch;
    };
    return typeof partial === "function"
      ? (rawSet as (p: unknown, r?: boolean) => void)((s: unknown) => wrap((partial as (s: unknown) => unknown)(s)), replace)
      : (rawSet as (p: unknown, r?: boolean) => void)(wrap(partial), replace);
  }) as typeof rawSet;

  return { config: null, /* …all existing actions unchanged, they call `set` … */ };
}
```

Notes:
- Null-config patches (the `if (!config) return state` early returns, selection setters)
  are skipped by the `patch.config` truthiness guard → no behavior change.
- Fast path (§3.1) means non-parametric houses get the same config reference back → no
  extra renders, byte-identical behavior. This is what keeps every existing test green.
- Do **not** touch `handleSet`/`partialize`/`limit`.

## 5. Warning channel

Mirror `three/House3D.tsx::reportGeometryWarnings`: a small
`src/param/warnings.ts::reportFormulaWarnings(warnings)` that stashes on
`window.__formulaWarnings` and dispatches a `wadi-formula-warnings` CustomEvent. In this
phase the viewer need only `console.warn`; wiring a banner is Phase 2. Kept out of the
React render path (same rationale as geometry warnings).

## 6. Tests + headless verification

- `src/param/formula.test.ts` — literals, precedence, parens, unary minus, dotted point
  refs, unknown-identifier error, divide-by-zero, `formulaDeps` extraction, leading `=`.
- `src/param/resolve.test.ts`:
  - variable chain `colB = "= colA + bay"`, `colC = "= colB + bay"` resolves correctly;
  - a cycle (`a = "= b"`, `b = "= a"`) → warning, no throw;
  - object field formula writes the resolved number; bad ref → warning + field unchanged;
  - **fast path returns the same reference** for a config with no parametric content;
  - idempotence: `resolve(resolve(x)) === resolve(x)` numerically.
- **Headless fixture** — the two-adjacent-rooms example from the plan (§10) as a JSON
  fixture; assert Dining.x === Living.x + Living.width after resolve, and that changing
  `bay` (re-resolve) moves+resizes both. Optionally render it through
  `scripts/gen-composite.ts` to eyeball the plan.
- `npm test` (full suite) + `npm run parity-all` must stay green — the fast path
  guarantees non-parametric output is unchanged.

## 7. Out of scope (confirmed deferred)

Object-to-object formula refs (`Living.x`) and any stable object `id`; the 9 control
points; the smart `=`-aware form field and Variables/Points panels (Phase 2);
meta-functions and grid drawing (Phase 3). Phase 1 authors variables/points/formulas by
hand-editing JSON.

## 8. Risks

- **TS typing of the wrapped `set`** against zundo's signature — resolved with a
  localized cast (above); no runtime cost.
- **Missed mutation path** — mitigated by wrapping at the single `set` seam rather than
  per-action.
- **Spurious re-renders** — mitigated by the fast-path same-reference return.
- **Formula ambiguity** (is `"north"` a formula?) — no: only strings starting with `=`
  are formulas; a plain string in a `numOrFormula` slot that isn't `=`-prefixed is a
  user error we warn on (it won't parse as a number).

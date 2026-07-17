// Kitchen platform editor — polyline path along a wall base, with
// depth (perpendicular extent from wall into the room) + height
// (vertical extent above the floor slab) + `side` picking which
// side of each segment's direction the platform extends.

import type { HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, TextField, SelectField, Section } from "./fields";

type KP = Extract<HouseObject, { type: "kitchen_platform" }>;

export function KitchenPlatformForm({
  obj,
  selection,
}: {
  obj: KP;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<KP>) => replace(selection, { ...obj, ...next });

  const path = obj.path;

  const updatePoint = (i: number, coord: 0 | 1, v: number | undefined): void => {
    if (v === undefined) return;
    const next = path.map((p, idx) =>
      idx === i ? ([coord === 0 ? v : p[0], coord === 1 ? v : p[1]] as [number, number]) : p,
    );
    patch({ path: next });
  };

  const addPoint = (): void => {
    const last = path[path.length - 1];
    const second = path[path.length - 2] ?? [last[0] - 100, last[1]];
    // New point continues in the same direction as the last segment
    // for one segment's length, so it visibly extends the run.
    const dx = last[0] - second[0];
    const dy = last[1] - second[1];
    const len = Math.hypot(dx, dy) || 100;
    const ux = dx / len, uy = dy / len;
    patch({
      path: [...path, [last[0] + ux * 100, last[1] + uy * 100] as [number, number]],
    });
  };

  const removePoint = (i: number): void => {
    if (path.length <= 2) return;   // need at least 2 for a segment
    patch({ path: path.filter((_, idx) => idx !== i) });
  };

  return (
    <div>
      <Section title="Identity">
        <TextField
          label="Name"
          value={obj.name ?? ""}
          onCommit={(v) => patch({ name: v || undefined })}
        />
      </Section>

      <Section title="Dimensions">
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Depth (from wall)"
            hint="Perpendicular extent into the room"
            value={obj.depth}
            onCommit={(v) => v !== undefined && patch({ depth: v })}
            min={0.01}
          />
          <NumberField
            label="Height (above floor)"
            value={obj.height}
            onCommit={(v) => v !== undefined && patch({ height: v })}
            min={0.01}
          />
        </div>
        <SelectField
          label="Extend to which side of path?"
          hint='"left" = +90° CCW from path direction. Flip if the platform is coming out the wrong side of the wall.'
          value={obj.side}
          onChange={(v) => patch({ side: v as "left" | "right" })}
          options={[
            { value: "left",  label: "left  (+90° CCW from start→end)" },
            { value: "right", label: "right (-90°)" },
          ]}
        />
        <NumberField
          label="Base Z (override)"
          hint="Optional. Empty = sits on top of the floor's slab. Non-zero raises it (e.g. for a mezzanine platform)."
          value={obj.base_z}
          onCommit={(v) => patch({ base_z: v })}
          allowEmpty
        />
      </Section>

      <Section title="Path (polyline along wall base)">
        <div className="mb-2 text-[11px] text-slate-400">
          Each point is a corner in the wall the platform hugs. Straight
          run = 2 points; L-shape = 3; U-shape = 4. Add / remove points
          below.
        </div>
        <div className="space-y-1">
          {path.map((pt, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
              <div className="text-[11px] text-slate-500 pb-1">P{i + 1}</div>
              <NumberField
                label={i === 0 ? "X" : undefined}
                value={pt[0]}
                onCommit={(v) => updatePoint(i, 0, v)}
              />
              <NumberField
                label={i === 0 ? "Y" : undefined}
                value={pt[1]}
                onCommit={(v) => updatePoint(i, 1, v)}
              />
              <button
                type="button"
                onClick={() => removePoint(i)}
                disabled={path.length <= 2}
                className="text-[11px] px-2 py-1 rounded bg-rose-900 hover:bg-rose-800 text-white disabled:opacity-30"
              >
                −
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addPoint}
          className="mt-2 text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
        >
          + Add point
        </button>
      </Section>
    </div>
  );
}

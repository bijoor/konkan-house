import type { Wall, Opening, Side } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, SelectField, TextField, Section } from "./fields";

const SIDES: Side[] = ["north", "south", "east", "west"];
const KINDS = [
  { value: "door" as const, label: "Door" },
  { value: "window" as const, label: "Window" },
];

export function WallForm({ wall, selection }: { wall: Wall; selection: Selection }) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<Wall>) => replace(selection, { ...wall, ...next });

  const dx = wall.end_x - wall.start_x;
  const dy = wall.end_y - wall.start_y;
  const wallLength = Math.hypot(dx, dy);
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  const defaultFacing: Side = isHorizontal ? "north" : "east";

  const addOpening = (kind: "door" | "window") => {
    const openings = [
      ...(wall.openings ?? []),
      {
        kind,
        offset: 0,
        width: kind === "door" ? 30 : 40,
        height: kind === "door" ? 65 : 40,
        ...(kind === "window" ? { sill_height: 25 } : {}),
      },
    ];
    patch({ openings });
  };

  const updateOpening = (i: number, next: Partial<Opening>) => {
    const openings = [...(wall.openings ?? [])];
    openings[i] = { ...openings[i], ...next };
    patch({ openings });
  };

  const deleteOpening = (i: number) => {
    const openings = (wall.openings ?? []).filter((_, idx) => idx !== i);
    patch({ openings });
  };

  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={wall.name} onCommit={(v) => patch({ name: v })} />
        <TextField
          label="Material"
          value={wall.material}
          onCommit={(v) => patch({ material: v || undefined })}
        />
      </Section>

      <Section title="Endpoints">
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="Start X" value={wall.start_x} onCommit={(v) => v !== undefined && patch({ start_x: v })} />
          <NumberField label="Start Y" value={wall.start_y} onCommit={(v) => v !== undefined && patch({ start_y: v })} />
          <NumberField label="End X" value={wall.end_x} onCommit={(v) => v !== undefined && patch({ end_x: v })} />
          <NumberField label="End Y" value={wall.end_y} onCommit={(v) => v !== undefined && patch({ end_y: v })} />
        </div>
        <div className="text-[10px] text-slate-500">
          Length {wallLength.toFixed(1)} · {isHorizontal ? "E–W" : "N–S"}
        </div>
      </Section>

      <Section title="Height & orientation">
        <NumberField label="Height" value={wall.height} onCommit={(v) => patch({ height: v })} allowEmpty />
        <NumberField
          label="Height end"
          value={wall.height_end}
          onCommit={(v) => patch({ height_end: v })}
          allowEmpty
          hint="sloping wall — height at end"
        />
        <NumberField
          label="Z offset"
          value={wall.z_offset}
          onCommit={(v) => patch({ z_offset: v })}
          allowEmpty
          hint="above floor base (10u=1ft); blank = on slab"
        />
        <SelectField
          label="Facing"
          hint={`default: ${defaultFacing}`}
          value={wall.facing ?? defaultFacing}
          onChange={(v) => patch({ facing: v as Side })}
          options={SIDES.map((s) => ({ value: s, label: s }))}
        />
      </Section>

      <Section
        title="Openings"
        actions={
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => addOpening("door")}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
            >
              + Door
            </button>
            <button
              type="button"
              onClick={() => addOpening("window")}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
            >
              + Window
            </button>
          </div>
        }
      >
        {(wall.openings ?? []).length === 0 && (
          <div className="text-[11px] text-slate-500">No openings yet.</div>
        )}
        {(wall.openings ?? []).map((op, i) => (
          <div key={i} className="mb-1 rounded bg-slate-900 p-2">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>
                <span className="capitalize">{op.kind}</span>
                {op.name ? ` · ${op.name}` : ""}
              </span>
              <button
                type="button"
                onClick={() => deleteOpening(i)}
                className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-red-300 hover:bg-red-900"
              >
                Delete
              </button>
            </div>
            <TextField label="Name" value={op.name} onCommit={(v) => updateOpening(i, { name: v || undefined })} />
            <SelectField
              label="Kind"
              value={op.kind}
              onChange={(v) => updateOpening(i, { kind: v })}
              options={KINDS}
            />
            <div className="grid grid-cols-2 gap-x-2">
              <NumberField
                label="Offset"
                value={op.offset}
                onCommit={(v) => v !== undefined && updateOpening(i, { offset: v })}
                min={0}
                max={wallLength}
              />
              <NumberField
                label="Width"
                value={op.width}
                onCommit={(v) => v !== undefined && updateOpening(i, { width: v })}
                min={0.01}
              />
              <NumberField
                label="Height"
                value={op.height}
                onCommit={(v) => v !== undefined && updateOpening(i, { height: v })}
                min={0.01}
              />
              {op.kind === "window" && (
                <NumberField
                  label="Sill height"
                  value={op.sill_height}
                  onCommit={(v) => updateOpening(i, { sill_height: v })}
                  min={0}
                  allowEmpty
                />
              )}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

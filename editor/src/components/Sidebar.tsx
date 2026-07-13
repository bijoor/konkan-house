import { useState } from "react";
import clsx from "clsx";
import { useConfigStore } from "../state/configStore";
import type { HouseObject } from "../schema/houseConfig";

// Order used to group the object tree so it's easier to scan by category.
const TYPE_ORDER: HouseObject["type"][] = [
  "floor_slab",
  "beam",
  "pillar",
  "room",
  "wall",
  "staircase",
  "door",
  "window",
  "hip_roof",
  "gable_roof",
];

const TYPE_LABEL: Record<HouseObject["type"], string> = {
  floor_slab: "Floor slabs",
  beam: "Beams",
  pillar: "Pillars",
  room: "Rooms",
  wall: "Walls",
  staircase: "Staircases",
  door: "Doors (flat)",
  window: "Windows (flat)",
  hip_roof: "Hip roofs",
  gable_roof: "Gable roofs",
};

function objectLabel(obj: HouseObject, index: number): string {
  const named = obj as { name?: string };
  return named.name ?? `${obj.type} #${index}`;
}

export function Sidebar() {
  const config = useConfigStore((s) => s.config);
  const selection = useConfigStore((s) => s.selection);
  const select = useConfigStore((s) => s.select);
  const [activeFloor, setActiveFloor] = useState(0);

  if (!config) {
    return (
      <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Load a <code className="rounded bg-slate-800 px-1">house_config.json</code>{" "}
        to begin.
      </aside>
    );
  }

  const floor = config.floors[activeFloor];
  const grouped = new Map<HouseObject["type"], { obj: HouseObject; idx: number }[]>();
  floor.objects.forEach((obj, idx) => {
    const bucket = grouped.get(obj.type) ?? [];
    bucket.push({ obj, idx });
    grouped.set(obj.type, bucket);
  });

  return (
    <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900">
      <nav className="flex border-b border-slate-800">
        {config.floors.map((f, i) => (
          <button
            key={f.floor_number}
            type="button"
            onClick={() => setActiveFloor(i)}
            className={clsx(
              "flex-1 border-r border-slate-800 px-2 py-2 text-xs last:border-r-0",
              i === activeFloor
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:bg-slate-800/50",
            )}
          >
            {f.name.replace(/floor/i, "").trim() || `Floor ${f.floor_number}`}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-2 text-sm">
        {TYPE_ORDER.filter((t) => grouped.has(t)).map((type) => (
          <details key={type} open className="mb-1">
            <summary className="cursor-pointer rounded px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-800">
              {TYPE_LABEL[type]} · {grouped.get(type)!.length}
            </summary>
            <ul className="ml-2 border-l border-slate-800">
              {grouped.get(type)!.map(({ obj, idx }) => {
                const isSelected =
                  selection?.floor === activeFloor && selection?.object === idx;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => select({ floor: activeFloor, object: idx })}
                      className={clsx(
                        "block w-full truncate px-2 py-1 text-left text-xs",
                        isSelected
                          ? "bg-emerald-600/30 text-emerald-200"
                          : "text-slate-300 hover:bg-slate-800",
                      )}
                      title={objectLabel(obj, idx)}
                    >
                      {objectLabel(obj, idx)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </aside>
  );
}

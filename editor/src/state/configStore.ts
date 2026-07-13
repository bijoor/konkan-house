import { create } from "zustand";
import { temporal } from "zundo";
import type { HouseConfig, HouseObject } from "../schema/houseConfig";

// Identity of the currently-selected object in the sidebar tree. `floor`
// is the index into HOUSE_CONFIG.floors; `object` is the index into that
// floor's objects array. `null` means nothing selected.
export interface Selection {
  floor: number;
  object: number;
}

interface ConfigState {
  config: HouseConfig | null;
  filename: string | null;
  selection: Selection | null;
  validationErrors: { path: string; message: string }[];
  dirty: boolean;

  loadConfig: (config: HouseConfig, filename?: string) => void;
  clearConfig: () => void;
  select: (sel: Selection | null) => void;

  // Object mutations — all bump `dirty` and are captured by the
  // temporal middleware so Cmd/Ctrl+Z rewinds them.
  updateObject: (sel: Selection, patch: Partial<HouseObject>) => void;
  replaceObject: (sel: Selection, next: HouseObject) => void;
  deleteObject: (sel: Selection) => void;
  duplicateObject: (sel: Selection) => Selection | null;
  insertObject: (floor: number, obj: HouseObject) => Selection;

  setValidationErrors: (errs: { path: string; message: string }[]) => void;
}

// Actions in this set do NOT participate in undo history — they'd
// otherwise pollute Cmd+Z with load events / selection moves / validator
// runs. Only the config-mutating ops are captured.
const NON_TRACKED_KEYS = new Set<keyof ConfigState>([
  "filename",
  "selection",
  "validationErrors",
]);

export const useConfigStore = create<ConfigState>()(
  temporal(
    (set) => ({
      config: null,
      filename: null,
      selection: null,
      validationErrors: [],
      dirty: false,

      loadConfig: (config, filename) => {
        set({
          config,
          filename: filename ?? null,
          selection: null,
          validationErrors: [],
          dirty: false,
        });
        // Fresh load ⇒ clear undo history so Cmd+Z can't undo past
        // the load boundary into a previous file's state.
        useConfigStore.temporal.getState().clear();
      },

      clearConfig: () => {
        set({
          config: null,
          filename: null,
          selection: null,
          validationErrors: [],
          dirty: false,
        });
        useConfigStore.temporal.getState().clear();
      },

      select: (sel) => set({ selection: sel }),

      updateObject: (sel, patch) =>
        set((state) => {
          if (!state.config) return state;
          return {
            config: mutateObject(state.config, sel, (o) => ({
              ...o,
              ...patch,
            }) as HouseObject),
            dirty: true,
          };
        }),

      replaceObject: (sel, next) =>
        set((state) => {
          if (!state.config) return state;
          return {
            config: mutateObject(state.config, sel, () => next),
            dirty: true,
          };
        }),

      deleteObject: (sel) =>
        set((state) => {
          if (!state.config) return state;
          const floors = state.config.floors.map((f, fi) => {
            if (fi !== sel.floor) return f;
            return {
              ...f,
              objects: f.objects.filter((_, oi) => oi !== sel.object),
            };
          });
          const nextSel = pickNearestSelection(state.config, sel);
          return {
            config: { ...state.config, floors },
            selection: nextSel,
            dirty: true,
          };
        }),

      duplicateObject: (sel) => {
        let newSel: Selection | null = null;
        set((state) => {
          if (!state.config) return state;
          const src = state.config.floors[sel.floor]?.objects[sel.object];
          if (!src) return state;
          const copy = structuredClone(src) as HouseObject;
          // Bump the name if it has one, otherwise leave the type alone.
          if ("name" in copy && typeof copy.name === "string") {
            copy.name = uniqueName(state.config, sel.floor, copy.name);
          }
          const floors = state.config.floors.map((f, fi) => {
            if (fi !== sel.floor) return f;
            const objects = [...f.objects];
            objects.splice(sel.object + 1, 0, copy);
            return { ...f, objects };
          });
          newSel = { floor: sel.floor, object: sel.object + 1 };
          return {
            config: { ...state.config, floors },
            selection: newSel,
            dirty: true,
          };
        });
        return newSel;
      },

      insertObject: (floor, obj) => {
        let sel: Selection = { floor, object: 0 };
        set((state) => {
          if (!state.config) return state;
          const floors = state.config.floors.map((f, fi) => {
            if (fi !== floor) return f;
            return { ...f, objects: [...f.objects, obj] };
          });
          sel = { floor, object: floors[floor].objects.length - 1 };
          return {
            config: { ...state.config, floors },
            selection: sel,
            dirty: true,
          };
        });
        return sel;
      },

      setValidationErrors: (validationErrors) => set({ validationErrors }),
    }),
    {
      // Only diff the `config` field for undo history — other state
      // (selection, validation, filename) is ephemeral and shouldn't
      // create undo entries.
      partialize: (state) => ({ config: state.config }),
      // Debounce rapid same-field edits so a single "typing" session
      // is one undo step, not one per keystroke.
      handleSet: (handleSet) => {
        let t: ReturnType<typeof setTimeout> | null = null;
        return (...args: unknown[]) => {
          if (t) clearTimeout(t);
          t = setTimeout(() => {
            (handleSet as (...a: unknown[]) => void)(...args);
            t = null;
          }, 250);
        };
      },
      limit: 100,
    },
  ),
);

// Read-only selectors used across components.
export const selectSelectedObject = (state: ConfigState): HouseObject | null => {
  if (!state.config || !state.selection) return null;
  return (
    state.config.floors[state.selection.floor]?.objects[state.selection.object] ??
    null
  );
};

// ---- helpers -------------------------------------------------------

function mutateObject(
  config: HouseConfig,
  sel: Selection,
  updater: (o: HouseObject) => HouseObject,
): HouseConfig {
  return {
    ...config,
    floors: config.floors.map((f, fi) => {
      if (fi !== sel.floor) return f;
      return {
        ...f,
        objects: f.objects.map((o, oi) => (oi === sel.object ? updater(o) : o)),
      };
    }),
  };
}

function pickNearestSelection(
  config: HouseConfig,
  removed: Selection,
): Selection | null {
  const floor = config.floors[removed.floor];
  if (!floor) return null;
  const newLen = floor.objects.length - 1;
  if (newLen <= 0) return null;
  return {
    floor: removed.floor,
    object: Math.min(removed.object, newLen - 1),
  };
}

function uniqueName(
  config: HouseConfig,
  floorIdx: number,
  base: string,
): string {
  const existing = new Set<string>();
  for (const o of config.floors[floorIdx]?.objects ?? []) {
    const n = (o as { name?: string }).name;
    if (typeof n === "string") existing.add(n);
  }
  let attempt = `${base}_copy`;
  let i = 2;
  while (existing.has(attempt)) attempt = `${base}_copy${i++}`;
  return attempt;
}

// Convenience hooks for temporal state (used by the undo/redo shortcut
// handler and the top-bar undo/redo buttons).
NON_TRACKED_KEYS satisfies Set<keyof ConfigState>;

// Live config watcher — the "Claude as editor" half of the Phase 2
// live-preview loop (see plans/claude-skill-plan.md).
//
// When something OUTSIDE the app rewrites the house config on disk
// (Claude Code editing the file, an MCP server, a manual save from
// another tool), this watcher notices and reloads the model so the
// Tauri window updates without any user action.
//
// Strictly event-driven — no polling anywhere. We attach the fs
// plugin's native `watch()` (backed by the OS's file-change
// notifications via the Rust `notify` crate) to the absolute path of
// the file the user opened via the native Load dialog (`filePath`).
// Works in BOTH `tauri dev` and the installed/DMG app: whoever edits
// the config writes THIS path, and the OS pushes us an event.
//
// NOTE: the native `watch()`/`unwatch()` commands only exist when the
// `tauri-plugin-fs` crate is built with its `watch` feature enabled
// (see src-tauri/Cargo.toml). Without it, `watch()` rejects with
// "Command watch not found" and live reload silently no-ops.
//
// The startup model is auto-loaded over HTTP with no `filePath` (see
// main.ts). That is a ONE-SHOT read and is intentionally NOT watched:
// there is no local file handle behind an `http://…/house_config.json`
// URL to attach `notify` to, and polling it was just dead weight (a
// no-op against the frozen bundle in the installed app). To get live
// reloads, open the working file via Load — that sets `filePath` and
// this watcher attaches a native watch to it.
//
// Only runs inside Tauri; in a plain browser tab there's no local file
// to watch and fetch already returns the served copy.

import { isTauri } from "@tauri-apps/api/core";
import { readTextFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { useConfigStore } from "../state/configStore";
import { validate } from "../schema/houseConfig";
import { serializeConfig } from "../io/fileIO";

const WATCH_DEBOUNCE_MS = 300;

export function startConfigWatcher(): void {
  // In a plain browser the fs plugin isn't available and there's no
  // external file to reconcile against — the served copy IS the source.
  if (!isTauri()) return;

  // Last raw text we've seen on disk. Used to skip the expensive
  // parse+validate when a change event fires but the bytes are
  // unchanged. Reset to null whenever the watched target changes so the
  // new target is read fresh.
  let lastSeen: string | null = null;
  let inFlight = false;
  // A change event that arrives while a read is still in flight sets
  // this so we re-read once the current read settles — without it, the
  // final write in a rapid burst could be dropped (no next poll to
  // self-correct in a pure event-driven model).
  let pending = false;
  let unwatch: UnwatchFn | null = null;

  const applyText = (path: string, text: string): void => {
    if (text === lastSeen) return; // unchanged since last read
    lastSeen = text;

    const state = useConfigStore.getState();

    // Skip reloads triggered by the app's OWN save: if the on-disk
    // text already matches what we'd serialize from the current
    // config, there's nothing external to apply. (Without this, an
    // in-app Save would bounce back through the watcher and wipe the
    // selection + undo history for no reason.)
    if (state.config && text.trim() === serializeConfig(state.config).trim()) {
      return;
    }

    // The file may be caught mid-write (partial JSON) or hold an
    // intermediate state that doesn't validate yet. In both cases we
    // skip this revision and wait for the next change rather than
    // flashing a broken model — matches the plan's "ignore invalid
    // intermediate states" rule.
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      console.warn("[watch] config not parseable yet; waiting for next write");
      return;
    }
    const parsed = validate(raw);
    if (!parsed.ok || !parsed.data) {
      console.warn(
        "[watch] external config failed validation; keeping current model",
        parsed.errors,
      );
      return;
    }

    console.info("[watch] external config change → reloading model");
    useConfigStore
      .getState()
      .loadConfig(parsed.data, state.filename ?? "house_config.json", path);
  };

  const readAndApply = async (path: string): Promise<void> => {
    if (inFlight) {
      // A read is already running; remember to re-read after it settles
      // so we never miss the latest write in a burst.
      pending = true;
      return;
    }
    inFlight = true;
    try {
      const text = await readTextFile(path);
      applyText(path, text);
    } catch (e) {
      // Transient read errors (file briefly missing during an atomic
      // rename). Stay quiet-ish; the next change event will retry.
      console.warn(
        "[watch] read error (transient?):",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      inFlight = false;
      if (pending) {
        pending = false;
        void readAndApply(path);
      }
    }
  };

  const stopWatching = (): void => {
    if (unwatch) {
      unwatch();
      unwatch = null;
    }
  };

  const applyTarget = (path: string | null): void => {
    stopWatching();
    lastSeen = null;
    pending = false;

    // No file open → nothing to watch. The startup model is auto-loaded
    // over HTTP (no filePath) and is intentionally left static; open a
    // file via Load to get live, event-driven reloads.
    if (!path) return;

    void watch(path, () => void readAndApply(path), { delayMs: WATCH_DEBOUNCE_MS })
      .then((stop) => {
        unwatch = stop;
      })
      .catch((e) => {
        // Native watch couldn't start (e.g. the plugin's `watch` feature
        // isn't compiled in, or an unsupported filesystem). We do NOT
        // fall back to polling — the model stays on its last-loaded
        // state until you reload it. Surfaced here so the silence has an
        // explanation rather than looking like a bug.
        console.warn(
          "[watch] native watch failed to start; live reload disabled for",
          path,
          e instanceof Error ? e.message : String(e),
        );
      });
  };

  let watchedPath = useConfigStore.getState().filePath;
  applyTarget(watchedPath);

  // If the user opens a different file (filePath changes), tear down
  // the current watcher and re-attach to the new target.
  useConfigStore.subscribe((state) => {
    if (state.filePath !== watchedPath) {
      watchedPath = state.filePath;
      applyTarget(watchedPath);
    }
  });

  console.info(
    "[watch] live config watcher started (native fs watch, event-driven, " +
      "no polling). Open your working house_config.json via Load to watch " +
      "an external file.",
  );
}

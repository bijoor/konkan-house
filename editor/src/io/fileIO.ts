import { validate, type HouseConfig } from "../schema/houseConfig";

// Prompt the user for a .json file and return the parsed + validated
// HouseConfig. Rejects with a plain-string error if the JSON is malformed
// or fails schema validation; the caller shows it in a toast/banner.
export async function pickAndLoadConfig(): Promise<{
  config: HouseConfig;
  filename: string;
}> {
  const file = await pickJsonFile();
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const result = validate(parsed);
  if (!result.ok || !result.data) {
    const errList = (result.errors ?? []).slice(0, 5);
    const details = errList.map((e) => `  /${e.path}: ${e.message}`).join("\n");
    throw new Error(
      `Config failed schema validation (${result.errors?.length} error${
        result.errors?.length === 1 ? "" : "s"
      }):\n${details}${
        (result.errors?.length ?? 0) > errList.length ? "\n  …" : ""
      }`,
    );
  }
  return { config: result.data, filename: file.name };
}

function pickJsonFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      resolve(file);
    });
    input.addEventListener("cancel", () => reject(new Error("Cancelled")));
    input.click();
  });
}

// Trigger a browser download of the current config as JSON. Uses the
// same 2-space indent + trailing newline the Python extractor emits so
// diffs against the repo copy stay clean.
export function downloadConfig(config: HouseConfig, filename = "house_config.json") {
  // Strip the runtime-only marker before saving; users editing on disk
  // shouldn't see internal flags.
  const clean = { ...config };
  delete (clean as { _walls_expanded?: boolean })._walls_expanded;
  const text = JSON.stringify(clean, null, 2) + "\n";
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on a delay so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

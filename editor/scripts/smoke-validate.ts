// One-shot: parse the repo's canonical house_config.json through the
// editor's Zod schema. Prints ✓ or the first few errors. Wire this into
// `npm test` once the editor has a real test runner.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { validate } from "../src/schema/houseConfig";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const configPath = path.resolve(here, "../../house_config.json");
const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
const result = validate(parsed);
if (result.ok) {
  const nObjects = result.data!.floors.reduce(
    (s, f) => s + f.objects.length,
    0,
  );
  console.log(
    `✓ ${path.relative(process.cwd(), configPath)} parses cleanly ` +
      `(${result.data!.floors.length} floors, ${nObjects} objects)`,
  );
} else {
  console.log(`✗ ${result.errors?.length} validation errors:`);
  for (const e of result.errors ?? []) {
    console.log(`  /${e.path}: ${e.message}`);
  }
  process.exit(1);
}

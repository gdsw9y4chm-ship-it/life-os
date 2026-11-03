import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectDatabase } from "../src/db/connection";
import { migrate } from "../src/db/migrate";
import { seedJade } from "../src/db/seed";

// Browser tests get a fresh database; never reuse the developer's profile.
const directory = mkdtempSync(join(tmpdir(), "life-os-browser-"));
const path = join(directory, "test.sqlite");
const db = connectDatabase(path);
migrate(db);
seedJade(db);
db.close();
const child = Bun.spawn(
  [
    process.execPath,
    "--bun",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    "3100",
    "--strictPort",
  ],
  {
    env: { ...process.env, NODE_ENV: "development", LIFE_OS_DB_PATH: path },
    stdout: "inherit",
    stderr: "inherit",
  },
);
process.on("SIGTERM", () => child.kill());
process.on("SIGINT", () => child.kill());
try {
  process.exitCode = await child.exited;
} finally {
  rmSync(directory, { recursive: true, force: true });
}

import {
  mkdtempSync,
  realpathSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
const marker = "Life OS isolated Playwright database";
export function createBrowserDirectory() {
  const directory = mkdtempSync(
    join(realpathSync(tmpdir()), "life-os-browser-"),
  );
  writeFileSync(join(directory, ".browser-test"), marker);
  return directory;
}
export function browserDatabasePath() {
  const directory = process.env.LIFE_OS_BROWSER_DIR;
  if (!directory)
    throw new Error("An explicit isolated browser directory is required.");
  const real = realpathSync(directory);
  if (
    dirname(real) !== realpathSync(tmpdir()) ||
    !basename(real).startsWith("life-os-browser-") ||
    readFileSync(join(real, ".browser-test"), "utf8") !== marker
  )
    throw new Error("Refusing to alter a non-browser-test database.");
  return join(real, "test.sqlite");
}

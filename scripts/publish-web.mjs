/**
 * Copy the static House pages into public/ as regular files.
 * Vercel does not serve symlinks that point out of public/, so the
 * deployed site 404s when these assets are only links back to web/.
 */
import { copyFile, lstat, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLISHED_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs"]);

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isPublishedWebAsset(name) {
  if (name.endsWith(".test.mjs") || name.endsWith(".test.js")) return false;
  return PUBLISHED_EXTENSIONS.has(path.extname(name));
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isEnoent(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

/**
 * @param {string} webDir
 * @param {string} publicDir
 * @returns {Promise<string[]>}
 */
export async function publishWebAssets(webDir, publicDir) {
  const names = (await readdir(webDir)).filter(isPublishedWebAsset).sort();
  for (const name of names) {
    const src = path.join(webDir, name);
    const dest = path.join(publicDir, name);
    let existing = null;
    try {
      existing = await lstat(dest);
    } catch (error) {
      if (!isEnoent(error)) {
        console.error("publish web asset stat failed", { dest, error });
        throw error;
      }
    }
    if (existing?.isSymbolicLink()) {
      try {
        await unlink(dest);
      } catch (error) {
        console.error("publish web asset unlink failed", { dest, error });
        throw error;
      }
    }
    try {
      await copyFile(src, dest);
    } catch (error) {
      console.error("publish web asset copy failed", { src, dest, error });
      throw error;
    }
  }
  return names;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const published = await publishWebAssets(path.join(root, "web"), path.join(root, "public"));
    console.log(`published ${published.length} web assets into public/`);
  } catch (error) {
    console.error("publish web assets failed", { error });
    process.exitCode = 1;
  }
}

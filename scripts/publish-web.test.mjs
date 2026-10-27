import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isPublishedWebAsset, publishWebAssets } from "./publish-web.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("isPublishedWebAsset keeps pages and theme files, skips tests", () => {
  assert.equal(isPublishedWebAsset("the-house.html"), true);
  assert.equal(isPublishedWebAsset("theme.css"), true);
  assert.equal(isPublishedWebAsset("theme.js"), true);
  assert.equal(isPublishedWebAsset("auth-bar.mjs"), true);
  assert.equal(isPublishedWebAsset("theme.test.mjs"), false);
  assert.equal(isPublishedWebAsset("notes.md"), false);
});

test("publishWebAssets replaces a public symlink with a regular file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "publish-web-"));
  const webDir = path.join(root, "web");
  const publicDir = path.join(root, "public");
  await mkdir(webDir);
  await mkdir(publicDir);
  const source = path.join(webDir, "the-house.html");
  const dest = path.join(publicDir, "the-house.html");
  await writeFile(source, "<p>house</p>");
  await symlink(path.join("..", "web", "the-house.html"), dest);
  await writeFile(path.join(webDir, "theme.test.mjs"), "test");

  const published = await publishWebAssets(webDir, publicDir);

  assert.deepEqual(published, ["the-house.html"]);
  const linked = await lstat(dest);
  assert.equal(linked.isSymbolicLink(), false);
  assert.equal(linked.isFile(), true);
  assert.equal(await readFile(source, "utf8"), "<p>house</p>");
  assert.equal(await readFile(dest, "utf8"), "<p>house</p>");
  await assert.rejects(lstat(path.join(publicDir, "theme.test.mjs")));
});

test("committed public pages are regular files matching web/", async () => {
  const names = (await readdir(path.join(repoRoot, "web"))).filter(isPublishedWebAsset);
  assert.ok(names.includes("the-house.html"));
  for (const name of names) {
    const webPath = path.join(repoRoot, "web", name);
    const publicPath = path.join(repoRoot, "public", name);
    const stat = await lstat(publicPath);
    assert.equal(stat.isSymbolicLink(), false, `${name} is a symlink Vercel will not serve`);
    assert.equal(stat.isFile(), true, name);
    const source = await readFile(webPath);
    const published = await readFile(publicPath);
    assert.equal(published.equals(source), true, name);
  }
});

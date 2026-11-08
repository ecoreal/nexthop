import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.js");

function fixtureHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nh-e2e-"));
  const cdir = path.join(home, ".claude", "projects", "-tmp-proj");
  fs.mkdirSync(cdir, { recursive: true });
  const lines = [
    JSON.stringify({ type: "user", timestamp: "2026-11-09T10:00:00Z", cwd: "/tmp/proj", message: { content: "Refactor the exporter module" } }),
    JSON.stringify({ type: "assistant", timestamp: "2026-11-09T10:01:00Z", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "/tmp/proj/src/export.js" } }] } }),
    JSON.stringify({ type: "assistant", timestamp: "2026-11-09T10:02:00Z", message: { content: [{ type: "text", text: "Exporter rewritten, 31/31 tests pass." }] } }),
  ];
  fs.writeFileSync(path.join(cdir, "e2e-01.jsonl"), lines.join("\n") + "\n");
  return { home, cwd: "/tmp/proj" };
}

const run = (args) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("list finds the session and marks cwd matches", () => {
  const { home, cwd } = fixtureHome();
  const r = run(["list", "--home", home, "--cwd", cwd, "--no-color"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("可交接"));
  assert.ok(r.stdout.includes("Refactor the exporter module"));
  assert.ok(r.stdout.includes("Claude Code"));
});

test("handoff writes HANDOFF.md into cwd; refuses overwrite without --force", () => {
  const { home, cwd } = fixtureHome();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "nh-work-"));
  const r1 = run(["handoff", "--home", home, "--cwd", cwd, "--out", path.join(work, "HANDOFF.md"), "--no-color"]);
  assert.equal(r1.status, 0, r1.stderr);
  const md = fs.readFileSync(path.join(work, "HANDOFF.md"), "utf8");
  assert.ok(md.includes("## Goal"));
  assert.ok(md.includes("Refactor the exporter module"));
  assert.ok(md.includes("src/export.js"));
  assert.ok(md.includes("claude --resume"));
  // second run without --force must refuse and keep the file intact
  const r2 = run(["handoff", "--home", home, "--cwd", cwd, "--out", path.join(work, "HANDOFF.md"), "--no-color"]);
  assert.equal(r2.status, 1);
  assert.ok(r2.stderr.includes("--force"));
  assert.ok(fs.readFileSync(path.join(work, "HANDOFF.md"), "utf8").includes("Refactor"));
  // --force overwrites
  const r3 = run(["handoff", "--home", home, "--cwd", cwd, "--out", path.join(work, "HANDOFF.md"), "--force", "--no-color"]);
  assert.equal(r3.status, 0);
});

test("show prints the handoff document to stdout", () => {
  const { home } = fixtureHome();
  const r = run(["show", "e2e-01", "--home", home, "--no-color"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("## Where it stands"));
  assert.ok(r.stdout.includes("31/31 tests pass"));
});

test("handoff with no matching cwd falls back to latest with a note", () => {
  const { home } = fixtureHome();
  const r = run(["handoff", "--home", home, "--cwd", "/elsewhere", "--out", path.join(os.tmpdir(), "nh-fb.md"), "--force", "--no-color"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("最近一次"));
});

test("--version and empty home", () => {
  assert.equal(run(["--version"]).status, 0);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "nh-empty-"));
  const r = run(["list", "--home", empty, "--no-color"]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("未发现任何会话"));
});

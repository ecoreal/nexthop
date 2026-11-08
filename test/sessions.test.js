import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adaptersFor, listSessions, pickSession } from "../src/sessions.js";

const b64 = (s) => Buffer.from(s, "utf8");

function fixtureHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nh-home-"));
  // claude-code session: goal → edits → status
  const cdir = path.join(home, ".claude", "projects", "-tmp-proj");
  fs.mkdirSync(cdir, { recursive: true });
  const claudeLines = [
    JSON.stringify({ type: "ai-title", title: "Fix the login race" }),
    JSON.stringify({ type: "user", timestamp: "2026-11-09T10:00:00Z", cwd: "/tmp/proj", message: { content: "Fix the login race in src/auth.ts" } }),
    JSON.stringify({
      type: "assistant", timestamp: "2026-11-09T10:01:00Z",
      message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "/tmp/proj/src/auth.ts" } }] },
    }),
    JSON.stringify({
      type: "assistant", timestamp: "2026-11-09T10:02:00Z",
      message: { content: [{ type: "text", text: "Serialized refreshes per user; 12/12 tests green." }] },
    }),
    JSON.stringify({ type: "user", timestamp: "2026-11-09T10:03:00Z", cwd: "/tmp/proj", message: { content: "add a regression test too" } }),
  ];
  fs.writeFileSync(path.join(cdir, "abc-123.jsonl"), claudeLines.join("\n") + "\n");

  // codex session: AGENTS.md wrapper must be skipped, exec/apply_patch captured
  const xdir = path.join(home, ".codex", "sessions", "2026", "11", "09");
  fs.mkdirSync(xdir, { recursive: true });
  const codexLines = [
    JSON.stringify({ timestamp: "2026-11-09T09:00:00Z", type: "session_meta", payload: { session_id: "cpx-01", cwd: "/tmp/proj" } }),
    JSON.stringify({ timestamp: "2026-11-09T09:01:00Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "# AGENTS.md instructions for /tmp/proj\n<INSTRUCTIONS>behave</INSTRUCTIONS>" }] } }),
    JSON.stringify({ timestamp: "2026-11-09T09:02:00Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "migrate the store to zustand" }] } }),
    JSON.stringify({ timestamp: "2026-11-09T09:03:00Z", type: "response_item", payload: { type: "function_call", name: "exec_command", arguments: JSON.stringify({ cmd: "npm test" }) } }),
    JSON.stringify({ timestamp: "2026-11-09T09:04:00Z", type: "response_item", payload: { type: "function_call", name: "apply_patch", arguments: "*** Begin Patch\n*** Update File: src/store.ts\n*** End Patch" } }),
    JSON.stringify({ timestamp: "2026-11-09T09:05:00Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Store migrated; all tests pass." }] } }),
  ];
  fs.writeFileSync(path.join(xdir, "rollout-cpx-01.jsonl"), codexLines.join("\n") + "\n");
  return { home, claudeFile: path.join(cdir, "abc-123.jsonl") };
}

test("adaptersFor roots resolve under the given home", () => {
  const home = mkdtempSync();
  const adapters = adaptersFor(home);
  assert.equal(adapters["claude-code"].root, path.join(home, ".claude", "projects"));
  assert.equal(adapters.codex.root, path.join(home, ".codex", "sessions"));
  function mkdtempSync() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "nh-x-"));
  }
});

test("claude-code adapter: title, goal, files, last state", () => {
  const { home } = fixtureHome();
  const sessions = listSessions({ home });
  const s = sessions.find((x) => x.cli === "claude-code");
  assert.ok(s);
  assert.equal(s.title, "Fix the login race");
  assert.equal(s.firstUser, "Fix the login race in src/auth.ts");
  assert.equal(s.lastUser, "add a regression test too");
  assert.ok(s.lastAssistant.includes("12/12 tests green"));
  assert.deepEqual(s.filesTouched, ["/tmp/proj/src/auth.ts"]);
  assert.equal(s.cwd, "/tmp/proj");
  assert.equal(s.turns, 2);
});

test("codex adapter: AGENTS.md wrapper skipped, exec/apply captured", () => {
  const { home } = fixtureHome();
  const sessions = listSessions({ home });
  const s = sessions.find((x) => x.cli === "codex");
  assert.ok(s);
  assert.equal(s.firstUser, "migrate the store to zustand");
  assert.ok(s.commands.includes("npm test"));
  assert.deepEqual(s.filesTouched, ["src/store.ts"]);
  assert.equal(s.sessionId, "cpx-01");
  assert.equal(s.cwd, "/tmp/proj");
});

test("listSessions sorts newest first and pickSession matches cwd", () => {
  const { home } = fixtureHome();
  const sessions = listSessions({ home });
  assert.equal(sessions[0].cli, "claude-code"); // claude 10:03 > codex 09:05
  assert.equal(sessions[1].cli, "codex");
  const { picked, cwdMatch } = pickSession(sessions, { cwd: "/tmp/proj" });
  assert.equal(cwdMatch, true);
  assert.equal(picked.cli, "claude-code");
});

test("pickSession by id substring", () => {
  const { home } = fixtureHome();
  const sessions = listSessions({ home });
  const { picked } = pickSession(sessions, { session: "cpx-01" });
  assert.equal(picked.cli, "codex");
});

// The adapter registry: where AI coding CLIs keep their sessions and how to
// read them. Parsing is heuristic and read-only — the source file is never
// modified.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const ADAPTERS = {
  "claude-code": {
    label: "Claude Code",
    subdir: [".claude", "projects"],
    ext: ".jsonl",
    parse: null, // set below
  },
  codex: {
    label: "Codex CLI",
    subdir: [".codex", "sessions"],
    ext: ".jsonl",
    parse: null, // set below
  },
};

export function adaptersFor(home) {
  const out = {};
  for (const [id, a] of Object.entries(ADAPTERS)) {
    out[id] = { ...a, id, root: path.join(home, ...a.subdir) };
  }
  return out;
}

// ---------- claude-code ----------
// Lines: {type:"user"|"assistant"|"ai-title"|"file-history-snapshot"|..., message:{content}}
// user content: string OR [{type:"text"|"tool_result",...}]
// assistant content: [{type:"text",text} | {type:"tool_use",name,input:{file_path|command}}]

function claudeText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
  return "";
}

function parseClaude(file) {
  const rec = baseRecord(file, "claude-code");
  let cwd = "";
  for (const line of iterLines(file)) {
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d.cwd && !cwd) cwd = d.cwd;
    if (d.timestamp) {
      if (!rec.startedAt) rec.startedAt = d.timestamp;
      rec.lastAt = d.timestamp;
    }
    if (d.type === "ai-title" && d.title && rec.title === "") rec.title = d.title;
    if (d.type === "user") {
      const text = claudeText(d.message?.content);
      if (!text) continue;
      if (rec.firstUser === "") rec.firstUser = text;
      rec.lastUser = text;
      rec.turns++;
    }
    if (d.type === "assistant") {
      for (const b of d.message?.content || []) {
        if (b.type === "text" && b.text.trim()) rec.lastAssistant = b.text.trim();
        if (b.type === "tool_use") {
          const inp = b.input || {};
          if (
            ["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(b.name) &&
            inp.file_path
          ) {
            rec.filesTouched.add(inp.file_path);
          }
          if (b.name === "Bash" && inp.command) rec.commands.push(String(inp.command));
        }
      }
    }
  }
  rec.cwd = cwd || rec.cwd;
  return finalize(rec);
}

// ---------- codex ----------
// Lines: {timestamp, type:"session_meta"|"response_item"|"event_msg"|...,
//         payload:{type:"message"|"function_call"|"session_meta"...}}
// message payload: {role:"user"|"assistant"|"developer", content:[{type:"input_text"|"output_text", text}]}

function codexText(content) {
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && (b.type === "input_text" || b.type === "output_text"))
      .map((b) => b.text || "")
      .join("\n")
      .trim();
  }
  return typeof content === "string" ? content.trim() : "";
}

const CODEX_META_PREFIXES = ["# AGENTS.md", "<user_instructions>", "<skills_instructions>", "<environment_context>", "<turn_context>", "<codex_internal_context"];

function parseCodex(file) {
  const rec = baseRecord(file, "codex");
  for (const line of iterLines(file)) {
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d.timestamp) {
      if (!rec.startedAt) rec.startedAt = d.timestamp;
      rec.lastAt = d.timestamp;
    }
    const p = d.payload || {};
    if (d.type === "session_meta") {
      rec.cwd = p.cwd || rec.cwd;
      rec.sessionId = p.session_id || rec.sessionId;
      continue;
    }
    if (d.type !== "response_item") continue;
    if (p.type === "message") {
      const text = codexText(p.content);
      if (!text) continue;
      if (p.role === "user") {
        if (CODEX_META_PREFIXES.some((pre) => text.startsWith(pre))) continue;
        if (rec.firstUser === "") rec.firstUser = text;
        rec.lastUser = text;
        rec.turns++;
      } else if (p.role === "assistant" && text) {
        rec.lastAssistant = text;
      }
    }
    if (p.type === "function_call" && p.name === "exec_command" && p.arguments) {
      try {
        const args = JSON.parse(p.arguments);
        if (args.cmd) rec.commands.push(String(args.cmd));
      } catch {
        /* non-JSON args — skip */
      }
    }
    if (p.type === "function_call" && p.name === "apply_patch" && p.arguments) {
      const m = String(p.arguments).match(/\*\*\* (?:Add|Update|Delete) File: (.+)/g);
      if (m) for (const line2 of m) rec.filesTouched.add(line2.split(": ")[1]?.trim() || "");
    }
  }
  if (rec.title === "") rec.title = rec.firstUser;
  return finalize(rec);
}

ADAPTERS["claude-code"].parse = parseClaude;
ADAPTERS.codex.parse = parseCodex;

// ---------- shared helpers ----------

function baseRecord(file, cli) {
  return {
    cli,
    label: cli === "claude-code" ? "Claude Code" : "Codex CLI",
    file,
    sessionId: path.basename(file).replace(/\.jsonl$/, ""),
    cwd: "",
    startedAt: "",
    lastAt: "",
    title: "",
    firstUser: "",
    lastUser: "",
    lastAssistant: "",
    filesTouched: new Set(),
    commands: [],
    turns: 0,
  };
}

function finalize(rec) {
  rec.filesTouched = [...rec.filesTouched].filter(Boolean);
  rec.commands = rec.commands.slice(-40);
  if (rec.title === "") rec.title = rec.firstUser || rec.sessionId;
  rec.title = rec.title.split("\n")[0].slice(0, 90);
  rec.firstUser = rec.firstUser.slice(0, 2000);
  rec.lastUser = rec.lastUser.slice(0, 2000);
  rec.lastAssistant = rec.lastAssistant.slice(0, 4000);
  return rec;
}

function* iterLines(file) {
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    if (line.trim()) yield line;
  }
}

export function listSessions({ home, clis = Object.keys(ADAPTERS), limit = 200 } = {}) {
  home = home || os.homedir();
  const adapters = adaptersFor(home);
  const out = [];
  for (const id of clis) {
    const adapter = adapters[id];
    if (!adapter || !fs.existsSync(adapter.root)) continue;
    const files = [];
    collect(adapter.root, files, limit);
    for (const f of files) {
      try {
        const rec = adapter.parse(f);
        if (rec.turns > 0 || rec.lastUser) out.push(rec);
      } catch {
        /* unreadable session — skip */
      }
    }
  }
  out.sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
  return out.slice(0, limit);
}

function collect(dir, files, limit) {
  let list;
  try {
    list = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of list) {
    if (files.length >= limit) return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collect(full, files, limit);
    else if (e.isFile() && e.name.endsWith(".jsonl")) files.push(full);
  }
}


export function pickSession(sessions, { cli, cwd, session } = {}) {
  let pool = sessions;
  if (cli) pool = pool.filter((s) => s.cli === cli);
  if (session) {
    const byId = pool.filter((s) => s.sessionId.includes(session) || s.file.includes(session));
    if (byId.length) return { picked: byId[0], matches: byId.length, cwdMatch: false };
  }
  if (cwd) {
    const norm = (p) => String(p || "").replace(/\/+$/, "");
    const matching = pool.filter((s) => norm(s.cwd) === norm(cwd));
    if (matching.length) return { picked: matching[0], matches: matching.length, cwdMatch: true };
  }
  return { picked: pool[0] || null, matches: pool.length, cwdMatch: false };
}

#!/usr/bin/env node
// nexthop — pass the baton between AI coding CLIs.

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import process from "node:process";

import { listSessions, pickSession, ADAPTERS } from "./sessions.js";
import { buildHandoffMd, resumeHints } from "./handoff.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const home = os.homedir();

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

function usage(code = 0) {
  console.log(`⏭  nexthop v${pkg.version} — pass the baton between AI coding CLIs

用法:
  nexthop                       列出所有可交接的会话（默认命令 = list）
  nexthop list [选项]           同上
  nexthop handoff [选项]        从会话生成 HANDOFF.md（默认当前目录最新会话）
  nexthop show <session>        在终端打印某次会话的提取结果

handoff 选项:
  --from <cli>      只在某个 CLI 里挑会话（claude-code | codex）
  --cwd <dir>       匹配该目录下发生的会话（默认：当前目录）
  --session <id>    按 session id / 文件名片段指定会话
  --out <file>      输出文件（默认 ./HANDOFF.md）
  --force           目标文件已存在时覆盖
  --json            list/show 输出 JSON

通用选项:
  --no-color        纯文本
  -h, --help        帮助
  -v, --version     版本

源会话只读。nexthop 唯一会写的文件是你指定的 HANDOFF.md。`);
  process.exit(code);
}

function parseArgv(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage(0);
    if (a === "-v" || a === "--version") {
      console.log(pkg.version);
      process.exit(0);
    }
    if (a === "--json") flags.json = true;
    else if (a === "--no-color") flags.color = false;
    else if (a === "--force") flags.force = true;
    else if (a === "--home") flags.home = argv[++i];
    else if (a === "--from") flags.from = argv[++i];
    else if (a === "--cwd") flags.cwd = argv[++i];
    else if (a === "--session") flags.session = argv[++i];
    else if (a === "--out") flags.out = argv[++i];
    else if (a === "--limit") flags.limit = Number(argv[++i]);
    else if (a.startsWith("--")) {
      console.error(`nexthop: 未知选项 ${a}`);
      usage(1);
    } else flags._.push(a);
  }
  return flags;
}

function fmtTime(t) {
  return t ? String(t).slice(0, 16).replace("T", " ") : "—";
}

function cmdList(flags) {
  const sessions = listSessions({ home: flags.home, limit: flags.limit || 50 });
  if (flags.json) {
    console.log(JSON.stringify(sessions, null, 2));
    return;
  }
  if (!sessions.length) {
    console.log("⏭ 未发现任何会话 —— 先用 claude / codex 干点活，再回来交接。");
    return;
  }
  const cwd = path.resolve(flags.cwd || process.cwd());
  console.log(bold(`⏭ nexthop · ${sessions.length} 个会话可交接`));
  console.log(dim(`   ${Object.values(ADAPTERS).map((a) => a.label).join(" · ")} · 最近优先`));
  console.log("");
  for (const s of sessions.slice(0, flags.limit || 50)) {
    const here = path.resolve(s.cwd || "") === cwd ? green("●") : dim("·");
    console.log(
      `  ${here} ${pad(fmtTime(s.lastAt), 17)} ${pad(s.label, 13)} ${pad(String(s.turns), 4)} turns  ${clip(s.title || s.firstUser, 56)}`,
    );
    console.log(dim(`  ${" ".repeat(22)}cwd: ${s.cwd || "?"} · id: ${s.sessionId.slice(0, 12)}`));
  }
  console.log("");
  console.log(dim("  交接: nexthop handoff [--from claude-code|codex] [--cwd <dir>]"));
}

function clip(s, n) {
  s = String(s ?? "").replace(/\n/g, " ");
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
function pad(s, n) {
  s = String(s ?? "");
  return s + " ".repeat(Math.max(0, n - s.length));
}

function cmdHandoff(flags) {
  const sessions = listSessions({ home: flags.home, limit: 300 });
  if (!sessions.length) {
    console.error("⏭ 没有可交接的会话。");
    process.exitCode = 1;
    return;
  }
  const cwd = path.resolve(flags.cwd || process.cwd());
  const { picked, matches, cwdMatch } = pickSession(sessions, {
    cli: flags.from,
    cwd,
    session: flags.session,
  });
  if (!picked) {
    console.error("⏭ 没有匹配的会话（试试 --from 或 --session）。");
    process.exitCode = 1;
    return;
  }
  const color = flags.color !== false && process.stdout.isTTY;
  const b = (s) => (color ? bold(s) : s);
  console.log(
    `⏭ 已选中 ${b(picked.label)} 会话 ${dim(picked.sessionId.slice(0, 12))}` +
      (cwdMatch ? green(" · cwd 匹配") : dim(` · 最近一次（${matches} 个候选，可用 --cwd/--session 收窄）`)),
  );
  console.log(dim(`   ${clip(picked.title || picked.firstUser, 70)}`));

  const outPath = path.resolve(flags.out || "HANDOFF.md");
  if (fs.existsSync(outPath) && !flags.force) {
    console.error(`✗ ${outPath} 已存在 —— 加 --force 覆盖，或 --out 换个文件名。`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(outPath, buildHandoffMd(picked, { cwd }) + "\n");
  console.log(`✓ HANDOFF.md → ${outPath}`);
  console.log("");
  console.log(b("  下一棒怎么接："));
  for (const h of resumeHints(picked)) console.log(`    ${h}`);
  console.log("");
  console.log(dim("  提示：HANDOFF.md 是启发式摘要 —— 接手前先核对其中列出的文件。"));
}

function cmdShow(target, flags) {
  const sessions = listSessions({ home: flags.home, limit: 300 });
  const { picked } = pickSession(sessions, { session: target });
  if (!picked) {
    console.error(`⏭ 没有匹配「${target}」的会话。`);
    process.exitCode = 1;
    return;
  }
  if (flags.json) {
    console.log(JSON.stringify(picked, null, 2));
    return;
  }
  console.log(buildHandoffMd(picked, { cwd: picked.cwd }));
}

const flags = parseArgv(process.argv.slice(2));
const cmd = flags._[0] || "list";
try {
  if (cmd === "list") cmdList(flags);
  else if (cmd === "handoff") cmdHandoff(flags);
  else if (cmd === "show") cmdShow(flags._[1], flags);
  else usage(1);
} catch (e) {
  console.error(`nexthop: ${e.message}`);
  process.exitCode = 1;
}

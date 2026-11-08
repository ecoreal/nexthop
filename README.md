<div align="center">

# ⏭ nexthop

**Your agent worked all night in Claude Code. Now your quota says Codex. Take the context with you.**

[![CI](https://github.com/ecoreal/nexthop/actions/workflows/ci.yml/badge.svg)](https://github.com/ecoreal/nexthop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb96f.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518.17-339933)](package.json)
[![dependencies](https://img.shields.io/badge/dependencies-0-339933)](package.json)
[![tests](https://img.shields.io/badge/tests-10-5ba1f0)](#development)

[中文说明](README.zh-CN.md)

```console
$ nexthop

  ⏭ nexthop · 6 个会话可交接
     Claude Code · Codex CLI · 最近优先

  ● 2026-11-09 10:03  Claude Code   2 turns  Fix the login race in src/auth.ts
  · 2026-11-09 09:05  Codex CLI     2 turns  migrate the store to zustand
```

Every solution to "I switched CLIs mid-task" ends the same way: a hand-written
`HANDOFF.md`. nexthop **writes that file for you**, extracted from the session
log the previous agent already left on disk — goal, where it stands, files
touched, commands worth knowing, resume commands.

- **Cross-CLI** — Claude Code and Codex sessions today; one registry, one format
- **Heuristic, labelled** — the handoff says exactly what it is and links the source log
- **Read-only on the source** — the only file nexthop writes is your HANDOFF.md
- **Zero dependencies** · offline · nothing leaves your machine

## Install

```bash
npm install -g nexthop
# or run once, install nothing:
npx nexthop
```

## Usage

```bash
nexthop                       # list handoff-able sessions across all CLIs
nexthop handoff               # latest session (matches your cwd when possible) → HANDOFF.md
nexthop handoff --from codex  # pick from Codex sessions only
nexthop handoff --session cpx-01 --force
nexthop show e2e-01           # print the extraction without writing
```

The generated `HANDOFF.md` follows the community convention — goal, where it
stands, last user instruction, files touched, commands, resume hints — so the
next agent (Claude Code, Codex, Cursor, anything) can read it cold.

## The read-only guarantees

- Session logs are parsed, never modified.
- The only file nexthop writes is the `HANDOFF.md` you asked for (and it
  refuses to overwrite one without `--force`).
- No network. Extraction is heuristic and the file says so on its face.

## Development

```bash
git clone https://github.com/ecoreal/nexthop && cd nexthop
npm test          # 10 tests against synthetic session fixtures
```

CI: Ubuntu/macOS/Windows × Node 18/20/22/24.

## Roadmap

- [ ] More adapters: OpenClaw, Gemini CLI, Cursor
- [ ] `--launch` — write the handoff and start the next CLI in one step
- [ ] Token-budget summary of what the next agent will re-read

## License

MIT © 2026 [Jerry Lee (ecoreal)](https://github.com/ecoreal)

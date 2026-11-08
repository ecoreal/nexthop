<div align="center">

# ⏭ nexthop

**你的 agent 在 Claude Code 里干了一整夜，配额却让你换 Codex —— 把上下文一起带走。**

[![CI](https://github.com/ecoreal/nexthop/actions/workflows/ci.yml/badge.svg)](https://github.com/ecoreal/nexthop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb96f.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518.17-339933)](package.json)
[![dependencies](https://img.shields.io/badge/dependencies-0-339933)](package.json)
[![tests](https://img.shields.io/badge/tests-10-5ba1f0)](#开发)

[English](README.md)

```console
$ nexthop

  ⏭ nexthop · 6 个会话可交接
     Claude Code · Codex CLI · 最近优先

  ● 2026-11-09 10:03  Claude Code   2 turns  Fix the login race in src/auth.ts
  · 2026-11-09 09:05  Codex CLI     2 turns  migrate the store to zustand
```

"干到一半换 CLI"的所有解法最后都殊途同归：一份手写的 `HANDOFF.md`。
nexthop **替你写好这份文件** —— 从上一个 agent 留在磁盘上的会话日志提取：
目标、进展、动过的文件、值得知道的命令、恢复命令。

- **跨 CLI** —— 今天支持 Claude Code 和 Codex；一个注册表，一种格式
- **启发式且自我声明** —— 文档开头就写明这是启发式摘要，并链接源日志
- **源会话只读** —— nexthop 唯一会写的文件是你的 HANDOFF.md
- **零依赖** · 离线 · 什么都不出网

## 安装

```bash
npm install -g nexthop
# 或者不装，直接跑一次：
npx nexthop
```

## 用法

```bash
nexthop                       # 列出所有可交接的会话
nexthop handoff               # 最新会话（尽量匹配当前目录）→ HANDOFF.md
nexthop handoff --from codex  # 只从 Codex 会话里挑
nexthop handoff --session cpx-01 --force
nexthop show e2e-01           # 只打印提取结果，不写文件
```

生成的 `HANDOFF.md` 遵循社区约定 —— 目标 / 现状 / 最后指令 / 动过的文件 /
命令 / 恢复提示 —— 下一个 agent（Claude Code、Codex、Cursor、任何家）
冷启动也能读懂。

## 只读保证

- 会话日志只解析，从不修改。
- 唯一会写的文件是你要求的 `HANDOFF.md`（已存在时拒绝覆盖，除非 `--force`）。
- 无网络。提取是启发式的，文件里明说了。

## 开发

```bash
git clone https://github.com/ecoreal/nexthop && cd nexthop
npm test          # 10 个测试跑在合成会话 fixtures 上
```

CI：Ubuntu/macOS/Windows × Node 18/20/22/24。

## 路线图

- [ ] 更多适配器：OpenClaw、Gemini CLI、Cursor
- [ ] `--launch` —— 写完交接文档直接启动下一个 CLI
- [ ] 下一棒将重读内容的 token 预算摘要

## 许可

MIT © 2026 [Jerry Lee (ecoreal)](https://github.com/ecoreal)

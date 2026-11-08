// Resume hints per CLI — best-effort commands, printed and embedded in the
// HANDOFF.md. Version-dependent flags are documented as hints, not gospel.

export function resumeHints(session) {
  const hints = [];
  if (session.cli === "claude-code") {
    hints.push(`claude --resume ${session.sessionId}   # continue the original session`);
    hints.push(`claude                                    # or start fresh in the cwd and read HANDOFF.md`);
  } else if (session.cli === "codex") {
    hints.push(`codex resume                              # pick the session interactively`);
    hints.push(`codex                                     # or start fresh in the cwd and read HANDOFF.md`);
  } else {
    hints.push(`# start your next CLI in the same cwd and read HANDOFF.md`);
  }
  return hints;
}

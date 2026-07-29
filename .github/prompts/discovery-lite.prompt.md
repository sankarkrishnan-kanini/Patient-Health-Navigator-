---
agent: agent
description: Lightweight, gate-enforced on-ramp into technical-discovery — brainstorm with an approval gate, then hand off.
tools: ['execute/createAndRunTask', 'read/readFile', 'edit/createFile', 'edit/editFiles', 'search', 'todo', propel-sdlc/*]
---

consult `.propel/orchestrators/discovery-lite.md` for the workflow steps.

**Session isolation (Copilot-specific):** delegate S1 to the custom agent
`propel-discovery-lite-s1` (explicitly via `@propel-discovery-lite-s1` if
Copilot doesn't delegate on its own), passing `runId`, `project`,
`gatePolicyJson`.

---

*The smallest gate-enforced workflow in the catalog — one step, one gate.*

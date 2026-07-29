---
agent: agent
description: For Architects. Gate-enforced technical discovery — requirements, architecture, optional modeling, and UI spec (Figma + wireframes), each phase requiring human approval before proceeding. Replaces discovery-agent.
tools: ['execute/createAndRunTask', 'read/readFile', 'azure-mcp/search', 'edit/createDirectory', 'edit/createFile', 'edit/editFiles', 'search', 'web', 'todo', propel-sdlc/*]
---

consult `.propel/orchestrators/technical-discovery.md` for the workflow steps.

**Session isolation (Copilot-specific):** delegate each step to its matching
custom agent -- `propel-technical-discovery-s1` through `-s5`. This
delegation is model-discretionary in Copilot, not guaranteed automatic; if
you find yourself about to execute a step inline, invoke the agent
explicitly (e.g. `@propel-technical-discovery-s3`) instead. Pass `runId`,
`project`, `gatePolicyJson` in each delegation.

---

*This agent orchestrates gate-enforced technical discovery for Solution Architects and System Architects.*

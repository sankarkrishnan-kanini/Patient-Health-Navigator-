---
agent: agent
description: Composite ideation agent — brainstorm candidates, select one, build a prototype, hand off to technical-discovery. Gate-enforced (unlike bare orchestrators, the server refuses to advance past a pending approval).
tools: ['execute/createAndRunTask', 'read/readFile', 'azure-mcp/search', 'edit/createDirectory', 'edit/createFile', 'edit/editFiles', 'search', 'web', 'todo', propel-sdlc/*]
---

consult `.propel/orchestrators/concept-validation.md` for the workflow steps.

**Session isolation (Copilot-specific):** delegate S1 to the custom agent
`propel-concept-validation-s1` and S2 to `propel-concept-validation-s2`.
Copilot's delegation to a custom agent is description-matched and
model-discretionary, not a guaranteed explicit call the way Claude Code's
Task tool is -- if you find yourself about to execute S1 or S2 inline instead
of delegating, stop and invoke the agent explicitly (`@propel-concept-validation-s1`
/ `@propel-concept-validation-s2`) rather than proceeding in this session.
Pass `runId`, `project`, `gatePolicyJson` (and, for S2, `context.selected`)
in the delegation.

---

*This agent orchestrates early-stage ideation for Product Architects, Solution Architects, and Business Analysts, before handing off into technical discovery.*

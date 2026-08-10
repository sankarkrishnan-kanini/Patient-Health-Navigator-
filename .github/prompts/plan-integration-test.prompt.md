---
agent: agent
description: Generates story-level integration test plans that validate real dependencies with dependency-readiness tracking and traceability to technical requirements and shared epic contracts.
tools: ['execute/testFailure', 'execute/getTerminalOutput', 'execute/createAndRunTask', 'execute/runInTerminal', 'read/problems', 'read/readFile', 'read/terminalSelection', 'read/terminalLastCommand', 'edit/createDirectory', 'edit/createFile', 'edit/editFiles', 'search', 'web', 'azure-mcp/search', 'context7/*', 'sequential-thinking/*', 'todo', propel-sdlc/*]
---

consult `.propel/prompts/plan-integration-test.md` for the workflow steps.

---

*This workflow generates integration test plans validating real dependencies with cross-story traceability.*

---
agent: agent
description: Generates feature/system-scoped performance test plans deriving load, stress, soak, and spike scenarios from performance-category NFR targets with bidirectional traceability.
tools: ['execute/testFailure', 'execute/getTerminalOutput', 'execute/createAndRunTask', 'execute/runInTerminal', 'read/problems', 'read/readFile', 'read/terminalSelection', 'read/terminalLastCommand', 'edit/createDirectory', 'edit/createFile', 'edit/editFiles', 'search', 'web', 'azure-mcp/search', 'context7/*', 'sequential-thinking/*', 'todo', propel-sdlc/*]
---

consult `.propel/prompts/plan-performance-test.md` for the workflow steps.

---

*This workflow generates performance test plans with load, stress, soak, and spike scenario coverage traced to NFR targets.*

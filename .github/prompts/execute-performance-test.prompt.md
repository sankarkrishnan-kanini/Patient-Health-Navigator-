---
agent: agent
description: Executes load/stress/soak/spike performance scenarios against a non-production target environment, comparing actual latency, throughput, and error rate against defined thresholds with causal failure diagnostics.
tools: ['execute/testFailure', 'execute/getTerminalOutput', 'execute/createAndRunTask', 'execute/runInTerminal', 'read/problems', 'read/readFile', 'read/terminalSelection', 'read/terminalLastCommand', 'edit/createDirectory', 'edit/createFile', 'edit/editFiles', 'search', 'web', 'azure-mcp/search', 'context7/*', 'sequential-thinking/*', 'todo', propel-sdlc/*]
---

consult `.propel/prompts/execute-performance-test.md` for the workflow steps.

---

*This workflow reports latency, throughput, and error-rate results against scenario thresholds with failure diagnostics.*

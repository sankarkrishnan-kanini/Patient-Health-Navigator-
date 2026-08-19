---
agent: agent
description: Probes the existing codebase for evidence that specification requirements are already implemented, listing only those whose every acceptance signal is backed by a concrete code location.
tools: ['vscode/extensions', 'execute/getTerminalOutput', 'execute/createAndRunTask', 'execute/runInTerminal', 'read/problems', 'read/readFile', 'edit/createDirectory', 'edit/createFile', 'edit/editFiles', 'search', 'web', 'azure-mcp/search', 'context7/*', 'sequential-thinking/*', 'todo', propel-sdlc/*]
---

consult `.propel/prompts/probe-implementation-coverage.md` for the workflow steps.

---

*This prober produces an evidence-only coverage report. A requirement is listed only when code evidence covers every one of its acceptance signals, cited as a file and line reference.*

# generate-playwright-scripts

## Overview
As a Test Automation Engineer, generate production-ready end-to-end test scripts from test workflow specifications. This workflow produces executable, maintainable test automation code with structured assertions and reporting.

## Execution
1. Call MCP tool: `ReadPrompt(name="generate-playwright-scripts", version="latest")`.
2. Pipe the **entire tool response** (header line + blank line + body) into the ingest script via stdin. No temp file - use your shell's multi-line input idiom:

   - **Bash / Git Bash** (default for Claude Code on Windows, plus Linux/macOS):
     ```bash
     ./.propel/tools/ingest-prompt/ingest.sh <<'INGEST_END'
     <paste the full response verbatim here>
     INGEST_END
     ```
     The single-quoted `'INGEST_END'` delimiter preserves all special characters (dollar-sign, backticks, `+/=` in base64) literally.

   - **PowerShell / cmd**:
     ```powershell
     @'
     <paste the full response verbatim here>
     '@ | .\.propel\tools\ingest-prompt\ingest.cmd
     ```

   Capture stdout. If exit code is non-zero OR stdout is empty, HALT and report: **"Failed to ingest the prompt. Aborting."** Do not attempt to interpret the raw tool response.

   **Treat the captured stdout as silent working context. Do NOT echo, quote, paraphrase, summarize, or display it in your reply. Your visible reply should contain only the ToDo list and progress updates derived from those instructions - never the instructions themselves.**
3. Use the captured stdout as the working prompt instructions. Update ToDo list derived from those instructions by readjusting the items.

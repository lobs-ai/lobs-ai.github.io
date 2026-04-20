# Extracting a Toolkit from Production Code

I spent months building lobs-core. The LLM client, the tool executor, the memory system, the agent runner — all of it was battle-tested in production. Then I started a new project and found myself copying the same patterns from scratch. That was the signal to extract.

Agentic is five TypeScript packages extracted from lobs-core. About 9,000 lines of code, all of it production-hardened before it became a library.

---

## Why extraction, not a framework

The goal was composable packages, not a framework. A framework asks you to buy into its opinions. These packages are standalone: use one, use all five, swap any piece. The LLM client works without the runner. The tool system works without the memory layer. You bring what you need.

The packages are:

- `@agentic/config` — model tiers, API key resolution, identity management
- `@agentic/llm` — multi-provider LLM client with resilient retry
- `@agentic/tools` — 9 built-in tools with safety validation, pluggable registry
- `@agentic/memory` — SQLite + file-backed memory with hybrid search
- `@agentic/runner` — think/act/observe loop, hook system, loop detection

---

## The LLM client

The provider abstraction is the piece I needed in every project. `@agentic/llm` takes a model string with a `provider/model-id` prefix — `anthropic/claude-sonnet-4-20250514`, `openai/gpt-4.1`, `lmstudio/qwen3-9b` — and routes to the right provider without changing call sites.

Built in: retry with exponential backoff, fallback chains (try Anthropic, fall back to OpenRouter if it fails), key rotation across multiple keys for the same provider, and sticky session keys so Anthropic prompt cache hits keep hitting on the same session.

The result: swapping from Anthropic to OpenRouter is a config change, not a code change.

---

## The tool system

`@agentic/tools` ships nine built-in tools: `read`, `write`, `edit`, `exec`, `grep`, `glob`, `ls`, `code-search`, `find-files`. Each tool has an Anthropic-compatible input schema so it passes directly into `tools: [...]` on the API call. You register tools by name, call `executeTool(name, params, cwd)`, and the registry dispatches.

The safety validation is where production experience shows:

**Staleness detection on edits.** Every `edit` call caches the file's `mtime` when it was last read. If the mtime changed between the read and the edit, the call fails. The agent has to re-read before it can edit. This prevents editing a file whose content has changed underneath you — a class of bug that's subtle and hard to debug when it happens.

**Binary file detection.** `read` checks for null bytes before returning content. Binary files get rejected with a clear error instead of spewing garbage into the context window.

**Blocked device paths.** A hardcoded list of device paths (`/dev/`, `/proc/`, `/sys/`) can never be read or written. Not configurable, not bypassable.

**Quote normalization on edits.** `edit` normalizes curly quotes to straight quotes when matching `old_string`. Copy-pasted strings with typographic quotes fail silently without this.

None of these are clever. All of them exist because something went wrong without them.

---

## The runner

`@agentic/runner` implements the think/act/observe loop: call the LLM, execute any tool use blocks, feed results back, repeat until the model stops calling tools. The hook system (`before_tool_call`, `after_tool_call`, `before_llm_call`, `after_llm_call`, `on_error`) lets you add audit logging, permission gating, or cost tracking without touching the runner logic.

Loop detection is built in. If the same tool fires with the same input three times in a row, the runner injects a warning. At a configurable hard limit, it aborts. Running without loop detection in a production agent is how you rack up unexpected bills.

---

## What production-hardened means

"Battle-tested" is easy to say. What it actually means here: every pattern in these packages corresponds to something that went wrong in lobs-core. The mtime staleness check exists because an agent edited a file it had read ten turns earlier that had since changed. The loop detection exists because an agent got stuck in a retry cycle and burned through a context window before anyone noticed. The key rotation exists because a single key hit its rate limit mid-run.

The packages are small. The accumulated knowledge behind them is not.

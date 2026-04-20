# The Structured-First Executive Assistant

Most AI productivity tools are chatbots with a calendar wrapper. You type a question, it tells you what's on your calendar, you say thanks and close the tab. The AI is decorative.

Cortex is designed differently. The premise: tasks, events, projects, and deadlines are first-class objects. The AI's job is to reason over that structure, not replace it.

---

## What it does

Cortex is a web-based personal executive assistant that syncs and manages your Google Calendar, manages tasks and projects natively, generates a daily plan every morning, runs proactive background checks throughout the day, sends Discord notifications for things worth interrupting you, and learns your habits and adjusts over time.

The key word is proactive. Most of what Cortex does happens without you asking. Background jobs run on schedule, detect notable states, and decide whether to surface something or stay quiet.

---

## Structured first, AI as reasoning layer

The architectural principle: structure first, AI second.

Calendar events, tasks, projects, reminders — these live in Postgres as properly typed rows. When the AI reasons about your day, it isn't reading raw text from some notes file. It gets a structured JSON payload:

```json
{
  "date": "2026-04-20",
  "calendar": [...],
  "free_blocks": [...],
  "tasks": [...],
  "projects": [...],
  "tendencies": [...]
}
```

The AI's job is to say something useful about that structure. Not to guess what structure might exist.

This matters for quality. When you ask "what should I work on today?", a chatbot guesses based on the last few messages. Cortex assembles your actual state — what's due, what's overdue, where your free time is, what your calendar looks like, what you've been neglecting — and hands that to the model. The model's response quality is bounded by the quality of its inputs.

It also matters for reliability. A system that stores tasks and events properly can answer questions about them correctly, every time. A system that relies on the AI to remember what tasks you mentioned in chat will eventually forget or confuse them.

---

## Four AI roles

The AI layer is split into four logical roles rather than one monolithic assistant:

**Planner** — daily and weekly planning, task prioritization, scheduling suggestions. Runs once a day. Premium model, premium output quality.

**Monitor** — background evaluation, detecting risk states, deciding whether to notify. Runs every 30-60 minutes during active hours. Cheap model, because most runs should produce nothing — only escalates when the rule-based detectors first find something worth surfacing.

**Memory curator** — extracts stable patterns from repeated observations. Runs nightly. Responsible for turning "user moved this suggested block to morning three times" into a formal tendency.

**Chat assistant** — answers questions and takes actions. Has the full tool set. Runs on demand.

Each role gets scoped tool access. The monitor can only read and propose notifications. The planner can read and propose schedule blocks. The chat assistant can read, write, and act. Scoping tool access per role reduces the chance that a proactive wake-up accidentally does something the user didn't ask for.

---

## The think → act loop

A single user message like "clean up my afternoon" might require several steps: read calendar, identify low-priority events, check task urgency, find free windows, propose a rearrangement. That's not one LLM call.

Cortex uses a think → act loop. The model gets called with its tool set. If it returns tool use blocks, those tools execute, results come back, the loop continues. When the model produces a final text response, the loop exits.

Requirements that make this safe:

- **Turn cap**: every run has a `maxTurns` limit (25 for chat, 15 for proactive wake-ups). Exceeding it aborts cleanly and logs the outcome.
- **Time cap**: wall-clock timeout enforced at the orchestration layer, not just per LLM call.
- **Parallel tool calls**: read tools execute concurrently. Writes serialize.
- **Loop detection**: if the same tool fires with the same input repeatedly, the system injects a warning, then hard-stops at a threshold.
- **Transactionality**: actions with real consequences — sending a Discord message, moving a Google Calendar event — queue as proposals during the loop and only commit after it finishes successfully. Unless the user has whitelisted that category as auto-act, in which case they commit immediately.

The proactive wake-ups use the same loop as chat. The only difference is the trigger source and which tools are in scope.

---

## The hardest problem: spam vs. usefulness

The assistant that notifies you about everything is worse than the one that says nothing. Every unnecessary notification makes the next one less likely to be read.

Cortex uses deterministic rule detectors before any LLM calls on proactive runs:

- Task due within 24h, unscheduled, estimated duration > available free time → flag deadline risk
- Meeting in 2h, marked important, no prep block → flag prep reminder
- Three overdue tasks, no focus block today → flag backlog problem

Only when a rule fires does the system spend tokens on a real LLM call. The LLM's job on a proactive run is to produce human-readable reasoning for something that already passed a rule check — not to invent reasons to interrupt you.

The monitor also has explicit cooldowns, importance scores, and per-channel rate limits. The morning daily plan goes to Discord once. A deadline risk that fired yesterday doesn't fire again unless the situation got worse.

---

## Learning that doesn't trust too fast

Cortex learns habits: preferred work times, task duration accuracy, how you respond to scheduling suggestions. But inferred tendencies require evidence before they affect behavior.

The threshold: at least three similar observations over 14+ days before a pattern is promoted. A single data point doesn't change the model. Repeated ones do.

Users can also see and edit everything the system has learned. Every inferred tendency is visible. Any tendency can be deleted, corrected, or promoted to explicit preference. The system is transparent about what it thinks it knows.

This design came from a real concern: a system that confidently adapts to wrong inferences will erode trust quickly. Conservative learning and visible memory are both answers to the same problem — the system should earn the user's trust over time, not assume it from the start.

---

## What it's not

Cortex is not a raw chatbot with a calendar API strapped to it. It's not an all-powerful autonomous agent that reorganizes your life without asking. In V1, it doesn't send emails, take over your browser, or make decisions that can't be reviewed.

What it is: a system that combines structured data, proactive orchestration, memory, and careful action-taking. The combination is what makes it more useful than a generic AI chat tool. Any single piece of it — a chatbot, a task manager, a calendar — is a solved problem. Connecting them, making them proactive, and making the AI layer understand the structure underneath: that's the actual product.

# Preparation beats power

Most of the improvements I've made to Lobs in the last week aren't about making the agent smarter. They're about making it less wasteful.

Two changes landed back-to-back that illustrate the same principle: don't solve problems with brute force when a little preparation handles them better.

## The standup problem

Lobs runs standup cron jobs four times a day. The agent wakes up, looks around at what's happened since the last check, and posts a summary to Discord. Simple enough.

Except "looks around" meant the agent spent its first 10-15 tool calls just gathering data. `git log` on six repos. `gh pr list`. `gh issue list`. Query the task database. Check recent memory entries. Each tool call costs tokens on both sides — the agent has to decide what to gather, then parse the results, then decide what else it needs.

By the time it actually started analyzing anything, it had burned through a meaningful chunk of context window just doing data collection that was completely predictable. Every standup needs the same categories of information. There's no creative judgment in "run git log on the PAW repos."

The fix was a new `standup` payload kind in the cron system. Before the LLM fires, a gatherer script runs and collects everything — git activity, open PRs, open issues, task state, recent memory. It assembles a formatted summary and injects it directly into the conversation as a pre-filled tool result. The agent wakes up with the data already in front of it and spends all its tokens on the part that actually requires intelligence: figuring out what matters, what's blocked, and what to flag.

The standup-gatherer is about 190 lines of TypeScript. It replaced what was easily 500+ tokens of agent reasoning per run, four times a day, every day.

## The retry loop

The second change came out of a specific incident. A task had been failing for four hours. Five spawn attempts, each one doing the same thing, each one failing for the same reason. The orchestrator's logic was: task failed, try again. Task failed again, try again. Eventually it hit the spawn count limit and silently blocked the task. Nobody was told why it failed.

This is the classic blind retry problem. The system knew *that* something failed but never stopped to ask *why*. When a programmer agent fails three times on the same task, the fourth attempt is going to fail too. The issue isn't that the agent needs another shot. The issue is that something about the task is broken in a way the programmer can't handle.

The new behavior: after three failures, the orchestrator stops retrying and routes the task to a researcher agent instead. The researcher gets a structured prompt with the original task, the failure count, spawn and crash counters, and whatever error information is available. Its job is diagnosis, not execution. What went wrong? Is it a bad task description? A missing dependency? An environment issue? A fundamental misunderstanding?

The researcher produces a report. The original task gets marked "escalated" rather than silently blocked. An inbox alert fires so I know it happened.

```typescript
const RESEARCHER_AUDIT_THRESHOLD = 3;
// ... 
if (guardResult === "researcher") {
  log().warn(
    `Task ${taskId.slice(0, 8)} hit failure threshold — escalated to researcher audit`
  );
  return;
}
```

This is maybe 125 lines of code in the control loop. But it transforms a failure mode from "silently waste compute and then give up" to "stop, think about what went wrong, and tell someone."

## The pattern

Both changes follow the same logic: spend a little effort up front to avoid wasting a lot of effort later.

The standup gatherer trades 190 lines of script for thousands of tokens per day. The failure escalation trades 125 lines of orchestrator logic for hours of wasted retries. Neither change makes the LLM itself smarter. They make the system around it smarter about when and how to use the LLM.

This keeps showing up as I build Lobs. The biggest improvements aren't model upgrades or prompt engineering tricks. They're structural changes to when the agent runs, what it starts with, and what happens when it fails. Preparation beats power.

There's a third change from this week that fits the same pattern: discord context injection. Instead of making the agent figure out where it is from conversation clues, the system now injects channel ID, guild ID, and latest message ID directly into the system prompt for guild sessions. The agent doesn't waste reasoning on "which channel am I in?" because it already knows. Another few lines of plumbing that save real tokens on every guild interaction.

None of these are flashy features. They don't make good demos. But they compound. An agent that starts every task with the right context, knows when to stop retrying, and understands where it's operating without having to figure it out — that agent does more useful work per dollar than one running a bigger model without those guardrails.

The lesson: before upgrading the engine, check if you're making it drive in circles.

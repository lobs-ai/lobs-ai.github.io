# Five Tiers, One Rule: The Cheapest Model That Works

Running an AI agent system on a grad student budget forces a question that most AI companies don't have to ask: what's the cheapest model that can do this job?

Not the best model. Not the most capable. The cheapest one that produces an acceptable result. This distinction is the difference between Lobs being a viable long-term project and a nice experiment that dies when the API bill gets uncomfortable.

---

## The Tiers

Lobs routes every task through one of five model tiers. The mapping isn't random — it's based on what kind of work the agent does and what failure looks like.

**Micro** — Qwen 2.5 running locally via LM Studio on the same Mac Mini that hosts lobs-core. Cost: zero. Latency: ~2 seconds. In the first week, roughly 60% of tasks ran here. These are the tasks where "good enough" is genuinely good enough: formatting, simple lookups, template generation, boilerplate.

**Small** — Claude Sonnet. The default for Writer agents. Good prose, follows instructions well, rarely surprises you. Most blog posts, documentation, and communication drafts start here.

**Medium** — Claude Sonnet+. Default for Researcher agents. Better at synthesis, longer context handling, more reliable at connecting information across sources. The price bump over Small is worth it when the task involves reading 10 files and producing a coherent summary.

**Standard** — Claude Sonnet / Codex. Default for Programmer agents. Code generation, debugging, architecture decisions that involve reading real codebases. This is where most of the token spend goes, because code tasks tend to be context-heavy.

**Strong** — Claude Opus. Reserved for Architect agents and complex design work. Used sparingly — maybe 5% of total runs. The situations where Opus justifies its cost are the ones where a wrong answer is expensive: system design decisions, security reviews, cross-cutting refactors.

## How Routing Works

Every task in the system has an agent type assignment. Agent types have default tiers. When a worker spawns to handle a task, it uses the tier mapped to its agent type.

This sounds simple because it is. The complexity isn't in the routing — it's in what happens when routing is wrong.

## Escalation on Failure

When a task fails on its assigned tier, the system doesn't just retry at the same level. It escalates up. Micro fails → retry on Small. Small fails → retry on Medium. And so on up the chain.

This is where the economics get interesting. A task that succeeds on Micro costs nothing. The same task, if it fails on Micro and succeeds on Small, costs one Sonnet API call plus one wasted local inference. That's still cheaper than running everything on Standard by default.

The failure rate on Micro is higher than on Standard — obviously. But the per-task cost is so much lower that the math works out. You can afford a 40% failure rate on free inference if the 60% that succeeds saves you hundreds of API calls.

## Circuit Breakers

Escalation handles individual task failures. Circuit breakers handle systemic model failures.

If a model's failure rate crosses a threshold within a rolling window, the circuit breaker trips and quarantines that model. Tasks that would have routed there skip to the next tier up. When the quarantine period expires, the model gets a probe request. If it succeeds, the circuit breaker resets.

This matters most for local models. LM Studio occasionally stalls, runs out of memory, or returns garbage after a context length overflow. Without the circuit breaker, every Micro-tier task would fail, retry on Small, and you'd be paying API costs for work that should be free. With it, the system detects the problem within a few failures and routes around it.

## The Numbers

In 30 days of operation: 33.1M input tokens, 560K output tokens, across 111 worker runs.

That input/output ratio — 59:1 — tells the real story. Agent work is overwhelmingly context consumption. Workers read codebases, documentation, conversation history, memory files. They produce relatively little output. A programmer agent that reads 200K tokens of context to write a 2K token code change is typical.

This has direct implications for cost optimization. Input tokens are cheaper than output tokens on every provider. The 59:1 ratio means our effective cost per task is heavily weighted toward the cheaper token type.

The agent distribution is also lopsided: 102 of 111 runs were Programmer agents. Code work dominates. This isn't surprising — Lobs is primarily a development tool — but it means optimizing programmer agent costs has outsized impact.

## The 38% Success Rate

Overall task success rate: 38%. That number sounds bad. It's actually fine.

Here's why: "failure" in this system isn't always what it sounds like. A task can fail because:

- The model timed out (network issue, not capability issue)
- The task was superseded by a newer version (intentional cancellation)
- The worker hit a rate limit and was killed
- The context was too large for the assigned tier
- The task was genuinely too hard for the model

Only the last category is a real failure. The others are operational noise. When you factor those out, the effective success rate for tasks that got a fair shot is closer to 60%.

The remaining 40% are tasks where the model genuinely couldn't do the work. Some of those escalated to a higher tier and succeeded. Some didn't. That's the tradeoff: starting cheap means accepting that some work will need a second attempt.

## Provider Diversity

Three providers: Anthropic (Claude family), OpenAI (Codex), and local LM Studio (Qwen). Each has different strengths, failure modes, and pricing.

Provider diversity is a reliability strategy, not just a cost strategy. When Anthropic has an outage — and they do — tasks can fall back to OpenAI or local inference. When LM Studio stalls, tasks escalate to cloud providers. No single provider failure takes down the system.

It also means we're not locked in. If Anthropic raises prices, we shift more work to local inference or OpenAI. If a new local model outperforms Qwen, we swap it into the Micro tier without changing anything else.

## What We've Learned

**Start cheap, escalate on failure.** The default instinct is to use the best model for everything "just to be safe." This is expensive and unnecessary. Most tasks don't need the best model. The ones that do will tell you — by failing on the cheaper one.

**Input tokens dominate costs.** Optimizing output generation is a rounding error. The real leverage is in context management: what goes into the prompt, how much history is included, whether the agent needs the full file or just the relevant function.

**Local inference changes the math.** Running Qwen locally on the same machine that hosts lobs-core costs nothing except electricity and compute time. Every task that succeeds on local inference is a task that didn't cost an API call. At 60% local success rates, that's substantial savings.

**A flaky cheap tier is worse than no cheap tier.** If local inference stalls and you don't detect it, every task escalates to the cloud — you pay more than if you'd never had local inference at all. The circuit breaker is what makes the cost model hold.

**The cheapest model that works is a moving target.** Local models get better every quarter. Cloud pricing changes. New providers appear. The tier system is designed to make swapping easy — change the model mapping, keep the architecture. The rule stays the same even when the specific models change.

One rule. Five tiers. The cheapest model that works.

# The Restart Loop: When Your AI Agents Go Rogue

At 12:15 AM on March 16th, I woke up to find my agent system had restarted itself 16 times in 9 hours. Fourteen of those were graceful. Two were crashes. One of the loops was restarting every 30 seconds for 20 minutes straight.

This is the story of what happened, why it happened, and what it taught me about giving AI agents access to their own runtime.

---

## The Setup

Lobs runs on a Mac Mini in my apartment. It's a standalone Node.js process that orchestrates multiple AI agents — each specialized for different kinds of work. Workers spawn, pick up tasks, do their thing, and shut down. The system runs 24/7.

At the time, workers had broad tool access. They could read files, write files, run shell commands, and — critically — interact with the system's own management layer. Including calling `gateway restart`.

This seemed fine. Workers occasionally needed to test changes or verify system state. Restricting tool access felt premature. The system was working.

Then we ran out of disk space.

## The Timeline

**00:15 — First crash.** `ENOSPC: no space left on device, write`. lobs-core dies. Clean death, clear error. Nothing exotic — the Mac Mini's SSD was full.

**00:16 — Memory server fails.** The memory supervisor detects 117 MB free and decides it's not enough to start the memory search server. It enters a retry loop. Ninety-five health check failures over the next hour.

**01:23 — Second crash.** Another `ENOSPC` during disk-pressure recovery. The system is now two crashes deep without human intervention.

**01:32 — System restarts.** Some disk space has been freed (likely temp files aging out). lobs-core comes back. Workers start spawning.

**01:39–02:49 — The agent restarts begin.** A worker picks up a task, makes a code change, and calls `gateway restart` to deploy it. This is technically legitimate — the agent was trying to ship its work. The restart succeeds. Fresh workers spawn. One of them picks up another active task. Makes a change. Calls restart.

**03:16–04:35 — The cascade.** This is where it goes sideways. Each restart bumps the WORKFLOW_SEED version, which triggers workflow re-evaluation, which spawns more workers, which find tasks, which make changes, which call restart. The feedback loop is complete.

Restarts at 03:39, 04:05, 04:12, 04:14, 04:17, 04:18, 04:19, 04:24, 04:25, 04:29, 04:35.

That's eleven restarts in 56 minutes. At the peak, restarts were happening within 60 seconds of each other. Each restart killed in-flight work, spawned fresh workers, and those workers immediately started the cycle over.

**04:29 — Stale PID collision.** A new process starts before the previous one's PID file is cleaned up. Two instances briefly coexist. This doesn't cause data corruption (SQLite handles it), but it does cause confusion in the process management layer.

**04:35 — Stabilization.** The WORKFLOW_SEED version stops changing. Workers settle into tasks that don't require restarts. The Cloudflare tunnel re-establishes. The system limps back to normal.

**~09:00 — I wake up** and find the wreckage in the logs.

## Why This Happened

Three things combined:

**1. Disk space exhaustion triggered the initial instability.** The ENOSPC crashes created a degraded state where the system was constantly recovering. Workers spawned into a half-broken environment and tried to fix things — which made things worse.

**2. Workers had too much power.** The ability to call `gateway restart` was designed for convenience — and that convenience quietly made it dangerous. No single restart was malicious or even unreasonable in isolation. The problem was the compound effect: each worker's rational decision to restart created the conditions for the next worker's rational decision to restart.

**3. No restart rate limiting.** The system had no concept of "we've restarted too many times recently, something is wrong." It would happily restart every 30 seconds forever.

## The Related Incident: Heartbeat Spam

The same week, a different but related problem showed up. Workers running background shell commands (using `&` or `nohup`) would trigger event-driven heartbeat messages when those commands completed. At peak, the main Discord channel received 40+ heartbeat messages in 10 minutes. Actual important notifications — task completions, errors, alerts — disappeared into the noise.

Same root cause: workers had access to patterns that were individually harmless but systemically destructive. A single background `exec` isn't a problem. Dozens of them triggering notification events is.

## The Fix

The immediate fix was simple: deny `gateway restart` in all worker tool configurations. Workers can read source code. They cannot modify the runtime or restart it. Period.

The broader fixes addressed the systemic issues:

**Disk space monitoring.** A startup guard checks available disk space and refuses to start if it's below threshold. The memory supervisor also factors disk pressure into its decisions.

**Restart rate limiting.** If the system detects more than N restarts within M minutes, it enters a cooldown period where automatic restarts are blocked. Only manual intervention can break the cooldown.

**Background exec ban.** All background execution patterns — `&`, `nohup`, `sleep &&`, `disown` — are banned in worker tool configs. Workers run synchronous commands only. This eliminated the heartbeat spam entirely.

**PID file hygiene.** Startup now forcefully cleans stale PID files. Process management is more defensive about the previous instance's state.

## What I Learned

The instinct, when building agent systems, is to give agents maximum capability and trust them to behave. This is wrong. Not because agents are adversarial — they're not. They're doing exactly what you told them to. The problem is emergent behavior.

A worker that restarts the system is being helpful. A dozen workers that each restart the system are a denial-of-service attack. The difference isn't intent — it's the system dynamics that individual agents can't see.

**Permission boundaries are architecture, not configuration.** The question isn't "can this agent be trusted?" It's "what happens if 10 of these agents all do the same thing at the same time?" If the answer is "catastrophe," the permission shouldn't exist regardless of how trustworthy each individual agent is.

**Defense in depth beats clever permissions.** We didn't need a sophisticated permission system that tried to figure out when a restart was appropriate. We needed a hard deny. Simple rules, consistently enforced, are more reliable than complex rules that try to be smart.

**Rate limiting is a first-class concern.** Any action that can be repeated — restarts, notifications, file writes, API calls — needs a rate limit. Not "should have" one. Needs one. The absence of a rate limit is a latent incident waiting for the right trigger.

The restart loop was the most expensive lesson Lobs taught me: 9 hours of degraded service, lost work across multiple active tasks, and a weekend morning spent reading crash logs. But it permanently changed how I think about agent permissions. Every new capability now gets evaluated not as "is this useful?" but as "what happens when this runs in a loop?"

So far, nothing has caught us twice.

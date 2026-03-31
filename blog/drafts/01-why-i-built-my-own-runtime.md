# Why I Built My Own Agent Runtime

The honest answer is: I didn't plan to.

Each version of Lobs existed because the previous one hit a wall. Not a soft wall — a hard architectural ceiling where the only move was to rebuild from scratch or accept permanent limitations. Eight times, I chose to rebuild. Here's why.

---

## v1: The Ceiling of One

It started inside OpenClaw, a powerful AI coding tool that gave me my first real playground for building agent workflows. I added a custom task framework — a way to queue work, track status, hand off to a single agent. Simple. It worked. Then I needed two things to happen at the same time.

You can't parallelize a single agent. There's no "add another worker" switch when your entire orchestration layer is built around one. The architecture had to change.

## v2: Many Agents, No Memory

Multi-agent made parallelism possible: Programmer, Writer, Researcher, Reviewer, Architect — each specialized, each running independently. Tasks routed to the right agent, multiple running simultaneously.

What it couldn't do was learn. Every session started fresh. An agent that debugged the same class of bug last Tuesday had zero recollection of it this Tuesday. The system was getting work done but not getting better. Shared memory was the obvious fix — and obvious fixes in agent systems are rarely simple.

## v3: The Learning Layer

Reflection and shared memory changed the character of the system. Agents would complete a task, extract lessons from what went well or didn't, and write those to a shared memory store. The next agent to encounter a similar problem had access to that context.

Week-over-week, the system improved without manual intervention. Mistakes stopped repeating — at least the ones that had been made before. This is when Lobs started feeling less like a tool and more like a system.

But now there was a new problem: I had a multi-agent learning system with no real API surface. It was still living inside OpenClaw, which meant I was working within the session lifecycle and execution model of a host platform — as you always are when building inside one. When I wanted health monitoring, a task queue, and proper REST endpoints, I wanted to own that layer myself.

## v4: The Web Server Era

FastAPI backend, REST API, task queue, health monitoring. A SwiftUI macOS app and an iOS app for dashboarding. This was peak "running my own infrastructure" energy. The system could accept tasks from anywhere, report status, and orchestrate agents across proper HTTP boundaries.

It also introduced the first real operational complexity. A Python FastAPI service plus OpenClaw plus agents communicating over localhost — three moving parts that could each fail independently. I spent more time debugging IPC than I spent on actual features. The more I added, the more surface area there was to break.

The workflow engine is what finally broke the architecture.

## v5: Workflows Expose Everything

Nineteen workflow definitions. State machines with conditional branching and rollback. Event-driven triggers. Cron scheduling. A DAG-based execution model where tasks have explicit dependencies and the engine handles ordering.

This was the most powerful version of Lobs yet — and it made every structural weakness in the underlying architecture visible. You can't have a clean workflow engine running on top of a messy execution substrate. The boundaries leak. Error handling in the workflow layer fights with error handling in the agent layer. State in the host platform and state in the workflow engine occupy the same space. The system was powerful enough to expose its own foundations as inadequate.

The Python codebase had also grown to ~38K lines. Most of it was fine. Some of it was not. A full rewrite was overdue.

## v6: The TypeScript Rewrite

The rewrite accomplished two things: it consolidated ~38K lines of Python into a leaner TypeScript core, and it made Lobs a proper OpenClaw plugin rather than a separate service. Single process. No IPC. No separate service to deploy.

The improvement was immediate — simpler deployment, faster iteration, fewer failure modes. OpenClaw was an excellent host for this phase. But I wanted to understand every layer of agent execution myself — not because the platform was insufficient, but because that depth of understanding was something I needed to build deliberately.

## v7: Visibility

Nexus, a React + Vite dashboard, arrived in v7. Self-hosted at lobslab.com via Caddy reverse proxy and a Cloudflare Tunnel — which meant the dashboard was reachable anywhere without port-forwarding gymnastics.

This was less a structural change and more a maturity signal: the system had gotten complex enough that a proper UI was necessary, not optional. Watching tasks move through states, seeing worker run timelines, inspecting artifacts — these went from nice-to-have to required for operating the system reliably.

But the dashboard also made the layering more visible. Nexus showed real-time state pulled from lobs-core APIs, which ran inside OpenClaw, which meant restarting OpenClaw to update the runtime also disrupted everything downstream. The runtime and its host were coupled in ways that were becoming harder to work with.

## v8: Cut the Cord

The current version of lobs-core has no dependency on OpenClaw or any other AI tool. It's a standalone Node.js process with its own:

- LLM execution loop (direct API calls to Anthropic, OpenAI, or local LM Studio)
- Worker lifecycle management (spawn, supervise, timeout, retry)
- Discord bot integration (primary interaction surface)
- Memory supervision (starts, monitors, and recovers the memory server)
- Workflow engine (unchanged — this survived every rebuild)
- Task database (SQLite, directly owned)
- REST API (for Nexus and external integrations)
- CLI (`lobs start`, `lobs stop`, `lobs status`, `lobs logs`, etc.)

63K lines of TypeScript. Six specialized agents. Five model tiers. The system runs 24/7 on a Mac Mini and handles everything from code review to research to documentation to architecture planning.

The decision to build a fully custom runtime wasn't about OpenClaw being insufficient — it's a powerful tool that gave Lobs its start. It was about wanting to understand every layer of agent execution from scratch. I'm preparing to teach EECS 498: Applied Agentic Software Engineering at the University of Michigan, and I believe the only way to teach something this deep is to have built it yourself. Agent systems are the career I'm building toward, and that requires owning the full stack — not because the alternatives are bad, but because the understanding matters.

The freedom to make arbitrary architectural decisions — pick any model, implement any tool, own the full execution loop — is what made all the subsequent work possible.

---

## What Actually Changed

Looking back, the version history isn't really a story about adding features. It's a story about removing constraints, one at a time.

v1 removed the single-agent ceiling. v2 removed the parallelism ceiling. v3 removed the memory ceiling. v4 gave it API surface. v5 gave it a proper workflow model. v6 simplified the stack. v7 made it visible. v8 made it independent.

Every rebuild felt costly in the moment. Weeks of work to end up with roughly the same feature set, but on better foundations. In retrospect, every one of them was the right call. Bad foundations compound. The system you can build on top of a proper foundation is an order of magnitude more capable than the one you can bolt onto a bad one.

The other thing that changed: each version taught me something the previous one couldn't. You can't learn what breaks in production until you're in production. You can't learn what's worth optimizing until you've run it at real load. The rewrite cadence, which felt wasteful, was actually the fastest path — because each version produced knowledge that made the next one better.

I built my own agent runtime because I needed to understand it completely — not just use it. Building Lobs inside OpenClaw was the right place to start: it's a capable platform that let me move fast and learn what agent systems actually need. But to teach this well, and to build a career at this layer of the stack, I needed to have built every piece myself. The rewrites weren't failures. They were the curriculum.

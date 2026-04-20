# One Agent Per Course

The first design question for CourseClaw wasn't "how do we build a course AI?" It was "how do we make sure it can't go rogue?"

We're building an AI teaching assistant for EECS 498: Applied Agentic Software Engineering at the University of Michigan — a course about building agent systems, where the TA is an agent system. That recursion is either interesting or terrifying depending on how well the guardrails hold.

Here's how we thought through the architecture.

---

## The hard rules

Before any other decisions, four rules were established that nothing can override:

1. **Student-originated messages never trigger writes to course material.** Students can ask questions. They cannot cause the agent to open a pull request, edit a lecture, or modify anything. Only instructor-sourced signals can initiate write actions.

2. **Knowledge scope is enforced at the data-fetch boundary, not in prompts.** The agent doesn't see content it's not supposed to see because that content is never fetched — not because we're hoping a well-worded prompt will keep it in lane.

3. **Every action is audited.** Every tool call, every PR opened, every message sent goes into an audit log. Not optional.

4. **Course content and agent workspace live in separate repos.** The agent has its own Git workspace (`aase-f26-openclaw`) separate from the course materials repo. Cross-contamination of those namespaces is a structural impossibility, not a policy.

These constraints came first. The architecture is designed around enforcing them.

---

## One container per course

The central decision: each course gets its own OpenClaw instance, running in a dedicated Docker container, with its own workspace mounted from a Git repo.

[OpenClaw](https://github.com/openclaw/openclaw) is an existing open-source agent framework. We're not building the runtime — we're building the course operations layer on top of it. CourseClaw handles the dashboard, Postgres, ingestion pipeline, signal routing, and container lifecycle. The OpenClaw container handles agent execution.

Why one container per course rather than a shared instance?

Isolation. A shared instance creates the possibility of cross-course contamination — course A's context leaking into course B, one course's high load affecting another's response times, a misconfigured tool in one course affecting the others. A per-course container means the blast radius of any problem is bounded to that course.

It also means each course gets a complete, inspectable workspace. The agent's `AGENTS.md`, `SOUL.md`, `USER.md`, `policies.yaml` — all of it lives in a course-specific Git repo that instructors can read, audit, and adjust directly. There's no shared configuration to accidentally break.

The trade-off is operational complexity. Running many courses means running many containers. For v0, targeting exactly one course, that's a problem we've explicitly deferred.

---

## Instructor-first, not student-first

Most educational tools are designed around the student experience. CourseClaw is designed around the instructor experience, with students as a secondary surface.

The logic: instructors are the people whose signals actually change the course. A student asking "when is the lab due?" gets a direct answer from the agent. An instructor evaluating a lecture — marking it as too fast, noting that students struggled with a specific topic, flagging a depth gap — becomes a signal that OpenClaw processes, turns into a draft fix, and opens as a pull request against the course materials.

The instructor evaluation form is the primary write interface. It's opinionated:

- **Duration**: how long the actual lecture ran
- **Depth score**: 1-5, did it go deep enough?
- **Breadth score**: 1-5, did it cover enough ground?
- **Pace score**: 1-5, did it move at the right speed?
- **Notes**: freeform

These scores feed directly into the signal router, which batches them into OpenClaw as structured context for the next agent run. The agent sees `Lecture 7: depth=2/5, breadth=4/5, notes: students lost after mutex section` and knows what to look at.

Students can ask questions. They can see upcoming deliverables and phase progress. They cannot drive the agent's write behavior.

---

## The ingestion pipeline

CourseClaw ingests a course manifest — a structured description of the course, its lectures, labs, and phase schedule — and populates Postgres. The dashboard reads from Postgres. OpenClaw reads from the mounted workspace, which is kept in sync through the audit mirror.

The signal router sits between the dashboard and OpenClaw. When an instructor submits an evaluation or schedules a prep task, the router converts that into an OpenClaw signal and fires it over HTTP to the running container. OpenClaw processes the signal in context of the current workspace state — which lectures exist, what evaluations have been filed, what prep work is scheduled — and decides what to do.

The audit mirror runs in the other direction. When OpenClaw writes to its workspace, those writes sync back to Postgres so the dashboard reflects the current state. The dashboard never talks directly to OpenClaw; it reads from the mirror.

---

## Scope discipline

v0 targets exactly one course: EECS 498 AASE, Fall 2026.

Multi-course support would require multi-tenant auth, cross-course isolation policies, per-course billing, and a lot of infrastructure we don't need yet. Building it all before knowing whether the single-course version works is a way to accumulate complexity that may never pay off.

The per-course container model is inherently multi-tenant — adding a second course would be a second container with a second workspace and second Postgres schema. The architecture can scale. The current scope just doesn't.

---

## What's hard

The easy parts of CourseClaw are the dashboard and data model. Those are standard web app problems.

**Signal fidelity.** The agent is only as good as the signals it receives. If instructor evaluations are vague or inconsistent, the agent's outputs will be too. The ingestion pipeline has to normalize signals well enough to act on them without losing the specificity that makes them useful.

**Trust calibration.** How much should the agent do autonomously versus proposing and waiting for approval? Opening a PR to fix a typo is low-risk. Restructuring a lab to address a systemic depth gap is not. The `policies.yaml` in the agent workspace controls this, but calibrating it for a real course requires actually running it.

**Audit completeness.** An audit log with missing entries is worse than no audit log. When something goes wrong — and something will — the trail needs to be complete enough to reconstruct exactly what happened.

We'll know how well we got these right when the course runs in Fall 2026. Building a course about agentic systems on top of an actual agent system is either the right way to test it, or the most direct path to a very memorable incident post-mortem.

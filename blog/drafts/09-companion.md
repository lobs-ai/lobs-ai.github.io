# Building a Collaborator, Not a Chatbot

The difference between a chatbot and a collaborator is context. A chatbot answers questions. A collaborator already knows who you are, what you're working on, and where things stand. Building that required solving three problems: local execution, permanent memory, and a UI that feels native.

Lobs Companion is a macOS app that runs entirely on my machine. It knows my projects. It remembers what we've worked on. It edits files alongside me. It doesn't have a server.

---

## Why local

Cloud-hosted agents have three problems: latency, privacy, and amnesia.

Latency is real. Round-tripping to a cloud service on every message adds up when you're doing iterative work. A local runtime answers from the same process without a network hop.

Privacy is obvious but easy to understate. Every message you send to a cloud agent gets logged, potentially used for training, and stored on someone else's infrastructure. For work on private codebases, that's a real concern.

Amnesia is the one nobody talks about. Every cloud chat session starts fresh. The assistant has no idea what you worked on yesterday, what your codebase looks like, or what you prefer. You spend tokens re-explaining context every session. Companion fixes this.

---

## Three memory layers

Companion has three memory layers that serve different purposes:

**Session memory** is the full transcript of the current conversation. It's active, it's ephemeral, and it disappears when the window closes.

**Project memory** is per-repository. When Companion starts in a project, it reads `AGENTS.md`, `README.md`, and git state to build a picture of the codebase. That picture persists across sessions.

**Permanent memory** is cross-session. After each session ends, the AI extracts key facts, learnings, and preferences and writes them to permanent storage. The next time you open Companion, it already knows what you figured out last time.

The combination means you never re-explain the same thing twice. The project context loads on startup. The session builds on top of it. When it ends, the useful parts get promoted to permanent memory.

---

## The socket bridge

Companion is a Tauri (Rust) app with a React frontend and a Node.js agent runtime. The frontend and runtime don't talk over HTTP — they talk over a Unix domain socket at `~/.lobs-companion/run/agent.sock`, using newline-delimited JSON-RPC 2.0.

Why a socket instead of stdin/stdout? Bidirectionality and clean stdout. When the runtime sends progress over stdout, it becomes hard to distinguish from structured messages. The socket gives you a clean, bidirectional channel. The `run/` directory gets `chmod 0700` — no other user on the machine can connect.

The messages themselves are simple: `user_message`, `token` (streamed), `tool_call`, `tool_result`, `confirm_tool` (for anything needing approval), `cancel`, `shutdown`. The frontend renders each one as it arrives.

---

## The UI

Three panels: context (what the agent knows), conversation (the chat), tool output (what tools are doing). The panels are keyboard-navigable — you shouldn't need the mouse.

The design is dark glass morphism: `#0A0A0F` background, frosted glass panels with 20px blur, `#6366F1` indigo accent. SF Pro for text, SF Mono for code, SF Symbols for icons. Transitions use spring physics — damping 0.8, response 0.3 — not linear easing.

It sounds like aesthetic detail but it matters. An AI collaborator you open every day should feel like a native macOS app. Glass and spring physics are what native macOS apps feel like. Linear easing and flat backgrounds are what web apps ported to Electron feel like. The difference is noticeable within thirty seconds.

---

## Bidirectional editing

Both I and the agent can edit files in the open project. Changes either of us makes are visible to the other immediately. There's no "export to editor" step — the agent edits files on disk and I see them in my editor.

The mtime staleness check from `@agentic/tools` matters here. If I edit a file while the agent has it open, its next edit attempt will fail with a staleness error. It has to re-read before it can continue. This is the same safety mechanism Claude Code uses, and it's the reason that class of conflict doesn't cause silent corruption.

---

## What makes it a collaborator

The phrase "not a chatbot" is easy to say. What it means in practice: Companion maintains state about who I am and what I'm working on across every session. It remembers the decisions we made, the patterns in my code, and the preferences I've expressed. The context panel shows exactly what it knows about the current project.

A chatbot is a stateless question-answering tool. Companion is stateful. The difference compounds over time. After a few weeks of sessions, it starts acting less like a tool I'm configuring and more like a collaborator I've worked with for a while.

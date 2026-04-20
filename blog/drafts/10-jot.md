# Private Notes, Local AI

I wanted to take notes and have AI help me organize them. Every tool I tried either stored my data on someone's cloud or required an API key and charged per query. Jot is what I built instead: capture notes in plain English, let local models analyze them in the background, search and summarize from the command line. All private, all free.

---

## The two problems

Cloud note-taking has a privacy problem. Every note you write lives on someone else's server. For personal logs, meeting notes, and work context, that's a real concern.

API-based AI analysis has a cost problem. Running every note through GPT or Claude adds up fast. For background enrichment on hundreds of notes over months, the per-token cost is significant.

Local models solve both. They run on your machine. They cost nothing per query. They're fast enough for background classification, tagging, and extraction. They're not great at creative writing or complex reasoning — but tagging a note and extracting action items is a different task, and they're good at it.

---

## Instant capture, async analysis

The core architecture is instant capture with async enrichment.

```bash
jot add "met with advisor, discussed timeline for paper, need to have draft by June 1"
```

That saves to SQLite immediately and returns an ID. Done. You can keep working. In the background, a detached worker process picks up the new note and sends it to the local model. The model extracts tags, action items, linked notes, and project associations. Those get written back to the note record.

The capture path has zero AI latency. The enrichment path happens offline, async, at whatever pace the local model runs. By the time you next search or summarize, the note is fully analyzed.

This is the same pattern lobs-core uses for agent workers: submit fast, process in background, query the results later. It works for notes for the same reason it works for agent tasks: the user doesn't want to wait.

---

## What the local model does

For each note, the model extracts:

- **Tags** — topic labels for the note
- **Action items** — things that need to happen
- **Linked notes** — other notes in the database this one relates to
- **Projects and people** — structured entities mentioned in the note
- **Urgency flag** — whether this note describes something time-sensitive

None of this requires a frontier model. A local Qwen or Llama running in LM Studio handles it well. The prompts are straightforward classification tasks: "here is a note, extract the following fields." Local models are reliable at this.

The extracted data lands in SQLite alongside the raw note. When you run `jot search "paper deadline"`, it searches against raw content and extracted fields. When you run `jot summarize`, it aggregates action items and tag frequency across all notes. The AI did the work asynchronously; the query is just a database read.

---

## The three-tier daemon

Jot runs a background daemon with three tiers of proactive behavior:

**Tier 1** runs every 15 minutes: sync Gmail and Google Calendar (if connected), analyze any unprocessed notes, check for overdue todos. Cheap, fast, runs constantly.

**Tier 2** runs every morning at 7:30am: generate a daily digest of outstanding action items, upcoming calendar events, and open todos. Delivered to Discord or terminal.

**Tier 3** is event-driven: fires immediately on overdue todos, urgent note flags, or high-priority incoming email.

The tier structure exists for the same reason the lobs-core monitor uses rule detectors before LLM calls: most checks should be cheap and produce nothing. Only the morning digest involves a real LLM call to produce human-readable output. Everything else is rule evaluation on structured data.

---

## The learning file

All prompts inject `~/.jot/user.md`, a two-section file. The first section is manual: I wrote a short description of who I am, what I'm working on, and what kinds of notes I take. The second section is auto-maintained: after each batch of analysis, the model appends new things it learned about me — recurring people, active projects, patterns in my notes.

Over time, the AI's tagging improves because it understands context. A note about "the advisor meeting" gets tagged correctly because the user file says who my advisor is and what project we're working on. The accuracy compounds.

The full file is plain markdown in `~/.jot/user.md`. I can read it, edit it, or delete the auto-learned section if it drifts. No black-box model state.

---

## What it replaces

I used to take notes in a markdown file, run occasional grepping, and lose most of the action items by the next day. The capture was fine; the retrieval was manual and unreliable.

Jot didn't change the capture behavior. It added async enrichment, structured search, and a daemon that surfaces what I'd otherwise forget. The notes still live on my machine as rows in a SQLite database. The AI made them queryable and proactive. That's the whole thing.

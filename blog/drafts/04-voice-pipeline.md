# Teaching an Agent to Listen

Up until last week, Lobs could read, write, search, and talk — but only through text. Discord messages, task descriptions, code diffs. Everything was typed. If you wanted to interact with the system, you opened a channel and started writing.

That was fine for async work. It's not fine for the two situations where text falls apart: real-time conversation and meetings.

---

## Why Voice Matters

Here's the thing about agent systems: most of the writing about them focuses on what the agent can *do*. Generate code, write docs, review PRs. Output. But the hard problem isn't output — it's input. How does the agent know what you need?

Text works great for well-defined tasks. "Review this PR." "Write a migration for the users table." Clean, unambiguous, easy to parse. But a lot of real work doesn't start that way. It starts in a voice channel at 11 PM when someone says "hey, what if we changed the way routing works?" or during a standup where three people are talking over each other about priorities.

I wanted Lobs in those conversations. Not transcribing them after the fact — actually in the room, listening, and occasionally having something useful to say.

That meant building two things: a voice pipeline for Discord, and a live meeting transcription system for the browser.

## The Sidecar Approach

The obvious way to add voice to an agent is to pipe audio to a cloud speech API, get text back, run it through the LLM, convert the response to speech with another cloud API, and send it back. OpenAI, Google, and Deepgram all offer this. It works.

I didn't want to do it that way.

The problem is dependency. Lobs already runs on a Mac Mini in my apartment. The whole design philosophy is local-first: SQLite for the database, LM Studio for cheap inference, the memory server running on the same box. Adding a hard dependency on cloud speech services for the default voice mode felt like backsliding. The Mac Mini has an M-series chip with a perfectly capable Neural Engine. It can run speech-to-text locally.

So the default voice mode — what I'm calling "sidecar" mode — runs entirely on local hardware. The pipeline looks like this:

Discord Opus audio → decode to PCM → local whisper.cpp for STT → Claude for the agent response → Chatterbox TTS for speech synthesis → encode to Opus → Discord audio back.

No cloud speech services. The Mac Mini does the heavy lifting. Whisper.cpp runs the `base.en` model, which is fast enough for conversational latency on Apple Silicon. Chatterbox handles text-to-speech. The whole thing stays on the box.

The sidecar process (whisper.cpp + Chatterbox) is managed by VoiceSidecar, which handles the lifecycle: start the services when a voice session begins, health-check them, restart if they crash, shut them down when the session ends. It's the same supervision pattern I use for the memory server — treat local services as processes that need babysitting.

## Voice Activity Detection

You can't just send a continuous audio stream to whisper.cpp. Or rather, you can, but you'll burn compute transcribing silence and background noise. You need to know when someone is actually talking.

VADProcessor handles this with a straightforward approach: RMS energy threshold plus silence duration tracking. Calculate the root-mean-square energy of each audio frame. If it's above the threshold, someone's talking. If it drops below the threshold and stays there for long enough (configurable, but around 300ms of silence), the utterance is complete.

It's not fancy. It doesn't use a neural VAD model. But it works well enough for Discord voice channels where background noise is relatively controlled. The main thing it prevents is sending 30 seconds of silence to whisper.cpp every time someone pauses to think — which would waste both compute and latency budget.

## The Discord Bridge

Discord voice is its own little world. Audio comes in as Opus-encoded packets, one stream per user. You have to handle the codec layer, mix or separate user streams, and manage the connection lifecycle.

VoiceReceiver captures the incoming Opus streams and decodes them to PCM. Each user gets their own audio buffer. When VAD signals that a user has finished speaking, the accumulated PCM is sent to whisper.cpp for transcription.

VoiceSpeaker goes the other direction: takes PCM audio from the TTS engine and plays it back through Discord's audio player. There's some buffering work here — Discord expects a steady stream of Opus frames, and TTS output arrives in chunks. The speaker smooths that out.

VoiceTranscript sits in between, maintaining a conversation history. This is important because voice conversations have context. If someone asks "what about the other approach?" the agent needs to know what was discussed 30 seconds ago. The transcript keeps a sliding window — 20 exchanges by default — and feeds it to Claude as conversation context. Without this, every utterance would be interpreted in isolation, which makes for a frustrating conversational partner.

VoiceManager ties it all together. One session per Discord guild. When someone joins a voice channel and the bot is present, VoiceManager spins up the pipeline: receiver, VAD, transcript, sidecar services. When everyone leaves, it tears it down.

## Trigger Modes

Not every conversation in a voice channel is directed at the agent. Sometimes people are just talking to each other. So there are two trigger modes:

**Keyword mode** (default): the agent only processes speech that starts with "hey lobs." Everything else is ignored. This is the polite option — the agent is present but not intrusive.

**Always-on mode**: the agent listens to everything and can jump in when it has something relevant to say. This is more useful for small group sessions where you actively want the agent participating, but it's opt-in because having an AI comment on every sentence gets old fast.

## The Realtime Alternative

Sidecar mode is the default because it's local and free. But it's not fast. The pipeline — Opus decode, whisper.cpp transcription, Claude API call, Chatterbox TTS, Opus encode — adds up. You're looking at 2-4 seconds of latency on a good day. That's fine for "hey lobs, what's the status of the deployment?" It's not fine for rapid back-and-forth conversation.

For that, there's realtime mode. This uses OpenAI's Realtime API, which is a WebSocket-based speech-to-speech system. The architecture is different: instead of decomposing audio into text and back, you send audio in and get audio out. The model handles STT and TTS internally, and latency drops below a second.

RealtimeVoiceSession bridges Discord audio to the OpenAI WebSocket. It takes Discord's Opus packets, decodes them to the PCM format the Realtime API expects, sends them over the WebSocket, receives audio responses, and pipes them back to Discord.

The tradeoff is cost and dependency. Realtime mode burns OpenAI API credits for every second of audio, and it requires an active internet connection to their API. Sidecar mode costs nothing beyond electricity. So sidecar is the default, and realtime is there for when you need the conversation to feel natural.

## Live Meeting Transcription

Voice in Discord is one thing. But a lot of important conversations happen in meetings — Zoom calls, Google Meet, in-person standups with a laptop on the table. I wanted Lobs to be useful there too.

The meeting transcription system works through the browser. The Nexus dashboard (Lobs's React frontend) has a meeting recorder that uses the MediaRecorder API to capture audio from the user's microphone — or, if you're sharing a tab, from the meeting itself.

The architecture is deliberately simple. The browser records 30-second audio chunks. Each chunk gets POSTed to the backend. The backend hands it to whisper.cpp for transcription. The transcribed text gets appended to a running transcript. The frontend polls for updates every few seconds.

I chose polling over WebSockets here. It would have been cleaner to push transcript updates in real-time over a WebSocket connection. But polling is simpler to implement, simpler to debug, and the latency difference (a few seconds at most) doesn't matter for meeting transcription. You're not having a conversation with the transcriber. You just want to see the words appear on screen reasonably quickly.

## The AI Activity Feed

The transcript alone is useful. But the thing that makes it actually worth building is what happens to the transcript while the meeting is still going.

Every time new transcript text arrives, the system feeds the full accumulated transcript to an LLM and asks it to analyze what's happening. The LLM produces typed insights — structured objects with a category, content, and metadata:

- **📝 Note** — key points being discussed. "Team decided to delay the v3 migration until after the security audit."
- **✅ Action** — action items with an assignee and priority. "Marcus to update the deployment script by Friday."
- **⚠️ Flag** — concerns or risks raised. "No one has tested the rollback procedure since January."
- **🔍 Context** — relevant background. "The API rate limit was last increased in December — may need another bump."
- **❓ Question** — open questions that need resolution. "Who owns the monitoring dashboard after the reorg?"

These appear in a live activity feed alongside the transcript. So while you're in a meeting, the AI is quietly extracting structure from the conversation: what was decided, what needs to happen next, what risks were mentioned, what's still unresolved.

I've sat in enough meetings where everyone walks away with a different understanding of what was agreed upon. The activity feed is my attempt to fix that — not by replacing note-taking, but by running a parallel process that catches the things humans miss because they're busy actually participating in the conversation.

## Auto-Titling and Participants

After enough transcript accumulates (usually a few minutes), the system takes a pass at generating a title and detecting participants. If people say each other's names — "Marcus, can you handle that?" — it picks up on those references and lists participants.

Meeting types get detected too: standup, 1:1, planning, review, retro, brainstorm. This isn't magic — the LLM looks at the conversation patterns and content and picks the closest match. It's useful for organizing meetings after the fact, since "standup 3/26" is more searchable than "meeting 47."

## After the Meeting

Sessions stay in memory while recording is active. Nothing hits the database until you finalize the meeting. This is a deliberate choice — I didn't want half-finished meeting transcripts cluttering the persistent store, and I wanted the option to discard a recording that didn't work out.

When you finalize, a few things happen. The full transcript gets analyzed one last time. Action items are extracted and can be automatically converted into tasks in the task system. There's a Discord share endpoint that formats a meeting summary for posting to a channel. And if you're using WhisperX with a Hugging Face token, you get speaker diarization — the transcript gets re-processed with speaker labels so you can see who said what.

The meeting-to-task pipeline is the part that saves the most time. A 30-minute planning meeting that surfaces 8 action items: those used to require someone to manually type them into the task tracker. Now they show up automatically, with assignees and priorities, ready to be confirmed or adjusted.

## 4,500 Lines Later

The voice module is about 3,300 lines of TypeScript. The meeting module is another 1,200. That's a lot of code for what sounds like "add a microphone." But the complexity is real — audio codec handling, process lifecycle management, voice activity detection, conversation state, real-time analysis pipelines, chunked upload processing. Each piece is straightforward in isolation. The integration work is where the time goes.

What I'm most satisfied with is the local-first design holding up. The sidecar approach — whisper.cpp and Chatterbox running on the same Mac Mini as everything else — means the default voice experience has no cloud dependency beyond the LLM call itself. That's consistent with how the rest of the system works: own the infrastructure, minimize external dependencies, keep it running on hardware you control.

## What This Enables

Voice and meeting transcription are input channels. They don't change what the agent can do — they change what the agent knows about. And that turns out to matter a lot.

Before this, Lobs only knew about work that was explicitly written down: task descriptions, Discord messages, code changes. Everything that happened in voice conversations or meetings was invisible unless someone typed it up afterward. Now those conversations are captured, analyzed, and fed back into the system.

The action items from a standup become tasks. The concerns raised in a planning meeting become flags in the project tracker. The decision made in a voice channel at midnight gets recorded in the transcript instead of lost to the ether.

The agent didn't get smarter. It got better ears.

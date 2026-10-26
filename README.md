# Crowd Says

A text-based survey guessing party game for **one person against bots**, **individual multiplayer**, or **two competing teams**. Guess the popular answers, reveal the board, and race for the highest score.

Built with Node.js and plain browser JavaScript. No external packages, paid APIs, or API keys are required.

## How to play

1. For a quick game alone, click **Play against a bot** on the home screen. Optional: enter your name in the Create a room form first.
2. To play with friends, enter your name, choose individual or team play, and create a room. Friends enter their own names and the room code; in team mode they choose Coral or Mint. The host joins Coral.
3. The host can click **Add bot** in the lobby. Bots join the smaller team automatically and display names such as Ram Bot, Rome Bot, and Alexa Bot.
4. Once everyone has joined, the host starts. Each of five rounds lasts up to 60 seconds. Each player gets five text guesses. First to claim a hidden answer earns its preset points; misses and already-claimed answers still use an attempt.
5. After each round, the host advances. Highest individual total, or combined team total, wins. Tied leaders share the win.

Rooms support up to 24 participants, including bots. At least two participants are needed; a person and a bot is enough. Team mode needs at least one participant per team.

All boards are **AI predictions, not actual survey data**. The bundled 12 boards and exact-match synonym lists are fixed before play. There is no API key or live AI scoring. Only revealed answers are sent to browsers. Team players choose Coral or Mint when joining (the creator joins Coral). Both teams must have players to start.

## Run

```sh
npm start
```

Requires Node.js 20 or newer. Open [http://localhost:3000](http://localhost:3000). There is no dependency installation or frontend build step. To choose another port, set the `PORT` environment variable before starting.

To test alone, create a room, click **Add bot**, then **Start game**. Works in individual and team modes; bots join the smaller team automatically. The home screen also has a Play against a bot shortcut. These are scripted casual practice opponents, not live AI players. They choose 3–5 guesses from independent prompt-specific vocabulary, including plausible wrong answers, without inspecting hidden answers, points, or claimed slots. Each guess has a randomized 7–11 second delay. They can leave valid answers unguessed. They use the same guess validation, five-attempt limit, first-claim scoring, and team totals as humans. Add bots only in the lobby.

Install Node.js 20 or newer, then run `npm start`. Open http://localhost:3000. Create a room and have others join using its six-character code. For devices on the same Wi-Fi, use the host computer's LAN IP and port 3000; allow inbound access if your firewall asks. `npm test` runs server integration tests.

## Deploy

`render.yaml` is a ready-to-import Render Blueprint using the Dockerfile and `/health` check. Push this project to your own Git repository, connect that repository in a Render account, and create a Blueprint from it. Review the free plan and provider terms before deploying. Once Render reports a successful deploy, verify its assigned HTTPS URL in two independent browser sessions before sharing it. No public URL has been provisioned by this project yet. Free hosting restarts or idle shutdowns can clear in-memory rooms.

The game has an **Invite a friend** control. On a public host it shows a link using that host's actual origin and `?room=CODE`, which prefills the join form without including a session token. In the localhost preview it explains that public hosting is required instead of presenting a local address as shareable. Friends must join before the game starts.

Use any host that supports a persistent Node HTTP server and streaming responses, or build the supplied Dockerfile. Set the start command to `npm start`; the server binds to `0.0.0.0` and respects `PORT` (default 3000). Health check: `/health`. No build step or secrets are needed. Configure HTTPS through your host and share the deployed URL. A hosting account and choice of provider are required for public deployment; this repository itself does not publish the app.

**Run exactly one instance.** Room state is in memory and resets on restart or deploy. Serverless functions and multiple replicas are unsupported. Rooms expire after 12 hours. For a larger public launch, add shared persistent state/pubsub, abuse protection, and load testing before increasing capacity. There is a 24-player room cap and a 1,000-room server cap, not a verified concurrency guarantee. Keep the host's browser session: the host controls round transitions, and its token is saved locally for reconnects. Leaving does not remove a player or transfer host ownership in this version. Clear your browser's saved session using Leave room. Do not share session tokens.

## Fairness

The server alone stores hidden boards, checks guesses, handles timers, and grants points. First processed valid claim wins simultaneous races. Host can end a round early for everyone. Exact normalized answers and listed synonyms are accepted; fuzzy semantic matching is intentionally absent. Refresh reconnects to the same identity. Guesses are private; successful claims are public. Names are displayed as text and session tokens are random. New players can only join the lobby.

## Checks and project layout

```sh
npm test
# With a local server already running on port 3000:
npm run verify:preview
```

Tests cover complete matches in both modes, hidden-board privacy, host permissions, attempt limits, duplicate claims, bot pacing and vocabulary, expired-session recovery, and invite-link origins. The preview check creates disposable rooms and verifies live streams, bot guesses, independent guest sessions, and reconnects. GitHub Actions runs the test suite on Node 20 and 22.

| Path | Purpose |
| --- | --- |
| `server.js` | HTTP server, room state, scoring, timers, live event streams |
| `boards.js` | Fixed AI-predicted question and answer boards |
| `bot-guesses.js` | Independent plausible practice guesses |
| `public/` | Responsive game interface |
| `test/` | Game and client recovery tests |
| `scripts/verify-preview.cjs` | Live local preview smoke check |
| `Dockerfile`, `render.yaml` | Single-instance deployment configuration |

## Current limits

This first version uses in-memory rooms, not durable storage. Restarting or redeploying clears them; expired saved sessions return to the home screen with a recovery message. A temporary connection interruption preserves your room identity and retries. Host handoff, player removal, accounts, contact lists, and automatic friend notifications are not implemented. Invite links make joining easier but still need to be shared. This version has not been load-tested for a large simultaneous launch.

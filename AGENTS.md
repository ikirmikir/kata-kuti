# AGENTS.md

For any coding agent working on Kata-kuti. Read this first, every session.

## What this is

Kata-kuti (কাটাকুটি): noughts and crosses with a friend, a game on [Ikirmikir](https://ikirmikir.com) and its open example of multiplayer rooms. Plain HTML, CSS and JavaScript in `public/`, no build step. MIT, public repo: anyone may copy it.

## Read before changing anything

1. The game builder guide: https://ikirmikir.com/developers/game-guide.md (rules, the paper and pencil look, the SDK, how a version goes live). Follow it.
2. `README.md`, then `public/game.js` (search for `SDK:`).
3. `git status` and `git log -10`. Never trust memory of an earlier conversation over the repo.

## How it works

- `public/ikirmikir.js` is the Ikirmikir game SDK 1.3.1, copied from https://ikirmikir.com/sdk/1.3.1/ikirmikir.js. Never edit it; replace it with a newer published file.
- Online: one player makes a room and invites a friend; each move goes to the other phone (relay), and both phones run the same rules. The player already in the room hands the newcomer their mark (`start` message). Don't decide roles by the order of `room.players`.
- One device: pass-and-play, also the only mode outside Ikirmikir (`ik.has("multiplayer")` is false there).
- Play time runs for the whole match (`clock` in `game.js`): one round is often shorter than the 20 seconds Ikirmikir needs to count a round for points and challenges. Keep it that way.
- The 10th online win earns the `champ` badge (wins kept in `ik.data`). Wins on one device don't count.
- No `<form>` submit (the player's sandbox blocks it): buttons and the Enter key.

## Testing

- Run: `npx serve public` (or any static server).
- Inside Ikirmikir: deploy, then paste the `https://` link in https://ikirmikir.com/developers/test/. Try one device, two phones in a room, a dropped connection and coming back, the sound switch, pausing.
- Check phone (375 px) and desktop widths, and `prefers-reduced-motion`.

## Rules

- Change gameplay only when asked. Keep the paper and pencil look (`public/style.css`).
- Commits as `Maruf <hi@maruf.ing>`, no AI co-author or "generated with" lines. Ask Maruf before pushing: `release` deploys to Cloudflare Pages (project `kata-kuti`), and a new version goes live only when Maruf adds its fixed link on Ikirmikir.
- Plain English in text, no em dashes. Record any outside asset and its license in `README.md`.

# Kata-kuti: noughts and crosses with a friend

The [Ikirmikir](https://ikirmikir.com) multiplayer example. Two players, each on their own phone: one makes a room and sends the invite link (or reads out the room code), the other joins, and every move goes to the other phone. Plain HTML, CSS and JavaScript, no build step. Copy anything you like.

- `public/ikirmikir.js` is the [Ikirmikir game SDK](https://ikirmikir.com/developers/sdk/) 1.3.1, copied next to the game.
- `public/game.js` uses it. Search for `SDK:` to see each call: `ik.multiplayer.create` and `join` (with the name the player typed), `invite`, `room.send`, `ik.sound.play("click")` for the menu buttons, the room's `join`, `leave`, `away`, `back`, `message` and `status` events, and catching a returning player up after a dropped connection. With SDK 1.3: the signed-in player's name is used with no name box (`ik.player.get`), online wins are kept in `ik.data`, and the tenth earns the `champ` badge (`ik.badges.award`).
- Play time is measured for the whole match, not each round (`gameplayStart` at the first round; `gameplayStop` on leaving, when the friend leaves, when the game is hidden, or a minute after a round without playing again). One round is often shorter than the 20 seconds Ikirmikir needs to count it.
- Who plays which mark: the player already in the room keeps theirs and sends the newcomer the other one (`start` message). Don't decide by the order of `room.players`: when the room's maker leaves and comes back, both players would pick the same mark.
- The pencil scratch for each stroke is made with Web Audio, so there are no sound files, and they stay quiet when Ikirmikir's sound switch is off (`ik.muted`).
- Online play works only inside Ikirmikir (`ik.has("multiplayer")`); anywhere else the game is pass-and-play on one device.
- It looks like ikirmikir.com: paper and pencil. A paper page, ink lines, hand-drawn boxes with an ink shadow, yellow for the button to press and whose turn it is, a blue cross and a red nought. The board, the marks and the line through three in a row are drawn in pencil by `game.js`, a little differently each time.
- Fonts: Kalam and Outfit, both SIL Open Font License 1.1, in `public/fonts/` with their licenses.
- `public/_headers` lets ikirmikir.com show the game in its player.

Run it locally with any static server, for example `npx serve public`, and try it in the Ikirmikir [test tool](https://ikirmikir.com/developers/test/).

MIT license.

The Ikirmikir player does not let games submit forms (its frame has no `allow-forms`), so the game uses buttons and the Enter key instead of a `<form>`.

## Navigation update, 13 November 2026

The home and Lobby/Resign toolbar match Chokkor. Existing online and pass-and-play modes remain; no computer mode was added. Signed-in names are used directly; guests can edit a remembered name. Join codes belong to the platform drawer and invite links open the name/join screen. Touch pass-and-play defaults to whole-page auto rotation. Sound continues to follow the platform. Leaving a round and resigning have explicit confirmations; Play again waits briefly after results. The whole-match clock and online-win badge behavior remain.

Validation: `node --check public/game.js` and `node --test test/ui.test.js` passed (5 tests). Checks cover names, pending-room cancellation/failure, ordinary winning rounds, resignation and confirmation. Browser boards inspected at 375 × 667 and 1280 × 800. No physical phone or live two-player room test was performed. Run a static server against `public/` to preview.

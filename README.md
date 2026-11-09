# Kata-kuti: noughts and crosses with a friend

The [Ikirmikir](https://ikirmikir.com) multiplayer example. Two players, each on their own phone: one makes a room and sends the invite link (or reads out the room code), the other joins, and every move goes to the other phone. Plain HTML, CSS and JavaScript, no build step. Copy anything you like.

- `public/ikirmikir.js` is the [Ikirmikir game SDK](https://ikirmikir.com/developers/sdk/) 1.2.1, copied next to the game.
- `public/game.js` uses it. Search for `SDK:` to see each call: `ik.multiplayer.create` and `join` (with the name the player typed), `invite`, `room.send`, `ik.sound.play("click")` for the menu buttons, the room's `join`, `leave`, `away`, `back`, `message` and `status` events, and catching a returning player up after a dropped connection.
- Who plays which mark: the player already in the room keeps theirs and sends the newcomer the other one (`start` message). Don't decide by the order of `room.players`: when the room's maker leaves and comes back, both players would pick the same mark.
- The pencil scratch for each stroke is made with Web Audio, so there are no sound files, and they stay quiet when Ikirmikir's sound switch is off (`ik.muted`).
- Online play works only inside Ikirmikir (`ik.has("multiplayer")`); anywhere else the game is pass-and-play on one device.
- It looks like ikirmikir.com: paper and pencil. A paper page, ink lines, hand-drawn boxes with an ink shadow, yellow for the button to press and whose turn it is, a blue cross and a red nought. The board, the marks and the line through three in a row are drawn in pencil by `game.js`, a little differently each time.
- Fonts: Kalam and Outfit, both SIL Open Font License 1.1, in `public/fonts/` with their licenses.
- `public/_headers` lets ikirmikir.com show the game in its player.

Run it locally with any static server, for example `npx serve public`, and try it in the Ikirmikir [test tool](https://ikirmikir.com/developers/test/).

MIT license.

The Ikirmikir player does not let games submit forms (its frame has no `allow-forms`), so the game uses buttons and the Enter key instead of a `<form>`.

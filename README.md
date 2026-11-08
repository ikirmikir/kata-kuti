# Kata-kuti: noughts and crosses with a friend

The [Ikirmikir](https://ikirmikir.com) multiplayer example. Two players, each on their own phone: one makes a room and sends the invite link (or reads out the room code), the other joins, and every move goes to the other phone. Plain HTML, CSS and JavaScript, no build step, no asset files. Copy anything you like.

- `public/ikirmikir.js` is the [Ikirmikir game SDK](https://ikirmikir.com/developers/sdk/) 1.1, copied next to the game.
- `public/game.js` uses it. Search for `SDK:` to see each call: `ik.multiplayer.create`, `join`, `invite`, `room.send`, the room's `join`, `leave`, `away`, `back`, `message` and `status` events, and catching a returning player up after a dropped connection.
- Online play works only inside Ikirmikir (`ik.has("multiplayer")`); anywhere else the game is pass-and-play on one device.
- `public/_headers` lets ikirmikir.com show the game in its player.

Run it locally with any static server, for example `npx serve public`, and try it in the Ikirmikir [test tool](https://ikirmikir.com/developers/test/).

MIT license.

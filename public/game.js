// Kata-kuti: noughts and crosses with a friend, the Ikirmikir multiplayer example (SDK 1.3.1).
// Online: one player makes a room and invites a friend; each move is sent to the other phone (relay mode, so both
// phones apply the same rules). Look for "SDK:" comments. Without Ikirmikir, it is pass-and-play on one device.
// Note: the Ikirmikir player doesn't let games submit forms, so buttons and the Enter key do the work instead.

const $ = id => document.getElementById(id);
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const NAME_RULE = /^[\p{L}\p{M}\p{N}_\- ]{1,16}$/u; // what the room server accepts
// Drawn like a pencil: a cross is two strokes one after the other, a nought one stroke that overshoots where it began
// (timed with sfx.scratch). Every mark wobbles a little differently, as by hand.
const wob = (n = 4) => (Math.random() * 2 - 1) * n;
const MARKS = {
  X: () => `<svg viewBox="0 0 100 100"><path pathLength="100" d="M${18 + wob()} ${18 + wob()}Q${50 + wob(6)} ${50 + wob(6)} ${82 + wob()} ${82 + wob()}"/><path pathLength="100" style="animation-delay:.24s" d="M${82 + wob()} ${18 + wob()}Q${50 + wob(6)} ${50 + wob(6)} ${18 + wob()} ${82 + wob()}"/></svg>`,
  O: () => {
    // a smooth, slightly uneven loop that ends a little inside where it began
    const a0 = -1.9 + wob(.3), ph = Math.random() * 6, sq = 1 + wob(.05), pts = Array.from({ length: 33 }, (_, i) => {
      const a = a0 + i / 32 * Math.PI * 2.1, r = 33 + Math.sin(a * 2 + ph) * 1.6 - i / 32 * 3;
      return [50 + Math.cos(a) * r * sq, 50 + Math.sin(a) * r / sq].map(v => v.toFixed(1)).join(" ");
    });
    return `<svg viewBox="0 0 100 100"><path pathLength="100" style="animation-duration:.42s" d="M${pts[0]}${pts.slice(1).map(p => "L" + p).join("")}"/></svg>`;
  },
};
// the board's four lines and the line through three in a row, in pencil (0 to 100 across the board)
const crooked = (x1, y1, x2, y2, bend = 1.6) => `<path pathLength="100" d="M${x1 + wob(.8)} ${y1 + wob(.8)}Q${(x1 + x2) / 2 + wob(bend)} ${(y1 + y2) / 2 + wob(bend)} ${x2 + wob(.8)} ${y2 + wob(.8)}"/>`;
const centre = i => [(i % 3 + .5) * 100 / 3, (Math.floor(i / 3) + .5) * 100 / 3];

let ik, room = null;          // the SDK, and the online room while in one
let myName = "";              // the signed-in player's name on Ikirmikir, if any
let online = false, me = "X"; // in an online game: which mark is mine
let board = Array(9).fill(""), round = 0, turn = "X", over = false, wins = { X: 0, O: 0 };

main();

async function main() {
  buildBoard();
  ik = await Ikirmikir.init({ gameId: "kata-kuti" });                    // SDK: start; never rejects
  const canPlayOnline = ik.has("multiplayer");                            // SDK: only inside Ikirmikir
  $("online").hidden = !canPlayOnline;
  $("offlineNote").hidden = canPlayOnline;
  ik.game.loadingDone();                                                  // SDK: Ikirmikir hides its loader
  try { myName = (await ik.player.get())?.name ?? "" } catch {}           // SDK 1.3: a signed-in player's name, for rooms
  ik.on("pause", () => { if (playingNow()) clock.stop() });               // SDK: the player left the game
  ik.on("resume", () => { if (playingNow()) clock.start() });

  // browsers allow sound only after a tap: start the sound engine on the first one, wherever it is
  addEventListener("pointerdown", sfx.wake, { capture: true });
  addEventListener("keydown", sfx.wake, { capture: true });
  // SDK: menu buttons make Ikirmikir's own click (it follows Ikirmikir's sound switch); the board has its pencil sound
  addEventListener("pointerdown", e => { if (e.target.closest?.("button:not(.cell)")) ik.sound.play("click") });

  $("toCreate").onclick = () => { $("name").value = myName || savedName() || newName(); show("create") };
  $("toJoin").onclick = () => { $("code").value = ""; show("join") };
  for (const b of document.querySelectorAll(".back")) b.onclick = () => show(b.dataset.to);
  $("create-go").onclick = create;
  $("name").onkeydown = e => { if (isEnter(e)) create() };
  $("join-go").onclick = toJoinName;
  $("code").onkeydown = e => { if (isEnter(e)) toJoinName() };
  $("play-go").onclick = join;
  $("name2").onkeydown = e => { if (isEnter(e)) join() };
  $("name2").oninput = () => say("joinNameMsg", `Joining room ${$("code").value}. Your friend will see this name.`);
  $("code").oninput = () => { $("code").value = $("code").value.toUpperCase().replace(/[^A-Z0-9]/g, ""); say("joinMsg", "Ask your friend for their 5-letter code.") };
  $("name").oninput = () => say("createMsg", "Friends will see this name. Change it if you like.");
  $("local").onclick = () => { online = false; wins = { X: 0, O: 0 }; startRound(0) };
  $("invite").onclick = () => room?.invite();                             // SDK: share sheet with the invite link
  $("cancel").onclick = leaveGame;
  $("again").onclick = () => { if (online) room.send({ t: "again", round: round + 1 }); startRound(round + 1) };

  // SDK: someone opened an invite link to a room, so join it straight away
  if (ik.multiplayer.invite) { $("code").value = ik.multiplayer.invite; toJoinName() }
  else show("home");
}

function leaveGame() { room?.leave(); room = null; clock.stop(); show("home") }

// Play time for a whole match, not each round (Maruf, 2026-11-12): one round of noughts and crosses is often shorter
// than the 20 seconds Ikirmikir needs to count a round, so the clock runs from the first round of a match until you
// leave, your friend leaves, the game is hidden, or a minute passes after a round without playing again.
const clock = (() => {
  let idle = 0;
  return {
    start() { clearTimeout(idle); ik.game.gameplayStart() },              // SDK: someone is playing
    between() { clearTimeout(idle); idle = setTimeout(() => ik.game.gameplayStop(), 60_000) },
    stop() { clearTimeout(idle); ik.game.gameplayStop() },                // SDK: play stopped
  };
})();
const playingNow = () => document.body.classList.contains("playing") && !over;

// ---------- names ----------
function savedName() { try { return localStorage.getItem("kata-kuti-name") ?? "" } catch { return "" } }
function newName() { return "usr_" + Array.from(crypto.getRandomValues(new Uint8Array(7)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("") }

// the typed name, tidied and remembered; null (with the reason shown) when it isn't allowed
function takeName(input, msg) {
  const name = $(input).value.trim().replace(/\s+/g, " ");
  if (!NAME_RULE.test(name)) { say(msg, "Use letters, numbers, spaces, _ or -, up to 16.", true); return null }
  try { localStorage.setItem("kata-kuti-name", name) } catch {}
  return name;
}

// ---------- online ----------
function create() {
  const name = takeName("name", "createMsg");
  if (name) enter(ik.multiplayer.create({ maxPlayers: 2, name }), "createMsg", "Making a room…");
}

// a code that looks right: ask for the name next
function toJoinName() {
  const code = $("code").value.trim().toUpperCase();
  if (code.length !== 5) return say("joinMsg", "Room codes have 5 letters and numbers.", true);
  $("code").value = code;
  $("name2").value = myName || savedName() || newName();
  say("joinNameMsg", `Joining room ${code}. Your friend will see this name.`);
  show("joinName");
}

async function join() {
  const name = takeName("name2", "joinNameMsg");
  if (!name) return;
  const joined = await enter(ik.multiplayer.join($("code").value, { name }), "joinNameMsg", "Joining…"); // SDK: join a friend's room
  if (!joined) { show("join"); say("joinMsg", $("joinNameMsg").textContent, true) } // a room that's gone or full: back to the code
}

// Who plays which mark: the player already in the room keeps theirs and tells whoever comes in to take the other
// one. (Deciding by the order of the player list broke when the room's maker left and came back: both picked the
// same mark and nobody could move.)
async function enter(request, msg, waitText) {
  say(msg, waitText);
  for (const b of document.querySelectorAll("#create-go, #play-go")) b.disabled = true;
  const r = await request;
  for (const b of document.querySelectorAll("#create-go, #play-go")) b.disabled = false;
  if (r.error) return void say(msg, {
    "not-found": "That room doesn't exist, or it has closed.",
    full: "That room already has two players.",
    unavailable: "Couldn't reach the online rooms. Late in the day they may rest until 6 AM Bangladesh time. Play on this device instead.",
  }[r.error] ?? "Something went wrong. Try again.", true);
  room = r.room; online = true; wins = { X: 0, O: 0 }; me = "X"; lastFriend = "Friend";
  room.on("join", () => {                                                 // a friend came in: they take the other mark
    wins = { X: 0, O: 0 };
    room.send({ t: "start", you: me === "X" ? "O" : "X" });
    startRound(0);
  });
  room.on("leave", p => { gameOff(); clock.stop(); over = over || { left: true }; render(); say("notice", `${p.name} left the game.`); $("again").hidden = true }); // the round stops
  room.on("away", p => say("notice", `${p.name}'s connection dropped. Waiting for them…`));
  room.on("back", () => { say("notice", ""); room.send({ t: "state", board, round, turn, over, wins }) }); // catch them up
  room.on("status", s => say("notice", s === "reconnecting" ? "Reconnecting…" : s === "closed" ? "Connection lost." : ""));
  room.on("message", (m, from) => {
    if (m?.t === "move") play(m.cell, from);
    else if (m?.t === "start" && (m.you === "X" || m.you === "O")) { me = m.you; say(msg, ""); startRound(0) }
    else if (m?.t === "again" && m.round === round + 1) startRound(m.round);
    else if (m?.t === "state" && Array.isArray(m.board)) { board = m.board; round = m.round; turn = m.turn; over = m.over; wins = m.wins; render() }
  });
  if (room.players.length === 1) { say(msg, ""); $("roomCode").textContent = room.code; show("waiting") } // made the room: wait
  // else: joined someone's room; their "start" message (sent the moment we arrive) starts the game
  return true;
}

// ---------- the game ----------
function startRound(r) {
  round = r; board = Array(9).fill(""); turn = r % 2 ? "O" : "X"; over = false;
  say("notice", ""); $("again").hidden = true;
  show("play"); render();
  clock.start();
}

function tap(cell) {
  if (over || board[cell] || (online && turn !== me)) return;
  if (online) room.send({ t: "move", cell });                             // SDK: send the move to the other phone
  play(cell);
}

function play(cell, from) {
  if (over || board[cell] || !Number.isInteger(cell) || cell < 0 || cell > 8) return;
  if (from && turn === me) return;                                        // not their turn: ignore
  board[cell] = turn; sfx.scratch(turn);
  const line = LINES.find(l => l.every(i => board[i] === turn));
  if (line || board.every(Boolean)) {
    over = line ? { winner: turn, line } : { winner: null }; if (line) wins[turn]++; gameOff();
    if (line && online && turn === me) countWin();
  }
  else turn = turn === "X" ? "O" : "X";
  render();
}

function gameOff() { clock.between(); $("again").hidden = false }

// Online wins, kept with the player's saves on Ikirmikir; the tenth earns the Kata-kuti champ badge. (Wins on one
// device don't count: you would be playing yourself.)
async function countWin() {
  try {
    const n = ((await ik.data.get("wins")) ?? 0) + 1;                     // SDK 1.3: saves
    await ik.data.set("wins", n);
    if (n >= 10) {
      const r = await ik.badges.award("champ");                           // SDK 1.3: a badge listed for Kata-kuti
      if (r.new) say("notice", "Badge earned: Kata-kuti champ, for 10 online wins!");
    }
  } catch {}
}

let lastFriend = "Friend";                                                // their name stays on screen after they leave
const opponent = () => room?.players.find(p => p.id !== room.you.id);
const nameOf = mark => !online ? (mark === "X" ? "Cross" : "Nought") : mark === me ? "You" : (lastFriend = opponent()?.name ?? lastFriend);

let lastTurnText = "";
function render() {
  const mine = online && !over && turn === me;
  for (const m of ["X", "O"]) {
    const side = $(`side${m}`);
    side.querySelector(".who").textContent = nameOf(m);
    side.classList.toggle("now", !over && turn === m);
    side.classList.toggle("you", online && m === me);
  }
  $("score").textContent = `${wins.X} · ${wins.O}`;
  const text = over
    ? (over.left ? "Game over" : over.winner ? (nameOf(over.winner) === "You" ? "You win" : `${nameOf(over.winner)} wins`) : "A draw")
    : online ? (mine ? "Your move" : `${nameOf(turn)} is thinking…`) : `${nameOf(turn)} to move`;
  if (text !== lastTurnText) {                                            // a new line rises in quietly
    const t = $("turn"); t.textContent = lastTurnText = text; t.classList.remove("fresh"); void t.offsetWidth; t.classList.add("fresh");
    if (mine) try { navigator.vibrate?.(20) } catch {}
  }
  $("board").querySelectorAll(".cell").forEach((b, i) => {
    if (b.dataset.mark !== board[i]) { b.dataset.mark = board[i]; b.innerHTML = MARKS[board[i]]?.() ?? "" }
    b.classList.toggle("win", !!over?.line?.includes(i));
    b.disabled = !!over || !!board[i] || (online && turn !== me);
    b.setAttribute("aria-label", `Square ${i + 1}${board[i] ? ", " + (board[i] === "X" ? "cross" : "nought") : ""}`);
  });
  $("board").dataset.turn = turn;                                         // a faint X or O under the pointer
  $("board").classList.toggle("done", !!over);
  $("board").classList.toggle("mine", mine);                             // your move: faint ghosts of your mark
  const strike = $("board").querySelector(".strike"), key = over?.line?.join("") ?? "";
  if (strike.dataset.line !== key) {                                      // three in a row: struck through, past both ends
    strike.dataset.line = key;
    if (!key) strike.innerHTML = "";
    else { const [a, b] = [centre(over.line[0]), centre(over.line[2])], dx = (b[0] - a[0]) * .22, dy = (b[1] - a[1]) * .22;
      strike.innerHTML = crooked(a[0] - dx, a[1] - dy, b[0] + dx, b[1] + dy, 2.4) }
  }
}

function buildBoard() {
  $("board").innerHTML = `<svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${
    crooked(100 / 3, 2, 100 / 3, 98) + crooked(200 / 3, 2, 200 / 3, 98) + crooked(2, 100 / 3, 98, 100 / 3) + crooked(2, 200 / 3, 98, 200 / 3)
  }</svg><svg class="strike" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>`;
  for (let i = 0; i < 9; i++) {
    const b = document.createElement("button");
    b.className = "cell"; b.dataset.mark = "";
    b.onclick = () => tap(i);
    $("board").append(b);
  }
}

// ---------- sound: made in the browser (Web Audio), no files ----------
// A pencil scratching paper for each stroke on the board. (Buttons use Ikirmikir's click, through the SDK.)
// Ikirmikir's sound switch wins (ik.muted).
const sfx = (() => {
  let ac = null, noise = null;
  const ok = () => ac && ac.state === "running" && !ik?.muted;
  function wake() {
    try {
      if (!ac) {
        ac = new AudioContext();
        // one second of grainy noise (mostly soft, with rough specks, like graphite on paper), reused by every stroke
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < .12 ? 1 : .35);
      }
      if (ac.state === "suspended") ac.resume();
    } catch {}
  }
  // one pencil stroke: band-passed noise, a quick attack, a slight wobble as the pencil drags, a soft lift-off
  function stroke(at, dur, pitch) {
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), hp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; src.playbackRate.value = .9 + Math.random() * .2;
    bp.type = "bandpass"; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(pitch, at); bp.frequency.linearRampToValueAtTime(pitch * 1.25, at + dur);
    hp.type = "highpass"; hp.frequency.value = 900;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.32, at + .025);
    for (let t = at + .05; t < at + dur - .04; t += .035) g.gain.linearRampToValueAtTime(.18 + Math.random() * .16, t);
    g.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(bp).connect(hp).connect(g).connect(ac.destination);
    src.start(at, Math.random() * .5, dur + .05);
  }
  return {
    wake,
    scratch(mark) {
      if (!ok()) return;
      const t = ac.currentTime;
      if (mark === "X") { stroke(t, .2, 2600); stroke(t + .24, .2, 2900) } // matches the two drawn strokes
      else stroke(t, .42, 2300);
    },
  };
})();

// ---------- small helpers ----------
function show(id) {
  document.body.classList.toggle("playing", id === "play");
  for (const s of document.querySelectorAll(".screen")) {
    const on = s.id === id;
    if (on && s.hidden) { s.hidden = false; s.classList.remove("enter"); void s.offsetWidth; s.classList.add("enter") }
    else if (!on) s.hidden = true;
  }
  // the screen's field gets focus at once, in the same moment as the tap, so phones keep their keyboard open
  const field = $(id).querySelector("input");
  if (field) { field.focus({ preventScroll: true }); field.select() }
}
const isEnter = e => e.key === "Enter" || e.keyCode === 13;
function say(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle("error", error) }

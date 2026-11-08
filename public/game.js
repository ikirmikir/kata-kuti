// Kata-kuti: noughts and crosses with a friend, the Ikirmikir multiplayer example (SDK 1.2).
// Online: one player makes a room and invites a friend; each move is sent to the other phone (relay mode, so both
// phones apply the same rules). Look for "SDK:" comments. Without Ikirmikir, it is pass-and-play on one device.
// Note: the Ikirmikir player doesn't let games submit forms, so buttons and the Enter key do the work instead.

const $ = id => document.getElementById(id);
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const NAME_RULE = /^[\p{L}\p{M}\p{N}_\- ]{1,16}$/u; // what the room server accepts
const MARKS = {
  X: '<svg viewBox="0 0 100 100"><path pathLength="100" d="M18 18 L82 82"/><path pathLength="100" d="M82 18 L18 82" style="animation-delay:.12s"/></svg>',
  O: '<svg viewBox="0 0 100 100"><circle pathLength="100" cx="50" cy="50" r="33"/></svg>',
};

let ik, room = null;          // the SDK, and the online room while in one
let online = false, me = "X"; // in an online game: which mark is mine
let board = Array(9).fill(""), round = 0, turn = "X", over = false, wins = { X: 0, O: 0 };
let audio;

main();

async function main() {
  buildBoard();
  ik = await Ikirmikir.init({ gameId: "kata-kuti" });                    // SDK: start; never rejects
  const canPlayOnline = ik.has("multiplayer");                            // SDK: only inside Ikirmikir
  $("online").hidden = !canPlayOnline;
  $("offlineNote").hidden = canPlayOnline;
  try { $("name").value = localStorage.getItem("kata-kuti-name") ?? "" } catch {}
  ik.game.loadingDone();                                                  // SDK: Ikirmikir hides its loader

  $("create").onclick = () => { const name = askName(); if (name !== false) enter(ik.multiplayer.create({ maxPlayers: 2, name }), "Making a room…") };
  $("join").onclick = join;
  $("code").onkeydown = e => { if (e.key === "Enter") join() };
  $("code").oninput = () => { $("code").value = $("code").value.toUpperCase().replace(/[^A-Z0-9]/g, "") };
  $("local").onclick = () => { online = false; wins = { X: 0, O: 0 }; startRound(0) };
  $("invite").onclick = () => room?.invite();                             // SDK: share sheet with this room's invite link
  $("cancel").onclick = $("quit").onclick = () => { room?.leave(); room = null; ik.game.gameplayStop(); say("menuMsg", ""); show("menu") };
  $("again").onclick = () => { if (online) room.send({ t: "again", round: round + 1 }); startRound(round + 1) };

  // SDK: someone opened an invite link to a room, so join it straight away
  if (ik.multiplayer.invite) { $("code").value = ik.multiplayer.invite; join() }
}

// the typed name: "" for none, false when it isn't allowed (the message says why)
function askName() {
  const name = $("name").value.trim().replace(/\s+/g, " ");
  if (name && !NAME_RULE.test(name)) { say("menuMsg", "Names can use letters, numbers, spaces, _ and -, up to 16."); return false }
  try { localStorage.setItem("kata-kuti-name", name) } catch {}
  return name;
}

function join() {
  const name = askName();
  if (name === false) return;
  const code = $("code").value.trim();
  if (code.length !== 5) return say("menuMsg", "Room codes have 5 letters and numbers.");
  enter(ik.multiplayer.join(code, { name }), "Joining…");                // SDK: join a friend's room
}

// ---------- online ----------
async function enter(request, waitText) {
  say("menuMsg", waitText);
  const r = await request;
  if (r.error) return say("menuMsg", {
    "not-found": "That room doesn't exist, or it has closed.",
    full: "That room already has two players.",
    unavailable: "Couldn't reach the online rooms. Late in the day they may rest until 6 AM Bangladesh time. Play on this device instead.",
  }[r.error] ?? "Something went wrong. Try again.");
  say("menuMsg", "");
  room = r.room; online = true; wins = { X: 0, O: 0 };
  me = room.players[0].id === room.you.id ? "X" : "O";                   // whoever made the room plays X
  room.on("join", () => startRound(0));
  room.on("leave", p => { gameOff(); say("notice", `${p.name} left the game.`); $("again").hidden = true });
  room.on("away", p => say("notice", `${p.name}'s connection dropped. Waiting for them…`));
  room.on("back", () => { say("notice", ""); room.send({ t: "state", board, round, turn, over, wins }) }); // catch them up
  room.on("status", s => say("notice", s === "reconnecting" ? "Reconnecting…" : s === "closed" ? "Connection lost." : ""));
  room.on("message", (m, from) => {
    if (m?.t === "move") play(m.cell, from);
    else if (m?.t === "again" && m.round === round + 1) startRound(m.round);
    else if (m?.t === "state" && Array.isArray(m.board)) { board = m.board; round = m.round; turn = m.turn; over = m.over; wins = m.wins; render() }
  });
  if (room.players.length === 2) startRound(0);
  else { $("roomCode").textContent = room.code; show("waiting") }
}

// ---------- the game ----------
function startRound(r) {
  round = r; board = Array(9).fill(""); turn = r % 2 ? "O" : "X"; over = false;
  say("notice", ""); $("again").hidden = true;
  show("play"); render(true);
  ik.game.gameplayStart();                                                // SDK: someone is playing
}

function tap(cell) {
  if (over || board[cell] || (online && turn !== me)) return;
  if (online) room.send({ t: "move", cell });                             // SDK: send the move to the other phone
  play(cell);
}

function play(cell, from) {
  if (over || board[cell] || !Number.isInteger(cell) || cell < 0 || cell > 8) return;
  if (from && turn === me) return;                                        // not their turn: ignore
  board[cell] = turn; tone(turn === "X" ? 520 : 390);
  const line = LINES.find(l => l.every(i => board[i] === turn));
  if (line || board.every(Boolean)) { over = line ? { winner: turn, line } : { winner: null }; if (line) wins[turn]++; gameOff() }
  else turn = turn === "X" ? "O" : "X";
  render(true);
}

function gameOff() { ik.game.gameplayStop(); $("again").hidden = false }  // SDK: play stopped

const opponent = () => room?.players.find(p => p.id !== room.you.id);
const nameOf = mark => !online ? (mark === "X" ? "Cross" : "Nought") : mark === me ? "You" : opponent()?.name ?? "Friend";

let wasMine = false;
function render(changed) {
  const mine = online && !over && turn === me;
  for (const m of ["X", "O"]) {
    const side = $(`side${m}`);
    side.querySelector(".who").textContent = nameOf(m);
    side.classList.toggle("now", !over && turn === m);
  }
  $("score").textContent = `${wins.X} · ${wins.O}`;
  $("turn").textContent = over
    ? (over.winner ? (nameOf(over.winner) === "You" ? "You win" : `${nameOf(over.winner)} wins`) : "A draw")
    : online ? (mine ? "Your move" : `${nameOf(turn)} is thinking…`) : `${nameOf(turn)} to move`;
  [...$("board").children].forEach((b, i) => {
    if (b.dataset.mark !== board[i]) { b.dataset.mark = board[i]; b.innerHTML = MARKS[board[i]] ?? "" }
    b.classList.toggle("win", !!over?.line?.includes(i));
    b.disabled = !!over || !!board[i] || (online && turn !== me);
    b.setAttribute("aria-label", `Square ${i + 1}${board[i] ? ", " + (board[i] === "X" ? "cross" : "nought") : ""}`);
  });
  $("board").classList.toggle("done", !!over);
  $("board").classList.toggle("mine", mine);
  // it just became your turn: a short splash so you can't miss it
  if (changed && mine && !wasMine) {
    const s = $("splash"); s.classList.remove("show"); void s.offsetWidth; s.classList.add("show");
    try { navigator.vibrate?.(30) } catch {}
  }
  if (!mine) $("splash").classList.remove("show"); // gone the moment you have played
  wasMine = mine;
}

function buildBoard() {
  for (let i = 0; i < 9; i++) {
    const b = document.createElement("button");
    b.className = "cell"; b.dataset.mark = "";
    b.onclick = () => { if (!audio) try { audio = new AudioContext() } catch {} ; tap(i) };
    $("board").append(b);
  }
}

// ---------- small helpers ----------
function show(id) { for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id }
function say(id, text) { $(id).textContent = text }
function tone(freq) {
  if (!audio || ik.muted) return;                                         // SDK: Ikirmikir's sound switch wins
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = "sine"; o.frequency.value = freq; g.gain.setValueAtTime(0.06, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.18);
}

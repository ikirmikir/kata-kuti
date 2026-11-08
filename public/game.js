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
  ik.game.loadingDone();                                                  // SDK: Ikirmikir hides its loader

  $("toCreate").onclick = () => { $("name").value = savedName() || newName(); show("create"); focus("name") };
  $("toJoin").onclick = () => { $("code").value = ""; show("join"); focus("code") };
  for (const b of document.querySelectorAll(".back")) b.onclick = () => show(b.dataset.to);
  $("create-go").onclick = create;
  $("name").onkeydown = e => { if (e.key === "Enter") create() };
  $("join-go").onclick = join;
  $("code").onkeydown = e => { if (e.key === "Enter") join() };
  $("code").oninput = () => { $("code").value = $("code").value.toUpperCase().replace(/[^A-Z0-9]/g, ""); say("joinMsg", "Ask your friend for their 5-letter code.") };
  $("name").oninput = () => say("createMsg", "Friends will see this name. Change it if you like.");
  $("local").onclick = () => { online = false; wins = { X: 0, O: 0 }; startRound(0) };
  $("invite").onclick = () => room?.invite();                             // SDK: share sheet with this room's invite link
  $("cancel").onclick = $("quit").onclick = () => { room?.leave(); room = null; ik.game.gameplayStop(); show("home") };
  $("again").onclick = () => { if (online) room.send({ t: "again", round: round + 1 }); startRound(round + 1) };

  // SDK: someone opened an invite link to a room, so join it straight away
  if (ik.multiplayer.invite) { $("code").value = ik.multiplayer.invite; show("join"); join() }
  else show("home");
}

// ---------- names ----------
function savedName() { try { return localStorage.getItem("kata-kuti-name") ?? "" } catch { return "" } }
function newName() { return "usr_" + Array.from(crypto.getRandomValues(new Uint8Array(7)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("") }

// ---------- online ----------
function create() {
  const name = $("name").value.trim().replace(/\s+/g, " ");
  if (!NAME_RULE.test(name)) return say("createMsg", "Use letters, numbers, spaces, _ or -, up to 16.", true);
  try { localStorage.setItem("kata-kuti-name", name) } catch {}
  enter(ik.multiplayer.create({ maxPlayers: 2, name }), "createMsg", "Making a room…");
}

function join() {
  const code = $("code").value.trim();
  if (code.length !== 5) return say("joinMsg", "Room codes have 5 letters and numbers.", true);
  enter(ik.multiplayer.join(code, { name: savedName() || undefined }), "joinMsg", "Joining…");   // SDK: join a friend's room
}

async function enter(request, msg, waitText) {
  say(msg, waitText);
  for (const b of document.querySelectorAll("#create-go, #join-go")) b.disabled = true;
  const r = await request;
  for (const b of document.querySelectorAll("#create-go, #join-go")) b.disabled = false;
  if (r.error) return say(msg, {
    "not-found": "That room doesn't exist, or it has closed.",
    full: "That room already has two players.",
    unavailable: "Couldn't reach the online rooms. Late in the day they may rest until 6 AM Bangladesh time. Play on this device instead.",
  }[r.error] ?? "Something went wrong. Try again.", true);
  say(msg, "");
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
  show("play"); render();
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
  render();
}

function gameOff() { ik.game.gameplayStop(); $("again").hidden = false }  // SDK: play stopped

const opponent = () => room?.players.find(p => p.id !== room.you.id);
const nameOf = mark => !online ? (mark === "X" ? "Cross" : "Nought") : mark === me ? "You" : opponent()?.name ?? "Friend";

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
    ? (over.winner ? (nameOf(over.winner) === "You" ? "You win" : `${nameOf(over.winner)} wins`) : "A draw")
    : online ? (mine ? "Your move" : `${nameOf(turn)} is thinking…`) : `${nameOf(turn)} to move`;
  if (text !== lastTurnText) {                                            // a new line rises in quietly
    const t = $("turn"); t.textContent = lastTurnText = text; t.classList.remove("fresh"); void t.offsetWidth; t.classList.add("fresh");
    if (mine) try { navigator.vibrate?.(20) } catch {}
  }
  [...$("board").children].forEach((b, i) => {
    if (b.dataset.mark !== board[i]) { b.dataset.mark = board[i]; b.innerHTML = MARKS[board[i]] ?? "" }
    b.classList.toggle("win", !!over?.line?.includes(i));
    b.disabled = !!over || !!board[i] || (online && turn !== me);
    b.setAttribute("aria-label", `Square ${i + 1}${board[i] ? ", " + (board[i] === "X" ? "cross" : "nought") : ""}`);
  });
  $("board").classList.toggle("done", !!over);
  $("board").classList.toggle("mine", mine);
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
function show(id) {
  document.body.classList.toggle("playing", id === "play");
  for (const s of document.querySelectorAll(".screen")) {
    const on = s.id === id;
    if (on && s.hidden) { s.hidden = false; s.classList.remove("enter"); void s.offsetWidth; s.classList.add("enter") }
    else if (!on) s.hidden = true;
  }
}
function focus(id) { setTimeout(() => { const el = $(id); el.focus(); el.select?.() }, 60) }
function say(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle("error", error) }
function tone(freq) {
  if (!audio || ik.muted) return;                                         // SDK: Ikirmikir's sound switch wins
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = "sine"; o.frequency.value = freq; g.gain.setValueAtTime(0.06, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.18);
}

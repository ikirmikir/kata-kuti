// Kata-kuti: noughts and crosses with a friend, the Ikirmikir multiplayer example (SDK 1.1).
// Online: one player makes a room and invites a friend; each move is sent to the other phone (relay mode, so both
// phones apply the same rules). Look for "SDK:" comments. Without Ikirmikir, it is pass-and-play on one device.

const $ = id => document.getElementById(id);
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

let ik, room = null;          // the SDK, and the online room while in one
let online = false, me = "X"; // in an online game: which mark is mine
let board, round = 0, turn, over, wins = { X: 0, O: 0 };
let audio;

main();

async function main() {
  buildBoard();
  ik = await Ikirmikir.init({ gameId: "kata-kuti" });                    // SDK: start; never rejects
  const canPlayOnline = ik.has("multiplayer");                            // SDK: only inside Ikirmikir
  $("online").hidden = !canPlayOnline;
  $("offlineNote").hidden = canPlayOnline;
  ik.game.loadingDone();                                                  // SDK: Ikirmikir hides its loader

  $("create").onclick = () => enter(ik.multiplayer.create({ maxPlayers: 2 }), "Making a room…");
  $("joinForm").onsubmit = e => { e.preventDefault(); enter(ik.multiplayer.join($("code").value), "Joining…") };
  $("local").onclick = () => { online = false; startRound(0) };
  $("invite").onclick = () => room?.invite();                             // SDK: share this room's invite link
  $("cancel").onclick = $("quit").onclick = () => { room?.leave(); room = null; show("menu") };
  $("again").onclick = () => { if (online) room.send({ t: "again", round: round + 1 }); startRound(round + 1) };

  // SDK: someone opened an invite link to a room, so join it straight away
  if (ik.multiplayer.invite) enter(ik.multiplayer.join(ik.multiplayer.invite), "Joining your friend's room…");
}

// ---------- online ----------
async function enter(request, waitText) {
  say("menuMsg", waitText);
  const r = await request;
  if (r.error) return say("menuMsg", {
    "not-found": "That room doesn't exist, or it has closed.",
    full: "That room already has two players.",
    unavailable: "Couldn't reach the online rooms. Late in the day they may be resting until 6 AM Bangladesh time. Play on this device instead.",
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
  board[cell] = turn; tone(turn === "X" ? 660 : 520);
  const line = LINES.find(l => l.every(i => board[i] === turn));
  if (line || board.every(Boolean)) { over = line ? { winner: turn, line } : { winner: null }; if (line) wins[turn]++; gameOff() }
  else turn = turn === "X" ? "O" : "X";
  render();
}

function gameOff() { ik.game.gameplayStop(); $("again").hidden = false }  // SDK: play stopped

function render() {
  const names = online ? room.players.map((p, i) => `${i ? "O" : "X"}: ${p.id === room.you.id ? "You" : p.name}`).join("   ") : "X and O take turns on this phone";
  $("names").textContent = `${names}   ·   ${wins.X} : ${wins.O}`;
  [...$("board").children].forEach((b, i) => {
    b.textContent = board[i]; b.className = `cell ${board[i].toLowerCase()}${over?.line?.includes(i) ? " win" : ""}`;
    b.disabled = !!over || !!board[i] || (online && turn !== me);
    b.setAttribute("aria-label", `Square ${i + 1}${board[i] ? ", " + board[i] : ""}`);
  });
  const who = mark => !online ? mark : mark === me ? "You" : room.players.find(p => p.id !== room.you.id)?.name ?? mark;
  $("turn").textContent = !over ? (online && turn === me ? "Your turn" : `${who(turn)}'s turn`)
    : over.winner ? `${who(over.winner)} ${who(over.winner) === "You" ? "win" : "wins"}!` : "A draw";
}

function buildBoard() {
  for (let i = 0; i < 9; i++) {
    const b = document.createElement("button");
    b.className = "cell"; b.onclick = () => { if (!audio) audio = new AudioContext(); tap(i) };
    $("board").append(b);
  }
}

// ---------- small helpers ----------
function show(id) { for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id }
function say(id, text) { $(id).textContent = text }
function tone(freq) {
  if (!audio || ik.muted) return;                                         // SDK: Ikirmikir's sound switch wins
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = freq; g.gain.setValueAtTime(0.08, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.15);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.15);
}

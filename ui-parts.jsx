/* Card UI components, side panel, modals */
/* global React */
const { useState, useEffect, useRef, useMemo } = React;

const SUIT_GLYPH = { H: "♥", D: "♦", C: "♣", S: "♠" };
const SUIT_NAME = { H: "Hearts", D: "Diamonds", C: "Clubs", S: "Spades" };
const SUIT_COLOR = { H: "red", D: "red", C: "black", S: "black" };
const RANK_SHORT = (r) => ({11:"J",12:"Q",13:"K",14:"A"})[r] || String(r);

function CardFace({ card, size = "" }) {
  if (!card) return null;
  const color = SUIT_COLOR[card.suit];
  const isTen = card.rank === 10;
  return (
    <div className={`card ${color} ${size} ${isTen ? "is-ten" : ""}`}>
      <div className="corner tl">
        <span className="rank">{RANK_SHORT(card.rank)}</span>
        <span className="suit">{SUIT_GLYPH[card.suit]}</span>
      </div>
      <div className="center-suit">{SUIT_GLYPH[card.suit]}</div>
      <div className="corner br">
        <span className="rank">{RANK_SHORT(card.rank)}</span>
        <span className="suit">{SUIT_GLYPH[card.suit]}</span>
      </div>
    </div>
  );
}

function CardBack({ size = "", style, design = "weave" }) {
  return (
    <div className={`card back ${design} ${size}`} style={style}>
      <div className="pattern"></div>
    </div>
  );
}

function HandCard({ card, size, legal, illegal, draggable, onDragStart, onDragEnd, onClick, hint, dealDelay }) {
  const cls = [
    "hand-card",
    draggable ? "draggable" : "",
    illegal ? "illegal" : "",
    legal ? "legal-hint" : "",
    hint ? "hint-card" : "",
    "deal-in",
  ].filter(Boolean).join(" ");
  const handleDragStart = (e) => {
    try { e.dataTransfer.setData("text/plain", `${card.rank}${card.suit}`); e.dataTransfer.effectAllowed = "move"; } catch (err) {}
    if (onDragStart) onDragStart(e);
  };
  return (
    <div
      className={cls}
      style={{ animationDelay: `${dealDelay || 0}ms` }}
      draggable={draggable && !illegal}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={illegal ? undefined : onClick}
    >
      <CardFace card={card} size={size} />
    </div>
  );
}

// Side panel — score + tabs
function SidePanel({ state, dispatch }) {
  const [tab, setTab] = useState("hand");
  const tens = state.handTens || { 0: 0, 1: 0 };
  const tricks = state.handTricks || { 0: 0, 1: 0 };
  const matchWins = state.matchWins || { 0: 0, 1: 0 };

  return (
    <aside className="side-panel">
      <header>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "-0.01em" }}>Match</div>
          <button className="btn-light" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => dispatch({ type: "RETURN_TO_SETUP" })}>
            New Match
          </button>
        </div>
        <div className="scoreline">
          <div className="score-card team0">
            <div className="lab">Team A · Tens</div>
            <div className="num">{tens[0]}</div>
            <div className="seats">Seats 0 · 2 · Hand wins {matchWins[0]}</div>
          </div>
          <div className="score-card team1">
            <div className="lab">Team B · Tens</div>
            <div className="num">{tens[1]}</div>
            <div className="seats">Seats 1 · 3 · Hand wins {matchWins[1]}</div>
          </div>
        </div>
      </header>
      <div className="tabs">
        <button className={tab === "hand" ? "active" : ""} onClick={() => setTab("hand")}>This Hand</button>
        <button className={tab === "match" ? "active" : ""} onClick={() => setTab("match")}>Match</button>
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>Move Log</button>
      </div>
      <div className="tab-body">
        {tab === "hand" && <ThisHandTab state={state} />}
        {tab === "match" && <MatchTab state={state} />}
        {tab === "log" && <MoveLogTab state={state} />}
      </div>
    </aside>
  );
}

function ThisHandTab({ state }) {
  const tricks = state.handTricks || { 0: 0, 1: 0 };
  const trumpName = state.trump ? `${SUIT_GLYPH[state.trump]} ${SUIT_NAME[state.trump]}` : "—";
  return (
    <div>
      <div className="row"><span className="lab">Hand #</span><span>{state.handNum}</span></div>
      <div className="row">
        <span className="lab">Trump</span>
        <span style={{ color: state.trump && SUIT_COLOR[state.trump] === "red" ? "var(--red)" : "inherit" }}>{trumpName}</span>
      </div>
      <div className="row"><span className="lab">Dealer</span><span>{state.players[state.dealerIdx]?.name}</span></div>
      <div className="row"><span className="lab">Tricks played</span><span>{state.tricksPlayed}/13</span></div>
      <div className="row"><span className="lab">Team A tricks</span><span>{tricks[0]}</span></div>
      <div className="row"><span className="lab">Team B tricks</span><span>{tricks[1]}</span></div>
      <div className="row"><span className="lab">To play</span>
        <span>{state.players[state.toPlayIdx]?.name || "—"}</span>
      </div>
    </div>
  );
}

function MatchTab({ state }) {
  const hands = state.matchHistory || [];
  if (!hands.length) return <div style={{ color: "var(--ink-3)" }}>No completed hands yet.</div>;
  return (
    <table className="summary-table">
      <thead>
        <tr><th>#</th><th>Trump</th><th>Tens A</th><th>Tens B</th><th>Win</th></tr>
      </thead>
      <tbody>
        {hands.map((h, i) => (
          <tr key={i} className={h.mindi ? "win-row" : ""}>
            <td>{h.handNum}</td>
            <td style={{ color: SUIT_COLOR[h.trump] === "red" ? "var(--red)" : "inherit" }}>
              {SUIT_GLYPH[h.trump]}
            </td>
            <td>{h.tens[0]}</td>
            <td>{h.tens[1]}</td>
            <td>{h.winner === 0 ? "A" : "B"}{h.mindi ? " ★" : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MoveLogTab({ state }) {
  const log = state.moveLog || [];
  if (!log.length) return <div style={{ color: "var(--ink-3)" }}>Moves will appear here as the hand plays.</div>;
  return (
    <div>
      {log.map((entry, i) => {
        if (entry.kind === "trick-start") {
          return <div key={i} style={{ marginTop: 10, fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Trick {entry.num}</div>;
        }
        if (entry.kind === "trick-win") {
          return (
            <div key={i} className="move-line win-row">
              ↳ {entry.who} wins{entry.tens ? ` (+${entry.tens} ten)` : ""}
            </div>
          );
        }
        return (
          <div key={i} className="move-line">
            <span className="who">{entry.who}</span>
            <span className={`mini-card ${SUIT_COLOR[entry.card.suit]}`}>
              {RANK_SHORT(entry.card.rank)}{SUIT_GLYPH[entry.card.suit]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

window.UI = { CardFace, CardBack, HandCard, SidePanel };

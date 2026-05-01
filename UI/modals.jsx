/* Modals: trump pick, hand summary, mindi/kot celebration */
/* global React */
const { useState: useStateMod } = React;

function TrumpPickModal({ chooserName, firstFour, suitCounts, onPick }) {
  const suits = ["S", "H", "D", "C"];
  return (
    <div className="modal-back">
      <div className="modal">
        <h2>Choose Trump</h2>
        <p className="lede">{chooserName} sits to the dealer's right. Pick a trump suit from these four cards.</p>
        <div className="trump-cards">
          {firstFour.map((c, i) => <window.UI.CardFace key={i} card={c} size="lg" />)}
        </div>
        <div className="suit-options">
          {suits.map((s) => {
            const count = suitCounts[s] || 0;
            const disabled = count === 0;
            const color = (s === "H" || s === "D") ? "red" : "black";
            return (
              <button
                key={s}
                className={`suit-pick ${color}`}
                disabled={disabled}
                onClick={() => onPick(s)}
              >
                <span className="suit-glyph">{({H:"♥",D:"♦",C:"♣",S:"♠"})[s]}</span>
                <span className="meta">
                  <b>{({H:"Hearts",D:"Diamonds",C:"Clubs",S:"Spades"})[s]}</b>
                  <div className="sub">{count} card{count === 1 ? "" : "s"} in first four</div>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HandSummaryModal({ result, players, onContinue, isMatchEnd, matchSummary }) {
  const tens = result.tens, tricks = result.tricks;
  const winnerLabel = result.winner === 0 ? "Team A" : "Team B";
  const note = result.mindi
    ? "Mindi — all four tens captured!"
    : (tens[0] === 2 && tens[1] === 2)
      ? "Draw broken by trick count."
      : "Hand won by capturing 3 or more tens.";
  return (
    <div className="modal-back">
      <div className="modal">
        <h2>{isMatchEnd ? "Match Over" : `Hand ${result.handNum} Complete`}</h2>
        <p className="lede">{isMatchEnd ? "Final standings below." : note}</p>
        <table className="summary-table">
          <thead>
            <tr><th>Team</th><th>Tens</th><th>Tricks</th><th></th></tr>
          </thead>
          <tbody>
            <tr className={result.winner === 0 ? "win-row" : ""}>
              <td>Team A · {players[0].name} &amp; {players[2].name}</td>
              <td className="num">{tens[0]}</td>
              <td>{tricks[0]}</td>
              <td>{result.winner === 0 ? "✓" : ""}</td>
            </tr>
            <tr className={result.winner === 1 ? "win-row" : ""}>
              <td>Team B · {players[1].name} &amp; {players[3].name}</td>
              <td className="num">{tens[1]}</td>
              <td>{tricks[1]}</td>
              <td>{result.winner === 1 ? "✓" : ""}</td>
            </tr>
          </tbody>
        </table>
        {isMatchEnd && matchSummary && (
          <div style={{ marginTop: 14, padding: 12, background: "var(--surface-2)", borderRadius: 10, fontSize: 13 }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>
              {matchSummary.kot ? `KOT! ${matchSummary.winner === 0 ? "Team A" : "Team B"} swept 7 consecutive hands.` :
                `${matchSummary.winner === 0 ? "Team A" : "Team B"} wins the match.`}
            </div>
            <div style={{ color: "var(--ink-3)" }}>
              Hand wins — Team A: {matchSummary.matchWins[0]} · Team B: {matchSummary.matchWins[1]}
            </div>
          </div>
        )}
        <div className="actions">
          <button className="btn-dark" onClick={onContinue}>
            {isMatchEnd ? "New match" : "Deal next hand →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Celebration({ kind, team, onDone }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);
  const teamName = team === 0 ? "Team A" : "Team B";
  const title = kind === "mindi" ? <>MINDI! <b>{teamName}</b> caught all 4 tens</> :
                kind === "kot" ? <>KOT! <b>{teamName}</b> swept 7 hands</> : null;
  return (
    <div className="celebrate">
      <div className="ring"></div>
      <div className="banner">{title}</div>
    </div>
  );
}

window.Modals = { TrumpPickModal, HandSummaryModal, Celebration };

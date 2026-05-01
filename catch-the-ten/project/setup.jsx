/* Setup screen — configure 4 seats */
/* global React */
const { useState: useStateSetup } = React;

function SetupScreen({ initial, onStart }) {
  const [players, setPlayers] = useStateSetup(initial || [
    { name: "You",   kind: "human" },
    { name: "Bobby", kind: "ai", agent: "heuristic" },
    { name: "Cara",  kind: "ai", agent: "heuristic" },
    { name: "Dev",   kind: "ai", agent: "heuristic" },
  ]);
  const [maxHands, setMaxHands] = useStateSetup(7);

  const update = (i, patch) => {
    setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, ...patch } : pl));
  };

  const teamLabel = (i) => i % 2 === 0 ? "Team A" : "Team B";
  const teamCls = (i) => i % 2 === 0 ? "team0" : "team1";
  const seatTag = (i) => ["You / Bottom","Right","Top / Partner","Left"][i];

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Dehla Pakad</h1>
        <p className="lede">Catch the Ten — a partnership trick-taking game. Configure each seat below.</p>

        {players.map((pl, i) => (
          <div key={i} className={`seat-row ${teamCls(i)}`}>
            <div className="seat-num">{i}</div>
            <div>
              <input
                className="name"
                value={pl.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Name"
              />
              <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                <span className={`team-badge t${i % 2}`}>
                  <span className="swatch"></span>{teamLabel(i)}
                </span>
                <span style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {seatTag(i)}
                </span>
              </div>
            </div>
            <div className="seg compact">
              <button
                className={pl.kind === "human" ? "on" : ""}
                onClick={() => update(i, { kind: "human" })}
              >Human</button>
              <button
                className={pl.kind === "ai" ? "on" : ""}
                onClick={() => update(i, { kind: "ai", agent: pl.agent || "heuristic" })}
              >AI</button>
            </div>
            <div>
              {pl.kind === "ai" ? (
                <select
                  value={pl.agent || "heuristic"}
                  onChange={(e) => update(i, { agent: e.target.value })}
                  style={{ width: "100%" }}
                >
                  <option value="heuristic">Heuristic agent</option>
                  <option value="random">Random agent</option>
                </select>
              ) : (
                <div className="role-tag">Manual play</div>
              )}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, fontSize: 13, color: "var(--ink-2)" }}>
          <span>Max hands per match</span>
          <input
            type="number"
            min={1}
            max={50}
            value={maxHands}
            onChange={(e) => setMaxHands(parseInt(e.target.value || "1", 10))}
            style={{ width: 70, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line-2)" }}
          />
          <span style={{ color: "var(--ink-3)", fontSize: 12 }}>(Kot ends earlier — 7 consecutive wins)</span>
        </div>

        <div className="setup-actions">
          <span style={{ color: "var(--ink-3)", fontSize: 12 }}>
            Seats 0 &amp; 2 partner up, vs seats 1 &amp; 3.
          </span>
          <button className="btn-dark" onClick={() => onStart(players, maxHands)}>
            Deal first hand →
          </button>
        </div>
      </div>
    </div>
  );
}

window.SetupScreen = SetupScreen;

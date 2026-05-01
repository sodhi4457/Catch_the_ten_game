/* Main app — table, dealing, trick play, AI orchestration */
/* global React, ReactDOM, DP, UI, SetupScreen, Modals */
const { useState, useEffect, useRef, useMemo, useReducer } = React;

const SUIT_GLYPH = { H: "♥", D: "♦", C: "♣", S: "♠" };
const SUIT_COLOR = { H: "red", D: "red", C: "black", S: "black" };
const SUIT_NAME = { H: "Hearts", D: "Diamonds", C: "Clubs", S: "Spades" };

// Map: where each seat is rendered relative to seat 0 (the human/bottom)
function seatPosition(seat, humanSeat = 0) {
  const rel = (seat - humanSeat + 4) % 4;
  return ["bottom", "right", "top", "left"][rel];
}

function audioBeep(freq = 440, dur = 0.08, vol = 0.05, kind = "sine") {
  try {
    const ctx = window.__dpAudio || (window.__dpAudio = new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = kind;
    o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch (e) {}
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "feltColor": "#2c4a3e",
  "cardBack": "weave",
  "aiSpeedMs": 700,
  "showLegalHints": true,
  "soundOn": false,
  "showAllHands": false
}/*EDITMODE-END*/;

function App() {
  // Tweaks
  const [tweaks, setTweaks] = useState(() => {
    try { return { ...TWEAK_DEFAULTS, ...(JSON.parse(localStorage.getItem("dp.tweaks") || "{}")) }; }
    catch { return { ...TWEAK_DEFAULTS }; }
  });
  useEffect(() => {
    document.documentElement.style.setProperty("--felt", tweaks.feltColor);
    document.documentElement.style.setProperty("--cb-bg", tweaks.feltColor);
    localStorage.setItem("dp.tweaks", JSON.stringify(tweaks));
  }, [tweaks]);
  const setTweak = (k, v) => {
    if (typeof k === "object") setTweaks(t => ({ ...t, ...k }));
    else setTweaks(t => ({ ...t, [k]: v }));
  };

  // Game phase: 'setup' | 'pre-deal' | 'pick-trump' | 'play' | 'hand-end' | 'match-end'
  const [phase, setPhase] = useState("setup");
  const [players, setPlayers] = useState(null);          // [{name, kind, agent}]
  const [maxHands, setMaxHands] = useState(7);
  const [hands, setHands] = useState([[],[],[],[]]);     // hands[seat] = card[]
  const pendingHandsRef = useRef(null); // full hands cached during trump pick
  const [trump, setTrump] = useState(null);
  const [dealerIdx, setDealerIdx] = useState(0);
  const [chooserIdx, setChooserIdx] = useState(0);
  const [trick, setTrick] = useState([]);                // [{seat, card}]
  const [ledSuit, setLedSuit] = useState(null);
  const [toPlayIdx, setToPlayIdx] = useState(0);
  const [tricksPlayed, setTricksPlayed] = useState(0);
  const [tens, setTens] = useState({0:0,1:0});
  const [trickWins, setTrickWins] = useState({0:0,1:0});
  const [seatTricks, setSeatTricks] = useState([0,0,0,0]);
  const [seatTens, setSeatTens] = useState([[],[],[],[]]); // array of captured 10 cards per seat
  const [seenCards, setSeenCards] = useState([]);
  const [moveLog, setMoveLog] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [matchWins, setMatchWins] = useState({0:0,1:0});
  const [consecutive, setConsecutive] = useState({0:0,1:0});
  const [handNum, setHandNum] = useState(1);
  const [lastTrickWinner, setLastTrickWinner] = useState(null);
  const [tenCallouts, setTenCallouts] = useState([]); // {id, seat, msg}
  const [celebrate, setCelebrate] = useState(null);   // {kind, team}
  const [handResult, setHandResult] = useState(null);
  const [matchEnd, setMatchEnd] = useState(null);
  const [pickInfo, setPickInfo] = useState(null);     // for trump modal
  const [drag, setDrag] = useState(null);
  const [passOverlay, setPassOverlay] = useState(null); // seat to pass to
  const lastHumanSeatRef = useRef(null);

  const [hintCardId, setHintCardId] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [pendingNext, setPendingNext] = useState(false); // manual "Next" prompt for AI moves
  const [autoAdvance, setAutoAdvance] = useState(false); // becomes true when human clicks Next once

  // Find human seats — declared before the useEffect that depends on isHotSeat
  const humanSeats = useMemo(() => {
    if (!players) return [];
    return players.map((p, i) => p.kind === "human" ? i : -1).filter(i => i >= 0);
  }, [players]);
  const primaryHumanSeat = humanSeats[0] ?? 0;
  // Hot-seat mode: when multiple humans, bottom = whichever human is currently playing
  const isHotSeat = humanSeats.length > 1;
  const activeHumanSeat = isHotSeat
    ? (humanSeats.includes(toPlayIdx) ? toPlayIdx : primaryHumanSeat)
    : primaryHumanSeat;

  useEffect(() => {
    if (!isHotSeat) return;
    if (phase !== "play") return;
    if (players[toPlayIdx]?.kind !== "human") return;
    if (lastHumanSeatRef.current !== null && lastHumanSeatRef.current !== toPlayIdx) {
      setPassOverlay(toPlayIdx);
    }
    lastHumanSeatRef.current = toPlayIdx;
  }, [toPlayIdx, phase, isHotSeat, players]);

  // ---------- start match ----------
  const startMatch = (configuredPlayers, mh) => {
    setPlayers(configuredPlayers);
    setMaxHands(mh);
    setMatchHistory([]);
    setMatchWins({0:0,1:0});
    setConsecutive({0:0,1:0});
    setHandNum(1);
    setDealerIdx(0);
    setMatchEnd(null);
    dealHand(configuredPlayers, 0, 1);
  };

  // ---------- deal a hand ----------
  const dealHand = (pls, dealer, hNum) => {
    const dealt = DP.deal();
    // hands[seat] = dealt[(seat - dealer + 4) % 4]
    const fullHands = [0,1,2,3].map(seat => DP.sortHand(dealt[(seat - dealer + 4) % 4]));
    // Only show first 4 cards (in deal order, not sorted) to each player initially
    const rawFirst4 = [0,1,2,3].map(seat => dealt[(seat - dealer + 4) % 4].slice(0, 4));
    const initialHands = rawFirst4.map(h => DP.sortHand(h));
    setHands(initialHands);
    pendingHandsRef.current = fullHands;
    setTrump(null);
    setTrick([]);
    setLedSuit(null);
    setTricksPlayed(0);
    setTens({0:0,1:0});
    setTrickWins({0:0,1:0});
    setSeatTricks([0,0,0,0]);
    setSeatTens([[],[],[],[]]);
    setSeenCards([]);
    setMoveLog([{ kind:"trick-start", num: 1 }]);
    setLastTrickWinner(null);
    setTenCallouts([]);
    setHandResult(null);
    setHandNum(hNum);
    const chooser = (dealer + 3) % 4;
    setChooserIdx(chooser);
    setDealerIdx(dealer);

    // Trump pick — uses raw first-4 (in dealt order)
    const chooserFirst4 = dealt[(chooser - dealer + 4) % 4].slice(0, 4);
    const firstFour = chooserFirst4;
    const suitCounts = {};
    for (const c of firstFour) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;

    if (pls[chooser].kind === "human") {
      setPickInfo({ chooser, firstFour, suitCounts });
      setPhase("pick-trump");
    } else {
      // auto pick most common suit
      const auto = DP.autoPickTrump(firstFour);
      setTimeout(() => {
        startPlayWithTrump(auto, dealer);
      }, 600);
      setPhase("pre-deal");
    }
  };

  const onTrumpPicked = (suit) => {
    setPickInfo(null);
    startPlayWithTrump(suit, dealerIdx);
  };

  const startPlayWithTrump = (suit, dealer) => {
    setTrump(suit);
    if (pendingHandsRef.current) {
      setHands(pendingHandsRef.current);
      pendingHandsRef.current = null;
    }
    if (tweaks.soundOn) audioBeep(620, 0.1, 0.04);
    const lead = (dealer + 1) % 4;
    setToPlayIdx(lead);
    setPhase("play");
    setAutoAdvance(false);
    setPendingNext(false);
  };

  // ---------- play a card ----------
  const playCard = (seat, card) => {
    if (phase !== "play") return;
    if (seat !== toPlayIdx) return;
    const legal = DP.legalMoves(hands[seat], ledSuit);
    if (!legal.find(c => c.suit === card.suit && c.rank === card.rank)) return;

    const newHands = hands.map((h, i) => i === seat ? h.filter(c => !(c.suit === card.suit && c.rank === card.rank)) : h);
    const newTrick = [...trick, { seat, card }];
    const newLedSuit = ledSuit || card.suit;
    const newSeen = [...seenCards, card];

    setHands(newHands);
    setTrick(newTrick);
    setLedSuit(newLedSuit);
    setSeenCards(newSeen);
    setMoveLog(log => [...log, { kind:"play", seat, who: players[seat].name, card }]);
    if (tweaks.soundOn) audioBeep(360 + (card.rank * 12), 0.08, 0.03);

    if (newTrick.length === 4) {
      // resolve trick
      const winnerSeat = DP.trickWinner(newTrick, trump, newLedSuit);
      const trickCards = newTrick.map(t => t.card);
      const tensInTrick = trickCards.filter(c => c.rank === 10).length;
      const team = DP.teamOf(winnerSeat);

      setTimeout(() => {
        setLastTrickWinner(winnerSeat);
        setTrickWins(tw => ({ ...tw, [team]: tw[team] + 1 }));
        setSeatTricks(st => st.map((v, i) => i === winnerSeat ? v + 1 : v));
        const tensCardsInTrick = trickCards.filter(c => c.rank === 10);
        if (tensCardsInTrick.length) {
          setSeatTens(st => st.map((arr, i) => i === winnerSeat ? [...arr, ...tensCardsInTrick] : arr));
        }
        if (tensInTrick > 0) {
          setTens(t => ({ ...t, [team]: t[team] + tensInTrick }));
          setTenCallouts(cb => [...cb, { id: Date.now(), seat: winnerSeat, msg: `+${tensInTrick} TEN!` }]);
        }
        setMoveLog(log => [...log, { kind: "trick-win", who: players[winnerSeat].name, tens: tensInTrick }]);
        if (tweaks.soundOn) {
          if (tensInTrick > 0) audioBeep(880, 0.18, 0.05, "triangle");
          else audioBeep(520, 0.06, 0.03);
        }

        // After short pause, clear trick & advance
        setTimeout(() => {
          setLastTrickWinner(null);
          const newTricksPlayed = tricksPlayed + 1;
          setTricksPlayed(newTricksPlayed);
          setTrick([]);
          setLedSuit(null);
          if (newTricksPlayed >= 13) {
            // hand end
            finalizeHand(winnerSeat);
          } else {
            setToPlayIdx(winnerSeat);
            setMoveLog(log => [...log, { kind:"trick-start", num: newTricksPlayed + 1 }]);
          }
        }, 1200);
      }, 350);
    } else {
      const next = (seat + 1) % 4;
      setToPlayIdx(next);
    }
  };

  const finalizeHand = (lastWinnerSeat) => {
    // tens & trickWins are state — re-derive from latest values
    setTimeout(() => {
      // close over current state via setter callbacks — simpler: read most recent setState by using ref
      const tCount = tensRef.current;
      const trCount = trickWinsRef.current;
      let winner;
      if (tCount[0] >= 3) winner = 0;
      else if (tCount[1] >= 3) winner = 1;
      else winner = (trCount[0] >= trCount[1]) ? 0 : 1;
      const mindi = tCount[winner] === 4;

      const result = {
        handNum,
        winner,
        mindi,
        tens: { ...tCount },
        tricks: { ...trCount },
        trump,
      };
      setHandResult(result);
      setMatchHistory(h => [...h, result]);
      setMatchWins(mw => ({ ...mw, [winner]: mw[winner] + 1 }));
      setConsecutive(c => {
        const nc = { ...c, [winner]: c[winner] + 1, [1 - winner]: 0 };
        // Check Kot
        if (nc[winner] >= 7) {
          setMatchEnd({ kot: true, winner });
          setCelebrate({ kind: "kot", team: winner });
        } else if (handNum >= maxHands) {
          // tally
          setMatchWins(mw => {
            const w = (mw[0] >= mw[1]) ? 0 : 1;
            setMatchEnd({ kot: false, winner: w });
            return mw;
          });
        }
        return nc;
      });

      if (mindi && !matchEnd) {
        setCelebrate({ kind: "mindi", team: winner });
      }

      setPhase("hand-end");
    }, 100);
  };

  // refs for finalize closure
  const tensRef = useRef(tens);
  const trickWinsRef = useRef(trickWins);
  useEffect(() => { tensRef.current = tens; }, [tens]);
  useEffect(() => { trickWinsRef.current = trickWins; }, [trickWins]);

  const continueAfterHand = () => {
    if (matchEnd) {
      // match over -> show match-end summary; on user dismiss go back to setup
      setPhase("match-end");
      return;
    }
    const newDealer = (dealerIdx + 1) % 4;
    setDealerIdx(newDealer);
    setHandResult(null);
    dealHand(players, newDealer, handNum + 1);
  };

  const newMatch = () => {
    setPhase("setup");
    setHandResult(null);
    setMatchEnd(null);
    setCelebrate(null);
  };

  // ---------- AI play orchestration ----------
  // When toPlayIdx is an AI in phase=play, automatically play after a short delay
  useEffect(() => {
    if (phase !== "play") return;
    if (trick.length >= 4) return;
    const current = players?.[toPlayIdx];
    if (!current || current.kind !== "ai") return;
    if (trick.some(t => t.seat === toPlayIdx)) return;

    setAiThinking(true);
    const seat = toPlayIdx;
    const t = setTimeout(() => {
      const legal = DP.legalMoves(hands[seat], ledSuit);
      if (!legal.length) { setAiThinking(false); return; }
      const fn = DP.AGENTS[current.agent || "heuristic"].fn;
      const card = fn({
        legal, hand: hands[seat], trick, trump, ledSuit, seat, seenCards
      });
      setAiThinking(false);
      playCard(seat, card);
    }, Math.max(80, tweaks.aiSpeedMs));
    return () => { clearTimeout(t); setAiThinking(false); };
  }, [phase, toPlayIdx, players, trick.length]);

  const advanceAi = () => {
    if (phase !== "play") return;
    if (trick.length >= 4) return;             // guard: trick is resolving
    const seat = toPlayIdx;
    const cur = players[seat];
    if (!cur || cur.kind !== "ai") return;
    // Don't double-play if this AI already played in current trick
    if (trick.some(t => t.seat === seat)) return;
    setPendingNext(false);
    setAiThinking(true);
    setTimeout(() => {
      const legal = DP.legalMoves(hands[seat], ledSuit);
      const fn = DP.AGENTS[cur.agent || "heuristic"].fn;
      const card = fn({
        legal, hand: hands[seat], trick, trump, ledSuit, seat, seenCards
      });
      setAiThinking(false);
      playCard(seat, card);
    }, Math.max(80, tweaks.aiSpeedMs));
  };

  // ---------- Hint ----------
  const showHint = () => {
    const seat = toPlayIdx;
    if (players[seat].kind !== "human") return;
    const legal = DP.legalMoves(hands[seat], ledSuit);
    const card = DP.heuristicAgent({ legal, hand: hands[seat], trick, trump, ledSuit, seat, seenCards });
    setHintCardId(`${card.rank}${card.suit}`);
    setTimeout(() => setHintCardId(null), 4400);
  };

  // ---------- Tweaks panel ----------
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // ---------- Render ----------
  if (phase === "setup") {
    return <SetupScreen initial={players} onStart={startMatch} />;
  }

  if (!players) return null;

  const youSeat = activeHumanSeat;
  const yourTurn = phase === "play" && players[toPlayIdx]?.kind === "human" && toPlayIdx === activeHumanSeat;
  const yourHand = hands[youSeat] || [];
  const legal = phase === "play" && yourTurn ? DP.legalMoves(yourHand, ledSuit) : [];
  const legalSet = new Set(legal.map(c => `${c.rank}${c.suit}`));

  return (
    <div className="app-shell">
      <div className="felt-wrap"
        onDragEnter={(e) => { e.preventDefault(); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={(e) => {
          e.preventDefault();
          if (drag && yourTurn && legalSet.has(`${drag.rank}${drag.suit}`)) {
            playCard(youSeat, drag);
          }
          setDrag(null);
        }}>
        <div className="table-frame"></div>
        <div className="topbar">
          <div className="brand">
            <span className="dot"></span>
            Dehla Pakad
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)", fontFamily: "var(--font-sans)", marginLeft: 6 }}>
              · Hand {handNum}/{maxHands}
            </span>
          </div>
          <div className="topinfo">
            <span>Dealer: <b>{players[dealerIdx].name}</b></span>
            {trump && (
              <span className={`trump-badge ${SUIT_COLOR[trump]}`}>
                Trump <span style={{ fontSize: 16 }}>{SUIT_GLYPH[trump]}</span> {SUIT_NAME[trump]}
              </span>
            )}
            <span>Tricks {tricksPlayed}/13</span>
            <span>A {matchWins[0]} – {matchWins[1]} B</span>
          </div>
        </div>

        <div className="table-grid">
          {[0,1,2,3].map(seat => {
            const pos = seatPosition(seat, youSeat);
            if (pos === "bottom") return null; // bottom is rendered as your-hand below
            const isActive = phase === "play" && toPlayIdx === seat;
            const flash = lastTrickWinner === seat;
            const player = players[seat];
            const hand = hands[seat] || [];
            const showFaces = tweaks.showAllHands || seat === activeHumanSeat;
            const teamCls = `t${seat % 2}`;
            return (
              <div key={seat} className={`seat ${pos} ${isActive ? "is-active" : ""} ${flash ? "flash-win" : ""}`}>
                <div className={`nameplate ${teamCls}`}>
                  <div className="av">{player.name[0]?.toUpperCase()}</div>
                  <span>{player.name}</span>
                  <span className="role">{player.kind === "ai" ? `AI · ${player.agent}` : "you"}</span>
                  {(seatTricks[seat] > 0 || seatTens[seat].length > 0) && (
                    <span className="ten-pip">
                      <span title="Tricks won">▦ {seatTricks[seat]}</span>
                      {seatTens[seat].length > 0 && <span title="Tens captured">★ {seatTens[seat].length}</span>}
                    </span>
                  )}
                  {isActive && aiThinking && <span className="thinking"><span></span><span></span><span></span></span>}
                </div>
                <div className="seat-hand">
                  {hand.map((c, i) => (
                    <div key={`${c.rank}${c.suit}`} className="stack-item">
                      {showFaces
                        ? <UI.CardFace card={c} size="sm" />
                        : <UI.CardBack size="sm" design={tweaks.cardBack} />}
                    </div>
                  ))}
                </div>
                {(seatTricks[seat] > 0 || seatTens[seat].length > 0) && (
                  <div className="trick-pile">
                    {Array.from({ length: Math.min(seatTricks[seat], 5) }).map((_, i) => (
                      <div key={`p${i}`} className="pile-back" style={{ left: i * 4, top: i * -2 }}>
                        <UI.CardBack size="sm" design={tweaks.cardBack} />
                      </div>
                    ))}
                    {seatTens[seat].map((tc, i) => (
                      <div key={`t${i}`} className="pile-ten" style={{ left: 30 + i * 18, top: -6 }}>
                        <UI.CardFace card={tc} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="seat-tag">{["You","Right","Partner","Left"][(seat - youSeat + 4) % 4]}</div>
              </div>
            );
          })}

          {/* Center play area */}
          <div className={`play-area ${drag ? "drop-target" : ""}`}>
            <div className="play-zone">
              {trick.length === 0 && phase === "play" && (
                <span>{yourTurn ? "Click or drag a card to play" : `Waiting on ${players[toPlayIdx]?.name}`}</span>
              )}
            </div>
            {trick.map(t => {
              const pos = seatPosition(t.seat, youSeat);
              return (
                <div key={`${tricksPlayed}-${t.seat}`} className={`play-card-slot ${pos} played-card`}>
                  <div>
                    <UI.CardFace card={t.card} />
                    <div className="lab">{players[t.seat].name}</div>
                  </div>
                </div>
              );
            })}
            {tenCallouts.map(co => (
              <div key={co.id} className="ten-callout"
                onAnimationEnd={() => setTenCallouts(cb => cb.filter(x => x.id !== co.id))}>
                {co.msg}
              </div>
            ))}
          </div>
        </div>

        {/* Your status (tricks/tens captured) */}
        {phase !== "setup" && (seatTricks[youSeat] > 0 || seatTens[youSeat].length > 0) && (
          <div className="your-status">
            <div className={`nameplate t${youSeat % 2}`}>
              <div className="av">{players[youSeat].name[0]?.toUpperCase()}</div>
              <span>{players[youSeat].name}</span>
              <span className="ten-pip">
                <span title="Tricks won">▦ {seatTricks[youSeat]}</span>
                {seatTens[youSeat].length > 0 && <span title="Tens captured">★ {seatTens[youSeat].length}</span>}
              </span>
            </div>
            {seatTens[youSeat].length > 0 && (
              <div className="your-status-tens">
                {seatTens[youSeat].map((tc, i) => (
                  <div key={i} className="stack-item"><UI.CardFace card={tc} size="sm" /></div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Your hand (bottom) */}
        <div className="your-hand">
          {yourHand.map((c, i) => {
            const id = `${c.rank}${c.suit}`;
            const isLegal = yourTurn && legalSet.has(id);
            const illegal = yourTurn && !isLegal;
            return (
              <div key={id} className="stack-item">
                <UI.HandCard
                  card={c}
                  draggable={isLegal}
                  illegal={illegal}
                  legal={tweaks.showLegalHints && isLegal}
                  hint={hintCardId === id}
                  dealDelay={i * 35}
                  onClick={() => isLegal && playCard(youSeat, c)}
                  onDragStart={() => setDrag(c)}
                  onDragEnd={() => setDrag(null)}
                />
              </div>
            );
          })}
        </div>

        {yourTurn && (
          <div className="hint-btn">
            <button className="btn" onClick={showHint}>💡 Hint</button>
          </div>
        )}
      </div>

      <UI.SidePanel state={{
        players,
        toPlayIdx,
        handTens: tens,
        handTricks: trickWins,
        matchWins,
        handNum,
        trump,
        dealerIdx,
        tricksPlayed,
        moveLog,
        matchHistory,
      }} dispatch={(action) => {
        if (action.type === "RETURN_TO_SETUP") newMatch();
      }} />

      {/* Trump pick modal */}
      {phase === "pick-trump" && pickInfo && (
        <Modals.TrumpPickModal
          chooserName={players[pickInfo.chooser].name}
          firstFour={pickInfo.firstFour}
          suitCounts={pickInfo.suitCounts}
          onPick={onTrumpPicked}
        />
      )}

      {/* Hand end modal */}
      {phase === "hand-end" && handResult && !celebrate && (
        <Modals.HandSummaryModal
          result={handResult}
          players={players}
          isMatchEnd={!!matchEnd}
          matchSummary={matchEnd ? { ...matchEnd, matchWins } : null}
          onContinue={matchEnd ? newMatch : continueAfterHand}
        />
      )}

      {/* Celebration */}
      {celebrate && (
        <Modals.Celebration
          kind={celebrate.kind}
          team={celebrate.team}
          onDone={() => setCelebrate(null)}
        />
      )}

      {/* Pass-device overlay for hot-seat mode */}
      {passOverlay !== null && (
        <div className="modal-back">
          <div className="modal" style={{ textAlign: "center" }}>
            <h2>Pass to {players[passOverlay].name}</h2>
            <p className="lede">It's their turn — hand the device over before tapping continue.</p>
            <div className="actions" style={{ justifyContent: "center" }}>
              <button className="btn-dark" onClick={() => setPassOverlay(null)}>I'm {players[passOverlay].name} — show my hand</button>
            </div>
          </div>
        </div>
      )}

      {/* Tweaks panel */}
      {tweaksOpen && (
        <window.TweaksPanel onClose={() => { setTweaksOpen(false); window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*"); }}>
          <window.TweakSection title="Theme">
            <window.TweakColor label="Felt color" value={tweaks.feltColor} onChange={(v) => setTweak("feltColor", v)} />
            <window.TweakRadio label="Card back" value={tweaks.cardBack} onChange={(v) => setTweak("cardBack", v)}
              options={[{value:"weave",label:"Weave"},{value:"dots",label:"Dots"},{value:"crest",label:"Crest"},{value:"plain",label:"Plain"}]} />
          </window.TweakSection>
          <window.TweakSection title="Gameplay">
            <window.TweakSlider label="AI speed (ms)" min={100} max={1800} step={50}
              value={tweaks.aiSpeedMs} onChange={(v) => setTweak("aiSpeedMs", v)} />
            <window.TweakToggle label="Highlight legal moves" value={tweaks.showLegalHints} onChange={(v) => setTweak("showLegalHints", v)} />
            <window.TweakToggle label="Sound effects" value={tweaks.soundOn} onChange={(v) => setTweak("soundOn", v)} />
            <window.TweakToggle label="Show all hands (debug)" value={tweaks.showAllHands} onChange={(v) => setTweak("showAllHands", v)} />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

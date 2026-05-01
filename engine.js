// Dehla Pakad engine — JS port of the Python reference.
// Globals: window.DP

(function (global) {
  const SUITS = ["H", "D", "C", "S"];
  const SUIT_NAMES = { H: "Hearts", D: "Diamonds", C: "Clubs", S: "Spades" };
  const SUIT_GLYPH = { H: "♥", D: "♦", C: "♣", S: "♠" };
  const SUIT_COLOR = { H: "red", D: "red", C: "black", S: "black" };
  const RANK_SHORT = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const RANK_NAMES = { 11: "Jack", 12: "Queen", 13: "King", 14: "Ace" };

  function rankShort(r) {
    return RANK_SHORT[r] || String(r);
  }
  function rankName(r) {
    return RANK_NAMES[r] || String(r);
  }

  function cardId(c) { return `${rankShort(c.rank)}${c.suit}`; }
  function cardLabel(c) { return `${rankShort(c.rank)}${SUIT_GLYPH[c.suit]}`; }
  function isTen(c) { return c.rank === 10; }

  // Build & shuffle deck
  function makeDeck() {
    const cards = [];
    for (const s of SUITS) {
      for (let r = 2; r <= 14; r++) cards.push({ suit: s, rank: r });
    }
    return cards;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Deal in batches: 4 each, then 1 each round-robin (matches Python deck.deal)
  function deal() {
    const deck = shuffle(makeDeck());
    const hands = [[], [], [], []];
    let idx = 0;
    for (let p = 0; p < 4; p++) {
      hands[p].push(...deck.slice(idx, idx + 4));
      idx += 4;
    }
    while (idx < deck.length) {
      hands[idx % 4].push(deck[idx]);
      idx++;
    }
    return hands;
  }

  // Sort a hand for display: by suit, then rank desc
  function sortHand(hand) {
    const order = { S: 0, H: 1, C: 2, D: 3 };
    return [...hand].sort((a, b) => {
      if (a.suit !== b.suit) return order[a.suit] - order[b.suit];
      return b.rank - a.rank;
    });
  }

  function teamOf(seat) { return seat % 2; }   // seats 0,2 = team0; 1,3 = team1
  function partnerOf(seat) { return (seat + 2) % 4; }

  // Legal moves: must follow led suit if possible
  function legalMoves(hand, ledSuit) {
    if (!ledSuit) return hand.slice();
    const matching = hand.filter(c => c.suit === ledSuit);
    return matching.length ? matching : hand.slice();
  }

  // Determine winning seat of a trick.
  // trick: [{seat, card}], trump: 'H'|'D'|'C'|'S'|null, ledSuit
  function trickWinner(trick, trump, ledSuit) {
    const trumps = trick.filter(t => t.card.suit === trump);
    if (trumps.length) {
      return trumps.reduce((a, b) => (a.card.rank >= b.card.rank ? a : b)).seat;
    }
    const led = trick.filter(t => t.card.suit === ledSuit);
    return led.reduce((a, b) => (a.card.rank >= b.card.rank ? a : b)).seat;
  }

  // ---------- Agents ----------
  function randomAgent({ legal }) {
    return legal[Math.floor(Math.random() * legal.length)];
  }

  function currentTrickWinner(trick, trump, ledSuit) {
    if (!trick.length) return null;
    const trumps = trick.filter(t => t.card.suit === trump);
    if (trumps.length) return trumps.reduce((a, b) => a.card.rank >= b.card.rank ? a : b);
    const led = trick.filter(t => t.card.suit === ledSuit);
    if (led.length) return led.reduce((a, b) => a.card.rank >= b.card.rank ? a : b);
    return trick[0];
  }

  function beats(card, winnerCard, trump, ledSuit) {
    if (card.suit === trump && winnerCard.suit !== trump) return true;
    if (card.suit === trump && winnerCard.suit === trump) return card.rank > winnerCard.rank;
    if (card.suit === ledSuit && winnerCard.suit === ledSuit) return card.rank > winnerCard.rank;
    return false;
  }

  // Heuristic agent (stateless wrapper; needs seenCards)
  function heuristicAgent({ legal, trick, trump, ledSuit, seat, seenCards }) {
    const myPos = trick.length;
    if (myPos === 0) {
      const safe = legal.filter(c => !isTen(c) && c.suit !== trump);
      if (safe.length) return safe.reduce((a, b) => a.rank <= b.rank ? a : b);
      const nonTens = legal.filter(c => !isTen(c));
      if (nonTens.length) return nonTens.reduce((a, b) => a.rank <= b.rank ? a : b);
      // all are tens — only lead if higher cards already seen
      for (const c of legal) {
        const totalHigher = 14 - c.rank; // J,Q,K,A above 10 = 4
        const seenHigher = seenCards.filter(s => s.suit === c.suit && s.rank > c.rank).length;
        if (seenHigher >= totalHigher) return c;
      }
      return legal.reduce((a, b) => a.rank <= b.rank ? a : b);
    }
    const winnerEntry = currentTrickWinner(trick, trump, ledSuit);
    const myTeam = teamOf(seat);
    const trickHasOppTen = trick.some(t => isTen(t.card) && teamOf(t.seat) !== myTeam);
    if (trickHasOppTen) {
      const winners = legal.filter(c => beats(c, winnerEntry.card, trump, ledSuit));
      if (winners.length) return winners.reduce((a, b) => a.rank <= b.rank ? a : b);
    }
    if (winnerEntry) {
      const weAreWinning = teamOf(winnerEntry.seat) === myTeam;
      const trickHasTen = trick.some(t => isTen(t.card));
      if (weAreWinning && trickHasTen) {
        return legal.reduce((a, b) => a.rank >= b.rank ? a : b);
      }
    }
    return legal.reduce((a, b) => a.rank <= b.rank ? a : b);
  }

  const AGENTS = {
    random: { name: "Random", fn: randomAgent },
    heuristic: { name: "Heuristic", fn: heuristicAgent },
  };

  // Compute most-common suit in first 4 cards (used as auto pick for AI choosers)
  function autoPickTrump(firstFour) {
    const counts = {};
    for (const c of firstFour) counts[c.suit] = (counts[c.suit] || 0) + 1;
    let best = null, bestCount = -1, bestIdx = 99;
    for (const s of SUITS) {
      if ((counts[s] || 0) > bestCount ||
          ((counts[s] || 0) === bestCount && SUITS.indexOf(s) < bestIdx)) {
        if ((counts[s] || 0) >= bestCount) {
          if ((counts[s] || 0) > bestCount) { best = s; bestCount = counts[s] || 0; bestIdx = SUITS.indexOf(s); }
        }
      }
    }
    // simpler:
    return Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
  }

  global.DP = {
    SUITS, SUIT_NAMES, SUIT_GLYPH, SUIT_COLOR,
    rankShort, rankName, cardId, cardLabel, isTen,
    makeDeck, shuffle, deal, sortHand,
    teamOf, partnerOf, legalMoves, trickWinner,
    randomAgent, heuristicAgent, AGENTS,
    autoPickTrump,
  };
})(window);

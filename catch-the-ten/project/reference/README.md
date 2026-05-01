# Dehla Pakad — Python Game Engine

A pure-Python simulation of **Dehla Pakad** (Catch the Ten), a South Asian trick-taking card game played by 4 players in two partnerships. This engine is the foundation for future reinforcement-learning agent development (Phase 2 of the RL roadmap).

---

## Directory Structure

```
game/
├── __init__.py        # Public API exports
├── card.py            # Card, Deck, Suit, Rank primitives
├── player.py          # Player state and hand management
├── game_engine.py     # Core rules engine (DehlaPakadGame)
├── agents.py          # BaseAgent, RandomAgent, HeuristicAgent
├── simulation.py      # Simulation runner and CLI entry point
└── README.md          # This file
```

---

## How to Run

From the `Catch_the_ten/` directory:

```bash
# Default: one verbose game (mixed agents) + 1000-game stats summary
python -m game.simulation

# Quiet mode — stats only, no per-trick output
python -m game.simulation --quiet

# Choose agent matchup
python -m game.simulation --agents random      # RandomAgent vs RandomAgent
python -m game.simulation --agents heuristic   # HeuristicAgent vs HeuristicAgent
python -m game.simulation --agents mixed       # HeuristicAgent (T0) vs RandomAgent (T1)

# Control game length
python -m game.simulation --hands 10           # Max 10 hands per game
python -m game.simulation --games 5000         # Run 5000 games for stats
```

> Python 3.8+ required. No external dependencies.

---

## Game Rules Summary

| Rule | Detail |
|---|---|
| Players | 4 — fixed partnerships; seats 0 & 2 = Team 0, seats 1 & 3 = Team 1 |
| Deck | Standard 52-card deck |
| Card rank (high→low) | A K Q J 10 9 8 7 6 5 4 3 2 |
| Prize cards | The four **10s** (called *Dehlas* or *Mindis*) |
| Trump | Player to dealer's right picks trump suit from their first 4 cards |
| Follow suit | Must follow led suit if possible; otherwise any card is legal |
| Trick winner | Highest trump wins; else highest card of led suit |
| Hand winner | Team capturing **3 or 4 tens** wins the hand |
| Mindi | Capturing **all 4 tens** in one hand — a major victory |
| Draw (2-2 tens) | Team with more tricks wins; tie goes to Team 0 |
| Kot | Winning **7 consecutive hands** — total defeat for opponents |

---

## Module Reference

### `card.py`

#### `Suit` (enum)
Values: `HEARTS`, `DIAMONDS`, `CLUBS`, `SPADES`

#### `Rank` (enum)
Integer values 2–14 (`TWO`=2 … `TEN`=10, `JACK`=11, `QUEEN`=12, `KING`=13, `ACE`=14).
- `Rank.short() -> str` — returns display string (`"2"`…`"9"`, `"10"`, `"J"`, `"Q"`, `"K"`, `"A"`)

#### `Card(suit, rank)`
| Method / Property | Description |
|---|---|
| `is_ten() -> bool` | Returns `True` if rank is TEN |
| `__repr__` | e.g. `"10♥"`, `"A♠"` |

#### `Deck()`
| Method | Description |
|---|---|
| `shuffle()` | Randomly shuffles the 52-card deck in place |
| `deal(n_players=4) -> List[List[Card]]` | Distributes all cards in batches (4 each, then 1 at a time). Returns a list of `n_players` hands |

---

### `player.py`

#### `Player(name, team_id)`
`team_id` is `0` or `1`.

| Method | Description |
|---|---|
| `set_hand(cards)` | Replace hand entirely (called by the engine after dealing) |
| `add_card(card)` | Append one card to hand |
| `play_card(card) -> Card` | Remove card from hand and return it |
| `has_suit(suit) -> bool` | True if player holds at least one card of that suit |
| `cards_of_suit(suit) -> List[Card]` | All cards in hand matching the given suit |
| `tens_captured() -> int` | Count of 10s across all won tricks |
| `tricks_count() -> int` | Number of tricks won this hand |
| `reset_for_hand()` | Clear hand and tricks (called automatically before each deal) |

---

### `game_engine.py`

#### `DehlaPakadGame(players)`
Accepts a list of exactly 4 `Player` objects.

| Method | Description |
|---|---|
| `deal(dealer_idx) -> int` | Shuffle and deal 13 cards per player. Returns `chooser_idx` (player to dealer's right who picks trump) |
| `select_trump(chooser_idx) -> Suit` | Picks the most-represented suit in the chooser's first 4 cards as trump |
| `get_legal_moves(player, led_suit) -> List[Card]` | Returns cards the player may legally play. Enforces follow-suit rule |
| `determine_trick_winner(trick, led_suit) -> int` | Given `List[(seat, Card)]`, returns the winning seat index |
| `play_trick(lead_player_idx, agents) -> (int, List)` | Plays one full trick. Returns `(winner_seat, trick_cards)` |
| `score_hand() -> dict` | Counts tens and tricks per team; determines hand winner |
| `play_hand(dealer_idx, agents) -> dict` | Deals, selects trump, plays 13 tricks, scores. Returns full hand result |
| `play_game(agents, max_hands=50) -> dict` | Plays hands until Kot or `max_hands`. Returns game log |

**Hand result dict keys:** `team_tens`, `team_tricks`, `winner`, `mindi`, `trump`, `dealer`, `tricks`, `hand_num`

**Game result dict keys:** `hands`, `kot`, `kot_team`, `total_hands`, `team_hand_wins` (if no Kot), `overall_winner` (if no Kot)

---

### `agents.py`

#### `BaseAgent` (abstract)
Subclass and implement `choose_card(...)`.

```python
def choose_card(
    self,
    hand: List[Card],          # player's current hand
    legal_moves: List[Card],   # cards allowed to play
    trick_so_far: List[Tuple[int, Card]],  # (seat, card) pairs played this trick
    trump: Optional[Suit],     # current trump suit
    led_suit: Optional[Suit],  # suit of the first card played this trick
) -> Card:
```

#### `RandomAgent`
Picks a uniformly random legal card. Useful as a baseline and for stress-testing the engine.

#### `HeuristicAgent`
Rule-based agent with four prioritized heuristics:
1. **Lead safely** — avoid leading a 10 unless all higher cards in that suit are gone.
2. **Trump opponent 10s** — if an opponent's 10 is in the trick, play the lowest trump that wins.
3. **Secure winning trick with a 10** — if already winning a trick containing a 10, play highest card.
4. **Default** — play the lowest legal card to preserve high cards.

`HeuristicAgent` also exposes `observe(card)` and `reset()` for agents that need to track played cards across a hand.

---

### `simulation.py`

#### `simulate_game(agents, players, max_hands=50, verbose=True) -> dict`
Runs one full game. Prints trick-by-trick output when `verbose=True`. Returns the raw game-log dict from `DehlaPakadGame.play_game`.

#### `run_stats(n_games, agents_factory, players_factory, max_hands=50) -> dict`
Runs `n_games` games and aggregates:
- `team_wins` / `team_win_pct`
- `kot_count`, `mindi_count`
- `avg_hands_per_game`
- `avg_tens_team0_per_hand`, `avg_tens_team1_per_hand`

`agents_factory` and `players_factory` are zero-argument callables invoked fresh for each game.

#### `main(argv=None)`
CLI entry point. Parses `--quiet`, `--hands`, `--games`, `--agents` flags.

---

## Example Output

```
Dehla Pakad Simulation  |  HeuristicAgent (Team 0) vs RandomAgent (Team 1)

--- Single Game (verbose) ---

============================================================
  Hand 1  |  Dealer: Alice  |  Trump: ♥ Hearts
============================================================
  Trick  1: [Bob: 7♦  Carol: J♦  Dave: 3♦  Alice: 2♦]  → Won by Carol
  Trick  2: [Carol: 8♣  Dave: 5♣  Alice: K♣  Bob: 2♣]  → Won by Alice
  ...
  Tens  — Team 0: 3  |  Team 1: 1
  Tricks— Team 0: 8  |  Team 1: 5
  Hand winner: Team 0 (seats 0 & 2)

--- Running 1000 games for statistics ---

============================================================
  STATS over 1000 games
============================================================
  Team 0 (seats 0 & 2): 712 wins  (71.2%)
  Team 1 (seats 1 & 3): 288 wins  (28.8%)
  Kots (7-consecutive-hand sweep): 14
  Mindis (all-4-tens in one hand): 47
  Avg hands per game: 8.3
  Avg tens/hand — Team 0: 2.64  Team 1: 1.36
============================================================
```

---

## Extending the Engine

To plug in a new agent, subclass `BaseAgent` and implement `choose_card`:

```python
from game.agents import BaseAgent
from game.card import Card, Suit
from typing import List, Tuple, Optional

class MyAgent(BaseAgent):
    def choose_card(self, hand, legal_moves, trick_so_far, trump, led_suit) -> Card:
        # your logic here
        return legal_moves[0]
```

Pass instances to `simulate_game` or `run_stats` as the `agents` list (one per seat, index 0–3).

---

## Next Steps (RL Roadmap)

This engine is Phase 2 of the full RL pipeline:

| Phase | What |
|---|---|
| Phase 3 | Wrap as a **PettingZoo AEC environment** (`reset`, `step`, `observe`, action masking) |
| Phase 4 | Build a stronger **heuristic baseline** to set the floor for RL agents |
| Phase 5 | Train a **PPO agent** (single-agent setup: one learner vs three heuristics) |
| Phase 6 | **Self-play** — all seats use the same policy network |
| Phase 7 | **MAPPO** — centralized training, decentralized execution for cooperative play |

from __future__ import annotations
from typing import List, Tuple, Optional, Dict, Any
from .card import Card, Deck, Suit, Rank
from .player import Player


# Seat index → team id: seats 0 & 2 = Team 0, seats 1 & 3 = Team 1
SEAT_TEAM = {0: 0, 1: 1, 2: 0, 3: 1}


class DehlaPakadGame:
    """
    Core game engine for Dehla Pakad (Catch the Ten).

    Manages dealing, trump selection, trick play, and scoring for one or more hands.
    Agents supply card choices; this class enforces all rules.
    """

    def __init__(self, players: List[Player]) -> None:
        if len(players) != 4:
            raise ValueError("Dehla Pakad requires exactly 4 players.")
        self.players = players
        self.trump_suit: Optional[Suit] = None
        self._played_cards: List[Card] = []

    def __repr__(self):
        snapshot = ''
        for i in range(len(self.players)):
            snapshot = snapshot+ str(self.players[i])+': '+ str(self.players[i].hand) + '\n'
        return snapshot
    # ------------------------------------------------------------------
    # Dealing
    # ------------------------------------------------------------------

    def deal(self, dealer_idx: int) -> int:
        """Deal 13 cards to each player. Returns the index of the trump chooser."""
        deck = Deck()
        deck.shuffle()
        hands = deck.deal(n_players=4)

        for p in self.players:
            p.reset_for_hand()

        # Rotate hands so dealer_idx player gets hands[0]
        for i, player in enumerate(self.players):
            seat = (i - dealer_idx) % 4
            player.set_hand(hands[seat])

        # Trump chooser = player to dealer's right = (dealer_idx + 3) % 4
        return (dealer_idx + 3) % 4

    # ------------------------------------------------------------------
    # Trump selection
    # ------------------------------------------------------------------

    def select_trump(self, chooser_idx: int) -> Suit:
        """
        Trump chooser looks at their first 4 cards and picks the most common suit.
        Ties broken by suit enum order.
        """
        first_four = self.players[chooser_idx].hand[:4]
        suit_counts: Dict[Suit, int] = {}
        for card in first_four:
            suit_counts[card.suit] = suit_counts.get(card.suit, 0) + 1
        chosen = max(suit_counts, key=lambda s: (suit_counts[s], list(Suit).index(s)))
        self.trump_suit = chosen
        return chosen

    # ------------------------------------------------------------------
    # Legal moves
    # ------------------------------------------------------------------

    def get_legal_moves(self, player: Player, led_suit: Optional[Suit]) -> List[Card]:
        """
        Return cards the player is allowed to play.
        Must follow led_suit if possible; otherwise any card is legal.
        """
        if led_suit is None:
            return list(player.hand)
        if player.has_suit(led_suit):
            return player.cards_of_suit(led_suit)
        return list(player.hand)

    # ------------------------------------------------------------------
    # Trick resolution
    # ------------------------------------------------------------------

    def determine_trick_winner(
        self,
        trick: List[Tuple[int, Card]],
        led_suit: Suit,
    ) -> int:
        """
        Given a list of (seat_idx, card) pairs, return the seat index of the winner.
        Highest trump wins; otherwise highest card of led suit.
        """
        trumps = [(idx, c) for idx, c in trick if c.suit == self.trump_suit]
        if trumps:
            winner_idx, _ = max(trumps, key=lambda x: x[1].rank.value)
        else:
            led = [(idx, c) for idx, c in trick if c.suit == led_suit]
            winner_idx, _ = max(led, key=lambda x: x[1].rank.value)
        return winner_idx

    # ------------------------------------------------------------------
    # Playing a single trick
    # ------------------------------------------------------------------

    def play_trick(
        self,
        lead_player_idx: int,
        agents: List[Any],
    ) -> Tuple[int, List[Tuple[int, Card]]]:
        """
        Play one trick starting from lead_player_idx.
        agents[i] must implement choose_card(hand, legal_moves, trick_so_far, trump, led_suit).
        Returns (winner_seat_idx, trick_as_list_of_(seat, card)).
        """
        trick: List[Tuple[int, Card]] = []
        led_suit: Optional[Suit] = None

        for offset in range(4):
            seat = (lead_player_idx + offset) % 4
            player = self.players[seat]
            legal = self.get_legal_moves(player, led_suit)
            card = agents[seat].choose_card(
                hand=player.hand,
                legal_moves=legal,
                trick_so_far=trick,
                trump=self.trump_suit,
                led_suit=led_suit,
            )
            player.play_card(card)
            self._played_cards.append(card)
            trick.append((seat, card))
            if led_suit is None:
                led_suit = card.suit

        winner_idx = self.determine_trick_winner(trick, led_suit)
        self.players[winner_idx].tricks_won.append([c for _, c in trick])
        return winner_idx, trick

    # ------------------------------------------------------------------
    # Scoring a hand
    # ------------------------------------------------------------------

    def score_hand(self) -> Dict[str, Any]:
        """
        Count tens per team; determine hand winner.
        Returns a dict with team tens, trick counts, and winning team.
        """
        team_tens = {0: 0, 1: 0}
        team_tricks = {0: 0, 1: 0}

        for seat, player in enumerate(self.players):
            team = SEAT_TEAM[seat]
            team_tens[team] += player.tens_captured()
            team_tricks[team] += player.tricks_count()

        if team_tens[0] >= 3:
            winner = 0
        elif team_tens[1] >= 3:
            winner = 1
        else:
            # Draw (2-2): team with more tricks wins; tie goes to Team 0
            winner = 0 if team_tricks[0] >= team_tricks[1] else 1

        mindi = team_tens[winner] == 4

        return {
            "team_tens": team_tens,
            "team_tricks": team_tricks,
            "winner": winner,
            "mindi": mindi,
        }

    # ------------------------------------------------------------------
    # Playing a full hand (13 tricks)
    # ------------------------------------------------------------------

    def play_hand(self, dealer_idx: int, agents: List[Any]) -> Dict[str, Any]:
        """
        Deal, select trump, play 13 tricks, score.
        Returns the hand result dict.
        """
        self._played_cards = []
        chooser_idx = self.deal(dealer_idx)
        trump = self.select_trump(chooser_idx)

        lead = (dealer_idx + 1) % 4  # Player left of dealer leads first trick
        trick_log: List[Dict[str, Any]] = []

        for trick_num in range(13):
            winner, trick = self.play_trick(lead, agents)
            trick_log.append({
                "trick_num": trick_num + 1,
                "cards": trick,
                "winner_seat": winner,
                "winner_name": self.players[winner].name,
            })
            lead = winner

        result = self.score_hand()
        result["trump"] = trump
        result["dealer"] = dealer_idx
        result["tricks"] = trick_log
        return result

    # ------------------------------------------------------------------
    # Playing a full game (multiple hands)
    # ------------------------------------------------------------------

    def play_game(self, agents: List[Any], max_hands: int = 50) -> Dict[str, Any]:
        """
        Play hands until Kot (7 consecutive wins by one team) or max_hands.
        Returns full game log.
        """
        hand_results: List[Dict[str, Any]] = []
        consecutive = {0: 0, 1: 0}
        dealer = 0

        for hand_num in range(max_hands):
            result = self.play_hand(dealer, agents)
            result["hand_num"] = hand_num + 1
            hand_results.append(result)

            winner = result["winner"]
            loser = 1 - winner
            consecutive[winner] += 1
            consecutive[loser] = 0

            if consecutive[winner] >= 7:
                return {
                    "hands": hand_results,
                    "kot": True,
                    "kot_team": winner,
                    "total_hands": hand_num + 1,
                }

            dealer = (dealer + 1) % 4

        # No Kot — tally hand wins
        team_hand_wins = {0: 0, 1: 0}
        for r in hand_results:
            team_hand_wins[r["winner"]] += 1

        overall_winner = 0 if team_hand_wins[0] >= team_hand_wins[1] else 1
        return {
            "hands": hand_results,
            "kot": False,
            "kot_team": None,
            "total_hands": max_hands,
            "team_hand_wins": team_hand_wins,
            "overall_winner": overall_winner,
        }

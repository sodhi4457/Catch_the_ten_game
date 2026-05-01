from __future__ import annotations
import random
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from .card import Card, Suit, Rank


class BaseAgent(ABC):
    """Abstract base class for all Dehla Pakad agents."""

    @abstractmethod
    def choose_card(
        self,
        hand: List[Card],
        legal_moves: List[Card],
        trick_so_far: List[Tuple[int, Card]],
        trump: Optional[Suit],
        led_suit: Optional[Suit],
    ) -> Card:
        """Return one card from legal_moves to play."""


class RandomAgent(BaseAgent):
    """Plays a uniformly random legal card every turn."""

    def choose_card(
        self,
        hand: List[Card],
        legal_moves: List[Card],
        trick_so_far: List[Tuple[int, Card]],
        trump: Optional[Suit],
        led_suit: Optional[Suit],
    ) -> Card:
        return random.choice(legal_moves)


class HeuristicAgent(BaseAgent):
    """
    Rule-based agent with four prioritized heuristics:

    1. If leading (no cards played yet):
       - Don't lead a 10 unless all higher cards of that suit are gone from play.
       - Prefer leading a non-10, non-trump card.

    2. If an opponent's 10 is already in the trick and we can win it with a trump,
       play the lowest trump that beats the current winning card.

    3. If we are currently winning the trick and it contains a 10, play the highest
       available legal card to secure the trick.

    4. Default: play the lowest legal card (preserves high cards for later).
    """

    # Track which cards have been seen (shared state across a hand; reset externally)
    def __init__(self) -> None:
        self.seen_cards: List[Card] = []

    def observe(self, card: Card) -> None:
        """Call this after each card is played so the agent tracks played cards."""
        self.seen_cards.append(card)

    def reset(self) -> None:
        self.seen_cards = []

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _current_trick_winner(
        self, trick_so_far: List[Tuple[int, Card]], trump: Optional[Suit], led_suit: Optional[Suit]
    ) -> Optional[Tuple[int, Card]]:
        if not trick_so_far:
            return None
        trumps = [(idx, c) for idx, c in trick_so_far if c.suit == trump]
        if trumps:
            return max(trumps, key=lambda x: x[1].rank.value)
        led = [(idx, c) for idx, c in trick_so_far if c.suit == led_suit]
        if led:
            return max(led, key=lambda x: x[1].rank.value)
        return trick_so_far[0]

    def _trick_has_opponent_ten(
        self, trick_so_far: List[Tuple[int, Card]], my_seat: int
    ) -> bool:
        my_team = my_seat % 2  # seats 0,2 = team 0; seats 1,3 = team 1
        for seat, card in trick_so_far:
            if card.is_ten() and (seat % 2) != my_team:
                return True
        return False

    def _beats_current_winner(
        self,
        card: Card,
        winner_card: Card,
        trump: Optional[Suit],
        led_suit: Optional[Suit],
    ) -> bool:
        if card.suit == trump and winner_card.suit != trump:
            return True
        if card.suit == trump and winner_card.suit == trump:
            return card.rank.value > winner_card.rank.value
        if card.suit == led_suit and winner_card.suit == led_suit:
            return card.rank.value > winner_card.rank.value
        return False

    def _higher_cards_gone(self, card: Card) -> bool:
        """True if all cards that beat `card` in its suit have already been played."""
        higher = [
            c for c in self.seen_cards
            if c.suit == card.suit and c.rank.value > card.rank.value
        ]
        # Number of cards higher than `card` in the suit (J, Q, K, A = 4 cards above 10)
        total_higher = sum(1 for r in Rank if r.value > card.rank.value)
        return len(higher) >= total_higher

    # ------------------------------------------------------------------
    # Main decision
    # ------------------------------------------------------------------

    def choose_card(
        self,
        hand: List[Card],
        legal_moves: List[Card],
        trick_so_far: List[Tuple[int, Card]],
        trump: Optional[Suit],
        led_suit: Optional[Suit],
    ) -> Card:
        # Infer our seat from trick position (we are the (len(trick_so_far))-th to play)
        # Seat is relative; for heuristic purposes we just need team parity.
        my_position = len(trick_so_far)  # 0 = lead, 3 = last

        # --- Heuristic 1: Leading ---
        if my_position == 0:
            non_tens_non_trump = [
                c for c in legal_moves if not c.is_ten() and c.suit != trump
            ]
            if non_tens_non_trump:
                return min(non_tens_non_trump, key=lambda c: c.rank.value)
            non_tens = [c for c in legal_moves if not c.is_ten()]
            if non_tens:
                return min(non_tens, key=lambda c: c.rank.value)
            # All legal moves are tens; only lead one if safe
            for c in legal_moves:
                if self._higher_cards_gone(c):
                    return c
            return min(legal_moves, key=lambda c: c.rank.value)

        # --- Heuristic 2: Trump an opponent's 10 ---
        winner_entry = self._current_trick_winner(trick_so_far, trump, led_suit)
        if winner_entry:
            winner_seat, winner_card = winner_entry
            trick_has_opp_ten = any(
                c.is_ten() and (seat % 2) != (my_position % 2)
                for seat, c in trick_so_far
            )
            if trick_has_opp_ten:
                trumps_that_win = [
                    c for c in legal_moves
                    if self._beats_current_winner(c, winner_card, trump, led_suit)
                ]
                if trumps_that_win:
                    return min(trumps_that_win, key=lambda c: c.rank.value)

        # --- Heuristic 3: Secure the trick if we're already winning it ---
        if winner_entry:
            winner_seat, winner_card = winner_entry
            we_are_winning = (winner_seat % 2) == (my_position % 2)
            trick_has_ten = any(c.is_ten() for _, c in trick_so_far)
            if we_are_winning and trick_has_ten:
                return max(legal_moves, key=lambda c: c.rank.value)

        # --- Heuristic 4: Default — play lowest card ---
        return min(legal_moves, key=lambda c: c.rank.value)

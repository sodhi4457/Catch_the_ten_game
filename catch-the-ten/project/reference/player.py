from __future__ import annotations
from typing import List, Optional
from .card import Card, Suit


class Player:
    def __init__(self, name: str, team_id: int) -> None:
        self.name = name
        self.team_id = team_id  # 0 or 1
        self.hand: List[Card] = []
        self.tricks_won: List[List[Card]] = []

    def add_card(self, card: Card) -> None:
        self.hand.append(card)

    def set_hand(self, cards: List[Card]) -> None:
        self.hand = list(cards)

    def play_card(self, card: Card) -> Card:
        self.hand.remove(card)
        return card

    def has_suit(self, suit: Suit) -> bool:
        return any(c.suit == suit for c in self.hand)

    def cards_of_suit(self, suit: Suit) -> List[Card]:
        return [c for c in self.hand if c.suit == suit]

    def tens_captured(self) -> int:
        return sum(1 for trick in self.tricks_won for card in trick if card.is_ten())

    def tricks_count(self) -> int:
        return len(self.tricks_won)

    def reset_for_hand(self) -> None:
        self.hand = []
        self.tricks_won = []

    def __repr__(self) -> str:
        return f"Player({self.name}, Team {self.team_id})"

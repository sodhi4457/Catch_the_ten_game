from __future__ import annotations
import random
from enum import Enum
from typing import List


class Suit(Enum):
    HEARTS = "Hearts"
    DIAMONDS = "Diamonds"
    CLUBS = "Clubs"
    SPADES = "Spades"


class Rank(Enum):
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5
    SIX = 6
    SEVEN = 7
    EIGHT = 8
    NINE = 9
    TEN = 10
    JACK = 11
    QUEEN = 12
    KING = 13
    ACE = 14

    def short(self) -> str:
        face = {11: "J", 12: "Q", 13: "K", 14: "A"}
        return face.get(self.value, str(self.value))


class Card:
    def __init__(self, suit: Suit, rank: Rank) -> None:
        self.suit = suit
        self.rank = rank

    def is_ten(self) -> bool:
        return self.rank == Rank.TEN

    def __repr__(self) -> str:
        suit_codes = {
            Suit.HEARTS: "H",
            Suit.DIAMONDS: "D",
            Suit.CLUBS: "C",
            Suit.SPADES: "S",
        }
        return f"{self.rank.short()}{suit_codes[self.suit]}"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Card):
            return NotImplemented
        return self.suit == other.suit and self.rank == other.rank

    def __hash__(self) -> int:
        return hash((self.suit, self.rank))


class Deck:
    def __init__(self) -> None:
        self.cards: List[Card] = [
            Card(suit, rank) for suit in Suit for rank in Rank
        ]

    def shuffle(self) -> None:
        random.shuffle(self.cards)

    def deal(self, n_players: int = 4) -> List[List[Card]]:
        """Deal all 52 cards to n_players in batches (4 at a time, then 1 at a time)."""
        hands: List[List[Card]] = [[] for _ in range(n_players)]
        deck = list(self.cards)
        idx = 0

        # First batch: 4 cards each
        for p in range(n_players):
            hands[p].extend(deck[idx: idx + 4])
            idx += 4

        # Remaining cards: 1 at a time round-robin
        while idx < len(deck):
            hands[idx % n_players].append(deck[idx])
            idx += 1

        return hands

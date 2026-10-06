from dataclasses import dataclass
from enum import Enum



class Hand(str, Enum):
    LEFT = "L"
    RIGHT = "R"


@dataclass
class User:
    display_name:str
    username: str
    email: str
    main_hand: Hand | None = None
    user_id: int | None = None
    
from dataclasses import dataclass


@dataclass
class Client:
    device: str
    token: str
    user_id: int
    incorrect_passwords: int = 0
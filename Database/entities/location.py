from dataclasses import dataclass


@dataclass
class MasterLocation:
    location_name: str
    lane_count: int | None = None
    address: str | None = None
    location_id: int | None = None


@dataclass
class UserEstablishment:
    establishment_name: str
    user_id: int
    lane_count: int | None = None
    address: str | None = None
    location_id: int | None = None
    establishment_id: int | None = None
    nickname: str | None = None
    type: str | None = None
    phone: str | None = None
    home_house: bool = False
    enabled: bool = True

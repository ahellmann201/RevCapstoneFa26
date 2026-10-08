
from uuid import uuid4

from database.connection import get_connection
from repositories.user_repository import UserRepository
from repositories.location_repository import LocationRepository
from entities import User, Hand, MasterLocation, UserEstablishment


def test_location_repository():
    conn = get_connection()

    user_repo = UserRepository(conn)
    location_repo = LocationRepository(conn)

    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"

    user_id = None
    location_id = None
    establishment_id = None

    try:
        # CREATE TEST USER
        user = User(
            user_id=None,
            display_name="Location Test User",
            username=username,
            email=f"{username}@example.com",
            main_hand=Hand.RIGHT
        )

        user = user_repo.create(
            user,
            password_hash=b"test_hash_not_for_real_auth"
        )

        user_id = user.user_id
        print("TEST USER CREATED:", user_id)

        # ---------- MASTER LOCATION ----------

        # CREATE MASTER LOCATION
        location = MasterLocation(
            location_id=None,
            location_name="Test Bowling Center",
            lane_count=20,
            address="123 Test Street"
        )

        created_location = location_repo.create_master(location)
        location_id = created_location.location_id

        assert location_id is not None
        print("CREATE MASTER:", created_location)

        # READ MASTER LOCATION
        found_location = location_repo.get_master_by_id(location_id)

        assert found_location is not None
        assert found_location.location_name == "Test Bowling Center"
        assert found_location.lane_count == 20

        print("READ MASTER:", found_location)

        # UPDATE MASTER LOCATION
        created_location.location_name = "Updated Bowling Center"
        created_location.lane_count = 30
        created_location.address = "456 Updated Street"

        location_repo.update_master(created_location)

        updated_location = location_repo.get_master_by_id(location_id)

        assert updated_location is not None
        assert updated_location.location_name == "Updated Bowling Center"
        assert updated_location.lane_count == 30
        assert updated_location.address == "456 Updated Street"

        print("UPDATE MASTER:", updated_location)

        # ---------- USER ESTABLISHMENT ----------

        # CREATE ESTABLISHMENT
        establishment = UserEstablishment(
            establishment_id=None,
            establishment_name="My Bowling Alley",
            lane_count=24,
            address="789 Bowling Lane",
            user_id=user_id,
            location_id=location_id
        )

        created_establishment = location_repo.create_establishment(
            establishment
        )

        establishment_id = created_establishment.establishment_id

        assert establishment_id is not None
        print("CREATE ESTABLISHMENT:", created_establishment)

        # READ ESTABLISHMENT
        found_establishment = location_repo.get_establishment_by_id(
            establishment_id
        )

        assert found_establishment is not None
        assert found_establishment.establishment_name == "My Bowling Alley"
        assert found_establishment.user_id == user_id
        assert found_establishment.location_id == location_id

        print("READ ESTABLISHMENT:", found_establishment)

        # UPDATE ESTABLISHMENT
        created_establishment.establishment_name = "Updated Bowling Alley"
        created_establishment.lane_count = 32
        created_establishment.address = "999 New Lane"

        location_repo.update_establishment(created_establishment)

        updated_establishment = location_repo.get_establishment_by_id(
            establishment_id
        )

        assert updated_establishment is not None
        assert updated_establishment.establishment_name == "Updated Bowling Alley"
        assert updated_establishment.lane_count == 32
        assert updated_establishment.address == "999 New Lane"

        print("UPDATE ESTABLISHMENT:", updated_establishment)

        # DELETE ESTABLISHMENT
        location_repo.delete_establishment(establishment_id)

        assert location_repo.get_establishment_by_id(establishment_id) is None

        establishment_id = None
        print("DELETE ESTABLISHMENT: Passed")

        # DELETE MASTER LOCATION
        location_repo.delete_master(location_id)

        assert location_repo.get_master_by_id(location_id) is None

        location_id = None
        print("DELETE MASTER: Passed")

        print("All LocationRepository tests passed!")

    finally:
        # Clean up in reverse foreign-key order
        try:
            if establishment_id is not None:
                location_repo.delete_establishment(establishment_id)

            if location_id is not None:
                location_repo.delete_master(location_id)

            if user_id is not None:
                user_repo.delete(user_id)

            print("CLEANUP: Test records removed")

        finally:
            conn.close()


if __name__ == "__main__":
    test_location_repository()

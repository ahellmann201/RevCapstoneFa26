
from uuid import uuid4

from database.connection import get_connection
from repositories.user_repository import UserRepository
from repositories.event_repository import EventRepository
from entities import User, Event, Hand


def test_event_repository():
    conn = get_connection()

    user_repo = UserRepository(conn)
    event_repo = EventRepository(conn)

    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"
    email = f"{username}@example.com"

    user_id = None
    event_id = None

    try:
        # CREATE TEST USER
        user = User(
            user_id=None,
            display_name="Event Test User",
            username=username,
            email=email,
            main_hand=Hand.RIGHT
        )

        user = user_repo.create(
            user,
            password_hash=b"test_hash_not_for_real_auth"
        )

        user_id = user.user_id
        print("TEST USER CREATED:", user_id)

        # CREATE EVENT
        event = Event(
            event_id=None,
            user_id=user_id,
            event_name="Test Bowling Tournament",
            event_type="Tournament",
            location_id=None
        )

        created = event_repo.create(event)
        event_id = created.event_id

        assert event_id is not None
        print("CREATE:", created)

        # READ BY ID
        found = event_repo.get_by_id(event_id)

        assert found is not None
        assert found.event_name == "Test Bowling Tournament"
        assert found.user_id == user_id

        print("READ BY ID:", found)

        # READ BY USER
        user_events = event_repo.get_by_user(user_id)

        assert any(e.event_id == event_id for e in user_events)

        print("READ BY USER:", user_events)

        # UPDATE
        created.event_name = "Updated Bowling Tournament"
        created.event_type = "League"

        event_repo.update(created)

        updated = event_repo.get_by_id(event_id)

        assert updated is not None
        assert updated.event_name == "Updated Bowling Tournament"
        assert updated.event_type == "League"

        print("UPDATE:", updated)

        # DELETE
        event_repo.delete(event_id)

        assert event_repo.get_by_id(event_id) is None

        print("DELETE: Event removed successfully")
        print("All EventRepository tests passed!")

    finally:
        # Clean up the temporary test event
        if event_id is not None:
            if event_repo.get_by_id(event_id) is not None:
                event_repo.delete(event_id)

        # Clean up the temporary test user
        if user_id is not None:
            user_repo.delete(user_id)
            print("CLEANUP: Test user removed")

        conn.close()


if __name__ == "__main__":
    test_event_repository()

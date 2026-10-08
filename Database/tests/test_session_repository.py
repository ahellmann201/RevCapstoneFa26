
from datetime import datetime
from uuid import uuid4

from database.connection import get_connection
from repositories.user_repository import UserRepository
from repositories.event_repository import EventRepository
from repositories.session_repository import SessionRepository

from entities import User, Event, Session, Hand


def test_session_repository():
    conn = get_connection()

    user_repo = UserRepository(conn)
    event_repo = EventRepository(conn)
    session_repo = SessionRepository(conn)

    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"

    user_id = None
    event_id = None
    session_id = None

    try:
        # CREATE TEST USER
        user = User(
            user_id=None,
            display_name="Session Test User",
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

        # CREATE TEST EVENT
        event = Event(
            event_id=None,
            user_id=user_id,
            event_name="Session Test Event",
            event_type="Practice",
            location_id=None
        )

        event = event_repo.create(event)
        event_id = event.event_id

        print("TEST EVENT CREATED:", event_id)

        # CREATE SESSION
        session = Session(
            session_id=None,
            event_id=event_id,
            establishment_id=None,
            date_time=datetime(2026, 10, 8, 14, 30),
            opponent="Test Opponent",
            score=150,
            record=1
        )

        created = session_repo.create(session)
        session_id = created.session_id

        assert session_id is not None
        print("CREATE:", created)

        # READ BY ID
        found = session_repo.get_by_id(session_id)

        assert found is not None
        assert found.event_id == event_id
        assert found.opponent == "Test Opponent"
        assert found.score == 150
        assert found.record == 1

        print("READ BY ID:", found)

        # READ BY EVENT
        event_sessions = session_repo.get_by_event(event_id)

        assert any(s.session_id == session_id for s in event_sessions)

        print("READ BY EVENT:", event_sessions)

        # UPDATE
        created.date_time = datetime(2026, 10, 9, 16, 0)
        created.opponent = "Updated Opponent"
        created.score = 200
        created.record = 2

        session_repo.update(created)

        updated = session_repo.get_by_id(session_id)

        assert updated is not None
        assert updated.date_time == datetime(2026, 10, 9, 16, 0)
        assert updated.opponent == "Updated Opponent"
        assert updated.score == 200
        assert updated.record == 2

        print("UPDATE:", updated)

        # DELETE
        session_repo.delete(session_id)

        assert session_repo.get_by_id(session_id) is None

        session_id = None

        print("DELETE: Session removed successfully")
        print("All SessionRepository tests passed!")

    finally:
        # Clean up in reverse foreign-key order
        try:
            if session_id is not None:
                session_repo.delete(session_id)

            if event_id is not None:
                event_repo.delete(event_id)

            if user_id is not None:
                user_repo.delete(user_id)

            print("CLEANUP: Test records removed")

        finally:
            conn.close()


if __name__ == "__main__":
    test_session_repository()

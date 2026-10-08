
from uuid import uuid4

from database.connection import get_connection
from repositories.user_repository import UserRepository
from repositories.event_repository import EventRepository
from repositories.session_repository import SessionRepository
from repositories.game_repository import GameRepository

from entities import User, Event, Session, Game, Hand


def test_game_repository():
    conn = get_connection()

    user_repo = UserRepository(conn)
    event_repo = EventRepository(conn)
    session_repo = SessionRepository(conn)
    game_repo = GameRepository(conn)

    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"

    user_id = None
    event_id = None
    session_id = None
    game_id = None

    try:
        # CREATE TEST USER
        user = user_repo.create(
            User(
                user_id=None,
                display_name="Game Test User",
                username=username,
                email=f"{username}@example.com",
                main_hand=Hand.RIGHT
            ),
            password_hash=b"test_hash_not_for_real_auth"
        )

        user_id = user.user_id
        print("TEST USER CREATED:", user_id)

        # CREATE TEST EVENT
        event = event_repo.create(
            Event(
                event_id=None,
                user_id=user_id,
                event_name="Game Test Event",
                event_type="Practice",
                location_id=None
            )
        )

        event_id = event.event_id
        print("TEST EVENT CREATED:", event_id)

        # CREATE TEST SESSION
        session = session_repo.create(
            Session(
                session_id=None,
                event_id=event_id,
                establishment_id=None,
                date_time=None,
                opponent=None,
                score=None,
                record=None
            )
        )

        session_id = session.session_id
        print("TEST SESSION CREATED:", session_id)

        # CREATE GAME
        game = Game(
            game_id=None,
            session_id=session_id,
            game_number=1,
            lane_number=5,
            game_score=150,
            game_result=1
        )

        created = game_repo.create(game)
        game_id = created.game_id

        assert game_id is not None
        print("CREATE:", created)

        # READ BY ID
        found = game_repo.get_by_id(game_id)

        assert found is not None
        assert found.session_id == session_id
        assert found.game_number == 1
        assert found.game_score == 150

        print("READ BY ID:", found)

        # READ BY SESSION
        session_games = game_repo.get_by_session(session_id)

        assert any(g.game_id == game_id for g in session_games)

        print("READ BY SESSION:", session_games)

        # UPDATE
        created.game_number = 2
        created.lane_number = 6
        created.game_score = 200
        created.game_result = 2

        game_repo.update(created)

        updated = game_repo.get_by_id(game_id)

        assert updated is not None
        assert updated.game_number == 2
        assert updated.lane_number == 6
        assert updated.game_score == 200
        assert updated.game_result == 2

        print("UPDATE:", updated)

        # DELETE
        game_repo.delete(game_id)

        assert game_repo.get_by_id(game_id) is None

        game_id = None

        print("DELETE: Game removed successfully")
        print("All GameRepository tests passed!")

    finally:
        # Clean up in reverse foreign-key order
        try:
            if game_id is not None:
                game_repo.delete(game_id)

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
    test_game_repository()

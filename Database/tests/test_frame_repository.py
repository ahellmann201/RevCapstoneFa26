
from uuid import uuid4

from database.connection import get_connection
from repositories.user_repository import UserRepository
from repositories.event_repository import EventRepository
from repositories.session_repository import SessionRepository
from repositories.game_repository import GameRepository
from repositories.frame_repository import FrameRepository

from entities import User, Event, Session, Game, Frame, Hand


def test_frame_repository():
    conn = get_connection()

    user_repo = UserRepository(conn)
    event_repo = EventRepository(conn)
    session_repo = SessionRepository(conn)
    game_repo = GameRepository(conn)
    frame_repo = FrameRepository(conn)

    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"

    user_id = None
    event_id = None
    session_id = None
    game_id = None
    frame_id = None

    try:
        # CREATE TEST USER
        user = user_repo.create(
            User(
                user_id=None,
                display_name="Frame Test User",
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
                event_name="Frame Test Event",
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

        # CREATE TEST GAME
        game = game_repo.create(
            Game(
                game_id=None,
                session_id=session_id,
                game_number=1,
                lane_number=1,
                game_score=150,
                game_result=None
            )
        )

        game_id = game.game_id
        print("TEST GAME CREATED:", game_id)

        # CREATE FRAME
        frame = Frame(
            frame_id=None,
            game_id=game_id,
            frame_number=1,
            frame_result=9
        )

        created = frame_repo.create(frame)
        frame_id = created.frame_id

        assert frame_id is not None
        print("CREATE:", created)

        # READ BY ID
        found = frame_repo.get_by_id(frame_id)

        assert found is not None
        assert found.game_id == game_id
        assert found.frame_number == 1
        assert found.frame_result == 9

        print("READ BY ID:", found)

        # READ BY GAME
        game_frames = frame_repo.get_by_game(game_id)

        assert any(f.frame_id == frame_id for f in game_frames)

        print("READ BY GAME:", game_frames)

        # UPDATE
        created.frame_number = 2
        created.frame_result = 10

        frame_repo.update(created)

        updated = frame_repo.get_by_id(frame_id)

        assert updated is not None
        assert updated.frame_number == 2
        assert updated.frame_result == 10

        print("UPDATE:", updated)

        # DELETE
        frame_repo.delete(frame_id)

        assert frame_repo.get_by_id(frame_id) is None

        frame_id = None
        print("DELETE: Frame removed successfully")

        print("All FrameRepository tests passed!")

    finally:
        # Clean up in reverse foreign-key order
        try:
            if frame_id is not None:
                frame_repo.delete(frame_id)

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
    test_frame_repository()

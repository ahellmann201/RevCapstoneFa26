
from uuid import uuid4

from database.connection import get_connection

from repositories.user_repository import UserRepository
from repositories.event_repository import EventRepository
from repositories.session_repository import SessionRepository
from repositories.game_repository import GameRepository
from repositories.frame_repository import FrameRepository
from repositories.shot_repository import ShotRepository

from entities import User, Event, Session, Game, Frame, Shot, Hand


def test_shot_repository():
    conn = get_connection()

    user_repo = UserRepository(conn)
    event_repo = EventRepository(conn)
    session_repo = SessionRepository(conn)
    game_repo = GameRepository(conn)
    frame_repo = FrameRepository(conn)
    shot_repo = ShotRepository(conn)

    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"

    user_id = None
    event_id = None
    session_id = None
    game_id = None
    frame_id = None
    shot_id = None

    try:
        # CREATE TEST USER
        user = user_repo.create(
            User(
                user_id=None,
                display_name="Shot Test User",
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
                event_name="Shot Test Event",
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
                game_score=None,
                game_result=None
            )
        )

        game_id = game.game_id
        print("TEST GAME CREATED:", game_id)

        # CREATE TEST FRAME
        frame = frame_repo.create(
            Frame(
                frame_id=None,
                game_id=game_id,
                frame_number=1,
                frame_result=None
            )
        )

        frame_id = frame.frame_id
        print("TEST FRAME CREATED:", frame_id)

        # CREATE SHOT
        shot = Shot(
            shot_id=None,
            frame_id=frame_id,
            shot_number=1,
            throw_type=None,
            pin_leave=[1, 3, 7, 10],
            side="Right",
            position="Center",
            comment="Test bowling shot",
            ball_id=None
        )

        created = shot_repo.create(shot)
        shot_id = created.shot_id

        assert shot_id is not None
        print("CREATE:", created)

        # READ BY ID
        found = shot_repo.get_by_id(shot_id)

        assert found is not None
        assert found.frame_id == frame_id
        assert found.shot_number == 1
        assert found.pin_leave == [1, 3, 7, 10]
        assert found.comment == "Test bowling shot"

        print("READ BY ID:", found)

        # READ BY FRAME
        frame_shots = shot_repo.get_by_frame(frame_id)

        assert any(s.shot_id == shot_id for s in frame_shots)

        print("READ BY FRAME:", frame_shots)

        # UPDATE SHOT
        created.shot_number = 2
        created.pin_leave = [2, 4, 6]
        created.side = "Left"
        created.position = "Outside"
        created.comment = "Updated test shot"

        shot_repo.update(created)

        updated = shot_repo.get_by_id(shot_id)

        assert updated is not None
        assert updated.shot_number == 2
        assert updated.pin_leave == [2, 4, 6]
        assert updated.side == "Left"
        assert updated.position == "Outside"
        assert updated.comment == "Updated test shot"

        print("UPDATE:", updated)

        # TEST PIN-LEAVE ENCODING
        encoded = ShotRepository._encode_pin_leave([1, 3, 7, 10])
        decoded = ShotRepository._decode_pin_leave(encoded)

        assert encoded == 581
        assert decoded == [1, 3, 7, 10]

        print("PIN-LEAVE ENCODING:", encoded)
        print("PIN-LEAVE DECODING:", decoded)

        # TEST INVALID PIN NUMBER
        try:
            ShotRepository._encode_pin_leave([11])
        except ValueError:
            print("INVALID PIN VALIDATION: Passed")
        else:
            raise AssertionError("Invalid pin number was accepted")

        # DELETE SHOT
        shot_repo.delete(shot_id)

        assert shot_repo.get_by_id(shot_id) is None

        shot_id = None

        print("DELETE: Shot removed successfully")
        print("All ShotRepository tests passed!")

    finally:
        # Clean up in reverse foreign-key order
        try:
            if shot_id is not None:
                shot_repo.delete(shot_id)

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
    test_shot_repository()

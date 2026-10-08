
from uuid import uuid4

from database.connection import get_connection
from repositories.user_repository import UserRepository
from repositories.ball_repository import BallRepository
from entities import User, Ball, Hand


def test_ball_repository():
    conn = get_connection()

    user_repo = UserRepository(conn)
    ball_repo = BallRepository(conn)

    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"
    email = f"{username}@example.com"

    user_id = None
    ball_id = None

    try:
        # CREATE TEST USER
        user = User(
            user_id=None,
            display_name="Ball Test User",
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

        # CREATE BALL
        ball = Ball(
            ball_id=None,
            user_id=user_id,
            ball_name="Test Bowling Ball",
            weight=15,
            color="Blue",
            core_type="Symmetrical"
        )

        created = ball_repo.create(ball)
        ball_id = created.ball_id

        assert ball_id is not None
        print("CREATE:", created)

        # READ BY ID
        found = ball_repo.get_by_id(ball_id)

        assert found is not None
        assert found.ball_name == "Test Bowling Ball"
        assert found.user_id == user_id

        print("READ BY ID:", found)

        # READ BY USER
        user_balls = ball_repo.get_by_user(user_id)

        assert any(b.ball_id == ball_id for b in user_balls)

        print("READ BY USER:", user_balls)

        # UPDATE
        created.ball_name = "Updated Bowling Ball"
        created.weight = 16
        created.color = "Red"
        created.core_type = "Asymmetrical"

        ball_repo.update(created)

        updated = ball_repo.get_by_id(ball_id)

        assert updated is not None
        assert updated.ball_name == "Updated Bowling Ball"
        assert updated.weight == 16
        assert updated.color == "Red"
        assert updated.core_type == "Asymmetrical"

        print("UPDATE:", updated)

        # DELETE
        ball_repo.delete(ball_id)

        assert ball_repo.get_by_id(ball_id) is None

        print("DELETE: Ball removed successfully")
        print("All BallRepository tests passed!")

    finally:
        # Clean up the temporary ball if needed
        try:
            if ball_id is not None:
                if ball_repo.get_by_id(ball_id) is not None:
                    ball_repo.delete(ball_id)
        finally:
            # Delete the temporary user
            try:
                if user_id is not None:
                    user_repo.delete(user_id)
                    print("CLEANUP: Test user removed")
            finally:
                conn.close()


if __name__ == "__main__":
    test_ball_repository()

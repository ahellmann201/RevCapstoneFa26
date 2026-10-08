
from uuid import uuid4

from database.connection import get_connection
from repositories.user_repository import UserRepository
from entities import User, Hand


def test_user_repository():
    conn = get_connection()
    repo = UserRepository(conn)

    # Unique values prevent conflicts with existing users
    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"
    email = f"{username}@example.com"

    user_id = None

    try:
        # CREATE
        user = User(
            user_id=None,
            display_name="Test User",
            username=username,
            email=email,
            main_hand=Hand.RIGHT
        )

        created = repo.create(
            user,
            password_hash=b"test_hash_not_for_real_auth"
        )

        user_id = created.user_id
        print("CREATE:", created)

        # READ BY ID
        found = repo.get_by_id(user_id)
        assert found is not None
        assert found.username == username
        print("READ BY ID:", found)

        # READ BY USERNAME
        found_by_username = repo.get_by_username(username)
        assert found_by_username is not None
        assert found_by_username.user_id == user_id
        print("READ BY USERNAME:", found_by_username)

        # UPDATE
        created.display_name = "Updated Test User"
        repo.update(created)

        updated = repo.get_by_id(user_id)
        assert updated.display_name == "Updated Test User"
        print("UPDATE:", updated)

        print("All repository tests passed!")

    finally:
        # Remove the temporary test user
        if user_id is not None:
            repo.delete(user_id)
            print("DELETE: Test user removed")

        conn.close()


if __name__ == "__main__":
    test_user_repository()

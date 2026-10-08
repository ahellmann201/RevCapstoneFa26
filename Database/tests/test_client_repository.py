
from uuid import uuid4

from database.connection import get_connection
from repositories.user_repository import UserRepository
from repositories.client_repository import ClientRepository
from entities import User, Client, Hand


def test_client_repository():
    conn = get_connection()

    user_repo = UserRepository(conn)
    client_repo = ClientRepository(conn)

    test_id = uuid4().hex[:12]
    username = f"test_{test_id}"
    email = f"{username}@example.com"

    user_id = None
    device = f"test_device_{test_id}"

    try:
        # Create a temporary user for the client
        user = User(
            user_id=None,
            display_name="Client Test User",
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

        # CREATE CLIENT
        client = Client(
            device=device,
            token="test_token",
            incorrect_passwords=0,
            user_id=user_id
        )

        created = client_repo.create(client)
        print("CREATE:", created)

        # READ CLIENT
        found = client_repo.get(user_id, device)

        assert found is not None
        assert found.token == "test_token"
        assert found.incorrect_passwords == 0

        print("READ:", found)

        # UPDATE CLIENT
        created.token = "updated_test_token"
        created.incorrect_passwords = 2

        client_repo.update(created)

        updated = client_repo.get(user_id, device)

        assert updated is not None
        assert updated.token == "updated_test_token"
        assert updated.incorrect_passwords == 2

        print("UPDATE:", updated)

        # DELETE CLIENT
        client_repo.delete(user_id, device)

        deleted = client_repo.get(user_id, device)

        assert deleted is None

        print("DELETE: Client removed successfully")
        print("All ClientRepository tests passed!")

    finally:
        # Clean up the temporary user.
        # Any remaining client records are deleted by ON DELETE CASCADE.
        if user_id is not None:
            user_repo.delete(user_id)
            print("CLEANUP: Test user removed")

        conn.close()


if __name__ == "__main__":
    test_client_repository()

import sqlite3

from entities import Client


class ClientRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, client: Client) -> Client:
        self.conn.execute(
            """
            INSERT INTO clients (
                device,
                token,
                incorrect_passwords,
                user_id
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                client.device,
                client.token,
                client.incorrect_passwords,
                client.user_id
            )
        )

        self.conn.commit()

        return client

    def get(self, user_id: int, device: str) -> Client | None:
        row = self.conn.execute(
            """
            SELECT device, token, incorrect_passwords, user_id
            FROM clients
            WHERE user_id = ?
              AND device = ?
            """,
            (user_id, device)
        ).fetchone()

        if row is None:
            return None

        return Client(
            device=row[0],
            token=row[1],
            incorrect_passwords=row[2],
            user_id=row[3]
        )

    def update(self, client: Client) -> None:
        self.conn.execute(
            """
            UPDATE clients
            SET token = ?,
                incorrect_passwords = ?
            WHERE user_id = ?
              AND device = ?
            """,
            (
                client.token,
                client.incorrect_passwords,
                client.user_id,
                client.device
            )
        )

        self.conn.commit()

    def delete(self, user_id: int, device: str) -> None:
        self.conn.execute(
            """
            DELETE FROM clients
            WHERE user_id = ?
              AND device = ?
            """,
            (user_id, device)
        )

        self.conn.commit()
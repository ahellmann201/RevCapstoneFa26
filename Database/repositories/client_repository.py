import pyodbc

from entities import Client


class ClientRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create(self, client: Client) -> Client:
        self.conn.cursor().execute(
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
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT device, token, incorrect_passwords, user_id
            FROM clients
            WHERE user_id = ? AND device = ?
            """,
            (user_id, device)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return Client(
            device=row[0],
            token=row[1],
            incorrect_passwords=row[2],
            user_id=row[3]
        )

    def update(self, client: Client) -> None:
        self.conn.cursor().execute(
            """
            UPDATE clients
            SET token = ?,
                incorrect_passwords = ?
            WHERE user_id = ? AND device = ?
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
        self.conn.cursor().execute(
            """
            DELETE FROM clients
            WHERE user_id = ? AND device = ?
            """,
            (user_id, device)
        )

        self.conn.commit()
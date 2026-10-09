import pyodbc

from ..entities import MasterLocation, UserEstablishment


class LocationRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create_master(self, location: MasterLocation) -> MasterLocation:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO master_locations (
                location_name,
                lane_count,
                address
            )
            OUTPUT INSERTED.location_id
            VALUES (?, ?, ?)
            """,
            (
                location.location_name,
                location.lane_count,
                location.address
            )
        )

        location.location_id = cursor.fetchone()[0]
        self.conn.commit()

        return location

    def get_master_by_id(
        self,
        location_id: int
    ) -> MasterLocation | None:

        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT location_id, location_name, lane_count, address
            FROM master_locations
            WHERE location_id = ?
            """,
            (location_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return MasterLocation(
            location_id=row[0],
            location_name=row[1],
            lane_count=row[2],
            address=row[3]
        )

    def update_master(self, location: MasterLocation) -> None:
        self.conn.cursor().execute(
            """
            UPDATE master_locations
            SET location_name = ?,
                lane_count = ?,
                address = ?
            WHERE location_id = ?
            """,
            (
                location.location_name,
                location.lane_count,
                location.address,
                location.location_id
            )
        )

        self.conn.commit()

    def delete_master(self, location_id: int) -> None:
        self.conn.cursor().execute(
            """
            DELETE FROM master_locations
            WHERE location_id = ?
            """,
            (location_id,)
        )

        self.conn.commit()

    def create_establishment(
        self,
        establishment: UserEstablishment
    ) -> UserEstablishment:

        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO user_establishments (
                establishment_name,
                lane_count,
                address,
                user_id,
                location_id
            )
            OUTPUT INSERTED.establishment_id
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                establishment.establishment_name,
                establishment.lane_count,
                establishment.address,
                establishment.user_id,
                establishment.location_id
            )
        )

        establishment.establishment_id = cursor.fetchone()[0]
        self.conn.commit()

        return establishment

    def get_establishment_by_id(
        self,
        establishment_id: int
    ) -> UserEstablishment | None:

        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT
                establishment_id,
                establishment_name,
                lane_count,
                address,
                user_id,
                location_id
            FROM user_establishments
            WHERE establishment_id = ?
            """,
            (establishment_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return UserEstablishment(
            establishment_id=row[0],
            establishment_name=row[1],
            lane_count=row[2],
            address=row[3],
            user_id=row[4],
            location_id=row[5]
        )

    def update_establishment(
        self,
        establishment: UserEstablishment
    ) -> None:

        self.conn.cursor().execute(
            """
            UPDATE user_establishments
            SET establishment_name = ?,
                lane_count = ?,
                address = ?,
                location_id = ?
            WHERE establishment_id = ?
            """,
            (
                establishment.establishment_name,
                establishment.lane_count,
                establishment.address,
                establishment.location_id,
                establishment.establishment_id
            )
        )

        self.conn.commit()

    def delete_establishment(self, establishment_id: int) -> None:
        self.conn.cursor().execute(
            """
            DELETE FROM user_establishments
            WHERE establishment_id = ?
            """,
            (establishment_id,)
        )

        self.conn.commit()

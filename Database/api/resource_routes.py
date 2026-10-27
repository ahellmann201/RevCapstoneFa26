from contextlib import contextmanager, suppress
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from pydantic import BaseModel, create_model

from Database.api.auth import UserResponse, current_user
from Database.database.connection import (
    DB_TYPE,
    DatabaseError,
    IntegrityError,
    get_connection,
)


UserDependency = Annotated[UserResponse, Depends(current_user)]
ResourceId = Annotated[int, Path(ge=1, le=2147483647)]


@dataclass
class Resource:
    table: str
    key: str
    path: str
    model: type[BaseModel]
    scope: str
    direct_owner: bool = False
    references: tuple = ()
    read_only: bool = False


@contextmanager
def database_cursor(write=False):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        if write and DB_TYPE == "sqlite":
            connection.execute("BEGIN IMMEDIATE")
        elif write:
            # Keep ownership/reference checks valid through the write.
            cursor.execute(
                "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"
            )

        yield cursor

        if write:
            connection.commit()

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Operation conflicts with existing or linked records",
        ) from None

    except (DatabaseError, KeyError):
        raise HTTPException(
            status_code=503,
            detail="Database operation unavailable",
        ) from None

    finally:
        if connection is not None:
            # Rolls back failed/uncommitted work. Harmless after commit.
            with suppress(DatabaseError):
                connection.rollback()

        if cursor is not None:
            with suppress(DatabaseError):
                cursor.close()

        if connection is not None:
            with suppress(DatabaseError):
                connection.close()


def scope_parameters(resource, user):
    return () if resource.read_only else (user.user_id,)


def require_record(cursor, resource, item_id, user):
    cursor.execute(
        f"""
        SELECT 1
        FROM [{resource.table}] AS r
        WHERE r.[{resource.key}] = ?
          AND ({resource.scope})
        """,
        (item_id, *scope_parameters(resource, user)),
    )

    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=404,
            detail="Record or linked record not found",
        )


def validate_references(cursor, resource, values, user):
    for field_name, target in resource.references:
        value = values.get(field_name)

        if value is not None:
            require_record(cursor, target, value, user)


def database_values(payload):
    values = payload.model_dump()

    if "pin_leave" in values:
        values["pin_leave"] = sum(
            1 << (pin - 1)
            for pin in values["pin_leave"]
        )

    return values


def add_resource_routes(router: APIRouter, resource: Resource):
    body_model = resource.model
    input_columns = list(body_model.model_fields)

    columns = [resource.key]

    if resource.direct_owner:
        columns.append("user_id")

    columns.extend(input_columns)

    extra_fields = {
        resource.key: (int, ...),
    }

    if resource.direct_owner:
        extra_fields["user_id"] = (int, ...)

    response_model = create_model(
        f"{body_model.__name__}Response",
        __base__=body_model,
        **extra_fields,
    )

    def response_from_row(row):
        values = dict(zip(columns, row))

        if "pin_leave" in values:
            mask = values["pin_leave"]
            values["pin_leave"] = [
                pin
                for pin in range(1, 11)
                if mask & (1 << (pin - 1))
            ]

        return response_model(**values)

    def selected_columns(alias):
        if DB_TYPE == "sqlite":
            return ", ".join(f"[{column}]" for column in columns)
        return ", ".join(
            f"{alias}.[{column}]"
            for column in columns
        )

    def list_items(
        user: UserDependency,
        limit: Annotated[int, Query(ge=1, le=100)] = 50,
        offset: Annotated[
            int,
            Query(ge=0, le=2147483647),
        ] = 0,
    ):
        with database_cursor() as cursor:
            pagination = (
                "LIMIT ? OFFSET ?"
                if DB_TYPE == "sqlite"
                else "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
            )
            pagination_values = (
                (limit, offset)
                if DB_TYPE == "sqlite"
                else (offset, limit)
            )
            cursor.execute(
                f"""
                SELECT {selected_columns("r")}
                FROM [{resource.table}] AS r
                WHERE {resource.scope}
                ORDER BY r.[{resource.key}]
                {pagination}
                """,
                (*scope_parameters(resource, user), *pagination_values),
            )

            result = [
                response_from_row(row)
                for row in cursor.fetchall()
            ]

        return result

    def get_item(item_id: ResourceId, user: UserDependency):
        with database_cursor() as cursor:
            cursor.execute(
                f"""
                SELECT {selected_columns("r")}
                FROM [{resource.table}] AS r
                WHERE r.[{resource.key}] = ?
                  AND ({resource.scope})
                """,
                (item_id, *scope_parameters(resource, user)),
            )

            row = cursor.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Record not found",
                )

            result = response_from_row(row)

        return result

    # body_model is the concrete Pydantic model for this resource.
    def create_item(payload: body_model, user: UserDependency):
        values = database_values(payload)

        if resource.direct_owner:
            values["user_id"] = user.user_id

        with database_cursor(write=True) as cursor:
            validate_references(cursor, resource, values, user)

            names = ", ".join(f"[{name}]" for name in values)
            placeholders = ", ".join("?" for _ in values)

            insert_sql = (
                f"""
                INSERT INTO [{resource.table}] ({names})
                VALUES ({placeholders})
                RETURNING {selected_columns('INSERTED')}
                """
                if DB_TYPE == "sqlite"
                else f"""
                INSERT INTO [{resource.table}] ({names})
                OUTPUT {selected_columns('INSERTED')}
                VALUES ({placeholders})
                """
            )
            cursor.execute(
                insert_sql,
                tuple(values.values()),
            )

            result = response_from_row(cursor.fetchone())

        return result

    def update_item(
        item_id: ResourceId,
        payload: body_model,
        user: UserDependency,
    ):
        values = database_values(payload)

        with database_cursor(write=True) as cursor:
            require_record(cursor, resource, item_id, user)
            validate_references(cursor, resource, values, user)

            assignments = ", ".join(
                f"[{name}] = ?"
                for name in values
            )

            if DB_TYPE == "sqlite":
                update_sql = f"""
                    UPDATE [{resource.table}] AS r
                    SET {assignments}
                    WHERE r.[{resource.key}] = ?
                      AND ({resource.scope})
                    RETURNING {selected_columns("INSERTED")}
                """
            else:
                update_sql = f"""
                    UPDATE r
                    SET {assignments}
                    OUTPUT {selected_columns("INSERTED")}
                    FROM [{resource.table}] AS r
                    WHERE r.[{resource.key}] = ?
                      AND ({resource.scope})
                """
            cursor.execute(
                update_sql,
                (
                    *values.values(),
                    item_id,
                    *scope_parameters(resource, user),
                ),
            )

            row = cursor.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Record not found",
                )

            result = response_from_row(row)

        return result

    def delete_item(item_id: ResourceId, user: UserDependency):
        with database_cursor(write=True) as cursor:
            delete_sql = (
                f"""
                DELETE FROM [{resource.table}] AS r
                WHERE r.[{resource.key}] = ?
                  AND ({resource.scope})
                RETURNING [{resource.key}]
                """
                if DB_TYPE == "sqlite"
                else f"""
                DELETE r
                OUTPUT DELETED.[{resource.key}]
                FROM [{resource.table}] AS r
                WHERE r.[{resource.key}] = ?
                  AND ({resource.scope})
                """
            )
            cursor.execute(
                delete_sql,
                (item_id, *scope_parameters(resource, user)),
            )

            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Record not found",
                )

        return Response(status_code=204)

    operations = [
        ("GET", "", list_items, list[response_model], 200),
        ("GET", "/{item_id}", get_item, response_model, 200),
    ]

    if not resource.read_only:
        operations.extend([
            ("POST", "", create_item, response_model, 201),
            ("PUT", "/{item_id}", update_item, response_model, 200),
            ("DELETE", "/{item_id}", delete_item, None, 204),
        ])

    for method, suffix, endpoint, output_model, status in operations:
        options: dict[str, Any] = {}

        if method == "DELETE":
            options["response_class"] = Response

        router.add_api_route(
            resource.path + suffix,
            endpoint,
            methods=[method],
            response_model=output_model,
            status_code=status,
            tags=[resource.path.strip("/").replace("-", " ").title()],
            name=f"{resource.table}_{endpoint.__name__}",
            **options,
        )

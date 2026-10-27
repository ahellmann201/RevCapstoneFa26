from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from pydantic import BaseModel, ConfigDict, Field

from Database.api.auth import UserResponse, current_user, database
from Database.database.connection import DB_TYPE, IntegrityError


router = APIRouter(prefix="/balls", tags=["Balls"])
AuthenticatedUser = Annotated[UserResponse, Depends(current_user)]


class BallCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    ball_name: str = Field(min_length=1, max_length=255)
    weight: int | None = Field(default=None, ge=1, le=16, strict=True)
    color: str | None = Field(default=None, max_length=100)
    core_type: str | None = Field(default=None, max_length=100)


class BallResponse(BaseModel):
    ball_id: int
    user_id: int
    ball_name: str
    weight: int | None
    color: str | None
    core_type: str | None


def ball_response(row) -> BallResponse:
    return BallResponse(
        ball_id=row[0], user_id=row[1], ball_name=row[2],
        weight=row[3], color=row[4], core_type=row[5],
    )


@router.post("", response_model=BallResponse, status_code=201)
def create_ball(data: BallCreate, user: AuthenticatedUser) -> BallResponse:
    query = (
        """INSERT INTO balls (user_id, ball_name, weight, color, core_type)
        VALUES (?, ?, ?, ?, ?)
        RETURNING ball_id, user_id, ball_name, weight, color, core_type"""
        if DB_TYPE == "sqlite"
        else """INSERT INTO balls (user_id, ball_name, weight, color, core_type)
        OUTPUT INSERTED.ball_id, INSERTED.user_id, INSERTED.ball_name,
               INSERTED.weight, INSERTED.color, INSERTED.core_type
        VALUES (?, ?, ?, ?, ?)"""
    )
    with database() as connection:
        cursor = connection.cursor()
        try:
            cursor.execute(query, (
                user.user_id, data.ball_name, data.weight, data.color,
                data.core_type,
            ))
            result = ball_response(cursor.fetchone())
            connection.commit()
        finally:
            cursor.close()
    return result


@router.get("", response_model=list[BallResponse])
def list_balls(
    user: AuthenticatedUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=2147483647)] = 0,
) -> list[BallResponse]:
    pagination = "LIMIT ? OFFSET ?" if DB_TYPE == "sqlite" else "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
    page_values = (limit, offset) if DB_TYPE == "sqlite" else (offset, limit)
    with database() as connection:
        cursor = connection.cursor()
        try:
            cursor.execute(f"""
                SELECT ball_id, user_id, ball_name, weight, color, core_type
                FROM balls WHERE user_id = ? ORDER BY ball_id {pagination}
            """, (user.user_id, *page_values))
            result = [ball_response(row) for row in cursor.fetchall()]
        finally:
            cursor.close()
    return result


@router.get("/{ball_id}", response_model=BallResponse)
def get_ball(
    ball_id: Annotated[int, Path(ge=1, le=2147483647)],
    user: AuthenticatedUser,
) -> BallResponse:
    with database() as connection:
        cursor = connection.cursor()
        try:
            cursor.execute("""
                SELECT ball_id, user_id, ball_name, weight, color, core_type
                FROM balls WHERE ball_id = ? AND user_id = ?
            """, (ball_id, user.user_id))
            row = cursor.fetchone()
        finally:
            cursor.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Ball not found")
    return ball_response(row)


@router.put("/{ball_id}", response_model=BallResponse)
def update_ball(
    ball_id: Annotated[int, Path(ge=1, le=2147483647)],
    data: BallCreate,
    user: AuthenticatedUser,
) -> BallResponse:
    query = (
        """UPDATE balls SET ball_name = ?, weight = ?, color = ?, core_type = ?
        WHERE ball_id = ? AND user_id = ?
        RETURNING ball_id, user_id, ball_name, weight, color, core_type"""
        if DB_TYPE == "sqlite"
        else """UPDATE balls SET ball_name = ?, weight = ?, color = ?, core_type = ?
        OUTPUT INSERTED.ball_id, INSERTED.user_id, INSERTED.ball_name,
               INSERTED.weight, INSERTED.color, INSERTED.core_type
        WHERE ball_id = ? AND user_id = ?"""
    )
    with database() as connection:
        cursor = connection.cursor()
        try:
            cursor.execute(query, (
                data.ball_name, data.weight, data.color, data.core_type,
                ball_id, user.user_id,
            ))
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Ball not found")
            result = ball_response(row)
            connection.commit()
        finally:
            cursor.close()
    return result


@router.delete("/{ball_id}", status_code=204, response_class=Response)
def delete_ball(
    ball_id: Annotated[int, Path(ge=1, le=2147483647)],
    user: AuthenticatedUser,
) -> Response:
    query = (
        "DELETE FROM balls WHERE ball_id = ? AND user_id = ? RETURNING ball_id"
        if DB_TYPE == "sqlite"
        else "DELETE FROM balls OUTPUT DELETED.ball_id WHERE ball_id = ? AND user_id = ?"
    )
    with database() as connection:
        cursor = connection.cursor()
        try:
            try:
                cursor.execute(query, (ball_id, user.user_id))
                if cursor.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Ball not found")
                connection.commit()
            except IntegrityError:
                connection.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="Ball cannot be deleted while linked records exist",
                ) from None
        finally:
            cursor.close()
    return Response(status_code=204)

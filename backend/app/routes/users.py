"""User identity and role management.

``/api/users/me`` is callable by any signed-in user so the frontend can
render role-aware UI without an extra round trip. The other endpoints
are superadmin-only and let a superadmin promote/demote editors and
admins. ``is_superadmin`` is intentionally read-only here; it is
granted only via the ``SUPERADMIN_EMAILS`` env var on first sign-in.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_user, require_superadmin
from ..database import get_db
from ..models import User, apply_role_implication

me_router = APIRouter(prefix="/api/users", tags=["users"])
admin_router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(require_superadmin)],
)


class UserOut(BaseModel):
    id: int
    clerk_user_id: str
    email: str
    name: Optional[str] = None
    is_editor: bool
    is_admin: bool
    is_superadmin: bool
    created_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None

    @classmethod
    def from_model(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            email=user.email,
            name=user.name,
            is_editor=user.is_editor,
            is_admin=user.is_admin,
            is_superadmin=user.is_superadmin,
            created_at=user.created_at,
            last_seen_at=user.last_seen_at,
        )


class RoleUpdate(BaseModel):
    is_editor: Optional[bool] = None
    is_admin: Optional[bool] = None


@me_router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.from_model(user)


@admin_router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[UserOut]:
    rows = (
        db.query(User)
        .order_by(User.is_superadmin.desc(), User.is_admin.desc(), User.email)
        .all()
    )
    return [UserOut.from_model(u) for u in rows]


@admin_router.patch("/{user_id}/role", response_model=UserOut)
def update_role(
    user_id: int,
    updates: RoleUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(require_superadmin),
) -> UserOut:
    target = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.is_superadmin:
        raise HTTPException(
            status_code=400,
            detail=(
                "Superadmin roles cannot be modified via the API. Adjust "
                "SUPERADMIN_EMAILS instead."
            ),
        )

    if updates.is_admin is not None:
        target.is_admin = updates.is_admin
    if updates.is_editor is not None:
        target.is_editor = updates.is_editor

    # Surface contradictions explicitly instead of silently re-applying
    # the implication. Demoting an admin should be a separate request.
    if target.is_admin and not target.is_editor:
        raise HTTPException(
            status_code=400,
            detail="Cannot revoke editor while user is still admin.",
        )

    apply_role_implication(target)

    db.commit()
    db.refresh(target)
    return UserOut.from_model(target)

"""Reading goal CRUD."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.api.deps import db_session
from backend.app.models import Goal
from backend.app.schemas import GoalOut, GoalUpdate, GoalUpsert


router = APIRouter(prefix="/api/goals", tags=["goals"])


def _to_out(g: Goal) -> GoalOut:
    return GoalOut(
        id=g.id,
        created_at=g.created_at,
        period_type=g.period_type,  # type: ignore[arg-type]
        period_start=g.period_start,
        metric=g.metric,  # type: ignore[arg-type]
        target=int(g.target),
        title=g.title,
    )


@router.get("", response_model=list[GoalOut])
def list_goals(db: Session = Depends(db_session)) -> list[GoalOut]:
    rows = db.execute(select(Goal).order_by(Goal.period_start.desc())).scalars().all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=GoalOut)
def create_goal(payload: GoalUpsert, db: Session = Depends(db_session)) -> GoalOut:
    existing = db.execute(
        select(Goal).where(
            Goal.period_type == payload.period_type,
            Goal.period_start == payload.period_start,
            Goal.metric == payload.metric,
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=409, detail="Goal for this period and metric already exists")

    goal = Goal(
        period_type=payload.period_type,
        period_start=payload.period_start,
        metric=payload.metric,
        target=payload.target,
        title=payload.title,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _to_out(goal)


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, payload: GoalUpdate, db: Session = Depends(db_session)) -> GoalOut:
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    data = payload.model_dump(exclude_unset=True)
    next_period_type = data.get("period_type", goal.period_type)
    next_period_start = data.get("period_start", goal.period_start)
    next_metric = data.get("metric", goal.metric)

    conflict = db.execute(
        select(Goal).where(
            Goal.period_type == next_period_type,
            Goal.period_start == next_period_start,
            Goal.metric == next_metric,
            Goal.id != goal_id,
        )
    ).scalar_one_or_none()
    if conflict:
        raise HTTPException(status_code=409, detail="Goal for this period and metric already exists")

    for key, value in data.items():
        setattr(goal, key, value)

    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _to_out(goal)


@router.delete("/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(db_session)) -> dict[str, str]:
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
    return {"status": "deleted"}

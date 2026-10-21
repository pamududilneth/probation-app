from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import require_admin
from ..models import User, FormInstance, FormAssignment, FormSection, RoleEnum, SectionStatus
from ..schemas import UserOut, RoleUpdateRequest, FormCreateRequest, FormListItem, FormDetailOut
from ..crud import to_detail

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    """Full roster, used to populate the role-assignment dropdowns and the
    'pending role' management table."""
    return db.query(User).order_by(User.email).all()


@router.patch("/users/{user_id}/role", response_model=UserOut)
def set_user_role(user_id: str, body: RoleUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You can't remove your own account.")

    assigned = db.query(FormAssignment).filter(FormAssignment.user_id == user.id).count()
    created = db.query(FormInstance).filter(FormInstance.created_by == user.id).count()
    completed = db.query(FormSection).filter(FormSection.completed_by == user.id).count()
    if assigned or created or completed:
        raise HTTPException(
            status_code=409,
            detail="This user is linked to existing forms (assigned, created, or signed off), so they can't be removed.",
        )

    db.delete(user)
    db.commit()
    return {"deleted": True}


def _find_user_by_email_or_404(db: Session, email: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, role=None, azure_oid=None)
        db.add(user)
        db.flush()
    return user


@router.post("/forms", response_model=FormDetailOut)
def create_form(body: FormCreateRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    hr_user = _find_user_by_email_or_404(db, body.hr_division_email)
    employee_user = _find_user_by_email_or_404(db, body.employee_email)
    supervisor_user = _find_user_by_email_or_404(db, body.supervisor_email)
    sbu_user = _find_user_by_email_or_404(db, body.sbu_hr_email)

    form = FormInstance(created_by=admin.id, current_step=RoleEnum.hr_division.value, data={})
    db.add(form)
    db.flush()

    role_user_pairs = [
        (RoleEnum.hr_division, hr_user),
        (RoleEnum.employee, employee_user),
        (RoleEnum.supervisor, supervisor_user),
        (RoleEnum.sbu_hr, sbu_user),
    ]
    for role, user in role_user_pairs:
        db.add(FormAssignment(form_instance_id=form.id, role=role, user_id=user.id))
        db.add(FormSection(form_instance_id=form.id, section_key=role, status=SectionStatus.not_started))

    db.commit()
    db.refresh(form)

    return to_detail(db, form, my_role="admin")


@router.get("/forms", response_model=List[FormListItem])
def list_all_forms(db: Session = Depends(get_db)):
    forms = db.query(FormInstance).order_by(FormInstance.created_at.desc()).all()
    return [
        FormListItem(
            id=f.id,
            status=f.status,
            current_step=f.current_step,
            created_at=f.created_at,
            updated_at=f.updated_at,
            employee_name=(f.data or {}).get("fullName"),
        )
        for f in forms
    ]


@router.get("/forms/{form_id}", response_model=FormDetailOut)
def get_form_admin(form_id: str, db: Session = Depends(get_db)):
    form = db.query(FormInstance).get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return to_detail(db, form, my_role="admin")
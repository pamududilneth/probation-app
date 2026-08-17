import io
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from ..models import (
    User, FormInstance, FormAssignment, FormSection, RoleEnum, SectionStatus,
    FormStatus, SECTION_ORDER,
)
from ..schemas import FormListItem, FormDetailOut, SectionSaveRequest
from ..crud import to_detail
from ..docx_export import generate_docx

router = APIRouter(prefix="/forms", tags=["forms"])


@router.get("", response_model=List[FormListItem])
def list_my_forms(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form_ids = [
        a.form_instance_id
        for a in db.query(FormAssignment).filter(FormAssignment.user_id == user.id).all()
    ]
    if not form_ids:
        return []
    forms = (
        db.query(FormInstance)
        .filter(FormInstance.id.in_(form_ids))
        .order_by(FormInstance.created_at.desc())
        .all()
    )
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


def _get_my_assignment(db: Session, form_id: str, user: User) -> FormAssignment | None:
    return (
        db.query(FormAssignment)
        .filter(FormAssignment.form_instance_id == form_id, FormAssignment.user_id == user.id)
        .first()
    )


@router.get("/{form_id}", response_model=FormDetailOut)
def get_form(form_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form = db.query(FormInstance).get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if user.role == RoleEnum.admin:
        return to_detail(db, form, my_role="admin")

    assignment = _get_my_assignment(db, form_id, user)
    if not assignment:
        raise HTTPException(status_code=403, detail="You're not assigned to this form")

    return to_detail(db, form, my_role=assignment.role.value)


@router.put("/{form_id}/sections/{section_key}", response_model=FormDetailOut)
def save_section(
    form_id: str,
    section_key: RoleEnum,
    body: SectionSaveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if section_key == RoleEnum.admin:
        raise HTTPException(status_code=400, detail="Not a valid section")

    form = db.query(FormInstance).get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if form.status != FormStatus.in_progress:
        raise HTTPException(status_code=400, detail="This form is no longer editable")

    is_admin = user.role == RoleEnum.admin
    if not is_admin:
        assignment = _get_my_assignment(db, form_id, user)
        if not assignment or assignment.role != section_key:
            raise HTTPException(status_code=403, detail="You're not assigned to this section")

    section = (
        db.query(FormSection)
        .filter(FormSection.form_instance_id == form_id, FormSection.section_key == section_key)
        .first()
    )
    if section.status == SectionStatus.completed and not is_admin:
        raise HTTPException(status_code=409, detail="This section has already been submitted")

    merged = dict(form.data or {})
    merged.update(body.data)
    form.data = merged
    form.updated_at = datetime.utcnow()

    if body.submit:
        section.status = SectionStatus.completed
        section.completed_by = user.id
        section.completed_at = datetime.utcnow()
    else:
        if section.status == SectionStatus.not_started:
            section.status = SectionStatus.in_progress

    all_sections = db.query(FormSection).filter(FormSection.form_instance_id == form_id).all()
    status_by_key = {s.section_key: s.status for s in all_sections}
    next_pending = next(
        (r for r in SECTION_ORDER if status_by_key.get(r) != SectionStatus.completed), None
    )
    if next_pending is None:
        form.current_step = "done"
        form.status = FormStatus.completed
    else:
        form.current_step = next_pending.value

    db.commit()
    db.refresh(form)

    my_role = "admin" if is_admin else section_key.value
    return to_detail(db, form, my_role=my_role)


@router.get("/{form_id}/export/docx")
def export_form_docx(form_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form = db.query(FormInstance).get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if user.role != RoleEnum.admin:
        assignment = _get_my_assignment(db, form_id, user)
        if not assignment:
            raise HTTPException(status_code=403, detail="You're not assigned to this form")

    docx_bytes = generate_docx(form.data or {})

    safe_name = ((form.data or {}).get("fullName") or "form").strip().replace(" ", "_") or "form"
    filename = f"Probation_Review_{safe_name}.docx"

    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
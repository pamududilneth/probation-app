from sqlalchemy.orm import Session

from .models import FormInstance, FormSection, FormAssignment, User
from .schemas import FormDetailOut, SectionOut, AssignmentOut


def to_detail(db: Session, form: FormInstance, my_role) -> FormDetailOut:
    sections = db.query(FormSection).filter(FormSection.form_instance_id == form.id).all()
    assignments = db.query(FormAssignment).filter(FormAssignment.form_instance_id == form.id).all()

    assignment_out = []
    for a in assignments:
        u = db.query(User).get(a.user_id)
        assignment_out.append(
            AssignmentOut(role=a.role, user_id=a.user_id, email=u.email, display_name=u.display_name)
        )

    return FormDetailOut(
        id=form.id,
        status=form.status,
        current_step=form.current_step,
        data=form.data or {},
        sections=[SectionOut.model_validate(s) for s in sections],
        assignments=assignment_out,
        my_role=my_role,
        created_at=form.created_at,
        updated_at=form.updated_at,
    )

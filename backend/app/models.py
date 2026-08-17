import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint, JSON
)
from sqlalchemy.orm import relationship

from .database import Base

# Plain String(36) instead of Postgres's native UUID type, and plain JSON
# instead of JSONB, so this schema works unchanged on SQLite (for zero-setup
# local runs) as well as Postgres (for real deployments).
def _uuid() -> str:
    return str(uuid.uuid4())


class RoleEnum(str, enum.Enum):
    admin = "admin"
    hr_division = "hr_division"
    employee = "employee"
    supervisor = "supervisor"
    sbu_hr = "sbu_hr"


# The four workflow roles, in baton order. Admin is never a section owner.
SECTION_ORDER = [
    RoleEnum.hr_division,
    RoleEnum.employee,
    RoleEnum.supervisor,
    RoleEnum.sbu_hr,
]


class SectionStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


class FormStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    azure_oid = Column(String, unique=True, nullable=True, index=True)
    role = Column(SAEnum(RoleEnum), nullable=True)  # null until Admin assigns one
    created_at = Column(DateTime, default=datetime.utcnow)


class FormInstance(Base):
    __tablename__ = "form_instances"

    id = Column(String(36), primary_key=True, default=_uuid)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(FormStatus), default=FormStatus.in_progress, nullable=False)
    # Stores a RoleEnum value while in progress, or the literal string "done".
    current_step = Column(String, default=RoleEnum.hr_division.value, nullable=False)
    data = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignments = relationship(
        "FormAssignment", back_populates="form", cascade="all, delete-orphan"
    )
    sections = relationship(
        "FormSection", back_populates="form", cascade="all, delete-orphan"
    )


class FormAssignment(Base):
    __tablename__ = "form_assignments"
    __table_args__ = (UniqueConstraint("form_instance_id", "role", name="uq_form_role"),)

    id = Column(String(36), primary_key=True, default=_uuid)
    form_instance_id = Column(String(36), ForeignKey("form_instances.id"), nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    form = relationship("FormInstance", back_populates="assignments")
    user = relationship("User")


class FormSection(Base):
    __tablename__ = "form_sections"
    __table_args__ = (
        UniqueConstraint("form_instance_id", "section_key", name="uq_form_section"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    form_instance_id = Column(String(36), ForeignKey("form_instances.id"), nullable=False)
    section_key = Column(SAEnum(RoleEnum), nullable=False)
    status = Column(SAEnum(SectionStatus), default=SectionStatus.not_started, nullable=False)
    completed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime, nullable=True)

    form = relationship("FormInstance", back_populates="sections")

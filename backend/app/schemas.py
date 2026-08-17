from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, EmailStr

from .models import RoleEnum, SectionStatus, FormStatus


class UserOut(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    role: Optional[RoleEnum] = None

    class Config:
        from_attributes = True


class RoleUpdateRequest(BaseModel):
    role: RoleEnum


class FormCreateRequest(BaseModel):
    hr_division_email: EmailStr
    employee_email: EmailStr
    supervisor_email: EmailStr
    sbu_hr_email: EmailStr


class SectionOut(BaseModel):
    section_key: RoleEnum
    status: SectionStatus
    completed_by: Optional[str] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssignmentOut(BaseModel):
    role: RoleEnum
    user_id: str
    email: str
    display_name: Optional[str] = None


class FormListItem(BaseModel):
    id: str
    status: FormStatus
    current_step: str
    created_at: datetime
    updated_at: datetime
    employee_name: Optional[str] = None


class FormDetailOut(BaseModel):
    id: str
    status: FormStatus
    current_step: str
    data: Dict[str, Any]
    sections: List[SectionOut]
    assignments: List[AssignmentOut]
    my_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class SectionSaveRequest(BaseModel):
    data: Dict[str, Any]
    submit: bool = False
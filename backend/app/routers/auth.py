from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..schemas import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
def read_current_user(user: User = Depends(get_current_user)):
    """
    Called right after the frontend acquires an MSAL token. Also doubles as the
    "am I registered / do I have a role yet" check the Dashboard uses to decide
    whether to show a form list or a "waiting for Admin" message.
    """
    return user

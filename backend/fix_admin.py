from app.database import SessionLocal
from app.models import User, RoleEnum

db = SessionLocal()
print("Current users:")

for u in db.query(User).all():
    print(f"  {u.email}  ->  {u.role}")

email = input("\nEnter the exact email to make admin: ").strip()
user = db.query(User).filter(User.email == email).first()

if not user:
    print(f"No user found with email '{email}'. Check the spelling above and try again.")
else:
    user.role = RoleEnum.admin
    db.commit()
    print(f"Done: {user.email} is now {user.role}")
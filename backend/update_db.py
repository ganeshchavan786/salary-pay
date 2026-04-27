import sqlite3
import os

db_path = r"d:\HR\V1\HRMS\backend\attendance.db"

columns = [
    ("aadhaar_no", "VARCHAR(20)"),
    ("pan_no", "VARCHAR(20)"),
    ("bank_name", "VARCHAR(100)"),
    ("account_no", "VARCHAR(50)"),
    ("ifsc_code", "VARCHAR(20)"),
    ("current_address", "TEXT"),
    ("permanent_address", "TEXT"),
    ("emergency_name", "VARCHAR(100)"),
    ("emergency_phone", "VARCHAR(20)")
]

def update_db():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE employees ADD COLUMN {col_name} {col_type}")
            print(f"Added column: {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column already exists: {col_name}")
            else:
                print(f"Error adding {col_name}: {e}")
    
    conn.commit()
    conn.close()
    print("Database update completed.")

if __name__ == "__main__":
    update_db()

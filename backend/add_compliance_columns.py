"""
Migration script: Add uan_no, pf_no, esi_no, location columns to employees table.
Run once:  python add_compliance_columns.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "attendance.db")

COLUMNS = [
    ("uan_no",   "VARCHAR(30)"),
    ("pf_no",    "VARCHAR(30)"),
    ("esi_no",   "VARCHAR(30)"),
    ("location", "VARCHAR(100)"),
]

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(employees);")
    existing_cols = {row[1] for row in cursor.fetchall()}

    added = []
    for col_name, col_type in COLUMNS:
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE employees ADD COLUMN {col_name} {col_type};")
            added.append(col_name)
            print(f"  Added column: {col_name} ({col_type})")
        else:
            print(f"  Column already exists, skipping: {col_name}")

    conn.commit()
    conn.close()

    if added:
        print(f"\nMigration complete. Added: {added}")
    else:
        print("\nAll columns already present. Nothing to do.")

if __name__ == "__main__":
    migrate()

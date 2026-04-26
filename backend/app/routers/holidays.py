from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import date, datetime
import uuid
import csv
import io

from app.database import get_db
from app.models.holiday import Holiday, HolidayType
from app.models.user import User
from app.schemas.holiday import (
    HolidayCreate, HolidayResponse, HolidayUpdate,
    BulkDeleteRequest, HolidayStatsResponse, UpcomingHolidayResponse,
    CopyToNextYearResponse, ImportSummaryResponse,
)
from app.utils.deps import get_current_user, require_admin

router = APIRouter(tags=["Holidays"])

# ── Seed data ─────────────────────────────────────────────────────────────────

MAHARASHTRA_2025 = [
    {"name": "Republic Day",         "name_marathi": "गणराज्य दिन",    "date": date(2025, 1, 26),  "holiday_type": HolidayType.NATIONAL},
    {"name": "Holi",                 "name_marathi": "होळी",            "date": date(2025, 3, 14),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Gudi Padwa",           "name_marathi": "गुढी पाडवा",     "date": date(2025, 3, 30),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Maharashtra Day",      "name_marathi": "महाराष्ट्र दिन", "date": date(2025, 5, 1),   "holiday_type": HolidayType.STATE},
    {"name": "Independence Day",     "name_marathi": "स्वातंत्र्य दिन","date": date(2025, 8, 15),  "holiday_type": HolidayType.NATIONAL},
    {"name": "Ganesh Chaturthi",     "name_marathi": "गणेश चतुर्थी",  "date": date(2025, 8, 27),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Dussehra",             "name_marathi": "दसरा",           "date": date(2025, 10, 2),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Diwali - Laxmi Pujan", "name_marathi": "लक्ष्मी पूजन",  "date": date(2025, 10, 20), "holiday_type": HolidayType.FESTIVAL},
    {"name": "Diwali - Bhaubeej",    "name_marathi": "भाऊबीज",        "date": date(2025, 10, 22), "holiday_type": HolidayType.FESTIVAL},
    {"name": "Christmas",            "name_marathi": "नाताळ",          "date": date(2025, 12, 25), "holiday_type": HolidayType.NATIONAL},
]

MAHARASHTRA_2026 = [
    {"name": "Republic Day",         "name_marathi": "गणराज्य दिन",    "date": date(2026, 1, 26),  "holiday_type": HolidayType.NATIONAL},
    {"name": "Gudi Padwa",           "name_marathi": "गुढी पाडवा",     "date": date(2026, 3, 20),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Maharashtra Day",      "name_marathi": "महाराष्ट्र दिन", "date": date(2026, 5, 1),   "holiday_type": HolidayType.STATE},
    {"name": "Independence Day",     "name_marathi": "स्वातंत्र्य दिन","date": date(2026, 8, 15),  "holiday_type": HolidayType.NATIONAL},
    {"name": "Ganesh Chaturthi",     "name_marathi": "गणेश चतुर्थी",  "date": date(2026, 9, 14),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Ganesh Visarjan",      "name_marathi": "गणेश विसर्जन",  "date": date(2026, 9, 25),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Dussehra",             "name_marathi": "दसरा",           "date": date(2026, 10, 20), "holiday_type": HolidayType.FESTIVAL},
    {"name": "Diwali - Dhanteras",   "name_marathi": "धनत्रयोदशी",    "date": date(2026, 11, 6),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Diwali - Laxmi Pujan", "name_marathi": "लक्ष्मी पूजन",  "date": date(2026, 11, 8),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Diwali - Bhaubeej",    "name_marathi": "भाऊबीज",        "date": date(2026, 11, 10), "holiday_type": HolidayType.FESTIVAL},
]

MAHARASHTRA_2027 = [
    {"name": "Republic Day",         "name_marathi": "गणराज्य दिन",    "date": date(2027, 1, 26),  "holiday_type": HolidayType.NATIONAL},
    {"name": "Holi",                 "name_marathi": "होळी",            "date": date(2027, 3, 3),   "holiday_type": HolidayType.FESTIVAL},
    {"name": "Gudi Padwa",           "name_marathi": "गुढी पाडवा",     "date": date(2027, 3, 19),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Maharashtra Day",      "name_marathi": "महाराष्ट्र दिन", "date": date(2027, 5, 1),   "holiday_type": HolidayType.STATE},
    {"name": "Independence Day",     "name_marathi": "स्वातंत्र्य दिन","date": date(2027, 8, 15),  "holiday_type": HolidayType.NATIONAL},
    {"name": "Ganesh Chaturthi",     "name_marathi": "गणेश चतुर्थी",  "date": date(2027, 9, 3),   "holiday_type": HolidayType.FESTIVAL},
    {"name": "Dussehra",             "name_marathi": "दसरा",           "date": date(2027, 10, 9),  "holiday_type": HolidayType.FESTIVAL},
    {"name": "Diwali - Laxmi Pujan", "name_marathi": "लक्ष्मी पूजन",  "date": date(2027, 10, 29), "holiday_type": HolidayType.FESTIVAL},
    {"name": "Christmas",            "name_marathi": "नाताळ",          "date": date(2027, 12, 25), "holiday_type": HolidayType.NATIONAL},
]

SEED_DATA = {2025: MAHARASHTRA_2025, 2026: MAHARASHTRA_2026, 2027: MAHARASHTRA_2027}


async def _seed_year(year: int, db: AsyncSession) -> dict:
    data = SEED_DATA.get(year, [])
    seeded = 0
    skipped = 0
    for h in data:
        existing = await db.execute(select(Holiday).where(Holiday.date == h["date"]))
        if existing.scalar_one_or_none():
            skipped += 1
            continue
        holiday = Holiday(
            id=str(uuid.uuid4()),
            name=h["name"],
            name_marathi=h["name_marathi"],
            date=h["date"],
            holiday_type=h["holiday_type"],
            year=year,
            is_active=True,
        )
        db.add(holiday)
        seeded += 1
    await db.commit()
    return {"message": f"Seeded {seeded} holidays, skipped {skipped} existing.", "seeded": seeded, "skipped": skipped}


def _holiday_to_dict(h: Holiday) -> dict:
    return {
        "id": h.id,
        "name": h.name,
        "name_marathi": h.name_marathi,
        "date": h.date.isoformat() if h.date else None,
        "holiday_type": h.holiday_type.value if h.holiday_type else None,
        "year": h.year,
        "is_active": h.is_active,
    }


# ── Static routes (MUST be before /{holiday_id}) ─────────────────────────────

@router.get("/stats", response_model=HolidayStatsResponse)
async def get_holiday_stats(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Holiday counts by type for a given year."""
    y = year or datetime.utcnow().year
    result = await db.execute(
        select(Holiday).where(and_(Holiday.year == y, Holiday.is_active == True))
    )
    holidays = result.scalars().all()
    counts = {"national": 0, "state": 0, "festival": 0, "optional": 0}
    for h in holidays:
        t = h.holiday_type.value if h.holiday_type else "optional"
        if t in counts:
            counts[t] += 1
    return HolidayStatsResponse(year=y, total=len(holidays), **counts)


@router.get("/upcoming")
async def get_upcoming_holidays(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Next 5 active holidays from today."""
    today = date.today()
    result = await db.execute(
        select(Holiday).where(
            and_(Holiday.is_active == True, Holiday.date >= today)
        ).order_by(Holiday.date).limit(5)
    )
    holidays = result.scalars().all()
    upcoming = [
        UpcomingHolidayResponse(
            id=h.id, name=h.name, name_marathi=h.name_marathi,
            date=h.date, holiday_type=h.holiday_type,
            days_remaining=(h.date - today).days,
        )
        for h in holidays
    ]
    return {"upcoming": [u.model_dump() for u in upcoming]}


@router.post("/bulk-delete")
async def bulk_delete_holidays(
    body: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Soft-delete multiple holidays by ID list."""
    deleted = 0
    not_found = 0
    for hid in body.ids:
        result = await db.execute(select(Holiday).where(and_(Holiday.id == hid, Holiday.is_active == True)))
        holiday = result.scalar_one_or_none()
        if holiday:
            holiday.is_active = False
            deleted += 1
        else:
            not_found += 1
    await db.commit()
    return {"deleted": deleted, "not_found": not_found}


@router.post("/copy-to-next-year", response_model=CopyToNextYearResponse)
async def copy_to_next_year(
    from_year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Copy all active holidays from from_year to from_year+1."""
    result = await db.execute(
        select(Holiday).where(and_(Holiday.year == from_year, Holiday.is_active == True))
    )
    source_holidays = result.scalars().all()

    copied = 0
    skipped = 0
    for h in source_holidays:
        try:
            target_date = h.date.replace(year=from_year + 1)
        except ValueError:
            # Feb 29 in non-leap year — skip
            skipped += 1
            continue

        existing = await db.execute(select(Holiday).where(and_(Holiday.date == target_date, Holiday.is_active == True)))
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        new_holiday = Holiday(
            id=str(uuid.uuid4()),
            name=h.name,
            name_marathi=h.name_marathi,
            date=target_date,
            holiday_type=h.holiday_type,
            year=from_year + 1,
            is_active=True,
        )
        db.add(new_holiday)
        copied += 1

    await db.commit()
    return CopyToNextYearResponse(copied=copied, skipped=skipped)


@router.post("/import", response_model=ImportSummaryResponse)
async def import_holidays(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Bulk import holidays from CSV file."""
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid CSV format: file must be UTF-8 encoded")

    try:
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {e}")

    total_rows = len(rows)
    imported = 0
    skipped = 0
    errors = 0
    error_details = []

    valid_types = {t.value for t in HolidayType}

    for i, row in enumerate(rows, start=2):
        raw_date = (row.get("date") or "").strip()
        name = (row.get("name") or "").strip()
        raw_type = (row.get("holiday_type") or "").strip().lower()
        raw_year = (row.get("year") or "").strip()

        # Validate required fields
        if not raw_date or not name:
            errors += 1
            error_details.append(f"Row {i}: missing required field (date or name)")
            continue

        if raw_type not in valid_types:
            errors += 1
            error_details.append(f"Row {i}: invalid holiday_type '{raw_type}'")
            continue

        try:
            holiday_date = date.fromisoformat(raw_date)
        except ValueError:
            errors += 1
            error_details.append(f"Row {i}: invalid date format '{raw_date}' (expected YYYY-MM-DD)")
            continue

        year_val = holiday_date.year
        if raw_year:
            try:
                year_val = int(raw_year)
            except ValueError:
                pass

        # Check duplicate
        existing = await db.execute(select(Holiday).where(and_(Holiday.date == holiday_date, Holiday.is_active == True)))
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        holiday = Holiday(
            id=str(uuid.uuid4()),
            name=name,
            name_marathi=(row.get("name_marathi") or "").strip() or None,
            date=holiday_date,
            holiday_type=HolidayType(raw_type),
            year=year_val,
            is_active=True,
        )
        db.add(holiday)
        imported += 1

    await db.commit()
    return ImportSummaryResponse(
        total_rows=total_rows, imported=imported, skipped=skipped,
        errors=errors, error_details=error_details,
    )


@router.post("/seed-2025", status_code=201)
async def seed_2025_holidays(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return await _seed_year(2025, db)


@router.post("/seed-2026", status_code=201)
async def seed_2026_holidays(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return await _seed_year(2026, db)


@router.post("/seed-2027", status_code=201)
async def seed_2027_holidays(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return await _seed_year(2027, db)


# ── List and CRUD ─────────────────────────────────────────────────────────────

@router.get("")
async def list_holidays(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List holidays, optionally filtered by year."""
    y = year or datetime.utcnow().year
    result = await db.execute(
        select(Holiday).where(
            and_(Holiday.year == y, Holiday.is_active == True)
        ).order_by(Holiday.date)
    )
    holidays = result.scalars().all()
    return {"holidays": [_holiday_to_dict(h) for h in holidays]}


@router.post("", status_code=201)
async def create_holiday(
    data: HolidayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Add a new holiday."""
    # Check duplicate date
    existing = await db.execute(select(Holiday).where(and_(Holiday.date == data.date, Holiday.is_active == True)))
    conflict = existing.scalar_one_or_none()
    if conflict:
        raise HTTPException(status_code=409, detail=f"A holiday already exists on {data.date}: {conflict.name}")

    holiday = Holiday(
        id=str(uuid.uuid4()),
        name=data.name,
        name_marathi=data.name_marathi,
        date=data.date,
        holiday_type=data.holiday_type,
        year=data.year,
        is_active=True,
    )
    db.add(holiday)
    await db.commit()
    await db.refresh(holiday)
    return {"message": "Holiday added.", "holiday": _holiday_to_dict(holiday)}


@router.put("/{holiday_id}")
async def update_holiday(
    holiday_id: str,
    data: HolidayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Edit an existing holiday."""
    result = await db.execute(select(Holiday).where(and_(Holiday.id == holiday_id, Holiday.is_active == True)))
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found.")

    # Check date conflict (excluding self)
    if data.date != holiday.date:
        existing = await db.execute(
            select(Holiday).where(
                and_(Holiday.date == data.date, Holiday.is_active == True, Holiday.id != holiday_id)
            )
        )
        conflict = existing.scalar_one_or_none()
        if conflict:
            raise HTTPException(status_code=409, detail=f"A holiday already exists on {data.date}: {conflict.name}")

    holiday.name = data.name
    holiday.name_marathi = data.name_marathi
    holiday.date = data.date
    holiday.holiday_type = data.holiday_type
    await db.commit()
    return {"message": "Holiday updated.", "holiday": _holiday_to_dict(holiday)}


@router.delete("/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Soft-delete a holiday."""
    result = await db.execute(select(Holiday).where(Holiday.id == holiday_id))
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found.")
    holiday.is_active = False
    await db.commit()
    return {"message": "Holiday removed."}

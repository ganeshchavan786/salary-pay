from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    total_employees: int
    active_employees: int
    present_today: int
    absent_today: int
    on_leave_today: int
    pending_leaves: int
    new_joiners_this_month: int
    attendance_rate: int

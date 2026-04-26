from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

from app.database import get_db
from app.models.approval import ApprovalWorkflow, ApprovalRequest, ApprovalAction, ApprovalStatus
from app.models.user import User
from app.utils.deps import get_current_user

router = APIRouter(tags=["Approvals"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class WorkflowCreate(BaseModel):
    workflow_name: str = Field(..., min_length=1)
    workflow_type: str = Field(..., description="e.g. SALARY_APPROVAL, DEDUCTION_APPROVAL")
    steps: List[dict] = Field(
        default_factory=list,
        description="List of step definitions, e.g. [{'level': 1, 'approver_role': 'SUPERVISOR'}]",
    )
    is_active: bool = True


class WorkflowResponse(BaseModel):
    id: str
    workflow_name: str
    workflow_type: str
    steps: List[Any]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalRequestCreate(BaseModel):
    workflow_id: str
    entity_type: str = Field(..., description="e.g. SALARY_CALCULATION, DEDUCTION")
    entity_id: str


class ApprovalRequestResponse(BaseModel):
    id: str
    workflow_id: str
    entity_type: str
    entity_id: str
    current_step: int
    status: ApprovalStatus
    requested_by: str
    requested_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApprovalActionRequest(BaseModel):
    action: str = Field(..., description="APPROVE, REJECT, or ESCALATE")
    comment: Optional[str] = None


VALID_ACTIONS = {"APPROVE", "REJECT", "ESCALATE"}


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_workflow_or_404(workflow_id: str, db: AsyncSession) -> ApprovalWorkflow:
    result = await db.execute(select(ApprovalWorkflow).where(ApprovalWorkflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval workflow not found.")
    return workflow


async def _get_request_or_404(request_id: str, db: AsyncSession) -> ApprovalRequest:
    result = await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found.")
    return req


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/workflows", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an approval workflow."""
    workflow = ApprovalWorkflow(
        workflow_name=payload.workflow_name,
        workflow_type=payload.workflow_type,
        steps=payload.steps,
        is_active=payload.is_active,
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return WorkflowResponse.model_validate(workflow)


@router.get("/workflows", response_model=List[WorkflowResponse])
async def list_workflows(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all approval workflows."""
    result = await db.execute(
        select(ApprovalWorkflow).order_by(ApprovalWorkflow.created_at.desc())
    )
    workflows = result.scalars().all()
    return [WorkflowResponse.model_validate(w) for w in workflows]


@router.post("/requests", response_model=ApprovalRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_request(
    payload: ApprovalRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an approval request for an entity."""
    await _get_workflow_or_404(payload.workflow_id, db)

    req = ApprovalRequest(
        workflow_id=payload.workflow_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        current_step=1,
        status=ApprovalStatus.PENDING,
        requested_by=current_user.id,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return ApprovalRequestResponse.model_validate(req)


@router.get("/requests", response_model=List[ApprovalRequestResponse])
async def list_pending_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pending approval requests for the current user."""
    result = await db.execute(
        select(ApprovalRequest).where(
            and_(
                ApprovalRequest.requested_by == current_user.id,
                ApprovalRequest.status == ApprovalStatus.PENDING,
            )
        ).order_by(ApprovalRequest.requested_at.desc())
    )
    requests = result.scalars().all()
    return [ApprovalRequestResponse.model_validate(r) for r in requests]


@router.post("/requests/{request_id}/action", response_model=ApprovalRequestResponse)
async def take_action_on_request(
    request_id: str,
    payload: ApprovalActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Take action on an approval request.
    - APPROVE: if current_step < total_steps → increment step; if last step → mark APPROVED
    - REJECT: mark as REJECTED
    - ESCALATE: mark as ESCALATED
    """
    action_upper = payload.action.upper()
    if action_upper not in VALID_ACTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action '{payload.action}'. Must be one of: {', '.join(VALID_ACTIONS)}.",
        )

    req = await _get_request_or_404(request_id, db)

    if req.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already {req.status.value} and cannot be acted upon.",
        )

    # Fetch workflow to determine total steps
    workflow = await _get_workflow_or_404(req.workflow_id, db)
    total_steps = len(workflow.steps) if workflow.steps else 1

    # Record the action
    approval_action = ApprovalAction(
        request_id=request_id,
        step_number=req.current_step,
        approver_id=current_user.id,
        action=action_upper,
        comments=payload.comment,
    )
    db.add(approval_action)

    # Update request status based on action
    if action_upper == "APPROVE":
        if req.current_step < total_steps:
            req.current_step += 1
            # Still pending — waiting for next approver
        else:
            req.status = ApprovalStatus.APPROVED
            req.completed_at = datetime.utcnow()
    elif action_upper == "REJECT":
        req.status = ApprovalStatus.REJECTED
        req.completed_at = datetime.utcnow()
    elif action_upper == "ESCALATE":
        req.status = ApprovalStatus.ESCALATED

    await db.commit()
    await db.refresh(req)
    return ApprovalRequestResponse.model_validate(req)

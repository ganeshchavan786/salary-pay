import hashlib
import json
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.salary_audit_log import SalaryAuditLog


class SalaryAuditLogger:
    """Tamper-evident audit logger for salary operations"""

    async def log(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: str,
        operation: str,
        old_values: Optional[Dict] = None,
        new_values: Optional[Dict] = None,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> SalaryAuditLog:
        """Create an immutable audit log entry with hash chain"""

        # Get previous hash for chain
        prev_result = await db.execute(
            select(SalaryAuditLog)
            .order_by(SalaryAuditLog.timestamp.desc())
            .limit(1)
        )
        prev_log = prev_result.scalar_one_or_none()
        previous_hash = prev_log.record_hash if prev_log else None

        # Calculate changed fields
        changed_fields = None
        if old_values and new_values:
            changed_fields = {
                k: {"old": old_values.get(k), "new": new_values.get(k)}
                for k in set(list(old_values.keys()) + list(new_values.keys()))
                if old_values.get(k) != new_values.get(k)
            }

        # Create record content for hashing
        record_content = json.dumps({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "operation": operation,
            "old_values": old_values,
            "new_values": new_values,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "previous_hash": previous_hash,
        }, sort_keys=True, default=str)

        record_hash = hashlib.sha256(record_content.encode()).hexdigest()

        log_entry = SalaryAuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            operation=operation,
            old_values=old_values,
            new_values=new_values,
            changed_fields=changed_fields,
            user_id=user_id,
            ip_address=ip_address,
            record_hash=record_hash,
            previous_hash=previous_hash,
        )

        db.add(log_entry)
        await db.flush()  # Don't commit here, let caller manage transaction
        return log_entry


salary_audit_logger = SalaryAuditLogger()

from typing import List, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Basic notification service for salary events"""

    TEMPLATES = {
        "salary_processed": {
            "subject": "Your {month} Payslip is Ready",
            "body": "Dear {employee_name}, Your salary of ₹{net_salary} for {period} has been processed.",
        },
        "payslip_available": {
            "subject": "Payslip Available - {period}",
            "body": "Dear {employee_name}, Your payslip for {period} is now available.",
        },
        "approval_pending": {
            "subject": "Approval Required - {entity_type}",
            "body": "Dear {approver_name}, An approval request is pending for {entity_type}.",
        },
        "tds_declaration_pending": {
            "subject": "TDS Declaration Pending - FY {financial_year}",
            "body": "Dear {employee_name}, Please submit your tax declaration for FY {financial_year}.",
        },
    }

    def render_template(self, template_key: str, variables: Dict) -> Dict:
        """Render a notification template with variables"""
        template = self.TEMPLATES.get(template_key, {
            "subject": "Notification",
            "body": "You have a new notification.",
        })

        subject = template["subject"]
        body = template["body"]

        for key, value in variables.items():
            subject = subject.replace(f"{{{key}}}", str(value))
            body = body.replace(f"{{{key}}}", str(value))

        return {"subject": subject, "body": body}

    async def send_notification(
        self,
        recipient_email: str,
        template_key: str,
        variables: Dict,
        channel: str = "email",
    ) -> Dict:
        """Send a notification (logs to console in dev mode)"""
        rendered = self.render_template(template_key, variables)

        notification = {
            "recipient": recipient_email,
            "channel": channel,
            "subject": rendered["subject"],
            "body": rendered["body"],
            "sent_at": datetime.utcnow().isoformat(),
            "status": "sent",
        }

        # In production, integrate with SendGrid/SMTP
        logger.info(f"[NOTIFICATION] To: {recipient_email} | Subject: {rendered['subject']}")

        return notification

    async def send_bulk_notifications(
        self,
        recipients: List[Dict],  # [{"email": str, "variables": dict}]
        template_key: str,
        channel: str = "email",
    ) -> Dict:
        """Send bulk notifications"""
        results = []
        for recipient in recipients:
            result = await self.send_notification(
                recipient_email=recipient["email"],
                template_key=template_key,
                variables=recipient.get("variables", {}),
                channel=channel,
            )
            results.append(result)

        return {
            "total": len(recipients),
            "sent": len([r for r in results if r["status"] == "sent"]),
            "results": results,
        }


notification_service = NotificationService()

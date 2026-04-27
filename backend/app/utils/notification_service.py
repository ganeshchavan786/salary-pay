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
        "welcome_pwa": {
            "subject": "Welcome to {company_name} HR Portal",
            "body": "Dear {employee_name},\n\nYour login for the HR portal has been created.\n\nUsername: {username}\nPassword: {password}\n\nYou can access the portal here: {app_url}\n\nBest regards,\n{company_name} Team",
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

    async def get_smtp_config(self):
        from app.database import AsyncSessionLocal
        from app.models.system_setting import SystemSetting
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as db:
            keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "sender_email", "sender_name", "use_tls"]
            result = await db.execute(select(SystemSetting).where(SystemSetting.key.in_(keys)))
            settings_dict = {s.key: s.value for s in result.scalars().all()}
            return settings_dict

    async def send_notification(
        self,
        recipient_email: str,
        template_key: str,
        variables: Dict,
        channel: str = "email",
    ) -> Dict:
        """Send a notification (logs to console and sends email if SMTP is configured)"""
        rendered = self.render_template(template_key, variables)

        notification = {
            "recipient": recipient_email,
            "channel": channel,
            "subject": rendered["subject"],
            "body": rendered["body"],
            "sent_at": datetime.utcnow().isoformat(),
            "status": "sent",
        }

        # In production, integrate with SMTP
        logger.info(f"[NOTIFICATION] To: {recipient_email} | Subject: {rendered['subject']}")

        if channel == "email":
            try:
                import smtplib
                from email.mime.text import MIMEText
                from email.mime.multipart import MIMEMultipart
                
                config = await self.get_smtp_config()
                if not config.get("smtp_host"):
                    logger.warning("SMTP not configured, skipping real email")
                    return notification
                
                msg = MIMEMultipart()
                msg['From'] = f"{config.get('sender_name', 'HRMS')} <{config.get('sender_email')}>"
                msg['To'] = recipient_email
                msg['Subject'] = rendered["subject"]
                msg.attach(MIMEText(rendered["body"], 'plain'))
                
                port = int(config.get("smtp_port", 587))
                if port == 465:
                    server = smtplib.SMTP_SSL(config.get("smtp_host"), port, timeout=10)
                else:
                    server = smtplib.SMTP(config.get("smtp_host"), port, timeout=10)
                    if config.get("use_tls", "true").lower() == "true":
                        server.starttls()
                
                server.login(config.get("smtp_user"), config.get("smtp_password"))
                server.send_message(msg)
                server.quit()
                logger.info(f"Email successfully sent to {recipient_email}")
            except Exception as e:
                logger.error(f"Failed to send email to {recipient_email}: {e}")
                notification["status"] = "failed"
                notification["error"] = str(e)

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

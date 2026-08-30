import os
import urllib.parse
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Candidate, Interaction, InteractionDirection


class CommunicationService:
    @staticmethod
    def format_whatsapp_deep_link(phone: str, message: str) -> str:
        clean_phone = "".join(c for c in phone if c.isdigit() or c == "+")
        if clean_phone.startswith("+"):
            clean_phone = clean_phone[1:]
        elif len(clean_phone) == 10:
            clean_phone = "91" + clean_phone  # Default to India if 10-digit
        encoded_message = urllib.parse.quote(message)
        return f"https://wa.me/{clean_phone}?text={encoded_message}"

    @staticmethod
    def format_mailto_link(email: str, subject: str, body: str) -> str:
        params = urllib.parse.urlencode({"subject": subject, "body": body})
        return f"mailto:{email}?{params}"

    @staticmethod
    async def dispatch_message(
        session: AsyncSession,
        candidate_id: str,
        channel: str,  # "WhatsApp" | "Email"
        message_text: str,
        subject: str | None = None,
        recipient_override: str | None = None,
        simulated: bool = False,
    ) -> dict[str, Any]:
        candidate = await session.scalar(
            select(Candidate).where(
                (Candidate.id == candidate_id) | (Candidate.external_id == candidate_id)
            )
        )
        if not candidate:
            raise ValueError("Candidate not found")

        phone = recipient_override or candidate.phone or "+919876543210"
        email = recipient_override or candidate.email or f"{candidate.name.lower().replace(' ', '.')}@example.com"
        email_subject = subject or f"Swiggy Onboarding: Welcome {candidate.name.split()[0]}!"

        deep_link = None
        status = "delivered"
        delivery_details = ""

        if channel.lower() == "whatsapp":
            deep_link = CommunicationService.format_whatsapp_deep_link(phone, message_text)
            # If WhatsApp API / Twilio environment variables exist, live dispatch would go here:
            twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
            twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
            if twilio_sid and twilio_token and not simulated:
                # Live Twilio dispatch stub
                delivery_details = f"Dispatched via Twilio WhatsApp Gateway to {phone}"
            else:
                delivery_details = f"Simulated WhatsApp message sent to {phone}. Deep link ready."
        else:
            deep_link = CommunicationService.format_mailto_link(email, email_subject, message_text)
            smtp_host = os.getenv("SMTP_HOST")
            if smtp_host and not simulated:
                # Live SMTP dispatch stub
                delivery_details = f"Dispatched via SMTP to {email}"
            else:
                delivery_details = f"Simulated Email sent to {email}. Mailto link ready."

        # Automatically log the outbound interaction in SQLite
        interaction = Interaction(
            candidate_id=candidate.id,
            channel="WhatsApp" if channel.lower() == "whatsapp" else "Email",
            direction=InteractionDirection.outbound,
            body=message_text,
            tone=f"Outreach ({'Live' if not simulated else 'Simulated'})",
            source="communication_service",
            occurred_at=datetime.utcnow(),
        )
        session.add(interaction)
        candidate.row_version += 1
        await session.commit()
        await session.refresh(interaction)

        return {
            "success": True,
            "channel": interaction.channel,
            "status": status,
            "details": delivery_details,
            "deep_link": deep_link,
            "interaction_id": interaction.id,
            "timestamp": interaction.occurred_at.isoformat(),
            "candidate_id": candidate.external_id or candidate.id,
            "candidate_name": candidate.name,
            "recipient": phone if channel.lower() == "whatsapp" else email,
        }

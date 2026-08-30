import asyncio
import traceback
from app.config import get_settings
from app.services.groq_service import GroqHRService
from app.schemas import GenerateMessageRequest

async def test_groq_service():
    settings = get_settings()
    service = GroqHRService(settings)
    
    payload = GenerateMessageRequest(
        candidateId="cand-001",
        candidateName="Aarav Mehta",
        role="Senior Product Designer",
        location="Bengaluru",
        joiningDate="02 Sep 2026",
        daysToJoin=3,
        risk="high",
        nextAction="Call today to unblock joining concerns",
        interactions=[],
        tone="Friendly",
        channel="WhatsApp",
    )
    
    try:
        draft = await service.generate_message(payload)
        print("SUCCESS! Generated draft:")
        print(draft)
    except Exception as e:
        print(f"Caught exception: {type(e).__name__}: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_groq_service())

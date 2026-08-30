"""Comprehensive API verification suite for Post-Offer HQ backend."""
import asyncio
import httpx


BASE_URL = "http://127.0.0.1:8000"


async def test_all_endpoints():
    print("=" * 60)
    print("[RUNNING] Post-Offer HQ Backend Endpoint Verification Suite")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Health Check
        res = await client.get("/api/v1/health")
        assert res.status_code == 200, f"Health check failed: {res.status_code}"
        print("[PASS] [1/12] GET  /api/v1/health -> 200 OK")

        # 2. List Candidates
        res = await client.get("/api/v1/candidates?page=1&pageSize=10")
        assert res.status_code == 200, f"List candidates failed: {res.status_code}"
        data = res.json()
        assert "items" in data and len(data["items"]) > 0
        candidate_id = data["items"][0]["id"]
        print(f"[PASS] [2/12] GET  /api/v1/candidates -> 200 OK (found {data['total']} candidates, sample: {candidate_id})")

        # 3. Get Candidate Detail & State
        res = await client.get(f"/api/v1/candidates/{candidate_id}")
        assert res.status_code == 200
        cand_detail = res.json()
        print(f"[PASS] [3/12] GET  /api/v1/candidates/{candidate_id} -> 200 OK ({cand_detail['name']}, {cand_detail['daysToJoin']} days to join)")

        res = await client.get(f"/api/v1/candidates/{candidate_id}/state")
        assert res.status_code == 200
        print(f"[PASS] [4/12] GET  /api/v1/candidates/{candidate_id}/state -> 200 OK")

        # 4. Add Manual Interaction
        res = await client.post(
            f"/api/v1/candidates/{candidate_id}/interactions",
            json={"channel": "Call", "text": "Confirmed transit booking", "tone": "Positive"},
        )
        assert res.status_code == 201
        print("[PASS] [5/12] POST /api/v1/candidates/{id}/interactions -> 201 Created")

        # 5. Toggle Journey Step
        res = await client.patch(
            f"/api/v1/candidates/{candidate_id}/journey-steps/welcome",
            json={"status": "completed"},
        )
        assert res.status_code == 200
        print("[PASS] [6/12] PATCH /api/v1/candidates/{id}/journey-steps/{step} -> 200 OK")

        # 6. Override Risk
        res = await client.post(
            f"/api/v1/candidates/{candidate_id}/risk-overrides",
            json={"risk": "medium", "reason": "Candidate confirmed relocation schedule.", "overriddenBy": "Nisha Rao"},
        )
        assert res.status_code == 200, f"Risk override failed: {res.status_code} {res.text}"
        print("[PASS] [7/12] POST /api/v1/candidates/{id}/risk-overrides -> 200 OK")

        # 7. AI Message Generation
        res = await client.post(
            "/api/v1/ai/messages/generate",
            json={
                "candidateId": candidate_id,
                "candidateName": cand_detail["name"],
                "role": cand_detail["role"],
                "location": cand_detail["location"],
                "joiningDate": cand_detail["joiningDate"],
                "daysToJoin": cand_detail["daysToJoin"],
                "risk": "medium",
                "nextAction": "Send a short check-in this week",
                "interactions": [],
                "tone": "Friendly",
                "channel": "WhatsApp",
            },
        )
        assert res.status_code == 200, f"AI generation failed: {res.status_code} {res.text}"
        ai_msg = res.json()
        print(f"[PASS] [8/12] POST /api/v1/ai/messages/generate -> 200 OK (Draft: {ai_msg['draft'][:45]}...)")

        # 8. AI Risk Analysis
        res = await client.post(
            "/api/v1/ai/candidates/analyze",
            json={
                "candidateId": candidate_id,
                "candidateName": cand_detail["name"],
                "role": cand_detail["role"],
                "location": cand_detail["location"],
                "joiningDate": cand_detail["joiningDate"],
                "daysToJoin": cand_detail["daysToJoin"],
                "risk": "medium",
                "nextAction": "Send check-in",
                "interactions": [{"channel": "WhatsApp", "direction": "in", "timestamp": "Yesterday", "text": "Looking forward to day one!"}],
            },
        )
        assert res.status_code == 200, f"AI analysis failed: {res.status_code} {res.text}"
        ai_analysis = res.json()
        print(f"[PASS] [9/12] POST /api/v1/ai/candidates/analyze -> 200 OK (Risk: {ai_analysis['risk']}, Confidence: {ai_analysis['confidence']})")

        # 9. Send Communication (WhatsApp / Email / Simulated)
        res = await client.post(
            f"/api/v1/candidates/{candidate_id}/send-message",
            json={"channel": "WhatsApp", "message": "Hi, welcome aboard!", "simulated": False},
        )
        assert res.status_code == 200
        msg_result = res.json()
        print(f"[PASS] [10/12] POST /api/v1/candidates/{id}/send-message -> 200 OK (Deep link: {msg_result['deepLink'][:35]}...)")

        # 10. Automated Engagement Rules Engine
        res = await client.post("/api/v1/automations/run-engagement-rules")
        assert res.status_code == 200
        auto_res = res.json()
        print(f"[PASS] [11/12] POST /api/v1/automations/run-engagement-rules -> 200 OK (Evaluated {auto_res['evaluatedCandidatesCount']}, Flagged: {auto_res['flaggedCount']})")

        # 11. Tasks & Notifications
        res = await client.get("/api/v1/tasks")
        assert res.status_code == 200
        tasks = res.json()
        print(f"[PASS] [12/12] GET  /api/v1/tasks -> 200 OK ({len(tasks)} tasks active in queue)")

    print("=" * 60)
    print("[SUCCESS] ALL 12 API ENDPOINTS VERIFIED & WORKING PERFECTLY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_all_endpoints())

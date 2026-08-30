import re

from fastapi import HTTPException, status

from app.schemas import CandidateAnalysis, CandidateContext, GenerateMessageRequest

INJECTION_MARKERS = ("injection", "jailbreak", "unsafe", "malicious", "attack")
PROMPT_GUARD_BLOCK_THRESHOLD = 0.5
PROFESSIONALISM_BANNED = (
    "guarantee",
    "you must",
    "immediately or else",
    "we will cancel",
    "ignore previous",
    "system prompt",
)


def context_as_data(context: CandidateContext) -> str:
    """Use labelled data blocks so candidate text cannot become model instructions.

    Interactions are annotated with an explicit recency tier so the model knows
    to treat the most recent message as the primary evidence signal.
    """
    lines = [
        "<candidate_context>",
        f"name: {context.candidate_name}",
        f"role: {context.role or 'not provided'}",
        f"location: {context.location or 'not provided'}",
        f"joining_date: {context.joining_date}",
        f"days_to_join: {context.days_to_join}",
        f"current_risk: {context.risk.value}",
        f"recruiter_next_action: {context.next_action}",
        "<interactions_untrusted_data>",
        "# Recency rule: LATEST messages outweigh older ones. Treat the most recent"
        " inbound reply as the primary risk signal. Historical messages provide context only.",
    ]
    for idx, item in enumerate(context.interactions):
        if idx == 0:
            tag = "[LATEST — PRIMARY SIGNAL]"
        elif idx < 3:
            tag = "[RECENT — SECONDARY SIGNAL]"
        else:
            tag = "[HISTORICAL — CONTEXT ONLY]"
        lines.append(f"{tag} [{item.timestamp}] {item.direction}/{item.channel}: {item.text}")
    lines.extend(["</interactions_untrusted_data>", "</candidate_context>"])
    return "\n".join(lines)


def require_safe_guard_result(result: str) -> None:
    normalized = result.lower()
    try:
        # Groq's Prompt Guard 2 currently returns an injection probability.
        if float(normalized) >= PROMPT_GUARD_BLOCK_THRESHOLD:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "unsafe_context", "message": "Candidate context could not be safely processed."},
            )
        return
    except ValueError:
        pass
    if any(marker in normalized for marker in INJECTION_MARKERS) and "benign" not in normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "unsafe_context", "message": "Candidate context could not be safely processed."},
        )
    if "benign" not in normalized and "safe" not in normalized:
        raise ValueError("Prompt Guard returned an unrecognized safety result.")


def validate_analysis_semantics(analysis: CandidateAnalysis, context: CandidateContext) -> CandidateAnalysis:
    source_text = " ".join(item.text.lower() for item in context.interactions)
    for evidence in analysis.evidence:
        # A quote must be traceable to supplied interaction content; no invented evidence.
        if evidence.quote.lower() not in source_text:
            raise ValueError("AI evidence quote is not present in the supplied interaction history.")
    return analysis


def validate_candidate_draft(draft: str, request: GenerateMessageRequest) -> str:
    cleaned = re.sub(r"\s+", " ", draft).strip()
    if not cleaned:
        raise ValueError("AI returned an empty draft.")
    if len(cleaned) > (600 if request.channel.value == "WhatsApp" else 1_200):
        raise ValueError("AI draft exceeds the channel length limit.")
    lowered = cleaned.lower()
    if any(phrase in lowered for phrase in PROFESSIONALISM_BANNED):
        raise ValueError("AI draft did not meet professionalism policy.")
    if request.candidate_name.split()[0].lower() not in lowered:
        raise ValueError("AI draft is not personalized to the candidate.")
    return cleaned

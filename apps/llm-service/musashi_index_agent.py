"""
Índice de Musashi (IM) — Musashi Index Agent

Calculates an experiential mastery score (0–10) inspired by Miyamoto Musashi,
translating real-world career trajectory into an academic-equivalent credential.

Scoring rubric (weighted composite):
  40% — Tenure & Sustained Practice
  30% — Portfolio Evidence & Demonstrated Output
  20% — Measurable Impact
  10% — Continuous Learning & Adaptation

Academic equivalencies:
  0.0–3.9  → Preparatoria / High School
  4.0–5.9  → Licenciatura / Bachelor's
  6.0–7.4  → Especialización / Specialization
  7.5–8.4  → Maestría / Master's
  8.5–9.4  → Doctorado / PhD
  9.5–10.0 → Sword Saint / Post-doctoral / Fellow
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Weights for the composite score
WEIGHTS = {
    "tenure": 0.40,
    "portfolio": 0.30,
    "impact": 0.20,
    "learning": 0.10,
}

# Academic equivalency thresholds
EQUIVALENCIES = [
    (
        9.5,
        "Sword Saint / Post-doctoral / Fellow",
        "Sword Saint / Post-doctoral / Fellow",
    ),
    (8.5, "Doctorado", "PhD equivalent"),
    (7.5, "Maestría", "Master's equivalent"),
    (6.0, "Especialización", "Specialization equivalent"),
    (4.0, "Licenciatura", "Bachelor's equivalent"),
    (0.0, "Preparatoria", "High School equivalent"),
]


def _resolve_equivalency(im_score: float) -> tuple[str, str]:
    for threshold, es, en in EQUIVALENCIES:
        if im_score >= threshold:
            return es, en
    return "Preparatoria", "High School equivalent"


def _compute_weighted_score(scores: Dict[str, float]) -> float:
    return round(
        scores["tenure"] * WEIGHTS["tenure"]
        + scores["portfolio"] * WEIGHTS["portfolio"]
        + scores["impact"] * WEIGHTS["impact"]
        + scores["learning"] * WEIGHTS["learning"],
        2,
    )


def _extract_json(text: str) -> Optional[Dict]:
    """Extract the first JSON object from an LLM response."""
    # Strip markdown code fences if present
    text = re.sub(r"```(?:json)?", "", text).strip()
    # Find the outermost {...}
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}\nRaw text: {text[:500]}")
        return None


def _validate_result(data: Dict) -> Dict:
    """Normalise and clamp all fields so the response is always safe to return."""
    scores = data.get("scores", {})
    for key in ("tenure", "portfolio", "impact", "learning"):
        scores[key] = round(max(0.0, min(10.0, float(scores.get(key, 5.0)))), 2)

    im_score = data.get("im_score")
    if im_score is None:
        im_score = _compute_weighted_score(scores)
    else:
        im_score = round(max(0.0, min(10.0, float(im_score))), 2)

    eq_es, eq_en = _resolve_equivalency(im_score)

    return {
        "scores": scores,
        "im_score": im_score,
        "academic_equivalent": data.get("academic_equivalent", eq_es),
        "academic_equivalent_en": data.get("academic_equivalent_en", eq_en),
        "citation": str(data.get("citation", "")),
        "duels_won": list(data.get("duels_won", [])),
        "growth_area": str(data.get("growth_area", "")),
        "rationale": str(data.get("rationale", "")),
    }


class MusashiIndexAgent:
    """
    Computes the Índice de Musashi for a career profile using an LLM.

    The agent accepts a free-form career profile (resume text, structured
    experience list, or both) and returns a structured IM result.
    """

    def __init__(self, llm_client, prompt_manager):
        """
        Args:
            llm_client: Object with a generate(prompt: str) -> str method.
            prompt_manager: PromptManager instance for loading the prompt template.
        """
        self.llm = llm_client
        self.prompts = prompt_manager

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def score(
        self,
        career_profile: Optional[str] = None,
        resume_content: Optional[str] = None,
        ai_context: Optional[str] = None,
        experience_years: Optional[float] = None,
        portfolio_items: Optional[List[str]] = None,
        impact_highlights: Optional[List[str]] = None,
        learning_highlights: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Compute the Musashi Index for the supplied career profile.

        Args:
            career_profile:       Optional free-form text (bio/summary/notes).
            resume_content:       Public resume content.
            ai_context:           Hidden/private AI context (llmContext).
            experience_years:     Optional hint for total years of experience.
            portfolio_items:      Optional list of notable projects/outputs.
            impact_highlights:    Optional list of quantified impact statements.
            learning_highlights:  Optional list of self-directed learning items.

        Returns:
            Dict with im_score, scores, academic_equivalent, citation, etc.
        """
        enriched_profile = self._enrich_profile(
            career_profile,
            resume_content,
            ai_context,
            experience_years,
            portfolio_items,
            impact_highlights,
            learning_highlights,
        )

        prompt = self.prompts.get("musashi_index", career_profile=enriched_profile)

        logger.info("Calling LLM for Musashi Index evaluation...")
        try:
            raw = self.llm.generate(prompt)
            logger.debug(f"LLM raw response (first 500 chars): {raw[:500]}")
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise

        parsed = _extract_json(raw)
        if parsed is None:
            logger.warning(
                "LLM returned non-JSON response; falling back to heuristic scores"
            )
            parsed = self._heuristic_fallback(
                experience_years,
                portfolio_items,
                impact_highlights,
                learning_highlights,
            )

        return _validate_result(parsed)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _enrich_profile(
        self,
        base_profile: Optional[str],
        resume_content: Optional[str],
        ai_context: Optional[str],
        experience_years: Optional[float],
        portfolio_items: Optional[List[str]],
        impact_highlights: Optional[List[str]],
        learning_highlights: Optional[List[str]],
    ) -> str:
        """Compose a profile that keeps resume and AI context as separate sections."""
        sections = []

        if resume_content and resume_content.strip():
            sections.append(f"[RESUME CONTENT]\n{resume_content.strip()}")

        if ai_context and ai_context.strip():
            sections.append(f"[AI CONTEXT]\n{ai_context.strip()}")

        if base_profile and base_profile.strip():
            sections.append(f"[ADDITIONAL CAREER PROFILE]\n{base_profile.strip()}")

        if experience_years is not None:
            sections.append(f"\n[HINT] Total years of experience: {experience_years}")

        if portfolio_items:
            joined = "\n  - ".join(portfolio_items)
            sections.append(f"\n[PORTFOLIO ITEMS]\n  - {joined}")

        if impact_highlights:
            joined = "\n  - ".join(impact_highlights)
            sections.append(f"\n[IMPACT HIGHLIGHTS]\n  - {joined}")

        if learning_highlights:
            joined = "\n  - ".join(learning_highlights)
            sections.append(f"\n[CONTINUOUS LEARNING]\n  - {joined}")

        if not sections:
            return "[NO PROFILE DATA PROVIDED]"

        return "\n\n".join(sections)

    def _heuristic_fallback(
        self,
        experience_years: Optional[float],
        portfolio_items: Optional[List[str]],
        impact_highlights: Optional[List[str]],
        learning_highlights: Optional[List[str]],
    ) -> Dict:
        """Simple rule-based fallback when the LLM doesn't return parseable JSON."""
        yrs = experience_years or 0
        if yrs >= 20:
            tenure = 9.5
        elif yrs >= 15:
            tenure = 8.5
        elif yrs >= 10:
            tenure = 7.0
        elif yrs >= 5:
            tenure = 5.5
        elif yrs >= 3:
            tenure = 4.0
        else:
            tenure = 2.5

        portfolio = min(10.0, 3.0 + len(portfolio_items or []) * 0.7)
        impact = min(10.0, 3.0 + len(impact_highlights or []) * 1.0)
        learning = min(10.0, 3.0 + len(learning_highlights or []) * 1.5)

        scores = {
            "tenure": round(tenure, 2),
            "portfolio": round(portfolio, 2),
            "impact": round(impact, 2),
            "learning": round(learning, 2),
        }
        im_score = _compute_weighted_score(scores)
        eq_es, eq_en = _resolve_equivalency(im_score)

        return {
            "scores": scores,
            "im_score": im_score,
            "academic_equivalent": eq_es,
            "academic_equivalent_en": eq_en,
            "citation": (
                "Evaluated via heuristic fallback — "
                "LLM response could not be parsed. "
                "Provide more structured input for a sharper score."
            ),
            "duels_won": [],
            "growth_area": "More quantified evidence needed for a precise evaluation.",
            "rationale": "Heuristic scoring based on years of experience and supplied hints only.",
        }

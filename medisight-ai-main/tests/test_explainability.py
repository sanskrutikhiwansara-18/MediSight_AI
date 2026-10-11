"""Focused tests for the patient-readable explainability payload."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.schemas.misc import RiskFeatureContribution, RiskPredictionOut
from app.services.risk_service import explain_contribution


def test_explanation_labels_and_direction_are_present():
    result = explain_contribution("latest_glucose", 145.0, 0.42)

    assert result["label"] == "Latest fasting glucose"
    assert result["direction"] == "raises"
    assert "model association" in result["explanation"]
    assert result["value"] == 145.0
    assert result["shap_value"] == 0.42


def test_negative_shap_is_described_as_lowering_model_score():
    result = explain_contribution("num_active_conditions", 2.0, -0.3)

    assert result["direction"] == "lowers"
    assert "lowers it" in result["explanation"]
    assert "not proof of cause" in result["explanation"]


def test_risk_response_schema_includes_limitations():
    contribution = explain_contribution("age", 55.0, 0.1)
    response = RiskPredictionOut(
        risk_score=0.62,
        risk_level="MODERATE",
        model_version="test-model",
        shap_explanation=[RiskFeatureContribution(**contribution)],
    )

    payload = response.model_dump()
    assert "synthetic Synthea data" in payload["disclaimer"]
    assert "SHAP feature contributions" in payload["explanation_method"]
    assert "fasting glucose" in payload["data_note"]

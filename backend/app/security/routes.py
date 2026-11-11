from flask import Blueprint, jsonify, request

from .engine import evaluate_job
from .storage import save_findings, get_findings

security_bp = Blueprint("security", __name__)


@security_bp.route("/security/check", methods=["POST"])
def security_check():
    job = request.get_json(silent=True)

    if not isinstance(job, dict):
        return jsonify({
            "success": False,
            "error": "A valid JSON object is required."
        }), 400

    result = evaluate_job(job)

    if result["findings"]:
        save_findings(result["findings"])

    return jsonify({
        "success": True,
        "data": result
    }), 200


@security_bp.route("/security/findings", methods=["GET"])
def security_findings():
    return jsonify({
        "success": True,
        "data": get_findings()
    }), 200
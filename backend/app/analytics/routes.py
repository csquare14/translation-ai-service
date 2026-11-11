from flask import Blueprint, jsonify
from .service import get_analytics

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/analytics", methods=["GET"])
def analytics():
    try:
        data = get_analytics()
        return jsonify({
            "success": True,
            "data": data
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500
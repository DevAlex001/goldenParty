"""
Handler listo para copiar en la Lambda POST de comentarios:
https://okzpybliflo6h2rxpakctwvtuy0gwazh.lambda-url.us-east-2.on.aws/

El front envía JSON:
  {"nombre": "James Bons", "comentario": "Fija lo hare caer al vayron"}

La lista GET devuelve:
  {"autor": "...", "comment": "...", "id": "..."}
"""

import json
import uuid
from datetime import datetime, timezone

# Ajusta al nombre real de tu tabla DynamoDB
TABLE_NAME = "comentarios"  # o el nombre que uses en la Lambda de listado

try:
    import boto3

    _table = boto3.resource("dynamodb").Table(TABLE_NAME)
except Exception:
    _table = None


def _cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    }


def _response(status: int, payload: dict):
    return {
        "statusCode": status,
        "headers": _cors_headers(),
        "body": json.dumps(payload, ensure_ascii=False),
    }


def _parse_body(event: dict) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {}
    body = event.get("body")
    if body is None:
        return {}
    if isinstance(body, str):
        if not body.strip():
            return {}
        return json.loads(body)
    if isinstance(body, dict):
        return body
    return {}


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS" or event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": ""}

    try:
        data = _parse_body(event)
    except json.JSONDecodeError:
        return _response(400, {"error": "JSON inválido en el body."})

    nombre = (data.get("nombre") or data.get("autor") or "").strip()
    comentario = (data.get("comentario") or data.get("comment") or "").strip()

    if not comentario:
        return _response(400, {"error": "El comentario no puede estar vacío."})

    if not nombre:
        return _response(400, {"error": "El nombre no puede estar vacío."})

    item_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Mismo formato que devuelve la Lambda GET
    item = {
        "id": item_id,
        "autor": nombre,
        "comment": comentario,
        "fecha_creacion": now,
    }

    if _table is not None:
        _table.put_item(Item=item)

    return _response(
        201,
        {
            "message": "Comentario creado",
            "id": item_id,
            "item": item,
        },
    )

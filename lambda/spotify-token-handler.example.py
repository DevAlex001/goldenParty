"""
Lambda opcional para producción (GitHub Pages).
URL en producción: https://bbgyax7gc7d4tt7yhjtszjsjui0gsjgw.lambda-url.us-east-2.on.aws/
Opcional en GitHub: secret VITE_SPOTIFY_TOKEN_URL (misma URL) para override

Variables de entorno en la Lambda:
  SPOTIFY_CLIENT_ID
  SPOTIFY_CLIENT_SECRET
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
import base64


def _cors():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    }


def lambda_handler(event, context):
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors(), "body": ""}

    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return {
            "statusCode": 500,
            "headers": _cors(),
            "body": json.dumps({"error": "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET"}),
        }

    creds = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {creds}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode()
            return {"statusCode": resp.status, "headers": _cors(), "body": body}
    except urllib.error.HTTPError as e:
        return {"statusCode": e.code, "headers": _cors(), "body": e.read().decode()}

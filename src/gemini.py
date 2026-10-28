"""Minimal Gemini (Google AI Studio) client for structured JSON output. Standard library only.

The key is read from the GEMINI_API_KEY environment variable and sent in a request header. It is never written to a file,
a log or a URL. Pin a named model (for example gemini-2.5-pro), not a '-latest' alias: aliases move and break eval comparisons.
"""
import json
import os
import time
import urllib.error
import urllib.request

BASE = "https://generativelanguage.googleapis.com/v1beta/models"
RETRY_STATUS = {429, 500, 502, 503, 504}


def to_gemini_schema(s):
    """Convert our JSON schema to the subset Gemini accepts: no additionalProperties; nullable instead of anyOf-with-null."""
    if isinstance(s, list):
        return [to_gemini_schema(x) for x in s]
    if not isinstance(s, dict):
        return s
    if "anyOf" in s:
        kinds = [x for x in s["anyOf"] if x.get("type") != "null"]
        if len(kinds) == 1 and len(kinds) != len(s["anyOf"]):
            out = to_gemini_schema(kinds[0])
            out["nullable"] = True
            return out
    return {k: to_gemini_schema(v) for k, v in s.items() if k != "additionalProperties"}


def _post(url, body, key, timeout):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def generate_json(model, system, user, schema, temperature=0, max_output_tokens=32000, timeout=300, retries=4, post=None, sleep=time.sleep):
    """Returns (object_or_None, meta). Never raises for API problems; meta['error'] says what went wrong."""
    key = os.environ.get("GEMINI_API_KEY")
    meta = {"provider": "gemini", "model": model}
    if not key:
        meta["error"] = "GEMINI_API_KEY is not set"
        return None, meta
    body = {"systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": to_gemini_schema(schema),
                                 "temperature": temperature, "maxOutputTokens": max_output_tokens}}
    t0 = time.time()
    last = None
    for attempt in range(retries):
        try:
            resp = (post or _post)(f"{BASE}/{model}:generateContent", body, key, timeout)
            break
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read().decode(errors='replace')[:200]}"
            if e.code not in RETRY_STATUS:
                meta.update(error=last, seconds=round(time.time() - t0, 1))
                return None, meta
        except Exception as e:  # network error or timeout
            last = f"{type(e).__name__}: {e}"[:200]
        sleep(min(60, 4 * 2 ** attempt))
    else:
        meta.update(error=f"gave up after {retries} tries: {last}", seconds=round(time.time() - t0, 1))
        return None, meta
    meta["seconds"] = round(time.time() - t0, 1)
    u = resp.get("usageMetadata", {})
    meta.update(input_tokens=u.get("promptTokenCount"), output_tokens=u.get("candidatesTokenCount"), thinking_tokens=u.get("thoughtsTokenCount"),
                model_version=resp.get("modelVersion"))
    cands = resp.get("candidates") or []
    if not cands:
        meta["error"] = f"no candidates; promptFeedback={json.dumps(resp.get('promptFeedback'))[:150]}"
        return None, meta
    meta["finish_reason"] = cands[0].get("finishReason")
    if meta["finish_reason"] != "STOP":
        meta["error"] = f"finishReason={meta['finish_reason']}"
        return None, meta
    try:
        text = "".join(p.get("text", "") for p in cands[0]["content"]["parts"] if not p.get("thought"))
        return json.loads(text), meta
    except Exception as e:
        meta["error"] = f"unparseable output: {e}"[:200]
        return None, meta

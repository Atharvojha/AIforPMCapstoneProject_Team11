"""Tests for gemini.py with a fake transport (no network, no key). Run: python3 src/test_gemini.py"""
import json
import os
import sys
import unittest
import urllib.error
from io import BytesIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gemini
import lapfit
import judge


def ok(text, finish="STOP"):
    return {"candidates": [{"finishReason": finish, "content": {"parts": [{"text": text}]}}],
            "usageMetadata": {"promptTokenCount": 7, "candidatesTokenCount": 3}, "modelVersion": "m-1"}


class T(unittest.TestCase):
    def setUp(self):
        os.environ["GEMINI_API_KEY"] = "test-key"

    def test_schema_conversion_for_our_real_schemas(self):
        for sch in (lapfit.SCHEMA, judge.SCHEMA):
            out = gemini.to_gemini_schema(sch)
            dump = json.dumps(out)
            self.assertNotIn("additionalProperties", dump)
            self.assertNotIn("anyOf", dump)
        flag = gemini.to_gemini_schema(lapfit.SCHEMA)["properties"]["review_assessments"]["items"]["properties"]["flag"]
        self.assertTrue(flag["nullable"]); self.assertEqual(flag["type"], "string"); self.assertIn("duplicate", flag["enum"])

    def test_success_and_request_shape(self):
        seen = {}
        def post(url, body, key, timeout):
            seen.update(url=url, body=body, key=key)
            return ok('{"a": 1}')
        obj, meta = gemini.generate_json("gemini-x", "sys", "usr", {"type": "object"}, post=post)
        self.assertEqual(obj, {"a": 1}); self.assertEqual(meta["input_tokens"], 7)
        self.assertTrue(seen["url"].endswith("/gemini-x:generateContent"))
        self.assertNotIn("test-key", seen["url"])                       # the key travels in a header, not the URL
        self.assertEqual(seen["body"]["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(seen["body"]["systemInstruction"]["parts"][0]["text"], "sys")

    def test_retries_then_succeeds_and_gives_up(self):
        calls = []
        def flaky(url, body, key, timeout):
            calls.append(1)
            if len(calls) < 3:
                raise urllib.error.HTTPError(url, 429, "slow down", {}, BytesIO(b"quota"))
            return ok("{}")
        obj, meta = gemini.generate_json("m", "s", "u", {}, post=flaky, sleep=lambda s: None)
        self.assertEqual((obj, len(calls)), ({}, 3))
        def always(url, body, key, timeout):
            raise urllib.error.HTTPError(url, 503, "down", {}, BytesIO(b"x"))
        obj, meta = gemini.generate_json("m", "s", "u", {}, post=always, sleep=lambda s: None, retries=2)
        self.assertIsNone(obj); self.assertIn("gave up", meta["error"])

    def test_non_retryable_and_bad_outputs_are_errors_not_exceptions(self):
        def bad_key(url, body, key, timeout):
            raise urllib.error.HTTPError(url, 400, "bad", {}, BytesIO(b"API key not valid"))
        obj, meta = gemini.generate_json("m", "s", "u", {}, post=bad_key, sleep=lambda s: None)
        self.assertIsNone(obj); self.assertIn("HTTP 400", meta["error"])
        for resp, frag in ((ok("{}", "MAX_TOKENS"), "MAX_TOKENS"), (ok("not json"), "unparseable"), ({"candidates": []}, "no candidates")):
            obj, meta = gemini.generate_json("m", "s", "u", {}, post=lambda *a: resp)
            self.assertIsNone(obj); self.assertIn(frag, meta["error"])

    def test_missing_key(self):
        del os.environ["GEMINI_API_KEY"]
        obj, meta = gemini.generate_json("m", "s", "u", {}, post=lambda *a: ok("{}"))
        self.assertIsNone(obj); self.assertIn("not set", meta["error"])


if __name__ == "__main__":
    unittest.main(verbosity=1)

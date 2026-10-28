"""Tests for judge.py with a stub client (no API call). Toy data only. Run: python3 src/test_judge.py"""
import json
import os
import sys
import unittest
from types import SimpleNamespace as NS

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import judge

ITEM = {"profile": {"label": "Tester"}, "laptop": {"laptop_id": "L1"},
        "reviews": [{"review_id": "R001", "stars": 2, "reviewer_config_stated": "16 GB", "review_text": "Fan is loud."}],
        "expected": {"applicable_review_ids": ["R001"], "dealbreakers": {}, "watchouts": {"thermals_noise": ["R001"]},
                     "conflicts": [], "evidence_gaps": [], "confidence": "Insufficient", "why": "one review"}}
GOOD = {**{c: {"reasoning": "ok", "evidence": "R001", "verdict": "Pass"} for c in judge.CRIT}, "reference_disputed": False, "dispute_reason": None}


class Stub:
    def __init__(self, text, stop="end_turn"):
        self.calls = []
        self.messages = NS(create=lambda **kw: (self.calls.append(kw), NS(stop_reason=stop, content=[NS(type="text", text=text)]))[1])


class T(unittest.TestCase):
    def test_prompt_is_read_from_the_markdown(self):
        system, tail = judge.load_prompt()
        self.assertIn("strict evaluator", system)
        self.assertTrue(tail.startswith("Criteria."))
        for c in ("C1 RELEVANCE", "C2 DEALBREAKERS", "C3 GROUNDEDNESS", "C4 CONFLICTS AND GAPS", "C5 CALIBRATION AND SAFETY"):
            self.assertIn(c, tail)

    def test_user_message_has_reference_and_hides_meta(self):
        _, tail = judge.load_prompt()
        out = {"item_id": "T", "summary": "s", "_meta": {"secret": "x"}}
        msg = judge.build_user(ITEM, out, tail)
        self.assertIn("<reference_labels>", msg); self.assertIn("thermals_noise", msg)
        self.assertNotIn("secret", msg)

    def test_good_and_bad_judge_responses(self):
        system, tail = judge.load_prompt()
        res, err = judge.judge_one(ITEM, {"item_id": "T"}, Stub(json.dumps(GOOD)), system, tail)
        self.assertIsNone(err); self.assertEqual(res["C3"]["verdict"], "Pass")
        for stub in (Stub("nope"), Stub("{}", "refusal")):
            res, err = judge.judge_one(ITEM, {"item_id": "T"}, stub, system, tail)
            self.assertIsNone(res); self.assertTrue(err)

    def test_schema_requires_all_criteria(self):
        self.assertEqual(set(judge.SCHEMA["required"]), set(judge.CRIT) | {"reference_disputed", "dispute_reason"})


if __name__ == "__main__":
    unittest.main(verbosity=1)

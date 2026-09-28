import unittest
from unittest.mock import patch
import app as checker_app
from app import decide, MODEL, REVISION, MANIFEST

PIN={"model":MODEL,"revision":REVISION,"engineManifestSha256":MANIFEST,"entailmentThreshold":0.85,"contradictionThreshold":0.85,"aggregateRule":"ANY_SUPPORT_ELSE_NOT_SUPPORTED"}
BASE={"pin":PIN,"claim":{"text":"claim"},"evidence":[{"evidence_id":"e1","title":"t","abstract":"a"}]}

class ContractTest(unittest.TestCase):
    def test_support_and_echo_pin(self):
        out=decide(BASE, lambda p,h:{"entailment":0.91,"contradiction":0.01})
        self.assertEqual(out,{"model":MODEL,"revision":REVISION,"engine_manifest_sha256":MANIFEST,"primary_decision":"SUPPORT","diagnostic":"SUPPORT"})
    def test_not_supported_with_contradiction_diagnostic(self):
        out=decide(BASE, lambda p,h:{"entailment":0.1,"contradiction":0.9})
        self.assertEqual(out["primary_decision"],"NOT_SUPPORTED")
        self.assertEqual(out["diagnostic"],"CONTRADICTS")
    def test_any_support_aggregates_to_support(self):
        body={**BASE,"evidence":[BASE["evidence"][0],{"evidence_id":"e2","title":"x","abstract":"y"}]}
        vals=iter([{"entailment":0.1,"contradiction":0.1},{"entailment":0.85,"contradiction":0.0}])
        self.assertEqual(decide(body,lambda p,h:next(vals))["primary_decision"],"SUPPORT")
    def test_runtime_scorer_requires_baked_local_model(self):
        previous = checker_app._PIPELINE
        checker_app._PIPELINE = None
        try:
            with patch.object(checker_app, "MODEL_PATH", "/definitely/missing/fresh-checker-model"):
                with self.assertRaisesRegex(RuntimeError, "FROZEN_MODEL_NOT_BAKED"):
                    checker_app._scorer("premise", "hypothesis")
        finally:
            checker_app._PIPELINE = previous

    def test_wrong_pin_fails_closed(self):
        body={**BASE,"pin":{**PIN,"revision":"wrong"}}
        with self.assertRaisesRegex(ValueError,"PIN_MISMATCH"): decide(body,lambda p,h:{})
if __name__=="__main__": unittest.main()

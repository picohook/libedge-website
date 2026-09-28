import json
import unittest
from unittest.mock import patch
import server

class ServerContractTest(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_ping(self):
        response = self.client.get("/ping")
        self.assertEqual(response.status_code, 200)

    @patch("server._scorer", return_value={"entailment": 0.9, "contradiction": 0.01})
    def test_invocations(self, _):
        from app import MODEL, REVISION, MANIFEST
        body = {
          "pin":{"model":MODEL,"revision":REVISION,"engineManifestSha256":MANIFEST,
                 "entailmentThreshold":0.85,"contradictionThreshold":0.85,
                 "aggregateRule":"ANY_SUPPORT_ELSE_NOT_SUPPORTED"},
          "claim":{"text":"claim"},
          "evidence":[{"evidence_id":"e1","title":"t","abstract":"a"}]
        }
        response = self.client.post("/invocations", json=body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["primary_decision"], "SUPPORT")

    def test_rejects_non_json(self):
        response = self.client.post("/invocations", data="x", content_type="text/plain")
        self.assertEqual(response.status_code, 415)

if __name__ == "__main__":
    unittest.main()

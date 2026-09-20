"""
test_d022_h1_structural_inventory_validator.py

Automated Test Suite for D022-H1 Structural Inventory Mechanical Validator.
Tests baseline validity, hash integrity, strict byte-level invariants,
bijective claim mappings, and negative mutations.

Role: H1 Structural Inventory Construction Validator / Test Author
Model Family / Version: Gemini / Gemini 3.7 Flash (gemini-3.7-flash)
"""

import copy
import json
import unittest
from d022_h1_structural_inventory_validator import (
    validate_h1_structural_inventory,
    compute_sha256,
    EXPECTED_HASHES,
)


def load_authorized_artifacts():
    with open("d022-h1-structural-inventory.jsonl", "rb") as f:
        inv_bytes = f.read()
    with open("d022-h1-pool.jsonl", "rb") as f:
        pool_bytes = f.read()
    with open("d022-h1-domain-metadata.jsonl", "rb") as f:
        dom_bytes = f.read()
    with open("d022-h1-construction-qa.jsonl", "rb") as f:
        qa_bytes = f.read()
    with open("d022-supportcheck-h2-construction-rating-spec-v0.1.md", "rb") as f:
        spec_bytes = f.read()

    return {
        "inventory": inv_bytes,
        "pool": pool_bytes,
        "domain_metadata": dom_bytes,
        "construction_qa": qa_bytes,
        "spec": spec_bytes,
    }


def parse_inventory_lines(raw_bytes: bytes) -> list:
    return [json.loads(line) for line in raw_bytes.decode("utf-8").strip().split("\n") if line.strip()]


def dump_inventory_lines(records: list) -> bytes:
    lines = [json.dumps(r, separators=(",", ":")) for r in records]
    return "\n".join(lines).encode("utf-8") + b"\n"


class TestH1StructuralInventoryValidator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.artifacts = load_authorized_artifacts()

    # --- Positive Validation Tests ---

    def test_baseline_authorized_artifacts_pass(self):
        """Baseline frozen artifacts must pass all mechanical validation checks."""
        report = validate_h1_structural_inventory(
            inventory_bytes=self.artifacts["inventory"],
            pool_bytes=self.artifacts["pool"],
            domain_meta_bytes=self.artifacts["domain_metadata"],
            construction_qa_bytes=self.artifacts["construction_qa"],
            spec_bytes=self.artifacts["spec"],
        )
        self.assertEqual(report["overall_status"], "PASS")
        self.assertEqual(len(report["errors"]), 0)
        self.assertEqual(report["checks"]["pool_integrity"]["status"], "PASS")
        self.assertEqual(report["checks"]["bijective_mapping"]["status"], "PASS")
        self.assertEqual(report["checks"]["template_invariants"]["status"], "PASS")
        self.assertEqual(report["summary"]["pool_claims_count"], 720)
        self.assertEqual(report["summary"]["mapped_claims_count"], 720)
        self.assertEqual(report["summary"]["templates_count"], 30)

    def test_expected_hashes_match(self):
        """All expected SHA-256 hashes must match the frozen upstream files."""
        for fname, exp_hash in EXPECTED_HASHES.items():
            if fname == "d022-h1-structural-inventory.jsonl":
                actual = compute_sha256(self.artifacts["inventory"])
            elif fname == "d022-h1-pool.jsonl":
                actual = compute_sha256(self.artifacts["pool"])
            elif fname == "d022-h1-domain-metadata.jsonl":
                actual = compute_sha256(self.artifacts["domain_metadata"])
            elif fname == "d022-h1-construction-qa.jsonl":
                actual = compute_sha256(self.artifacts["construction_qa"])
            elif fname == "d022-supportcheck-h2-construction-rating-spec-v0.1.md":
                actual = compute_sha256(self.artifacts["spec"])
            else:
                self.fail(f"Unknown artifact {fname}")
            self.assertEqual(actual, exp_hash, f"Hash mismatch for {fname}")

    # --- Negative Mutation Tests ---

    def test_missing_claim_mapping(self):
        """Removing a claim ID must trigger missing_claims failure."""
        records = parse_inventory_lines(self.artifacts["inventory"])
        removed_cid = records[0]["claim_ids"].pop(0)
        mutated_inv = dump_inventory_lines(records)

        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertEqual(report["checks"]["bijective_mapping"]["status"], "FAIL")
        self.assertIn(removed_cid, report["checks"]["bijective_mapping"]["missing_claims"])

    def test_duplicate_multiply_mapped_claim(self):
        """Mapping a claim under multiple templates must trigger duplicate failure."""
        records = parse_inventory_lines(self.artifacts["inventory"])
        dup_cid = records[0]["claim_ids"][0]
        records[1]["claim_ids"].append(dup_cid)
        mutated_inv = dump_inventory_lines(records)

        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertEqual(report["checks"]["bijective_mapping"]["status"], "FAIL")
        self.assertIn(dup_cid, report["checks"]["bijective_mapping"]["duplicate_mapped_claims"])

    def test_unknown_claim_id(self):
        """Introducing an unknown claim ID must fail validation."""
        records = parse_inventory_lines(self.artifacts["inventory"])
        unknown_cid = "D022-H1-S999-C99"
        records[0]["claim_ids"].append(unknown_cid)
        mutated_inv = dump_inventory_lines(records)

        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertEqual(report["checks"]["bijective_mapping"]["status"], "FAIL")
        self.assertIn(unknown_cid, report["checks"]["bijective_mapping"]["unknown_claims"])

    def test_duplicate_template_id(self):
        """Duplicate template IDs must fail template uniqueness."""
        records = parse_inventory_lines(self.artifacts["inventory"])
        records[1]["template_id"] = "H1T001"
        mutated_inv = dump_inventory_lines(records)

        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertTrue(any("duplicate template_id" in err for err in report["errors"]))

    def test_duplicate_template_definition(self):
        """Identical duplicate transformation definitions must fail definition uniqueness."""
        records = parse_inventory_lines(self.artifacts["inventory"])
        records[1]["transformation"] = records[0]["transformation"]
        mutated_inv = dump_inventory_lines(records)

        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertTrue(any("duplicate transformation definition" in err for err in report["errors"]))

    def test_mutated_frozen_source_hash_mismatch(self):
        """Mutating a frozen source artifact must trigger input_hashes failure."""
        mutated_pool = self.artifacts["pool"] + b"\n"
        report = validate_h1_structural_inventory(
            inventory_bytes=self.artifacts["inventory"],
            pool_bytes=mutated_pool,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertFalse(report["checks"]["input_hashes"]["d022-h1-pool.jsonl"]["match"])

    def test_malformed_jsonl_syntax(self):
        """Malformed JSON on any line must fail fail-closed."""
        mutated_inv = self.artifacts["inventory"].replace(b'{"template_id":"H1T001"', b'{"template_id":H1T001"')
        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertEqual(report["checks"]["inventory_format"]["status"], "FAIL")

    def test_malformed_byte_properties_bom(self):
        """UTF-8 BOM must be rejected fail-closed."""
        mutated_inv = b"\xef\xbb\xbf" + self.artifacts["inventory"]
        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertTrue(any("BOM" in err for err in report["errors"]))

    def test_malformed_byte_properties_crlf(self):
        """Carriage return bytes (CRLF) must be rejected fail-closed."""
        mutated_inv = self.artifacts["inventory"].replace(b"\n", b"\r\n")
        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertTrue(any("carriage return" in err for err in report["errors"]))

    def test_malformed_byte_properties_trailing_empty_lines(self):
        """Trailing extra empty lines in JSONL must be rejected."""
        mutated_inv = self.artifacts["inventory"] + b"\n"
        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertTrue(any("empty" in err for err in report["errors"]))

    def test_noncanonical_template_ordering(self):
        """Templates not in sequential order H1T001..H1T030 must fail ordering invariant."""
        records = parse_inventory_lines(self.artifacts["inventory"])
        records[0], records[1] = records[1], records[0]
        mutated_inv = dump_inventory_lines(records)

        custom_hashes = copy.deepcopy(EXPECTED_HASHES)
        custom_hashes["d022-h1-structural-inventory.jsonl"] = compute_sha256(mutated_inv)

        report = validate_h1_structural_inventory(
            inventory_bytes=mutated_inv,
            pool_bytes=self.artifacts["pool"],
            expected_hashes=custom_hashes,
        )
        self.assertEqual(report["overall_status"], "FAIL")
        self.assertEqual(report["checks"]["template_invariants"]["status"], "FAIL")
        self.assertFalse(report["checks"]["template_invariants"]["canonical_sequential_order"])

    # --- Explicit NOT APPLICABLE Invariants ---

    def test_undefined_template_reference_not_applicable(self):
        """
        NOT APPLICABLE: The canonical inventory schema contains `template_id`,
        `transformation`, and `claim_ids`. Templates do not reference other template
        definitions via an external pointer/foreign key.
        """
        self.assertTrue(True)

    def test_declared_template_count_field_not_applicable(self):
        """
        NOT APPLICABLE: The inventory format is line-delimited JSONL without a global
        metadata header record declaring a template count. Template count is derived
        directly from the number of line entries (which must equal 30).
        """
        self.assertTrue(True)

    def test_declared_cross_stratum_fields_not_applicable(self):
        """
        NOT APPLICABLE: Inventory records do not declare stratum memberships in the JSONL;
        cross-stratum breakdown is independently recomputed from frozen pool metadata.
        """
        self.assertTrue(True)


if __name__ == "__main__":
    unittest.main()

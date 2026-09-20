"""
d022_h1_structural_inventory_validator.py

Mechanical Validator for D022-H1 Structural Inventory.
Implements fail-closed verification of byte formatting, schema, hash integrity,
bijective claim mapping, template ordering, and stratum recomputation.

Role: H1 Structural Inventory Construction Validator / Test Author
Model Family / Version: Gemini / Gemini 3.7 Flash (gemini-3.7-flash)
"""

import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Expected SHA-256 digests for frozen upstream artifacts
EXPECTED_HASHES = {
    "d022-h1-pool.jsonl": "8e191f4d728467a788a55f24725ada21e4a563323dd5f72252b78d93b0ab47cb",
    "d022-h1-domain-metadata.jsonl": "f68cc483f241a9aef914b06c53644ee1a6c96c9d8b080625b4a4ac4784a08d69",
    "d022-h1-construction-qa.jsonl": "067f8bdf328a5444f913b1e6d0cc661dffc81aa2bb57362f5e7eeb25e809cb32",
    "d022-supportcheck-h2-construction-rating-spec-v0.1.md": "2d5460e57361c2aac9b71418758895c364344420175b8a95ba89159af00c7996",
    "d022-h1-structural-inventory.jsonl": "a08da438f43b023d9eea73cf4378bbb7bc529e450e6fef16afb894d8e8f9a468",
}

TEMPLATE_ID_REGEX = re.compile(r"^H1T\d{3}$")
CLAIM_ID_REGEX = re.compile(r"^D022-H1-S\d{3}-C\d{2}$")


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check_file_byte_properties(raw_bytes: bytes, file_name: str) -> Tuple[bool, List[str]]:
    """Check UTF-8 encoding, absence of BOM, LF-only line endings, no trailing empty lines."""
    errors = []
    if raw_bytes.startswith(b"\xef\xbb\xbf"):
        errors.append(f"{file_name}: Contains prohibited UTF-8 Byte Order Mark (BOM).")

    if b"\r" in raw_bytes:
        errors.append(f"{file_name}: Contains non-LF carriage return bytes (CR / CRLF).")

    try:
        decoded = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as e:
        errors.append(f"{file_name}: Invalid UTF-8 encoding: {e}")
        return False, errors

    if len(raw_bytes) > 0 and not raw_bytes.endswith(b"\n"):
        errors.append(f"{file_name}: File does not terminate with a canonical newline (LF).")

    return len(errors) == 0, errors


def parse_jsonl_strict(raw_bytes: bytes, file_name: str) -> Tuple[Optional[List[dict]], List[str]]:
    """Strict JSONL parser without silent normalization or stripping that could mask errors."""
    valid_bytes, errors = check_file_byte_properties(raw_bytes, file_name)
    if not valid_bytes:
        return None, errors

    if len(raw_bytes) == 0:
        return [], []

    raw_lines = raw_bytes.split(b"\n")
    if raw_lines[-1] != b"":
        errors.append(f"{file_name}: Missing terminal LF byte.")
        return None, errors

    lines = raw_lines[:-1]
    parsed_records = []
    for idx, line_bytes in enumerate(lines, 1):
        if len(line_bytes) == 0:
            errors.append(f"{file_name}: Line {idx} is empty (prohibited empty line in JSONL).")
            continue
        try:
            line_str = line_bytes.decode("utf-8")
            record = json.loads(line_str)
            parsed_records.append(record)
        except json.JSONDecodeError as e:
            errors.append(f"{file_name}: Line {idx} is malformed JSON: {e}")

    if errors:
        return None, errors
    return parsed_records, []


def validate_h1_structural_inventory(
    inventory_bytes: bytes,
    pool_bytes: bytes,
    domain_meta_bytes: Optional[bytes] = None,
    construction_qa_bytes: Optional[bytes] = None,
    spec_bytes: Optional[bytes] = None,
    expected_hashes: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Execute complete mechanical validation of H1 Structural Inventory."""
    if expected_hashes is None:
        expected_hashes = EXPECTED_HASHES

    report: Dict[str, Any] = {
        "validator_name": "d022_h1_structural_inventory_validator",
        "validator_version": "1.0.0",
        "role": "H1 Structural Inventory Construction Validator / Test Author",
        "overall_status": "FAIL",
        "checks": {},
        "summary": {},
        "per_template_summary": [],
        "errors": [],
    }

    # 1. Verify Hashes of all supplied input files
    hash_checks = {}
    inputs_to_check = [
        ("d022-h1-structural-inventory.jsonl", inventory_bytes),
        ("d022-h1-pool.jsonl", pool_bytes),
    ]
    if domain_meta_bytes is not None:
        inputs_to_check.append(("d022-h1-domain-metadata.jsonl", domain_meta_bytes))
    if construction_qa_bytes is not None:
        inputs_to_check.append(("d022-h1-construction-qa.jsonl", construction_qa_bytes))
    if spec_bytes is not None:
        inputs_to_check.append(("d022-supportcheck-h2-construction-rating-spec-v0.1.md", spec_bytes))

    hash_failures = []
    for fname, data in inputs_to_check:
        actual_h = compute_sha256(data)
        exp_h = expected_hashes.get(fname)
        matches = (exp_h is None) or (actual_h.lower() == exp_h.lower())
        hash_checks[fname] = {
            "sha256": actual_h,
            "expected_sha256": exp_h,
            "match": matches,
            "size_bytes": len(data),
        }
        if not matches:
            hash_failures.append(f"Hash mismatch for {fname}: got {actual_h}, expected {exp_h}")

    report["checks"]["input_hashes"] = hash_checks
    if hash_failures:
        report["errors"].extend(hash_failures)

    # 2. Parse and validate H1 Pool
    pool_records, pool_parse_errors = parse_jsonl_strict(pool_bytes, "d022-h1-pool.jsonl")
    if pool_parse_errors:
        report["errors"].extend(pool_parse_errors)
        report["checks"]["pool_integrity"] = {"status": "FAIL", "errors": pool_parse_errors}
        return report

    pool_claim_ids: Set[str] = set()
    claim_to_stratum: Dict[str, str] = {}
    claim_to_scenario: Dict[str, str] = {}
    pool_duplicate_ids = set()

    for idx, rec in enumerate(pool_records, 1):
        if not isinstance(rec, dict):
            report["errors"].append(f"Pool line {idx} is not a JSON object.")
            continue
        cid = rec.get("claim_id")
        stratum = rec.get("stratum_id")
        scen = rec.get("scenario_id")
        if not cid or not isinstance(cid, str) or not CLAIM_ID_REGEX.match(cid):
            report["errors"].append(f"Pool line {idx} invalid claim_id: {cid}")
            continue
        if cid in pool_claim_ids:
            pool_duplicate_ids.add(cid)
        pool_claim_ids.add(cid)
        claim_to_stratum[cid] = stratum
        claim_to_scenario[cid] = scen

    if pool_duplicate_ids:
        report["errors"].append(f"Pool contains duplicate claim IDs: {sorted(list(pool_duplicate_ids))}")

    pool_valid = (len(pool_claim_ids) == 720) and (len(pool_duplicate_ids) == 0)
    report["checks"]["pool_integrity"] = {
        "status": "PASS" if pool_valid else "FAIL",
        "total_claims": len(pool_claim_ids),
        "expected_total_claims": 720,
    }
    if not pool_valid:
        report["errors"].append(f"Pool claim count is {len(pool_claim_ids)}, expected exactly 720.")

    # 3. Parse and validate Structural Inventory JSONL
    inventory_records, inv_parse_errors = parse_jsonl_strict(inventory_bytes, "d022-h1-structural-inventory.jsonl")
    if inv_parse_errors:
        report["errors"].extend(inv_parse_errors)
        report["checks"]["inventory_format"] = {"status": "FAIL", "errors": inv_parse_errors}
        return report

    report["checks"]["inventory_format"] = {"status": "PASS", "line_count": len(inventory_records)}

    # 4. Mechanical Schema & Bijective Mapping Verification
    seen_template_ids: List[str] = []
    seen_transformations: Set[str] = set()
    mapped_claim_instances: List[str] = []
    mapped_claim_set: Set[str] = set()
    duplicate_claim_mappings: Set[str] = set()
    per_template_summary = []

    expected_schema_keys = {"template_id", "transformation", "claim_ids"}

    for idx, entry in enumerate(inventory_records, 1):
        if not isinstance(entry, dict):
            report["errors"].append(f"Inventory line {idx} is not a JSON object.")
            continue

        entry_keys = set(entry.keys())
        if entry_keys != expected_schema_keys:
            report["errors"].append(
                f"Inventory line {idx} keys mismatch: expected {expected_schema_keys}, got {entry_keys}"
            )

        tid = entry.get("template_id")
        trans = entry.get("transformation")
        cids = entry.get("claim_ids")

        if not isinstance(tid, str) or not TEMPLATE_ID_REGEX.match(tid):
            report["errors"].append(f"Inventory line {idx} invalid template_id: {tid}")
        else:
            if tid in seen_template_ids:
                report["errors"].append(f"Inventory contains duplicate template_id: {tid}")
            seen_template_ids.append(tid)

        if not isinstance(trans, str) or len(trans.strip()) == 0:
            report["errors"].append(f"Inventory line {idx} ({tid}) has invalid transformation text.")
        else:
            if trans in seen_transformations:
                report["errors"].append(f"Inventory line {idx} ({tid}) has identical duplicate transformation definition.")
            seen_transformations.add(trans)

        if not isinstance(cids, list) or len(cids) == 0:
            report["errors"].append(f"Inventory line {idx} ({tid}) claim_ids must be a non-empty list.")
            cids_list = []
        else:
            cids_list = cids

        strata_counts: Dict[str, int] = {}
        for cid in cids_list:
            if not isinstance(cid, str) or not CLAIM_ID_REGEX.match(cid):
                report["errors"].append(f"Inventory line {idx} ({tid}) contains invalid claim ID format: {cid}")
                continue

            if cid not in pool_claim_ids:
                report["errors"].append(f"Inventory line {idx} ({tid}) contains unknown claim ID not in pool: {cid}")

            if cid in mapped_claim_set:
                duplicate_claim_mappings.add(cid)
            mapped_claim_set.add(cid)
            mapped_claim_instances.append(cid)

            stratum = claim_to_stratum.get(cid, "UNKNOWN")
            strata_counts[stratum] = strata_counts.get(stratum, 0) + 1

        per_template_summary.append({
            "template_id": tid,
            "transformation": trans,
            "claim_count": len(cids_list),
            "stratum_counts": strata_counts,
        })

    # Template Ordering Check
    expected_order = [f"H1T{i:03d}" for i in range(1, len(seen_template_ids) + 1)]
    ordering_valid = (seen_template_ids == expected_order)
    if not ordering_valid:
        report["errors"].append(f"Templates not in canonical sequential order H1T001..H1Tnnn. Got: {seen_template_ids}")

    missing_claims = pool_claim_ids - mapped_claim_set
    unknown_claims = mapped_claim_set - pool_claim_ids

    mapping_valid = (
        len(missing_claims) == 0
        and len(unknown_claims) == 0
        and len(duplicate_claim_mappings) == 0
        and len(mapped_claim_instances) == 720
        and len(mapped_claim_set) == 720
    )

    report["checks"]["bijective_mapping"] = {
        "status": "PASS" if mapping_valid else "FAIL",
        "total_pool_claims": len(pool_claim_ids),
        "total_mapped_instances": len(mapped_claim_instances),
        "total_unique_mapped_claims": len(mapped_claim_set),
        "missing_claims_count": len(missing_claims),
        "missing_claims": sorted(list(missing_claims)),
        "unknown_claims_count": len(unknown_claims),
        "unknown_claims": sorted(list(unknown_claims)),
        "duplicate_mapped_claims_count": len(duplicate_claim_mappings),
        "duplicate_mapped_claims": sorted(list(duplicate_claim_mappings)),
    }

    report["checks"]["template_invariants"] = {
        "status": "PASS" if (len(seen_template_ids) == 30 and ordering_valid and len(report["errors"]) == 0) else "FAIL",
        "template_count": len(seen_template_ids),
        "expected_template_count": 30,
        "canonical_sequential_order": ordering_valid,
        "unique_transformations_count": len(seen_transformations),
    }

    report["summary"] = {
        "pool_claims_count": len(pool_claim_ids),
        "mapped_claims_count": len(mapped_claim_set),
        "templates_count": len(seen_template_ids),
        "total_errors": len(report["errors"]),
    }
    report["per_template_summary"] = per_template_summary

    if len(report["errors"]) == 0 and mapping_valid and pool_valid and ordering_valid:
        report["overall_status"] = "PASS"
    else:
        report["overall_status"] = "FAIL"

    return report


if __name__ == "__main__":
    import sys

    with open("d022-h1-structural-inventory.jsonl", "rb") as f:
        inv_data = f.read()
    with open("d022-h1-pool.jsonl", "rb") as f:
        pool_data = f.read()
    with open("d022-h1-domain-metadata.jsonl", "rb") as f:
        dom_data = f.read()
    with open("d022-h1-construction-qa.jsonl", "rb") as f:
        qa_data = f.read()
    with open("d022-supportcheck-h2-construction-rating-spec-v0.1.md", "rb") as f:
        spec_data = f.read()

    rep = validate_h1_structural_inventory(
        inventory_bytes=inv_data,
        pool_bytes=pool_data,
        domain_meta_bytes=dom_data,
        construction_qa_bytes=qa_data,
        spec_bytes=spec_data,
    )

    print(json.dumps(rep, indent=2))
    if rep["overall_status"] != "PASS":
        sys.exit(1)

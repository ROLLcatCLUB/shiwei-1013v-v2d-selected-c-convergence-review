from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


STAGE = "1013V_VISUAL_SYSTEM_POLISH_LINE"
PHASE = "V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY"
BUILD_STAGE = "1013V_V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY"

VIEWPORTS = {
    "1366": (1366, 768),
    "1600": (1600, 1000),
    "2560": (2560, 1440),
}

REQUIRED_FILES = [
    "README.md",
    "v2d_direction_decision.md",
    "v2d_selected_C_convergence_notes.md",
    "v2d_copy_and_visibility_rules.md",
    "source_lock.json",
    "v2d_selected_C_converged_teacher_notebook_workbench.html",
    "screenshot_manifest.json",
    "visual_smoke_result.json",
    "tools/capture_v2d_selected_c_smoke.cjs",
]

SOURCE_V2C = Path(
    "outputs/1013V_VISUAL_SYSTEM_POLISH_LINE/"
    "V2C_R97B_VISUAL_HIERARCHY_AND_AESTHETIC_DIRECTION/"
    "v2c_direction_C_notebook_paper.html"
)
DERIVED_V2D = Path(
    "outputs/1013V_VISUAL_SYSTEM_POLISH_LINE/"
    "V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY/"
    "v2d_selected_C_converged_teacher_notebook_workbench.html"
)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def num(value: object, default: float = 0) -> float:
    return value if isinstance(value, (int, float)) else default


def validate_case(case: dict, errors: list[str]) -> None:
    case_id = str(case.get("id") or "")
    viewport = str((case.get("viewport") or {}).get("width") or "")
    expected_size = VIEWPORTS.get(viewport)
    size = case.get("screenshot_dimensions") or {}
    dom = case.get("dom_metrics") or {}
    vc = dom.get("visual_contract") or {}
    layout = dom.get("layout") or {}
    rim = layout.get("notebook_inner_bottom_rim") or {}

    if case.get("pass") is not True:
        fail(errors, f"screenshot case failed: {case_id}")
    if expected_size and (size.get("width"), size.get("height")) != expected_size:
        fail(errors, f"{case_id} screenshot dimensions mismatch: {size}")
    if case.get("screenshot_bytes", 0) < 25000:
        fail(errors, f"{case_id} screenshot too small")
    if dom.get("current_shell") != "R97B":
        fail(errors, f"{case_id} current shell must be R97B")
    if dom.get("r220b_shell_binding") != "true":
        fail(errors, f"{case_id} missing R220B shell binding")

    for key in (
        "derived_v2_polish",
        "derived_v2a_polish",
        "derived_v2b_polish",
        "derived_v2c_polish",
        "derived_v2d_polish",
        "v2d_derived_preview",
        "has_ownership_map",
        "has_resolve_shell_layer",
        "has_resolve_render_slot",
    ):
        if dom.get(key) is not True:
            fail(errors, f"{case_id} missing marker: {key}")

    if dom.get("primary_direction") != "C_NOTEBOOK_PAPER":
        fail(errors, f"{case_id} primary direction mismatch")
    if dom.get("stability_reference") != "A_TEACHER_WORKBENCH":
        fail(errors, f"{case_id} stability reference mismatch")
    if dom.get("toolbar_policy") != "kept-expanded-by-human-request":
        fail(errors, f"{case_id} toolbar policy must keep expanded tools")

    if dom.get("forbidden_visible_terms"):
        fail(errors, f"{case_id} leaked forbidden visible terms: {dom.get('forbidden_visible_terms')}")
    if dom.get("forbidden_accessible_terms"):
        fail(errors, f"{case_id} leaked forbidden accessible terms: {dom.get('forbidden_accessible_terms')}")

    for slot_id, slot in (dom.get("render_slots") or {}).items():
        if (slot or {}).get("found") is not True:
            fail(errors, f"{case_id} missing render slot: {slot_id}")

    if vc.get("toolbar_kept_expanded") is not True:
        fail(errors, f"{case_id} toolbar was not kept expanded")
    if num(vc.get("visible_tool_buttons")) < 10:
        fail(errors, f"{case_id} expanded toolbar has too few visible tools")
    if num(vc.get("toolbar_rows")) > 2:
        fail(errors, f"{case_id} toolbar wrapped into too many rows")
    if vc.get("primary_all_single_line") is not True:
        fail(errors, f"{case_id} primary toolbar actions are not single-line")
    if vc.get("primary_all_svg_icons") is not True:
        fail(errors, f"{case_id} primary toolbar icons are not inline SVG")

    paper_grid = str(vc.get("paper_grid_background") or "")
    canvas_grid = str(vc.get("canvas_grid_background") or "")
    if "rgba(46, 101, 78" not in paper_grid or "0.02" not in paper_grid:
        fail(errors, f"{case_id} notebook paper grid was not quieted")
    if "rgba(99, 103, 76" not in canvas_grid or "0.02" not in canvas_grid:
        fail(errors, f"{case_id} stage canvas grid was not quieted")
    if vc.get("paper_background_color") != "rgb(255, 253, 247)":
        fail(errors, f"{case_id} paper background color changed unexpectedly")

    if num(vc.get("left_panel_opacity"), 1) > 0.76:
        fail(errors, f"{case_id} left notebook panel remains too heavy")
    if num(vc.get("quiet_left_node_opacity"), 1) > 0.55:
        fail(errors, f"{case_id} non-current left items were not lowered")
    if num(vc.get("active_left_node_opacity")) < 0.98:
        fail(errors, f"{case_id} current left item is not clear enough")

    if vc.get("right_rail_summary_present") is not True:
        fail(errors, f"{case_id} right rail teacher margin note missing")
    if num(vc.get("right_rail_summary_item_count")) != 3:
        fail(errors, f"{case_id} right rail summary item count mismatch")
    if num(vc.get("right_rail_action_count")) > 2:
        fail(errors, f"{case_id} right rail action count exceeds 2")
    if vc.get("right_rail_copy_ok") is not True:
        fail(errors, f"{case_id} right rail copy is not teacher-facing")

    if vc.get("bottom_system_bar") is not True:
        fail(errors, f"{case_id} bottom Xiaojiao system bar marker missing")
    if not (56 <= num(vc.get("bottom_height")) <= 64):
        fail(errors, f"{case_id} bottom Xiaojiao height out of range")

    if num(rim.get("binder_to_panel")) < 12 or num(rim.get("binder_to_workspace")) < 12:
        fail(errors, f"{case_id} notebook inner bottom rim is too tight")
    if num(rim.get("binder_to_bottom_xiaojiao")) < 18:
        fail(errors, f"{case_id} notebook-to-Xiaojiao gap is too tight")
    if "rgba(95, 84, 56" not in str(rim.get("binder_border_bottom") or ""):
        fail(errors, f"{case_id} notebook bottom rim border missing")

    width = int((case.get("viewport") or {}).get("width") or 0)
    if width >= 1800:
        if layout.get("scene_full_width") is not True:
            fail(errors, f"{case_id} scene is not full width")
        if layout.get("right_rail_reaches_right") is not True:
            fail(errors, f"{case_id} right rail does not reach right side")
        if num((layout.get("lesson_workspace") or {}).get("width")) < (1350 if width >= 2400 else 980):
            fail(errors, f"{case_id} workspace still too narrow")


def validate(root: Path) -> dict:
    audit_dir = root / "outputs" / STAGE / PHASE
    errors: list[str] = []
    warnings: list[str] = []

    if not audit_dir.exists():
        fail(errors, f"missing audit dir: {audit_dir}")
        return {"ok": False, "errors": errors, "warnings": warnings}

    for rel in REQUIRED_FILES:
        target = audit_dir / rel
        if not target.exists():
            fail(errors, f"missing required file: {rel}")
        elif target.is_file() and target.stat().st_size == 0:
            fail(errors, f"empty required file: {rel}")

    for viewport in VIEWPORTS:
        rel = f"screenshots/v2d_selected_C_{viewport}.png"
        target = audit_dir / rel
        if not target.exists():
            fail(errors, f"missing screenshot: {rel}")

    source_abs = root / SOURCE_V2C
    derived_abs = root / DERIVED_V2D
    lock_path = audit_dir / "source_lock.json"
    if source_abs.exists() and derived_abs.exists() and lock_path.exists():
        lock = read_json(lock_path)
        actual_source_hash = sha256(source_abs)
        actual_derived_hash = sha256(derived_abs)
        if lock.get("source_v2c_sha256") != actual_source_hash:
            fail(errors, "source V2C hash changed after V2D derivation")
        if lock.get("derived_v2d_sha256") != actual_derived_hash:
            fail(errors, "derived V2D hash does not match source_lock")
        if actual_source_hash == actual_derived_hash:
            fail(errors, "derived V2D must differ from source V2C")
        if lock.get("source_v2c_modified") is not False:
            fail(errors, "source lock must record source_v2c_modified=false")

    manifest_path = audit_dir / "screenshot_manifest.json"
    if manifest_path.exists():
        manifest = read_json(manifest_path)
        if manifest.get("stage") != STAGE or manifest.get("phase") != PHASE:
            fail(errors, "manifest stage/phase mismatch")
        if manifest.get("build_stage") != BUILD_STAGE:
            fail(errors, "manifest build_stage mismatch")
        if manifest.get("current_visual_baseline") != "R97B":
            fail(errors, "manifest baseline must be R97B")
        if manifest.get("human_selected_direction") != "C_NOTEBOOK_PAPER":
            fail(errors, "manifest human selected direction must be C")
        if manifest.get("stability_reference") != "A_TEACHER_WORKBENCH":
            fail(errors, "manifest stability reference must be A")
        if manifest.get("toolbar_policy") != "kept-expanded-by-human-request":
            fail(errors, "manifest toolbar policy must keep expanded tools")
        if manifest.get("formal_apply") != "NOT_READY":
            fail(errors, "formal_apply must be NOT_READY")
        if manifest.get("source_v2c_modified") is not False:
            fail(errors, "manifest source_v2c_modified must be false")
        if manifest.get("pass") is not True:
            fail(errors, "screenshot manifest did not pass")
        cases = manifest.get("cases") or []
        if len(cases) != 3:
            fail(errors, f"expected 3 screenshot cases, got {len(cases)}")
        seen = {case.get("id") for case in cases}
        for viewport in VIEWPORTS:
            case_id = f"v2d_selected_C_{viewport}"
            if case_id not in seen:
                fail(errors, f"missing manifest case: {case_id}")
        for case in cases:
            validate_case(case, errors)

    smoke_path = audit_dir / "visual_smoke_result.json"
    if smoke_path.exists():
        smoke = read_json(smoke_path)
        if smoke.get("visual_smoke_completed") is not True:
            fail(errors, "visual smoke did not complete")
        if smoke.get("case_count") != 3 or smoke.get("fail_count") != 0 or smoke.get("pass") is not True:
            fail(errors, f"visual smoke count mismatch: {smoke}")

    return {
        "stage": STAGE,
        "phase": PHASE,
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "audit_dir": str(audit_dir),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    result = validate(root)
    out_path = Path(args.out) if args.out else root / "outputs" / STAGE / PHASE / "validator_result.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result.get("ok"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()

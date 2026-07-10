# Ninebot Vehicle Caption Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vehicle-aware captioning path for the merged FLUX LoRA dataset so captions teach `ninebot_style` plus the visible vehicle parts and view context.

**Architecture:** Extend the existing `ninebot_flux_lora_caption` custom node package with focused helpers and one new rule-based refinement node that can compose formal vehicle LoRA captions from visual caption text, optional WD14 tags, image paths, and source-group hints. Add a new ComfyUI caption workflow that keeps the current load/tag/save shape and defaults to dry-run review before writing sidecar `.txt` files.

**Tech Stack:** Python 3.11, ComfyUI custom nodes, existing `WD14Tagger|pysssss`, JSON ComfyUI workflows, PowerShell verification commands.

---

## File Structure

- Modify `custom_nodes/ninebot_flux_lora_caption/nodes.py`: add pure helper functions and a `NinebotVehicleCaptionRefine` node; keep existing dataset load and sidecar save behavior stable.
- Create `custom_nodes/ninebot_flux_lora_caption/tests/test_vehicle_caption_refine.py`: focused unit tests for helper behavior and node output using Python's `unittest`.
- Create `user/ninebot_flux_lora_training/workflows/01_打标工作流_车辆部件视觉理解版.json`: a dry-run-first workflow for the merged dataset.
- Create `docs/superpowers/plans/2026-06-30-ninebot-vehicle-caption-workflow.md`: this implementation plan.

## Task 1: Caption Refinement Helpers

**Files:**
- Modify: `custom_nodes/ninebot_flux_lora_caption/nodes.py`
- Test: `custom_nodes/ninebot_flux_lora_caption/tests/test_vehicle_caption_refine.py`

- [ ] **Step 1: Add failing tests for vehicle caption composition**

Create `custom_nodes/ninebot_flux_lora_caption/tests/test_vehicle_caption_refine.py` with:

```python
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from nodes import _compose_vehicle_caption, _source_group_from_path


class VehicleCaptionRefineTests(unittest.TestCase):
    def test_style_caption_keeps_trigger_and_vehicle_parts(self):
        caption = _compose_vehicle_caption(
            trigger="ninebot_style",
            image_path=r"C:\data\style\0001_style_front.png",
            visual_caption="front three-quarter view, large front windscreen, angular white gray body panels",
            wd14_tags="vehicle, product render, grey background",
            source_hint="auto",
        )
        self.assertTrue(caption.startswith("ninebot_style, "))
        self.assertIn("futuristic three-wheeled electric motorcycle concept", caption)
        self.assertIn("front three-quarter view", caption)
        self.assertIn("large front windscreen", caption)
        self.assertIn("angular white gray body panels", caption)
        self.assertIn("studio product render", caption)

    def test_cutout_caption_uses_cutout_context(self):
        caption = _compose_vehicle_caption(
            trigger="ninebot_style",
            image_path=r"C:\data\cutout\0001_cutout_vehicle.png",
            visual_caption="isolated vehicle, black wheels, white body shell",
            wd14_tags="transparent background",
            source_hint="auto",
        )
        self.assertIn("isolated vehicle cutout", caption)
        self.assertIn("clean product silhouette", caption)
        self.assertIn("black wheels", caption)

    def test_view_caption_uses_reference_sheet_context(self):
        caption = _compose_vehicle_caption(
            trigger="ninebot_style",
            image_path=r"C:\data\view\Xyber_0001.png",
            visual_caption="side view and front view, compact vehicle body, black wheels",
            wd14_tags="reference sheet",
            source_hint="auto",
        )
        self.assertIn("multi angle reference sheet", caption)
        self.assertIn("side view", caption)
        self.assertIn("front view", caption)

    def test_deduplicates_and_removes_old_trigger(self):
        caption = _compose_vehicle_caption(
            trigger="ninebot_style",
            image_path=r"C:\data\style\image.png",
            visual_caption="ninebot_motorcycle_style, ninebot_style, black wheels, black wheels",
            wd14_tags="black wheels",
            source_hint="style",
        )
        self.assertEqual(caption.count("ninebot_style"), 1)
        self.assertNotIn("ninebot_motorcycle_style", caption)
        self.assertEqual(caption.count("black wheels"), 1)

    def test_source_group_from_path(self):
        self.assertEqual(_source_group_from_path(r"C:\data\view\Xyber_0001.png"), "view")
        self.assertEqual(_source_group_from_path(r"C:\data\cutout\img.png"), "cutout")
        self.assertEqual(_source_group_from_path(r"C:\data\抠图\img.png"), "cutout")
        self.assertEqual(_source_group_from_path(r"C:\data\style\img.png"), "style")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
C:\Users\ninebot\ComfyUI_windows_portable\python_embeded\python.exe -m unittest custom_nodes.ninebot_flux_lora_caption.tests.test_vehicle_caption_refine -v
```

Expected: failure or import error because `_compose_vehicle_caption` and `_source_group_from_path` do not exist yet.

- [ ] **Step 3: Add helper functions to `nodes.py`**

Add these functions below `_compose_caption`:

```python
def _source_group_from_path(image_path):
    parts = [part.lower() for part in Path(str(image_path)).parts]
    name = Path(str(image_path)).name.lower()
    text = " ".join(parts + [name])
    if "cutout" in text or "抠图" in text:
        return "cutout"
    if "view" in text or "xyber" in text:
        return "view"
    if "style" in text:
        return "style"
    return "style"


def _compose_vehicle_caption(trigger, image_path, visual_caption="", wd14_tags="", source_hint="auto"):
    trigger = str(trigger).strip()
    if not trigger:
        raise ValueError("trigger must not be empty")

    source = str(source_hint or "auto").strip().lower()
    if source == "auto":
        source = _source_group_from_path(image_path)

    raw_text = f"{visual_caption}, {wd14_tags}".lower()

    parts = [
        trigger,
        "futuristic three-wheeled electric motorcycle concept",
    ]

    if source == "view":
        parts.append("multi angle reference sheet")
    elif source == "cutout":
        parts.append("isolated vehicle cutout")
    else:
        parts.append("studio product render")

    feature_map = [
        ("front three-quarter view", ["front three-quarter", "three-quarter", "3/4"]),
        ("front view", ["front view", "front-facing", "front facing"]),
        ("side view", ["side view", "profile view"]),
        ("rear view", ["rear view", "back view"]),
        ("large front windscreen", ["windscreen", "windshield", "front glass"]),
        ("angular white gray body panels", ["angular", "white", "gray", "grey", "body panel"]),
        ("black wheels", ["black wheels", "black wheel", "dark wheels", "dark wheel"]),
        ("wide rear wheel stance", ["wide rear", "rear wheel stance", "wide stance"]),
        ("compact electric vehicle body", ["compact", "electric vehicle", "electric motorcycle"]),
        ("clean product silhouette", ["silhouette", "isolated", "cutout", "transparent"]),
        ("neutral background", ["neutral background", "gray background", "grey background", "transparent background"]),
    ]

    for phrase, needles in feature_map:
        if any(needle in raw_text for needle in needles):
            parts.append(phrase)

    if source == "cutout":
        parts.extend(["clean product silhouette", "neutral background"])
    elif source == "view":
        parts.append("product design reference")
    else:
        parts.extend(["studio product photography", "neutral background"])

    blocked = {"ninebot_motorcycle_style", "ninebot_style"}
    deduped = []
    seen = set()
    for part in parts:
        cleaned = str(part).strip().strip(",")
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in blocked and cleaned != trigger:
            continue
        if key in seen:
            continue
        seen.add(key)
        deduped.append(cleaned)
    return ", ".join(deduped)
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```powershell
C:\Users\ninebot\ComfyUI_windows_portable\python_embeded\python.exe -m unittest custom_nodes.ninebot_flux_lora_caption.tests.test_vehicle_caption_refine -v
```

Expected: all tests pass.

## Task 2: New ComfyUI Refine Node

**Files:**
- Modify: `custom_nodes/ninebot_flux_lora_caption/nodes.py`
- Test: `custom_nodes/ninebot_flux_lora_caption/tests/test_vehicle_caption_refine.py`

- [ ] **Step 1: Add failing test for node list behavior**

Append this test method to `VehicleCaptionRefineTests`:

```python
    def test_refine_node_handles_batched_lists(self):
        from nodes import NinebotVehicleCaptionRefine

        node = NinebotVehicleCaptionRefine()
        result = node.refine(
            image_paths=[
                r"C:\data\style\0001.png",
                r"C:\data\view\Xyber_0001.png",
            ],
            visual_caption=[
                "front three-quarter view, large front windscreen",
                "side view and front view, black wheels",
            ],
            wd14_tags=[
                "product render",
                "reference sheet",
            ],
            trigger_word=["ninebot_style"],
            source_hint=["auto"],
        )
        captions = result["result"][0]
        self.assertEqual(len(captions), 2)
        self.assertTrue(captions[0].startswith("ninebot_style, "))
        self.assertIn("front three-quarter view", captions[0])
        self.assertIn("multi angle reference sheet", captions[1])
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
C:\Users\ninebot\ComfyUI_windows_portable\python_embeded\python.exe -m unittest custom_nodes.ninebot_flux_lora_caption.tests.test_vehicle_caption_refine.VehicleCaptionRefineTests.test_refine_node_handles_batched_lists -v
```

Expected: failure because `NinebotVehicleCaptionRefine` is not defined.

- [ ] **Step 3: Add `NinebotVehicleCaptionRefine` to `nodes.py`**

Add this class before `NODE_CLASS_MAPPINGS`:

```python
class NinebotVehicleCaptionRefine:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_paths": ("STRING", {"forceInput": True}),
                "visual_caption": ("STRING", {"forceInput": True}),
                "trigger_word": (
                    "STRING",
                    {
                        "default": "ninebot_style",
                        "multiline": False,
                        "tooltip": "Caption trigger word. Formal dataset captions should start with this token.",
                    },
                ),
                "source_hint": (
                    ["auto", "style", "view", "cutout"],
                    {
                        "default": "auto",
                        "tooltip": "Use auto for folder/file detection, or force a source group.",
                    },
                ),
            },
            "optional": {
                "wd14_tags": ("STRING", {"forceInput": True}),
            },
        }

    INPUT_IS_LIST = True
    OUTPUT_IS_LIST = (True,)
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("captions",)
    FUNCTION = "refine"
    CATEGORY = "Ninebot/FLUX LoRA Caption"

    def refine(self, image_paths, visual_caption, trigger_word, source_hint, wd14_tags=None):
        paths = image_paths
        visual_values = _as_list(visual_caption, len(paths))
        wd14_values = _as_list(wd14_tags or [""], len(paths))
        trigger = _first(trigger_word).strip()
        hint = _first(source_hint).strip() or "auto"

        captions = []
        for path, visual, wd14 in zip(paths, visual_values, wd14_values):
            captions.append(
                _compose_vehicle_caption(
                    trigger=trigger,
                    image_path=path,
                    visual_caption=str(visual),
                    wd14_tags=str(wd14),
                    source_hint=hint,
                )
            )
        return {"ui": {"text": captions[:20]}, "result": (captions,)}
```

Add this helper near `_first`:

```python
def _as_list(value, length):
    if isinstance(value, (list, tuple)):
        values = list(value)
    else:
        values = [value]
    if len(values) == length:
        return values
    if len(values) == 1:
        return values * length
    raise ValueError(f"Expected 1 or {length} values, got {len(values)}.")
```

Update mappings:

```python
NODE_CLASS_MAPPINGS = {
    "NinebotCaptionDatasetLoad": NinebotCaptionDatasetLoad,
    "NinebotCaptionSidecarSave": NinebotCaptionSidecarSave,
    "NinebotVehicleCaptionRefine": NinebotVehicleCaptionRefine,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NinebotCaptionDatasetLoad": "Ninebot Caption Dataset Load",
    "NinebotCaptionSidecarSave": "Ninebot Caption Sidecar Save",
    "NinebotVehicleCaptionRefine": "Ninebot Vehicle Caption Refine",
}
```

- [ ] **Step 4: Run all caption tests**

Run:

```powershell
C:\Users\ninebot\ComfyUI_windows_portable\python_embeded\python.exe -m unittest custom_nodes.ninebot_flux_lora_caption.tests.test_vehicle_caption_refine -v
```

Expected: all tests pass.

## Task 3: Dry-Run Vehicle Caption Workflow

**Files:**
- Create: `user/ninebot_flux_lora_training/workflows/01_打标工作流_车辆部件视觉理解版.json`

- [ ] **Step 1: Create workflow JSON**

Create `user/ninebot_flux_lora_training/workflows/01_打标工作流_车辆部件视觉理解版.json` with these nodes:

```json
{
  "last_node_id": 4,
  "last_link_id": 5,
  "nodes": [
    {
      "id": 1,
      "type": "NinebotCaptionDatasetLoad",
      "pos": [-900, -160],
      "size": [560, 230],
      "flags": {},
      "order": 0,
      "mode": 0,
      "inputs": [],
      "outputs": [
        {"name": "images", "type": "IMAGE", "links": [1], "slot_index": 0, "shape": 3},
        {"name": "image_paths", "type": "STRING", "links": [2, 4], "slot_index": 1, "shape": 3},
        {"name": "dataset_dir", "type": "STRING", "links": null, "slot_index": 2, "shape": 3}
      ],
      "properties": {"Node name for S&R": "NinebotCaptionDatasetLoad"},
      "widgets_values": [
        "C:\\Users\\ninebot\\ComfyUI_windows_portable\\ComfyUI\\user\\ninebot_flux_lora_training\\datasets\\motorcycle_flux_v002_merged_ninebot_style_1024\\style",
        10,
        true
      ],
      "title": "1. 读取合并训练图片"
    },
    {
      "id": 2,
      "type": "WD14Tagger|pysssss",
      "pos": [-170, -190],
      "size": [460, 320],
      "flags": {},
      "order": 1,
      "mode": 0,
      "inputs": [{"name": "image", "type": "IMAGE", "link": 1}],
      "outputs": [{"name": "STRING", "type": "STRING", "links": [3], "slot_index": 0, "shape": 3}],
      "properties": {"Node name for S&R": "WD14Tagger|pysssss"},
      "widgets_values": [
        "wd-v1-4-moat-tagger-v2",
        0.35,
        0.85,
        true,
        false,
        "person, human, girl, boy, text, watermark, logo"
      ],
      "title": "2. WD14 辅助标签"
    },
    {
      "id": 4,
      "type": "NinebotVehicleCaptionRefine",
      "pos": [430, -180],
      "size": [560, 300],
      "flags": {},
      "order": 2,
      "mode": 0,
      "inputs": [
        {"name": "image_paths", "type": "STRING", "link": 4},
        {"name": "visual_caption", "type": "STRING", "link": 3},
        {"name": "wd14_tags", "type": "STRING", "link": 3}
      ],
      "outputs": [{"name": "captions", "type": "STRING", "links": [5], "slot_index": 0, "shape": 3}],
      "properties": {"Node name for S&R": "NinebotVehicleCaptionRefine"},
      "widgets_values": [
        "ninebot_style",
        "auto"
      ],
      "title": "3. 车辆部件 Caption 规范化"
    },
    {
      "id": 3,
      "type": "NinebotCaptionSidecarSave",
      "pos": [1120, -160],
      "size": [520, 300],
      "flags": {},
      "order": 3,
      "mode": 0,
      "inputs": [
        {"name": "image_paths", "type": "STRING", "link": 2},
        {"name": "tags", "type": "STRING", "link": 5}
      ],
      "outputs": [],
      "properties": {"Node name for S&R": "NinebotCaptionSidecarSave"},
      "widgets_values": [
        "ninebot_style",
        ", ",
        false,
        true
      ],
      "title": "4. Dry Run 保存审核清单"
    }
  ],
  "links": [
    [1, 1, 0, 2, 0, "IMAGE"],
    [2, 1, 1, 3, 0, "STRING"],
    [3, 2, 0, 4, 1, "STRING"],
    [4, 1, 1, 4, 0, "STRING"],
    [5, 4, 0, 3, 1, "STRING"]
  ],
  "groups": [
    {
      "title": "1. 车辆部件导向 Caption 打标",
      "bounding": [-950, -280, 2700, 580],
      "color": "#3f789e",
      "font_size": 24,
      "flags": {}
    }
  ],
  "config": {},
  "extra": {
    "ninebot_notes": {
      "purpose": "Dry-run first vehicle-aware caption workflow for the merged ninebot_style FLUX LoRA dataset.",
      "dry_run_default": true,
      "next_step": "After reviewing _ninebot_caption_manifest.json, set max_images=0 and dry_run=false to write captions."
    }
  },
  "version": 0.4
}
```

- [ ] **Step 2: Validate JSON**

Run:

```powershell
$p='C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\workflows\01_打标工作流_车辆部件视觉理解版.json'
Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
'JSON_OK'
```

Expected: `JSON_OK`.

## Task 4: Verification and Manual Smoke Test

**Files:**
- Modify: no files unless a previous task fails.

- [ ] **Step 1: Run unit tests**

Run:

```powershell
C:\Users\ninebot\ComfyUI_windows_portable\python_embeded\python.exe -m unittest custom_nodes.ninebot_flux_lora_caption.tests.test_vehicle_caption_refine -v
```

Expected: all tests pass.

- [ ] **Step 2: Restart ComfyUI or reload custom nodes**

Restart the ComfyUI process that runs on port `8089`, then open the new workflow. Expected: the new node `Ninebot Vehicle Caption Refine` is available and the workflow has no missing-node errors.

- [ ] **Step 3: Run dry-run smoke test with 10 images**

Run the new workflow with:

```text
max_images: 10
include_existing_txt: true
dry_run: true
overwrite_existing_txt: false
```

Expected: no `.txt` files are overwritten; `_ninebot_caption_manifest.json` is written in the dataset directory.

- [ ] **Step 4: Inspect manifest output**

Open:

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\datasets\motorcycle_flux_v002_merged_ninebot_style_1024\style\_ninebot_caption_manifest.json
```

Expected: preview captions start with `ninebot_style,` and include vehicle/style terms such as `futuristic three-wheeled electric motorcycle concept`, `angular white gray body panels`, `black wheels`, `front windscreen`, `multi angle reference sheet`, or `isolated vehicle cutout` when the related source group or visual text supports them.

- [ ] **Step 5: Report results**

Report:

```text
Unit tests: pass/fail
Workflow JSON: valid/invalid
Dry-run manifest: generated/not generated
Caption quality: acceptable / needs refinement
```

Do not overwrite the full dataset captions until the dry-run manifest has been reviewed.

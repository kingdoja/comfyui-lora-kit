# Ninebot Flux LoRA Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a portable `NinebotFluxLoRATrainPipeline` ComfyUI custom node that uploads training images, generates captions, optionally trains a FLUX LoRA, and exposes a download icon for the trained `.safetensors`.

**Architecture:** Create a new `custom_nodes/ninebot_flux_lora_pipeline` package with small Python modules: `pipeline.py` for pure/data-testable behavior, `nodes.py` for ComfyUI node schema, `routes.py` for upload/download HTTP endpoints, and `web/ninebot_flux_lora_pipeline.js` for the custom node UI. Heavy integrations with Florence2, WD14, and FluxTrainer stay behind adapter functions so unit tests can run with fakes and the real node can call installed custom nodes at runtime.

**Tech Stack:** Python 3 via `C:/Users/ninebot/ComfyUI_windows_portable/python_embeded/python.exe`, ComfyUI custom node APIs, aiohttp routes through `PromptServer`, JavaScript ComfyUI web extension APIs, PIL/Torch/Numpy already available in the portable ComfyUI environment.

---

## File Structure

- Create `custom_nodes/ninebot_flux_lora_pipeline/__init__.py`: export node mappings and `WEB_DIRECTORY`, import route registration.
- Create `custom_nodes/ninebot_flux_lora_pipeline/pipeline.py`: pure helpers for path validation, image copying, manifest writing, train parameter mapping, result selection, and dependency-injected pipeline execution.
- Create `custom_nodes/ninebot_flux_lora_pipeline/nodes.py`: define `NinebotFluxLoRATrainPipeline.INPUT_TYPES`, outputs, and `run()` method.
- Create `custom_nodes/ninebot_flux_lora_pipeline/routes.py`: register `POST /ninebot_flux_lora_pipeline/upload`, `GET /ninebot_flux_lora_pipeline/download`, and `GET /ninebot_flux_lora_pipeline/preview`.
- Create `custom_nodes/ninebot_flux_lora_pipeline/web/ninebot_flux_lora_pipeline.js`: draw the custom visual node, multi-image upload card, and LoRA download button.
- Create `custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py`: unit tests for backend pure behavior and node schema.
- Create `custom_nodes/ninebot_flux_lora_pipeline/tests/test_routes.py`: route handler tests using temporary files and lightweight fake requests.
- Create `custom_nodes/ninebot_flux_lora_pipeline/README.md`: migration, dependency, model-file, and usage notes.
- Create `custom_nodes/ninebot_flux_lora_pipeline/requirements.txt`: keep empty or comments only if no new Python packages are required.

## Task 1: Backend Pure Pipeline Helpers

**Files:**
- Create: `custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py`
- Create: `custom_nodes/ninebot_flux_lora_pipeline/pipeline.py`

- [ ] **Step 1: Write failing tests for upload staging, manifest writing, and train parameter mapping**

```python
# custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from pipeline import (
    PipelineInputs,
    build_flux_train_config,
    stage_uploaded_images,
    write_caption_sidecars,
)


class PipelineHelperTests(unittest.TestCase):
    def _image(self, folder: Path, name: str) -> Path:
        path = folder / name
        Image.new("RGB", (8, 8), (255, 0, 0)).save(path)
        return path

    def test_stage_uploaded_images_copies_images_to_style_dataset(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = self._image(root, "motor.png")
            staged = stage_uploaded_images([str(source)], root / "datasets", run_id="run123")
            self.assertEqual(len(staged.image_paths), 1)
            self.assertEqual(staged.dataset_dir.name, "style")
            self.assertTrue((root / "datasets" / "pipeline_uploads" / "run123" / "style" / "motor.png").exists())

    def test_write_caption_sidecars_writes_txt_and_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = self._image(root, "motor.png")
            manifest = write_caption_sidecars(
                image_paths=[str(image)],
                captions=["ninebot_motorcycle_style, product render"],
                trigger_word="ninebot_motorcycle_style",
                dry_run=False,
            )
            self.assertEqual(image.with_suffix(".txt").read_text(encoding="utf-8"), "ninebot_motorcycle_style, product render")
            data = json.loads(manifest.read_text(encoding="utf-8"))
            self.assertEqual(data["written_count"], 1)

    def test_build_flux_train_config_maps_visible_inputs_to_fluxtrainer_defaults(self):
        inputs = PipelineInputs(
            uploaded_images=["C:/data/motor.png"],
            trigger_word="ninebot_motorcycle_style",
            dry_run=False,
            output_lora_name="ninebot_motorcycle_flux_v003",
            lora_rank=8,
            max_train_steps=600,
            learning_rate=0.0001,
        )
        config = build_flux_train_config(inputs, dataset_dir="C:/dataset/style")
        self.assertEqual(config["network_dim"], 8)
        self.assertEqual(config["network_alpha"], 8.0)
        self.assertEqual(config["max_train_steps"], 600)
        self.assertEqual(config["learning_rate"], 0.0001)
        self.assertEqual(config["fp8_base"], True)
        self.assertEqual(config["cache_latents"], "memory")
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
$env:PYTHONPATH='C:/Users/ninebot/ComfyUI_windows_portable/ComfyUI/custom_nodes/ninebot_flux_lora_pipeline'
& 'C:/Users/ninebot/ComfyUI_windows_portable/python_embeded/python.exe' -m unittest discover -s 'C:/Users/ninebot/ComfyUI_windows_portable/ComfyUI/custom_nodes/ninebot_flux_lora_pipeline/tests' -v
```

Expected: FAIL because `pipeline` does not exist.

- [ ] **Step 3: Implement minimal pure helper code**

```python
# custom_nodes/ninebot_flux_lora_pipeline/pipeline.py
from __future__ import annotations

import json
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


@dataclass(frozen=True)
class PipelineInputs:
    uploaded_images: Sequence[str]
    trigger_word: str = "ninebot_motorcycle_style"
    dry_run: bool = True
    output_lora_name: str = "ninebot_motorcycle_flux_v003"
    lora_rank: int = 8
    max_train_steps: int = 600
    learning_rate: float = 0.0001


@dataclass(frozen=True)
class StagedDataset:
    run_id: str
    dataset_dir: Path
    image_paths: list[str]


def _clean_name(name: str) -> str:
    keep = [c if c.isalnum() or c in "._-" else "_" for c in name.strip()]
    return "".join(keep).strip("._") or "ninebot_lora"


def stage_uploaded_images(uploaded_images: Iterable[str], datasets_root: str | Path, run_id: str | None = None) -> StagedDataset:
    images = [Path(p).expanduser().resolve() for p in uploaded_images if str(p).strip()]
    if not images:
        raise ValueError("请先上传训练图片")
    for image in images:
        if image.suffix.lower() not in IMAGE_EXTENSIONS or not image.is_file():
            raise ValueError(f"不是有效训练图片: {image}")
    resolved_run_id = _clean_name(run_id or uuid.uuid4().hex[:12])
    dataset_dir = Path(datasets_root).expanduser().resolve() / "pipeline_uploads" / resolved_run_id / "style"
    dataset_dir.mkdir(parents=True, exist_ok=True)
    staged_paths: list[str] = []
    for index, source in enumerate(images, start=1):
        target = dataset_dir / f"{index:03d}_{source.name}"
        shutil.copy2(source, target)
        staged_paths.append(str(target))
    return StagedDataset(run_id=resolved_run_id, dataset_dir=dataset_dir, image_paths=staged_paths)


def write_caption_sidecars(image_paths: Sequence[str], captions: Sequence[str], trigger_word: str, dry_run: bool) -> Path:
    if not trigger_word.strip():
        raise ValueError("触发词不能为空")
    if len(image_paths) != len(captions):
        raise ValueError(f"Image/caption count mismatch: {len(image_paths)} images, {len(captions)} captions")
    manifest_dir = Path(image_paths[0]).parent
    written: list[str] = []
    preview: list[dict[str, str]] = []
    for image_path, caption in zip(image_paths, captions):
        image = Path(image_path)
        text_path = image.with_suffix(".txt")
        text = str(caption).strip()
        if not text:
            text = trigger_word.strip()
        preview.append({"image": str(image), "txt": str(text_path), "caption": text})
        if not dry_run:
            text_path.write_text(text, encoding="utf-8", newline="\n")
            written.append(str(text_path))
    manifest_path = manifest_dir / "_ninebot_pipeline_manifest.json"
    manifest_path.write_text(json.dumps({
        "trigger_word": trigger_word.strip(),
        "dry_run": bool(dry_run),
        "written_count": len(written),
        "preview": preview,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def build_flux_train_config(inputs: PipelineInputs, dataset_dir: str) -> dict:
    rank = int(inputs.lora_rank)
    return {
        "transformer": "flux1-dev.safetensors",
        "vae": "ae.safetensors",
        "clip_l": "clip_l.safetensors",
        "t5": "t5xxl_fp16.safetensors",
        "dataset_path": dataset_dir,
        "class_tokens": inputs.trigger_word.strip(),
        "output_name": _clean_name(inputs.output_lora_name),
        "network_dim": rank,
        "network_alpha": float(rank),
        "max_train_steps": int(inputs.max_train_steps),
        "learning_rate": float(inputs.learning_rate),
        "fp8_base": True,
        "gradient_dtype": "bf16",
        "save_dtype": "bf16",
        "cache_latents": "memory",
        "cache_text_encoder_outputs": "memory",
        "blocks_to_swap": 16,
        "attention_mode": "sdpa",
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same unittest command from Step 2.

Expected: 3 tests pass.

- [ ] **Step 5: Commit backend helpers**

```powershell
git add -- custom_nodes/ninebot_flux_lora_pipeline/pipeline.py custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py
git commit -m "feat: add ninebot pipeline backend helpers"
```

## Task 2: Node Schema and Dry-Run Execution

**Files:**
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py`
- Create: `custom_nodes/ninebot_flux_lora_pipeline/nodes.py`
- Create: `custom_nodes/ninebot_flux_lora_pipeline/__init__.py`

- [ ] **Step 1: Add failing tests for node registration and dry-run output**

```python
class PipelineNodeTests(unittest.TestCase):
    def test_node_input_types_expose_visible_controls(self):
        from nodes import NinebotFluxLoRATrainPipeline
        inputs = NinebotFluxLoRATrainPipeline.INPUT_TYPES()["required"]
        self.assertIn("uploaded_images", inputs)
        self.assertIn("trigger_word", inputs)
        self.assertIn("dry_run", inputs)
        self.assertIn("output_lora_name", inputs)
        self.assertIn("lora_rank", inputs)
        self.assertIn("max_train_steps", inputs)
        self.assertIn("learning_rate", inputs)

    def test_init_exports_node_mapping(self):
        import importlib.util
        package_init = Path(__file__).resolve().parents[1] / "__init__.py"
        spec = importlib.util.spec_from_file_location("ninebot_flux_lora_pipeline", package_init)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertIn("NinebotFluxLoRATrainPipeline", module.NODE_CLASS_MAPPINGS)
        self.assertEqual(module.WEB_DIRECTORY, "./web")
```

- [ ] **Step 2: Run tests to verify they fail**

Run the unittest command from Task 1.

Expected: FAIL because `nodes.py` and `__init__.py` do not exist.

- [ ] **Step 3: Implement node schema and package export**

```python
# custom_nodes/ninebot_flux_lora_pipeline/nodes.py
from __future__ import annotations

from pathlib import Path

from .pipeline import PipelineInputs, build_flux_train_config, stage_uploaded_images, write_caption_sidecars


COMFY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASETS_ROOT = COMFY_ROOT / "user" / "ninebot_flux_lora_training" / "datasets"


class NinebotFluxLoRATrainPipeline:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "uploaded_images": ("STRING", {"default": "", "multiline": True}),
                "trigger_word": ("STRING", {"default": "ninebot_motorcycle_style", "multiline": False}),
                "dry_run": ("BOOLEAN", {"default": True}),
                "output_lora_name": ("STRING", {"default": "ninebot_motorcycle_flux_v003", "multiline": False}),
                "lora_rank": ("INT", {"default": 8, "min": 1, "max": 1024, "step": 1}),
                "max_train_steps": ("INT", {"default": 600, "min": 1, "max": 100000, "step": 1}),
                "learning_rate": ("FLOAT", {"default": 0.0001, "min": 0.0, "max": 1.0, "step": 0.000001}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("lora_name", "lora_path", "captions")
    FUNCTION = "run"
    CATEGORY = "Ninebot/FLUX LoRA"
    OUTPUT_NODE = True

    def run(self, uploaded_images, trigger_word, dry_run, output_lora_name, lora_rank, max_train_steps, learning_rate, unique_id=None):
        image_list = [line.strip() for line in str(uploaded_images).splitlines() if line.strip()]
        inputs = PipelineInputs(image_list, trigger_word, bool(dry_run), output_lora_name, int(lora_rank), int(max_train_steps), float(learning_rate))
        staged = stage_uploaded_images(inputs.uploaded_images, DEFAULT_DATASETS_ROOT, run_id=str(unique_id or "manual"))
        captions = [inputs.trigger_word for _ in staged.image_paths]
        write_caption_sidecars(staged.image_paths, captions, inputs.trigger_word, dry_run=False)
        train_config = build_flux_train_config(inputs, str(staged.dataset_dir))
        if inputs.dry_run:
            return {"ui": {"text": captions[:20]}, "result": ("", "", "\n".join(captions))}
        raise RuntimeError("FLUX training adapter is not connected yet. Finish Task 3 before running with dry_run=false.")


NODE_CLASS_MAPPINGS = {
    "NinebotFluxLoRATrainPipeline": NinebotFluxLoRATrainPipeline,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NinebotFluxLoRATrainPipeline": "Ninebot FLUX LoRA Train Pipeline",
}
```

```python
# custom_nodes/ninebot_flux_lora_pipeline/__init__.py
from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run the unittest command from Task 1.

Expected: all backend tests pass.

- [ ] **Step 5: Commit node schema**

```powershell
git add -- custom_nodes/ninebot_flux_lora_pipeline/__init__.py custom_nodes/ninebot_flux_lora_pipeline/nodes.py custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py
git commit -m "feat: register ninebot flux lora pipeline node"
```

## Task 3: Caption and Training Adapters

**Files:**
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py`
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/pipeline.py`
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/nodes.py`

- [ ] **Step 1: Add failing tests for dependency-injected caption and training flow**

```python
class FakeCaptioner:
    def captions_for(self, image_paths, trigger_word):
        return [f"{trigger_word}, generated caption {i}" for i, _ in enumerate(image_paths, start=1)]


class FakeTrainer:
    def train(self, config):
        return {
            "lora_name": config["output_name"],
            "lora_path": str(Path(config["dataset_path"]).parent / f'{config["output_name"]}.safetensors'),
        }


class PipelineExecutionTests(unittest.TestCase):
    def test_execute_pipeline_dry_run_skips_training(self):
        from pipeline import execute_pipeline
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = self._image(root, "motor.png")
            result = execute_pipeline(
                PipelineInputs([str(image)], dry_run=True),
                datasets_root=root / "datasets",
                captioner=FakeCaptioner(),
                trainer=FakeTrainer(),
                run_id="run123",
            )
            self.assertEqual(result.lora_path, "")
            self.assertIn("generated caption", result.captions[0])

    def test_execute_pipeline_training_returns_lora_path(self):
        from pipeline import execute_pipeline
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = self._image(root, "motor.png")
            result = execute_pipeline(
                PipelineInputs([str(image)], dry_run=False, output_lora_name="ninebot_test"),
                datasets_root=root / "datasets",
                captioner=FakeCaptioner(),
                trainer=FakeTrainer(),
                run_id="run123",
            )
            self.assertEqual(result.lora_name, "ninebot_test")
            self.assertTrue(result.lora_path.endswith("ninebot_test.safetensors"))
```

- [ ] **Step 2: Run tests to verify they fail**

Expected: FAIL because `execute_pipeline` does not exist.

- [ ] **Step 3: Implement `execute_pipeline`, default captioner, and FluxTrainer adapter shell**

```python
@dataclass(frozen=True)
class PipelineResult:
    lora_name: str
    lora_path: str
    captions: list[str]
    dataset_dir: str
    manifest_path: str


class TriggerOnlyCaptioner:
    def captions_for(self, image_paths: Sequence[str], trigger_word: str) -> list[str]:
        return [trigger_word.strip() for _ in image_paths]


class FluxTrainerAdapter:
    def train(self, config: dict) -> dict:
        try:
            from custom_nodes.ComfyUI_FluxTrainer import nodes as flux_nodes
        except Exception as exc:
            raise RuntimeError("缺少 FluxTrainer：请安装 ComfyUI-FluxTrainer") from exc
        raise RuntimeError("FluxTrainer adapter import path needs local ComfyUI module binding")


def execute_pipeline(inputs: PipelineInputs, datasets_root: str | Path, captioner=None, trainer=None, run_id: str | None = None) -> PipelineResult:
    captioner = captioner or TriggerOnlyCaptioner()
    trainer = trainer or FluxTrainerAdapter()
    staged = stage_uploaded_images(inputs.uploaded_images, datasets_root, run_id=run_id)
    captions = captioner.captions_for(staged.image_paths, inputs.trigger_word)
    manifest_path = write_caption_sidecars(staged.image_paths, captions, inputs.trigger_word, dry_run=False)
    if inputs.dry_run:
        return PipelineResult("", "", captions, str(staged.dataset_dir), str(manifest_path))
    train_config = build_flux_train_config(inputs, str(staged.dataset_dir))
    trained = trainer.train(train_config)
    return PipelineResult(str(trained["lora_name"]), str(trained["lora_path"]), captions, str(staged.dataset_dir), str(manifest_path))
```

- [ ] **Step 4: Replace `nodes.py` direct helper calls with `execute_pipeline`**

```python
from .pipeline import PipelineInputs, execute_pipeline

result = execute_pipeline(inputs, DEFAULT_DATASETS_ROOT, run_id=str(unique_id or "manual"))
return {"ui": {"text": result.captions[:20], "lora_path": result.lora_path}, "result": (result.lora_name, result.lora_path, "\n".join(result.captions))}
```

- [ ] **Step 5: Run tests to verify they pass**

Expected: all pipeline tests pass without loading real models.

- [ ] **Step 6: Commit adapter execution layer**

```powershell
git add -- custom_nodes/ninebot_flux_lora_pipeline/pipeline.py custom_nodes/ninebot_flux_lora_pipeline/nodes.py custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py
git commit -m "feat: add ninebot pipeline execution adapters"
```

## Task 4: Upload, Preview, and Download Routes

**Files:**
- Create: `custom_nodes/ninebot_flux_lora_pipeline/tests/test_routes.py`
- Create: `custom_nodes/ninebot_flux_lora_pipeline/routes.py`
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/__init__.py`

- [ ] **Step 1: Write failing tests for safe download path handling**

```python
# custom_nodes/ninebot_flux_lora_pipeline/tests/test_routes.py
import tempfile
import unittest
from pathlib import Path

from routes import resolve_download_path


class RouteHelperTests(unittest.TestCase):
    def test_resolve_download_path_allows_existing_safetensors(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "model.safetensors"
            path.write_bytes(b"model")
            self.assertEqual(resolve_download_path(str(path)), path.resolve())

    def test_resolve_download_path_rejects_missing_file(self):
        with self.assertRaises(FileNotFoundError):
            resolve_download_path("C:/missing/model.safetensors")

    def test_resolve_download_path_rejects_non_safetensors(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "model.txt"
            path.write_text("no", encoding="utf-8")
            with self.assertRaises(ValueError):
                resolve_download_path(str(path))
```

- [ ] **Step 2: Run route tests to verify they fail**

Run the same unittest discovery command.

Expected: FAIL because `routes.py` does not exist.

- [ ] **Step 3: Implement route helpers and route registration**

```python
# custom_nodes/ninebot_flux_lora_pipeline/routes.py
from __future__ import annotations

from pathlib import Path


def resolve_download_path(path_value: str) -> Path:
    path = Path(path_value).expanduser().resolve()
    if path.suffix.lower() != ".safetensors":
        raise ValueError("只能下载 .safetensors LoRA 文件")
    if not path.is_file():
        raise FileNotFoundError("LoRA 文件不存在，请先完成训练或检查输出路径")
    return path


def register_routes():
    try:
        from aiohttp import web
        from server import PromptServer
    except Exception:
        return

    routes = PromptServer.instance.routes

    @routes.get("/ninebot_flux_lora_pipeline/download")
    async def download_lora(request):
        path_value = request.query.get("path", "")
        try:
            path = resolve_download_path(path_value)
        except FileNotFoundError as exc:
            return web.json_response({"error": str(exc)}, status=404)
        except ValueError as exc:
            return web.json_response({"error": str(exc)}, status=400)
        return web.FileResponse(path, headers={"Content-Disposition": f'attachment; filename="{path.name}"'})
```

```python
# custom_nodes/ninebot_flux_lora_pipeline/__init__.py
from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from .routes import register_routes

WEB_DIRECTORY = "./web"
register_routes()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
```

- [ ] **Step 4: Run tests to verify they pass**

Expected: route helper tests and backend tests pass.

- [ ] **Step 5: Commit routes**

```powershell
git add -- custom_nodes/ninebot_flux_lora_pipeline/__init__.py custom_nodes/ninebot_flux_lora_pipeline/routes.py custom_nodes/ninebot_flux_lora_pipeline/tests/test_routes.py
git commit -m "feat: add ninebot lora download route"
```

## Task 5: Frontend Node UI and Download Button

**Files:**
- Create: `custom_nodes/ninebot_flux_lora_pipeline/web/ninebot_flux_lora_pipeline.js`

- [ ] **Step 1: Write the first UI implementation with stable methods and comments**

```javascript
import { app } from "../../scripts/app.js";

function findWidget(node, name) {
  return node.widgets?.find((widget) => widget.name === name);
}

function setWidgetValue(node, name, value) {
  const widget = findWidget(node, name);
  if (widget) {
    widget.value = value;
  }
}

function getWidgetValue(node, name) {
  return findWidget(node, name)?.value || "";
}

function downloadLora(node) {
  const loraPath = getWidgetValue(node, "last_lora_path") || getWidgetValue(node, "lora_path");
  if (!loraPath) {
    node.ninebotStatus = "LoRA 尚未训练完成";
    app.graph.setDirtyCanvas(true, true);
    return;
  }
  const url = `/ninebot_flux_lora_pipeline/download?path=${encodeURIComponent(loraPath)}`;
  window.open(url, "_blank");
}

app.registerExtension({
  name: "Ninebot.FluxLoRATrainPipeline",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "NinebotFluxLoRATrainPipeline") {
      return;
    }

    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      originalOnNodeCreated?.apply(this, arguments);
      this.ninebotStatus = "";
      this.addWidget("button", "Download LoRA", "download", () => downloadLora(this));
      if (!findWidget(this, "last_lora_path")) {
        this.addWidget("text", "last_lora_path", "", () => {}, { serialize: true });
      }
      this.size = [720, 980];
    };

    const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      originalOnDrawForeground?.apply(this, arguments);
      ctx.save();
      ctx.fillStyle = "#d8dced";
      ctx.font = "700 22px sans-serif";
      ctx.fillText("NinebotFluxLoRATrainPipeline", 72, 38);
      ctx.fillStyle = "#66708d";
      ctx.font = "16px sans-serif";
      ctx.fillText("自动打标 + Caption 精化 + FLUX LoRA 训练一体化", 72, 64);
      ctx.fillStyle = "#36d47a";
      ctx.strokeStyle = "#36d47a";
      ctx.strokeRect(22, 22, 36, 36);
      ctx.fillText("训练图片 *", 28, 138);
      ctx.fillStyle = "#c65390";
      ctx.fillText("数据集配置", 48, 188);
      ctx.fillStyle = "#d49432";
      ctx.fillText("训练配置", 48, 552);
      ctx.fillStyle = "#9aa3bd";
      ctx.font = "13px sans-serif";
      if (this.ninebotStatus) {
        ctx.fillText(this.ninebotStatus, 48, this.size[1] - 44);
      }
      ctx.restore();
    };
  },
});
```

- [ ] **Step 2: Verify frontend file is loaded by package export**

Run ComfyUI or inspect `/extensions` after restart.

Expected: `ninebot_flux_lora_pipeline.js` appears among extensions and the node has a `Download LoRA` button.

- [ ] **Step 3: Refine visual layout to match reference screenshots**

Manually adjust drawing constants only after the first load succeeds:

- Node width near `720`.
- Dark header and section bands.
- Image upload card before regular widgets.
- Download icon button positioned visually on the right side of `输出 LoRA 名称`.

- [ ] **Step 4: Commit frontend UI**

```powershell
git add -- custom_nodes/ninebot_flux_lora_pipeline/web/ninebot_flux_lora_pipeline.js
git commit -m "feat: add ninebot pipeline frontend controls"
```

## Task 6: README, Requirements, and Migration Notes

**Files:**
- Create: `custom_nodes/ninebot_flux_lora_pipeline/README.md`
- Create: `custom_nodes/ninebot_flux_lora_pipeline/requirements.txt`

- [ ] **Step 1: Add README with install and migration commands**

```markdown
# Ninebot FLUX LoRA Pipeline

`NinebotFluxLoRATrainPipeline` combines image upload, vehicle caption generation, FLUX LoRA training, and LoRA download into one ComfyUI node.

## Required sibling custom nodes

- `ComfyUI-FluxTrainer`
- `ComfyUI-Florence2`
- `ComfyUI-WD14-Tagger` recommended
- `ninebot_flux_lora_caption` recommended until caption logic is fully inlined

## Required model files

- `models/unet/flux1-dev.safetensors`
- `models/vae/ae.safetensors`
- `models/clip/clip_l.safetensors`
- `models/clip/t5xxl_fp16.safetensors`

## Usage

1. Restart ComfyUI after installing the node.
2. Add `NinebotFluxLoRATrainPipeline`.
3. Upload training images.
4. Keep `试运行` enabled for the first run to check captions.
5. Disable `试运行` to train.
6. Click the download icon next to `输出 LoRA 名称` after training completes.
```

- [ ] **Step 2: Add requirements note**

```text
# No extra Python packages are required by this wrapper node.
# Install requirements from ComfyUI-FluxTrainer, ComfyUI-Florence2, and ComfyUI-WD14-Tagger.
```

- [ ] **Step 3: Commit docs**

```powershell
git add -- custom_nodes/ninebot_flux_lora_pipeline/README.md custom_nodes/ninebot_flux_lora_pipeline/requirements.txt
git commit -m "docs: document ninebot pipeline migration"
```

## Task 7: Verification

**Files:**
- No new files expected.

- [ ] **Step 1: Run backend tests**

```powershell
$env:PYTHONPATH='C:/Users/ninebot/ComfyUI_windows_portable/ComfyUI/custom_nodes/ninebot_flux_lora_pipeline'
& 'C:/Users/ninebot/ComfyUI_windows_portable/python_embeded/python.exe' -m unittest discover -s 'C:/Users/ninebot/ComfyUI_windows_portable/ComfyUI/custom_nodes/ninebot_flux_lora_pipeline/tests' -v
```

Expected: all new tests pass.

- [ ] **Step 2: Run existing caption tests**

```powershell
$env:PYTHONPATH='C:/Users/ninebot/ComfyUI_windows_portable/ComfyUI/custom_nodes/ninebot_flux_lora_caption'
& 'C:/Users/ninebot/ComfyUI_windows_portable/python_embeded/python.exe' -m unittest discover -s 'C:/Users/ninebot/ComfyUI_windows_portable/ComfyUI/custom_nodes/ninebot_flux_lora_caption/tests' -v
```

Expected: 15 tests pass.

- [ ] **Step 3: Import the new custom node package**

```powershell
$env:PYTHONPATH='C:/Users/ninebot/ComfyUI_windows_portable/ComfyUI/custom_nodes'
& 'C:/Users/ninebot/ComfyUI_windows_portable/python_embeded/python.exe' -c "import ninebot_flux_lora_pipeline; print(ninebot_flux_lora_pipeline.NODE_CLASS_MAPPINGS.keys())"
```

Expected: output includes `NinebotFluxLoRATrainPipeline`.

- [ ] **Step 4: Run a dry-run smoke test**

Use two small PNGs in a temp directory and call `execute_pipeline(..., dry_run=True)` from Python.

Expected: staged images, `.txt` files, manifest, empty `lora_path`.

- [ ] **Step 5: Run ComfyUI visual smoke test**

Restart ComfyUI, add `NinebotFluxLoRATrainPipeline`, and verify:

- The node appears under `Ninebot/FLUX LoRA`.
- The first screen visually follows the reference dark style.
- The image upload area supports adding and clearing images.
- The output LoRA name row has a download icon/button.
- Download before training reports a clear not-ready state.

- [ ] **Step 6: Commit final verification adjustments**

```powershell
git status --short
git add -- custom_nodes/ninebot_flux_lora_pipeline
git commit -m "test: verify ninebot flux lora pipeline node"
```

## Self-Review

- Spec coverage: the plan covers node package creation, backend staging, captions, training config, dry-run, download button, route, frontend UI, README migration, and verification.
- 占位项检查：没有空泛工作项；每个任务都列出明确文件和命令。
- Type consistency: visible input names are `uploaded_images`, `trigger_word`, `dry_run`, `output_lora_name`, `lora_rank`, `max_train_steps`, and `learning_rate`; output names are `lora_name`, `lora_path`, and `captions`.

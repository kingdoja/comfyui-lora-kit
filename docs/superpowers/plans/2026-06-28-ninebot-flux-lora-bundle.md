# Ninebot FLUX LoRA Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated FLUX.1-dev LoRA bundle for internal motorcycle style/type/view experiments without disturbing the existing SD1.5 LoRA bundle.

**Architecture:** Create a new `ninebot_flux_lora_training_bundle` with docs, dataset templates, ComfyUI workflow JSON, and PowerShell scripts. Keep model download/licensing explicit and keep training setup isolated under `user/ninebot_flux_lora_training`.

**Tech Stack:** ComfyUI portable, Python 3.11.9 embedded, PyTorch 2.12.1+cu130, PowerShell, JSON workflow files, optional Hugging Face CLI for gated FLUX model access.

---

### Task 1: Bundle Skeleton And Docs

**Files:**
- Create: `ninebot_flux_lora_training_bundle/README.md`
- Create: `ninebot_flux_lora_training_bundle/docs/install.md`
- Create: `ninebot_flux_lora_training_bundle/docs/usage.md`
- Create: `ninebot_flux_lora_training_bundle/docs/dataset_caption_guide.md`
- Create: `ninebot_flux_lora_training_bundle/docs/model_sources.md`

- [ ] **Step 1: Create the bundle directories**

Run: `New-Item -ItemType Directory -Force` for docs, requirements, workflows, datasets, and training subfolders.
Expected: all directories exist.

- [ ] **Step 2: Write README and docs**

Write docs that state FLUX.1-dev is for internal/non-commercial use, model download is explicit, SD1.5 bundle remains untouched, and the trigger token is `ninebot_motorcycle_style`.

- [ ] **Step 3: Verify docs exist**

Run: `Test-Path` for each doc.
Expected: all return `True`.

### Task 2: Runtime And Setup Scripts

**Files:**
- Create: `ninebot_flux_lora_training_bundle/requirements/requirements-flux.txt`
- Create: `ninebot_flux_lora_training_bundle/requirements/setup_flux_training.ps1`
- Create: `ninebot_flux_lora_training_bundle/training/scripts/verify_flux_env.ps1`
- Create: `ninebot_flux_lora_training_bundle/training/scripts/train_flux_lora.ps1`

- [ ] **Step 1: Write requirements**

Include only supporting packages that do not downgrade ComfyUI's torch/transformers stack.

- [ ] **Step 2: Write setup script**

The script installs/verifies supporting packages, creates user training directories, checks for `flux1-dev-fp8.safetensors`, and prints model placement instructions if missing.

- [ ] **Step 3: Write verify script**

The script verifies Python, torch CUDA, GPU name, accelerate, diffusers, transformers, bitsandbytes, and presence of expected folders.

- [ ] **Step 4: Write train wrapper**

The wrapper is a guarded placeholder around the selected FLUX trainer: it validates dataset/model/output paths and explains that actual training starts after the FLUX-capable trainer is installed/configured. It must not call SD1.5 `train_network.py`.

### Task 3: Dataset Template And Training Config

**Files:**
- Create: `ninebot_flux_lora_training_bundle/datasets/motorcycle_flux_v001/10_ninebot_motorcycle_style/put_images_here.txt`
- Create: `ninebot_flux_lora_training_bundle/datasets/motorcycle_flux_v001/10_ninebot_motorcycle_style/example_caption.txt`
- Create: `ninebot_flux_lora_training_bundle/training/configs/motorcycle_flux_lora_16gb.toml`
- Create directories under `user/ninebot_flux_lora_training/datasets/motorcycle_flux_v001/10_ninebot_motorcycle_style`

- [ ] **Step 1: Create dataset folders**

Create both bundle template and user working dataset folders.
Expected: folders exist.

- [ ] **Step 2: Write caption examples**

Use trigger token `ninebot_motorcycle_style` and view/type tags for motorcycle training.

- [ ] **Step 3: Write conservative config**

Set resolution 768, batch size 1, rank 16, output name `ninebot_motorcycle_flux_v001`, output dir `ComfyUI/models/loras`.

### Task 4: ComfyUI Workflows

**Files:**
- Create: `ninebot_flux_lora_training_bundle/workflows/flux_dev_fp8_text2image.workflow.json`
- Create: `ninebot_flux_lora_training_bundle/workflows/flux_dev_lora_test.workflow.json`
- Copy into: `workflows/ninebot_flux_lora_training/`

- [ ] **Step 1: Create valid workflow JSON files**

Use node types available in ComfyUI: `CheckpointLoaderSimple`, `CLIPTextEncode`, `EmptyLatentImage`, `KSampler`, `VAEDecode`, `SaveImage`, and `LoraLoader` in the LoRA test workflow.

- [ ] **Step 2: Validate JSON**

Run: `python -m json.tool` against both workflow files.
Expected: exit code 0.

- [ ] **Step 3: Copy workflows to ComfyUI workflows folder**

Create `workflows/ninebot_flux_lora_training` and copy both JSON files.

### Task 5: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run setup script**

Run: `powershell -ExecutionPolicy Bypass -File ninebot_flux_lora_training_bundle/requirements/setup_flux_training.ps1`
Expected: package checks pass and missing FLUX model guidance is printed if model is absent.

- [ ] **Step 2: Run verify script**

Run: `powershell -ExecutionPolicy Bypass -File ninebot_flux_lora_training_bundle/training/scripts/verify_flux_env.ps1`
Expected: Python 3.11.9, torch cu130, RTX 4080, and expected folders reported.

- [ ] **Step 3: Start ComfyUI and verify workflow node types**

Start ComfyUI on port 8188 and query `/object_info` for `CheckpointLoaderSimple`, `LoraLoader`, `CLIPTextEncode`, `KSampler`, `VAEDecode`, `SaveImage`.
Expected: all found.

- [ ] **Step 4: Stop test server**

Stop the test ComfyUI Python process started for verification.


# Ninebot ComfyUI LoRA Kit

[中文](README.md) | **English**

> A practical ComfyUI toolkit for image captioning, LoRA training, and inference validation. It turns the path from dataset preparation to caption sidecars, training, and regression checks into importable, reproducible, portable project assets.

This is an engineering-focused portfolio project. It does not reimplement the training algorithms; instead, it combines ComfyUI custom nodes, workflow JSON, training configurations, dependency isolation, and tests around WD14, FluxTrainer, and sd-scripts.

## The 30-second overview

| Goal | Start here | What you get |
| --- | --- | --- |
| Caption a training set | [Caption workflow](workflows/ninebot_lora_training/lora_caption_mvp.workflow.json) | Same-name `.txt` sidecars ready for review |
| Validate an SD1.5 LoRA path | [SD1.5 smoke-test workflow](workflows/ninebot_lora_training/lora_training_mvp.workflow.json) | A short check of dependencies, paths, and `.safetensors` output |
| Train a FLUX LoRA | [NinebotFluxLoRATrainPipeline](custom_nodes/ninebot_flux_lora_pipeline/) | One node for upload, staging, captions, training, and artifact download |
| Check a trained FLUX LoRA | [FLUX LoRA test workflow](workflows/ninebot_flux_lora_training/flux_dev_lora_test.workflow.json) | A trigger-word-based inference regression entry point |

## Why this project is useful

- **Clear workflow entry points:** the FLUX node owns input validation, run isolation, parameter mapping, status feedback, and download routing, while FluxTrainer / sd-scripts remain responsible for optimization.
- **Reviewable captioning:** `LoRA Caption Load → WD14Tagger|pysssss → LoRA Caption Save` writes same-name sidecars that can be inspected before training.
- **Explicit batch boundaries:** a new upload batch replaces the previous list, and each run receives its own `run_id`, reducing dataset mixing and artifact confusion.
- **Validate before spending GPU time:** `dry_run` stages images, captions, and a manifest without training; the SD1.5 path includes a one-epoch smoke test.
- **Practical memory defaults:** the bundle documents a balanced RTX 4080 16GB reference path and keeps high-risk controls such as resolution, batch size, and blocks-to-swap in Advanced Settings.
- **Portable and review-friendly:** nodes, workflows, training bundles, docs, tests, and third-party boundaries are separated; model weights and private source material stay out of the repository.

## Two workflows

```text
SD1.5 / Legacy
Image folder → LoRA Caption Load → WD14 Tagger → LoRA Caption Save
            → human caption review → Lora Training in ComfyUI → smoke test

FLUX
Image upload → NinebotFluxLoRATrainPipeline
            → dry_run (staging + sidecars + manifest)
            → training (FluxTrainer) → LoRA save → inference regression
```

### Captioning and SD1.5 training

1. Open the [caption workflow](workflows/ninebot_lora_training/lora_caption_mvp.workflow.json) and point `LoRA Caption Load` at an image-only directory.
2. Confirm that every image has a same-name `.txt` file, then review the trigger word, subject, view, materials, and background.
3. Open the [training smoke-test workflow](workflows/ninebot_lora_training/lora_training_mvp.workflow.json) and start with one epoch and batch size 1 to validate CUDA, the checkpoint, `data_path`, and output paths.
4. Replace the sample dataset and parameters only after the smoke test passes.

### FLUX LoRA node

1. Copy the [custom node package](custom_nodes/ninebot_flux_lora_pipeline/) into the target ComfyUI `custom_nodes/` directory.
2. Install the [third-party node and model dependencies](THIRD_PARTY.md), then restart ComfyUI.
3. Add `NinebotFluxLoRATrainPipeline`, upload one complete batch, and choose a unique trigger word such as `ninebot_motorcycle_style`.
4. Keep `dry_run` enabled first and inspect the staging directory, `.txt` sidecars, and `_ninebot_pipeline_manifest.json`.
5. Disable `dry_run` to queue training, then use the [FLUX LoRA test workflow](workflows/ninebot_flux_lora_training/flux_dev_lora_test.workflow.json) for inference regression.

## Quick start

### Set up the FLUX bundle

```powershell
powershell -ExecutionPolicy Bypass -File bundles\flux_lora_training\requirements\setup_flux_training.ps1
powershell -ExecutionPolicy Bypass -File bundles\flux_lora_training\training\scripts\setup_flux_trainer.ps1
```

Recommended reading order:

1. [Installation](bundles/flux_lora_training/docs/install.md)
2. [Dataset and caption guide](bundles/flux_lora_training/docs/dataset_caption_guide.md)
3. [Training and validation usage](bundles/flux_lora_training/docs/usage.md)
4. [Model sources and terms](bundles/flux_lora_training/docs/model_sources.md)

### Dependency boundary

This repository maintains the Ninebot wrapper, workflows, configurations, and documentation. The target ComfyUI still needs route-specific components such as `ComfyUI-FluxTrainer`, `ComfyUI-WD14-Tagger`, `Image-Captioning-in-ComfyUI`, and `Lora-Training-in-Comfy`; see [THIRD_PARTY.md](THIRD_PARTY.md) for the full list.

## Engineering evidence

- Python tests cover the pipeline, routes, input validation, run directories, and download paths.
- Frontend tests cover upload replacement, inline editing, LoRA path payloads, Advanced Settings, and widget visibility.
- Workflow JSON, manifests, smoke-test datasets, and setup scripts provide reproducible entry points.
- All workflow JSON files pass a JSON parse check. The repository does not claim formal model-quality benchmarks or production-grade concurrent scheduling.

## Repository layout

```text
custom_nodes/ninebot_flux_lora_pipeline/  # FLUX LoRA orchestration node, frontend, and tests
workflows/                                # Importable ComfyUI workflow JSON
bundles/flux_lora_training/               # FLUX configs, scripts, caption guide, and inference workflows
bundles/sd15_lora_training/               # SD1.5 / legacy captioning and training MVP
docs/dev_docs/                            # Architecture, migration, delivery, and implementation notes
docs/superpowers/                         # Design specs and execution plans
THIRD_PARTY.md                            # Third-party node, model, and license boundaries
```

## Suggested interview path

1. Start with this README to understand the user journey and the explicit boundaries.
2. Read the [FLUX node README](custom_nodes/ninebot_flux_lora_pipeline/README.md) for node responsibilities, inputs, dry runs, and error handling.
3. Open the [captioning/training workflow README](workflows/ninebot_lora_training/README.md) for the dataset contract and smoke-test design.
4. Finish with `docs/dev_docs/` and `docs/superpowers/` for architecture decisions, migration notes, and acceptance evidence.

## Privacy and licensing

The repository excludes checkpoints, LoRAs, ONNX files, safetensors, original training images, PSDs, generated images, logs, Hugging Face caches, and virtual environments. Confirm the separate licenses and model terms for FLUX.1-dev, third-party nodes, and training scripts; this project is intended for internal, non-commercial experiments by default.

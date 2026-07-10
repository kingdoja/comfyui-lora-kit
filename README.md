# ComfyUI LoRA Kit

ComfyUI LoRA Kit is a curated project package for LoRA training, captioning, workflow delivery, and custom-node integration in ComfyUI. It separates reusable project assets from a full local ComfyUI installation so the workflows, training configs, scripts, and documentation can be reviewed, maintained, and moved between machines cleanly.

The repository demonstrates an end-to-end AI image workflow implementation: dataset preparation, caption sidecars, SD1.5 training migration, FLUX LoRA training setup, workflow JSON delivery, and a custom ComfyUI node pipeline with backend routes, frontend behavior, and tests.

## Project Highlights

- Custom ComfyUI node package for a FLUX LoRA training pipeline.
- Frontend extension coverage for widget behavior, inline editing, upload handling, advanced settings, and payload validation.
- Backend pipeline and route tests for the custom node package.
- FLUX training bundle with setup scripts, training configs, model-source notes, and dataset caption guidance.
- SD1.5 legacy training bundle with caption examples, dependency notes, and workflow migration material.
- ComfyUI workflow JSON files for captioning, training, LoRA testing, and FLUX image generation.
- Clear separation between lightweight reproducible project assets and large local-only runtime artifacts.

## Repository Layout

```text
custom_nodes/
  <flux_lora_pipeline>/        # Custom ComfyUI node package
workflows/
  <flux_training_workflows>/   # FLUX image generation and LoRA test workflows
  <sd15_training_workflows>/   # SD1.5 captioning and training workflows
bundles/
  flux_lora_training/          # FLUX scripts, configs, docs, and examples
  sd15_lora_training/          # SD1.5 migration bundle and lightweight examples
docs/
  dev_docs/                    # Architecture, migration, and delivery notes
  superpowers/                 # Design specs and execution plans
```

## What Is Included

- A custom ComfyUI node package with Python backend code, browser-side extension code, and focused tests.
- FLUX LoRA training configuration, PowerShell setup helpers, model-source documentation, and captioning guidance.
- SD1.5 captioning and LoRA training workflows, dependency notes, and sample caption sidecars.
- Importable ComfyUI workflow JSON for captioning, training, FLUX LoRA testing, and FLUX text-to-image generation.
- Implementation notes that document the migration path from a local working environment into a portable repository.

## What Is Not Included

The repository intentionally excludes large or machine-specific artifacts:

- ComfyUI core source code.
- Checkpoints, LoRA files, ONNX files, safetensors files, and other model weights.
- Original training images, PSD files, generated outputs, and TensorBoard logs.
- Vendored copies of large third-party custom nodes.
- Python virtual environments, Hugging Face caches, `__pycache__`, and local runtime caches.

Third-party node and model dependencies are documented in [THIRD_PARTY.md](THIRD_PARTY.md).

## Install Into ComfyUI

1. Copy the custom node package from `custom_nodes/` into the target ComfyUI `custom_nodes/` directory.
2. Install the required third-party custom nodes and model files listed in [THIRD_PARTY.md](THIRD_PARTY.md).
3. Restart ComfyUI.
4. Import the workflow JSON files from `workflows/` or `bundles/*/workflows/`.
5. Run a dry run or smoke workflow first to validate paths, caption sidecars, and model locations.
6. Start training only after the environment check passes.

## FLUX Training Start Points

Recommended documentation:

```text
bundles/flux_lora_training/docs/install.md
bundles/flux_lora_training/docs/usage.md
bundles/flux_lora_training/docs/dataset_caption_guide.md
bundles/flux_lora_training/docs/model_sources.md
```

Common setup commands:

```powershell
powershell -ExecutionPolicy Bypass -File bundles\flux_lora_training\requirements\setup_flux_training.ps1
powershell -ExecutionPolicy Bypass -File bundles\flux_lora_training\training\scripts\setup_flux_trainer.ps1
```

## SD1.5 Legacy Start Points

The SD1.5 migration bundle includes installation notes, workflow usage notes, dependency lists, and lightweight caption examples:

```text
bundles/sd15_lora_training/docs/install.md
bundles/sd15_lora_training/docs/usage.md
bundles/sd15_lora_training/workflows/
```

The bundle keeps only portable text, workflow, dependency, and example-caption assets. WD14, captioning nodes, LoRA training nodes, and other third-party components should be installed separately in the target ComfyUI environment.

## Engineering Notes

This project is structured to make the implementation easy to evaluate:

- Source code, workflows, documentation, and training bundles are separated by responsibility.
- Runtime-heavy assets are excluded so the repository remains reviewable and clone-friendly.
- Tests focus on the custom node pipeline and frontend extension behaviors that are most likely to regress.
- Documentation records setup assumptions, dependency boundaries, and migration decisions.

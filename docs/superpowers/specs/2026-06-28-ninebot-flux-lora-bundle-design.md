# Ninebot FLUX LoRA Bundle Design

Date: 2026-06-28

## Goal

Create a separate `ninebot_flux_lora_training_bundle` for internal FLUX LoRA work. The existing SD1.5 LoRA bundle stays intact. The new bundle provides FLUX inference workflows, a motorcycle-focused dataset structure, low-VRAM training configuration, and scripts/docs for moving trained LoRAs back into ComfyUI.

## Local Constraints

- ComfyUI root: `C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI`
- Python: 3.11.9 embedded
- PyTorch: 2.12.1+cu130
- GPU: NVIDIA GeForce RTX 4080, 16GB VRAM
- RAM: about 130GB
- Use case: internal/non-commercial experimentation with motorcycle style/type/view LoRAs.

## Model Choice

Use FLUX.1-dev as the target quality baseline for internal use. Prefer a ComfyUI-friendly FP8 checkpoint for initial inference because it fits the 16GB GPU better than full BF16 model loading.

Primary inference target:

- `flux1-dev-fp8.safetensors` in `ComfyUI/models/checkpoints/`

If the FP8 checkpoint is unavailable or the user wants the modular layout later, use ComfyUI's split-model folders:

- `models/diffusion_models/` for the FLUX transformer
- `models/text_encoders/` for CLIP/T5 encoders
- `models/vae/` for the FLUX autoencoder

The bundle should document that FLUX.1-dev has a non-commercial license. Do not imply commercial permission.

## Architecture

The new bundle has two layers:

1. ComfyUI runtime layer
   - Workflows for FLUX base inference and FLUX LoRA testing.
   - Output LoRAs are loaded from `ComfyUI/models/loras/`.
   - Does not depend on the old SD1.5 `Lora-Training-in-Comfy` workflow.

2. Training layer
   - Isolated under `user/ninebot_flux_lora_training/` or under the bundle's `training/` directory.
   - Uses a FLUX-capable training stack, not the legacy SD1.5 `sd-scripts/train_network.py` bundled earlier.
   - Scripts must default to low-VRAM settings for RTX 4080 16GB.

## Bundle Layout

```text
ninebot_flux_lora_training_bundle/
  README.md
  docs/
    install.md
    usage.md
    dataset_caption_guide.md
    model_sources.md
  requirements/
    setup_flux_training.ps1
    requirements-flux.txt
  workflows/
    flux_dev_fp8_text2image.workflow.json
    flux_dev_lora_test.workflow.json
  datasets/
    motorcycle_flux_v001/
      10_ninebot_motorcycle_style/
        put_images_here.txt
  training/
    configs/
      motorcycle_flux_lora_16gb.toml
    scripts/
      train_flux_lora.ps1
      verify_flux_env.ps1
```

## Dataset And Caption Design

Use one trigger token: `ninebot_motorcycle_style`.

Initial folder:

```text
user/ninebot_flux_lora_training/datasets/motorcycle_flux_v001/10_ninebot_motorcycle_style/
```

Each image must have a matching `.txt` caption. Captions should separate identity/style from view and vehicle attributes:

```text
ninebot_motorcycle_style, electric off-road motorcycle, front three-quarter view, rugged tires, exposed suspension, product photography, neutral studio lighting
```

Recommended view tags:

- `front view`
- `side view`
- `rear view`
- `front three-quarter view`
- `rear three-quarter view`
- `top view`
- `detail shot`

Recommended type tags:

- `electric motorcycle`
- `off-road motorcycle`
- `sport motorcycle`
- `adventure motorcycle`
- `urban commuter motorcycle`

Avoid captions that overfit one background unless the background is part of the desired style.

## Training Defaults

Start conservative for 16GB VRAM:

- resolution: 768
- batch size: 1
- LoRA rank: 16 initially, 32 after smoke success
- mixed precision: bf16 or fp16 depending on trainer support
- optimizer: AdamW or 8-bit optimizer only after import verification
- cache latents/text encodings when supported
- output: `ComfyUI/models/loras/ninebot_motorcycle_flux_v001.safetensors`

The first run should be a smoke test with a tiny image subset and very low steps. A full run should only follow after the LoRA file is produced and can be loaded in ComfyUI.

## Workflows

`flux_dev_fp8_text2image.workflow.json` should load the base FP8 checkpoint and generate a simple motorcycle prompt.

`flux_dev_lora_test.workflow.json` should load the same base model plus `ninebot_motorcycle_flux_v001.safetensors` from `models/loras`.

The workflows should be valid ComfyUI workflow JSON and use local model names, not absolute paths, where ComfyUI node widgets expect model filenames.

## Error Handling

- If FLUX model files are missing, docs/scripts should print exact target paths.
- If Hugging Face access requires acceptance or login, stop and tell the user to accept the model terms or provide a local file.
- If training OOMs, lower resolution to 512 or rank to 8 and keep batch size 1.
- If bitsandbytes fails, fall back to AdamW or Lion if the chosen trainer supports it.
- If a trainer package conflicts with ComfyUI dependencies, use an isolated training venv under `user/ninebot_flux_lora_training/train_venv`.

## Verification Plan

Before considering the bundle usable:

1. Run Python import checks for torch CUDA, accelerate, transformers, and the selected FLUX trainer dependencies.
2. Start ComfyUI and verify FLUX-related workflow nodes can load.
3. Verify workflow JSON parses.
4. Verify all expected directories exist.
5. If model files are already available, run a minimal FLUX inference smoke test.
6. If training model files and dataset are available, run a short LoRA smoke train and confirm a `.safetensors` LoRA is created.

## Non-Goals

- Do not replace or remove the existing SD1.5 LoRA bundle.
- Do not train a production LoRA before the user supplies the real motorcycle dataset.
- Do not claim commercial use rights for FLUX.1-dev.
- Do not hide large downloads; scripts should name expected model sizes and destinations.

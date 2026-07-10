# Ninebot FLUX LoRA Training Bundle

This bundle is for internal FLUX.1-dev LoRA experiments focused on motorcycle style, vehicle type, and view consistency.

It is separate from the SD1.5 LoRA bundle. Do not run the old SD1.5 training workflow for FLUX.

## Local Target

- ComfyUI portable root: `C:\Users\ninebot\ComfyUI_windows_portable`
- Python: 3.11.9 embedded
- PyTorch: 2.12.1+cu130
- GPU: NVIDIA GeForce RTX 4080, 16GB VRAM

## Trigger Token

Use this token in every training caption and later prompt:

```text
ninebot_motorcycle_style
```

Example:

```text
ninebot_motorcycle_style, electric off-road motorcycle, side view, product photography
```

## Start Here

Read:

```text
docs/install.md
docs/usage.md
docs/dataset_caption_guide.md
docs/model_sources.md
```

Then run:

```powershell
powershell -ExecutionPolicy Bypass -File requirements\setup_flux_training.ps1
powershell -ExecutionPolicy Bypass -File training\scripts\setup_flux_trainer.ps1
```

To refresh the motorcycle dataset from the SD1.5 bundle source folders:

```powershell
powershell -ExecutionPolicy Bypass -File training\scripts\prepare_motorcycle_dataset.ps1 -CleanGenerated
```

## Important

FLUX.1-dev is not an SD1.5 checkpoint. It needs FLUX-compatible inference and training workflows.

Inference uses `models\checkpoints\flux1-dev-fp8.safetensors`. Training uses `kohya-ss/sd-scripts` plus split FLUX training components in `models\diffusion_models`, `models\text_encoders`, and `models\vae`.

This bundle documents FLUX.1-dev for internal/non-commercial experiments only. Confirm model terms before downloading or using the model.


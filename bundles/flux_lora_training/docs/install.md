# Install

## 1. Verify ComfyUI Environment

The local portable ComfyUI has already been prepared with:

```text
Python 3.11.9
PyTorch 2.12.1+cu130
NVIDIA GeForce RTX 4080
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\training\scripts\verify_flux_env.ps1
```

## 2. Install Supporting Packages

From this bundle directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\requirements\setup_flux_training.ps1
```

This does not replace ComfyUI's torch stack.

## 3. Add FLUX Model

Preferred starter model for ComfyUI inference on this 16GB GPU:

```text
ComfyUI\models\checkpoints\flux1-dev-fp8.safetensors
```

If you use the split ComfyUI FLUX layout later, place files under:

```text
ComfyUI\models\diffusion_models
ComfyUI\models\text_encoders
ComfyUI\models\vae
```

The setup script prints exact paths if the FP8 checkpoint is missing.

## 4. Install FLUX LoRA Trainer

This bundle uses `kohya-ss/sd-scripts` and its `flux_train_network.py` entry point.

```powershell
powershell -ExecutionPolicy Bypass -File .\training\scripts\setup_flux_trainer.ps1
```

The trainer is installed under:

```text
ComfyUI\user\ninebot_flux_lora_training\train\sd-scripts
```

## 5. Add Training Model Components

Training needs split FLUX files. The FP8 checkpoint used for ComfyUI inference is not enough.

Check missing files:

```powershell
powershell -ExecutionPolicy Bypass -File .\training\scripts\download_flux_training_models.ps1
```

Download missing files:

```powershell
powershell -ExecutionPolicy Bypass -File .\training\scripts\download_flux_training_models.ps1 -Download
```

If `black-forest-labs/FLUX.1-dev` fails, accept the model terms on Hugging Face and run `huggingface-cli login`.

## 6. Copy Or Prepare Dataset

Working dataset path:

```text
ComfyUI\user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001\10_ninebot_motorcycle_style
```

Each image needs a same-name `.txt` caption.

## 7. Start ComfyUI

```text
C:\Users\ninebot\ComfyUI_windows_portable\run_nvidia_gpu.bat
```

Open workflows from:

```text
ComfyUI\workflows\ninebot_flux_lora_training
```


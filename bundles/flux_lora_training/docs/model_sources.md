# Model Sources

## Recommended Internal Model

Use FLUX.1-dev for internal/non-commercial experiments.

Model terms must be accepted by the user before downloading from Hugging Face:

```text
black-forest-labs/FLUX.1-dev
```

## ComfyUI Starter File

For this RTX 4080 16GB setup, start with a single-file FP8 checkpoint:

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\models\checkpoints\flux1-dev-fp8.safetensors
```

This is easier than the split FLUX layout for first validation.

## Training Files

The selected trainer is:

```text
https://github.com/kohya-ss/sd-scripts
```

It uses:

```text
flux_train_network.py
```

Training requires these files:

```text
ComfyUI\models\diffusion_models\flux1-dev.safetensors
ComfyUI\models\vae\ae.safetensors
ComfyUI\models\text_encoders\clip_l.safetensors
ComfyUI\models\text_encoders\t5xxl_fp16.safetensors
```

Sources:

```text
black-forest-labs/FLUX.1-dev
comfyanonymous/flux_text_encoders
```

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\training\scripts\download_flux_training_models.ps1 -Download
```

## Split Layout

If using split model files later:

```text
ComfyUI\models\diffusion_models
ComfyUI\models\text_encoders
ComfyUI\models\vae
```

## License Note

Do not use FLUX.1-dev outputs or weights commercially unless the license terms permit your use case. This bundle is written for internal experimentation.

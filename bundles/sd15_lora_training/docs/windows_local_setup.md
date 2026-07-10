# Windows Local Setup

This bundle is now staged for this local portable ComfyUI:

```text
C:\Users\ninebot\ComfyUI_windows_portable
```

Use Python 3.11 for this bundle. The current Python 3.13 portable runtime is too new for several LoRA training dependencies.

Run this from PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
cd C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\ninebot_lora_training_bundle\requirements
.\setup_windows_python311_lora.ps1
```

Then start ComfyUI:

```text
C:\Users\ninebot\ComfyUI_windows_portable\run_nvidia_gpu.bat
```

Open these workflows:

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\workflows\ninebot_lora_training\lora_caption_mvp.workflow.json
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\workflows\ninebot_lora_training\lora_training_mvp.workflow.json
```

For the included smoke workflow, keep `optimizerType` as `Lion`. Use `AdamW8bit` only if `bitsandbytes` installed and imports cleanly.

Put an SD 1.5 base checkpoint in:

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\models\checkpoints
```

The bundled workflow currently expects:

```text
v1-5-pruned-emaonly.safetensors
```

If your checkpoint filename differs, change `ckpt_name` in the training node.

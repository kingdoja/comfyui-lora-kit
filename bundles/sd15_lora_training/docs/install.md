# Install Ninebot LoRA Training Bundle

## Target

Use this bundle on a CUDA ComfyUI machine.

Recommended:

```text
Python 3.10 or 3.11
NVIDIA GPU, 12GB VRAM or more
PyTorch CUDA installed
ComfyUI already starts successfully
```

## 1. Copy Bundle Contents

Copy these bundle folders into the target ComfyUI root:

```text
custom_nodes/
workflows/
datasets/
```

Suggested final layout:

```text
ComfyUI/
  custom_nodes/
    Lora-Training-in-Comfy/
    Image-Captioning-in-ComfyUI/
    ComfyUI-WD14-Tagger/
  workflows/
    ninebot_lora_training/
      lora_caption_mvp.workflow.json
      lora_training_mvp.workflow.json
      lora_training_manifest.json
  user/
    ninebot_lora_training/
      datasets/
        offroad_vehicle_smoke_v001/
        offroad_vehicle_caption_scratch_v001/
```

If the target ComfyUI does not use `user/ninebot_lora_training/datasets/`, update workflow paths after opening the JSON.

## 2. Install CUDA Dependencies

From this bundle directory:

```bash
chmod +x requirements/install_cuda.sh
bash requirements/install_cuda.sh
```

If the script cannot find the correct Python, activate the ComfyUI venv first:

```bash
source /path/to/ComfyUI/.venv/bin/activate
bash requirements/install_cuda.sh
```

## 3. Add Checkpoint

Put a training base model in:

```text
ComfyUI/models/checkpoints/
```

The sample workflow expects:

```text
v1-5-pruned-emaonly.safetensors
```

If your model filename differs, change `ckpt_name` in the training node.

## 4. Restart ComfyUI

After restart, verify these nodes are searchable:

```text
LoRA Caption Load
WD14Tagger|pysssss
LoRA Caption Save
Lora Training in Comfy (Advanced)
Tensorboard Access
```

## 5. Open Workflow

Caption:

```text
workflows/ninebot_lora_training/lora_caption_mvp.workflow.json
```

Training:

```text
workflows/ninebot_lora_training/lora_training_mvp.workflow.json
```

Do caption first, inspect `.txt`, then run training.

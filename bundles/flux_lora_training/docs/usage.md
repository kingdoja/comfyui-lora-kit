# Usage

## Base FLUX Inference

Open:

```text
workflows\ninebot_flux_lora_training\flux_dev_fp8_text2image.workflow.json
```

This workflow expects:

```text
models\checkpoints\flux1-dev-fp8.safetensors
```

## FLUX LoRA Test

After training creates a LoRA, open:

```text
workflows\ninebot_flux_lora_training\flux_dev_lora_test.workflow.json
```

Expected LoRA filename:

```text
models\loras\ninebot_motorcycle_flux_v001.safetensors
```

## Prompt Pattern

Use the trigger token first:

```text
ninebot_motorcycle_style, electric off-road motorcycle, front three-quarter view, rugged tires, product photography, neutral studio lighting
```

## Training Flow

1. Put images in the working dataset folder.
2. Create matching `.txt` captions for each image.
3. Run the environment verification script.
4. Run the training wrapper only after a FLUX-capable trainer is installed/configured.
5. Copy or save the output LoRA into `ComfyUI\models\loras`.
6. Test with the LoRA workflow.

The current wrapper intentionally refuses to call the old SD1.5 training script.


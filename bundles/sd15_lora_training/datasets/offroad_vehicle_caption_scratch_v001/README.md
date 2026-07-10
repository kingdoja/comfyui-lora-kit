# offroad_vehicle_caption_scratch_v001

This dataset is for testing the automatic caption workflow.

It intentionally contains only `.png` images at first. `LoRA Caption Save` should create matching `.txt` files beside each image.

## Image Folder

```text
10_ninebot_atv_style/
```

## Use With

```text
workflows/ninebot_lora_training/lora_caption_mvp.workflow.json
```

## Important

If `.txt` files already exist in this folder, `LoRA Caption Save` can fail or skip names because the upstream node tries to avoid overwriting existing files. Delete the generated `.txt` files before rerunning caption generation.

# Dataset Caption Guide

## Trigger Token

Use exactly:

```text
ninebot_motorcycle_style
```

Keep this token in every caption.

## Current Folder Layout

Use separate FLUX dataset subsets for one training run:

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001
  style
  views
```

Example files:

```text
view_0001.png
view_0001.txt
style_0001.png
style_0001.txt
```

## Current Prepared Dataset

The source images are copied from:

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\ninebot_lora_training_bundle\datasets\方位图
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\ninebot_lora_training_bundle\datasets\风格图
```

Current counts:

- `style`: 25 images, 25 captions.
- `views`: 42 images, 42 captions.

The `motorcycle_flux_dataset.toml` training config reads only these two subsets. `style` teaches the design language. `views` teaches controllable vehicle angles. Non-training files such as `.psd` are skipped.

## Caption Pass

The current captions are a precision pass based on visual review, not blind filename-based labels.

Review assets:

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\caption_review\style_contact_sheet.jpg
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\caption_review\views_contact_sheet.jpg
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\caption_review\caption_review.csv
```

Old captions were backed up to:

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\caption_review\caption_backup_before_precision_pass
```

For `style`, captions describe the shared design language: futuristic electric three-wheeled motorcycle concept, angular white/gray/black panels, large windscreen, wide rear stance, red accents, studio product render.

For `views`, captions describe the real turntable angle for each Xyber image: front, rear, left side, right side, and three-quarter variants.

## Caption Template

```text
ninebot_motorcycle_style, [motorcycle type], [view], [key parts], [material/color], [photo style], [background/lighting]
```

Example:

```text
ninebot_motorcycle_style, electric off-road motorcycle, front three-quarter view, rugged tires, exposed suspension, matte black body panels, product photography, neutral studio lighting
```

## View Tags

- `front view`
- `side view`
- `rear view`
- `front three-quarter view`
- `rear three-quarter view`
- `top view`
- `detail shot`

## Type Tags

- `electric motorcycle`
- `off-road motorcycle`
- `sport motorcycle`
- `adventure motorcycle`
- `urban commuter motorcycle`

## Practical Dataset Advice

- Start with 30-80 curated images.
- Include repeated views for each important type.
- Avoid mixing too many backgrounds if the vehicle design is the target.
- Use captions to preserve controllable concepts such as view and type.
- Do not put negative prompts in captions.
- Keep `cache_text_encoder_outputs` compatible by leaving `shuffle_caption = false` in the dataset TOML.


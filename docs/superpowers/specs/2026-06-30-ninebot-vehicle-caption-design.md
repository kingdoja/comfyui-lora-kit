# Ninebot Vehicle Caption Workflow Design

## Goal

Build a captioning workflow for the merged FLUX LoRA dataset that teaches both the overall `ninebot_style` design language and the recurring vehicle part styling. The captions should help the LoRA learn the three-wheeled electric motorcycle concept, body panel language, front windscreen, wheel stance, lighting, cutout/product render context, and viewpoint-specific details.

## Current State

The existing workflow `user/ninebot_flux_lora_training/workflows/01_打标工作流_美化版.json` loads images, runs WD14 Tagger, and saves `.txt` sidecar captions through `ninebot_flux_lora_caption`. This is useful as a batch shell, but WD14 is not precise enough for product/vehicle component captioning. The current merged dataset has 90 images across `style`, `view`, and `cutout` sources.

## Recommended Architecture

Keep the current batch flow shape:

```text
NinebotCaptionDatasetLoad
  -> vehicle-aware visual caption source
  -> optional WD14 auxiliary tags
  -> sidecar caption save
  -> review manifest
```

The new primary caption source should be a local vision-language model when available, such as Florence-2, Qwen2-VL, JoyCaption, or another installed visual caption node/script. WD14 remains optional auxiliary context, not the final authority.

## Caption Contract

Every caption must start with the trigger word:

```text
ninebot_style,
```

Every caption should then describe the training target in this order:

```text
ninebot_style, subject/category, viewpoint, vehicle structure, body panels/material/color, key parts, image context/background
```

Example for product render images:

```text
ninebot_style, futuristic three-wheeled electric motorcycle concept, front three-quarter view, angular white gray body panels, large front windscreen, wide rear wheel stance, black wheels, studio product render, neutral background
```

Example for cutouts:

```text
ninebot_style, futuristic three-wheeled electric motorcycle concept, isolated vehicle cutout, angular white gray body shell, black wheels, large front windscreen, clean product silhouette, neutral background
```

Example for multi-view/reference images:

```text
ninebot_style, futuristic three-wheeled electric motorcycle concept, multi angle reference sheet, front view and side view, compact electric vehicle body, angular white gray panels, black wheels, product design reference
```

## Workflow Behavior

The first version should support a `dry_run` mode. In dry run, it writes only a manifest containing the image path, proposed caption, source group, and raw model output. It must not overwrite reviewed `.txt` files unless `overwrite_existing_txt` is explicitly enabled.

For the first implementation, the workflow can avoid a separate complex cleanup node. Instead, the vision model prompt should strongly constrain the output to the caption contract. If model output is unstable, a later `NinebotVehicleCaptionRefine` node can normalize order, remove noise, and inject source-group hints.

## Source Group Hints

The captioner should use folder/file hints when available:

- `style`: product render, studio product photography, design concept image.
- `view`: multi angle reference, front/side/rear view, vehicle design sheet.
- `cutout`: isolated cutout, clean product silhouette, neutral or transparent background.

These hints should guide wording without replacing image-specific observations.

## Success Criteria

- Captions always start with `ninebot_style,`.
- Captions mention relevant vehicle features when visible, especially front windscreen, three-wheel stance, black wheels, angular body panels, and white/gray/black material language.
- Captions are concise enough for LoRA training and avoid generic WD14 noise.
- Existing reviewed captions are not overwritten by default.
- A review manifest allows checking the first 10-20 outputs before writing sidecar `.txt` files.

## Non-Goals

- Do not train the LoRA inside the caption workflow.
- Do not merge datasets in this workflow; it captions an existing dataset directory.
- Do not rely on WD14 as the sole caption source for the formal dataset.
- Do not introduce complex human-in-the-loop UI in the first version.

## Proposed First Implementation

Create a vehicle-focused captioning workflow and supporting node/script path that can:

1. Load images from the merged dataset directory.
2. Generate a vehicle-aware caption draft using a local vision-language model path if available.
3. Optionally include WD14 tags in the manifest for reference.
4. Save dry-run review output first.
5. After review, write `.txt` captions with `ninebot_style` as the trigger.


# Ninebot FLUX LoRA Pipeline

`NinebotFluxLoRATrainPipeline` combines image upload, caption sidecar preparation, FLUX LoRA training, and trained LoRA download into one ComfyUI node.

The node is designed for the Ninebot FLUX LoRA workflow:

- Upload multiple training images in the node.
- Uploading a new batch replaces the current `uploaded_images` list, so old dataset paths are not mixed into the next run.
- Use `trigger_word` for caption and FluxTrainer `class_tokens`; choose a unique token such as `ninebot_xxx_style`, not a broad word like `car`, `vehicle`, or `motorcycle`.
- Keep `dry_run` enabled for the first queue to verify upload and caption sidecars.
- Disable `dry_run` to run the FluxTrainer chain.
- Optionally connect `NinebotFluxLoRAAdvancedSettings` when tuning speed, memory, or quality.
- Click the small download icon next to `output_lora_name` after training finishes.

## Required Sibling Custom Nodes

This package contains only the Ninebot wrapper node. The target ComfyUI also needs the training/caption custom nodes and their dependencies.

Copy these custom nodes when moving this node to another ComfyUI install:

- `custom_nodes/ninebot_flux_lora_pipeline`
- `custom_nodes/ComfyUI-FluxTrainer`
- `custom_nodes/ComfyUI-Florence2`
- `custom_nodes/ComfyUI-WD14-Tagger`
- `custom_nodes/ninebot_flux_lora_caption`

The current backend calls the installed FluxTrainer node classes through ComfyUI `NODE_CLASS_MAPPINGS`. Caption generation is adapter-based; the safe default writes trigger-only captions, and the package is structured so Florence2/WD14 caption adapters can be expanded without changing the public node UI.

## Required Model Files

The default RTX4080-friendly FLUX training configuration expects:

- `models/unet/flux1-dev.safetensors`
- `models/vae/ae.safetensors`
- `models/clip/clip_l.safetensors`
- `models/clip/t5xxl_fp16.safetensors`

The default training settings are:

- rank and alpha: `8`
- max train steps: `600`
- learning rate: `0.0001`
- optimizer: `adamw8bit`
- cache latents: `memory`
- cache text encoder outputs: `memory`
- `fp8_base`: enabled
- dtype: `bf16`
- attention: `sdpa`

## Optional Advanced Settings

Use `NinebotFluxLoRAAdvancedSettings` only when you need to tune hidden FluxTrainer knobs. Click the small `advanced_settings` input socket on the left side of `NinebotFluxLoRATrainPipeline` to auto-create and connect the advanced node, or add it manually and connect its `advanced_settings` output.

The advanced node intentionally exposes only 8 controls: `training_resolution`, `batch_size`, `num_repeats`, `blocks_to_swap`, `fp8_base`, `gradient_dtype`, `attention_mode`, and `sample_prompts`.

Useful adjustments:

- Lower `training_resolution` or `max_train_steps` to reduce runtime.
- Lower `blocks_to_swap` for speed if VRAM is enough; raise it to save VRAM when training fails or stalls.
- Keep `gradient_dtype=bf16` and `attention_mode=sdpa` for the RTX4080 balanced path.
- `network_alpha`, cache mode, gradient checkpointing, save dtype, optimizer, and scheduler stay on stable defaults in the backend.
- Leave `sample_prompts` empty when you do not want to set validation preview prompts.
- Fill `sample_prompts` when you want custom validation previews; separate multiple prompts with `|`.

`sample_prompts` are only for training-time validation previews. They are not the training image captions.

## Usage

1. Restart ComfyUI after installing or copying the node.
2. Add `NinebotFluxLoRATrainPipeline` from `Ninebot/FLUX LoRA`.
3. Click the training image area and upload PNG, JPG, JPEG, or WEBP images.
   Uploading again replaces the previous image list; select all images for the new dataset in one batch.
4. Click `触发词`, `输出 LoRA 名称`, `LoRA Rank`, `最大训练步数`, or `学习率` to edit values.
5. Keep `试运行` on for the first run to verify dataset staging and `.txt` sidecars.
6. Optional: click the left-side `advanced_settings` input socket to auto-add `NinebotFluxLoRAAdvancedSettings` for speed or memory tuning.
7. Turn `试运行` off and queue the node to train.
8. When training finishes, click the download icon next to `输出 LoRA 名称`.

## Output Files

Uploaded images are staged into:

`user/ninebot_flux_lora_training/datasets/pipeline_uploads/<run_id>/style/`

The node writes:

- same-name `.txt` caption files
- `_ninebot_pipeline_manifest.json`
- FLUX LoRA output under `output/ninebot_flux_lora_training/<output_lora_name>/`
- a copied LoRA under `models/loras/flux_trainer/` when FluxTrainer copy mode succeeds

## Notes

- The download route only serves existing `.safetensors` files.
- If the download icon is clicked before training completes, the node shows a not-ready status.
- If the LoRA file has been moved or deleted, the backend returns a clear file-not-found error.
- The package intentionally does not vendor FluxTrainer, Florence2, or WD14 dependencies.

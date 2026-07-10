# Ninebot FLUX LoRA Advanced Mode Design

## Goal

Add an optional advanced-settings node for the packaged `ninebot_flux_lora_pipeline` custom node. The main LoRA training node must stay simple by default, while advanced users can add and connect a separate node when they need to tune speed, memory, and quality parameters.

## User-Facing Behavior

- The existing `NinebotFluxLoRATrainPipeline` node remains the primary node.
- A new `NinebotFluxLoRAAdvancedSettings` node appears under the same `Ninebot/FLUX LoRA` category.
- The training node gets one optional input socket named `advanced_settings`.
- If `advanced_settings` is not connected, training uses the current RTX4080 balanced defaults.
- If the advanced node is connected, only the advanced values override those defaults.
- The advanced node is not embedded into the custom painted training-node UI. Users only see it when they explicitly add it to the graph.
- The sample prompt field from the original workflow is out of scope for this change and will be handled separately.

## Advanced Parameters

Expose only parameters that materially affect speed, memory, or quality and are already supported by FluxTrainer:

- `training_resolution`: default `1024`; controls dataset width/height.
- `batch_size`: default `1`.
- `num_repeats`: default `1`.
- `cache_latents`: `memory`, `disk`, or `disabled`; default `memory`.
- `cache_text_encoder_outputs`: `memory`, `disk`, or `disabled`; default `memory`.
- `blocks_to_swap`: default `16`; lower can be faster but needs more VRAM, higher saves VRAM but can be slower.
- `gradient_checkpointing`: `enabled`, `enabled_with_cpu_offloading`, or `disabled`; default `enabled`.
- `fp8_base`: default `true`.
- `gradient_dtype`: `bf16`, `fp16`, or `fp32`; default `bf16`.
- `save_dtype`: `bf16`, `fp16`, or `fp32`; default `bf16`.
- `attention_mode`: `sdpa`, `xformers`, or `disabled`; default `sdpa`.
- `optimizer_type`: default `adamw8bit`.
- `lr_scheduler`: default `constant`.
- `network_alpha`: default `0`, meaning follow the main node's `LoRA Rank`.

Keep `sample_prompts`, text encoder training, block/loss args, and resume args out of this node for now.

## Data Flow

`NinebotFluxLoRAAdvancedSettings` returns a dictionary-like payload with type `NINEBOT_FLUX_LORA_ADVANCED`.

`NinebotFluxLoRATrainPipeline.run(...)` accepts the optional payload and passes it into `PipelineInputs`.

`build_flux_train_config(...)` starts from the current defaults, then merges validated advanced values:

1. Main node values always own visible basics: trigger word, LoRA name, rank, steps, learning rate.
2. Advanced node owns hidden FluxTrainer knobs.
3. `network_alpha <= 0` resolves to the main node rank.
4. Values are clamped or normalized before being sent to FluxTrainer.

## Compatibility

Existing workflows without the advanced node continue to run because `advanced_settings` is optional. The return type and visible output sockets stay unchanged: the training node is still an output node with no visible result sockets.

The current custom frontend should not draw the native optional socket labels over the painted UI. The new optional input socket is positioned like the existing image socket, with a small blank label so the visual style remains stable.

## Tests

Add or update tests for:

- The advanced settings node exists in `NODE_CLASS_MAPPINGS`.
- The training node exposes optional `advanced_settings`.
- Default config remains unchanged when no advanced settings are connected.
- Advanced values override config fields.
- `network_alpha=0` follows rank.
- Frontend hiding/layout still removes output sockets and keeps the node bounds stable.

## Packaging

After implementation and verification, rebuild the portable zip under:

`user/ninebot_flux_lora_training/portable_bundles/`

The zip must include updated Python files, frontend JS, README, tests, and install notes.

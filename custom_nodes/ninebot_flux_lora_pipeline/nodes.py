from __future__ import annotations

from pathlib import Path

try:
    from .pipeline import PipelineInputs, execute_pipeline, save_comfy_image_batch
except ImportError:
    from pipeline import PipelineInputs, execute_pipeline, save_comfy_image_batch


COMFY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASETS_ROOT = COMFY_ROOT / "user" / "ninebot_flux_lora_training" / "datasets"
DEFAULT_INPUTS_ROOT = DEFAULT_DATASETS_ROOT / "linked_inputs"


class NinebotFluxLoRAAdvancedSettings:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "training_resolution": ("INT", {"default": 1024, "min": 64, "max": 4096, "step": 64}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 16, "step": 1}),
                "num_repeats": ("INT", {"default": 1, "min": 1, "max": 100, "step": 1}),
                "blocks_to_swap": ("INT", {"default": 8, "min": 0, "max": 64, "step": 1}),
                "fp8_base": ("BOOLEAN", {"default": True}),
                "gradient_dtype": (["bf16", "fp16", "fp32"], {"default": "bf16"}),
                "attention_mode": (["sdpa", "xformers", "disabled"], {"default": "sdpa"}),
                "sample_prompts": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": True,
                    },
                ),
            },
        }

    RETURN_TYPES = ("NINEBOT_FLUX_LORA_ADVANCED",)
    RETURN_NAMES = ("advanced_settings",)
    FUNCTION = "build"
    CATEGORY = "Ninebot/FLUX LoRA"

    def build(
        self,
        training_resolution,
        batch_size,
        num_repeats,
        blocks_to_swap,
        fp8_base,
        gradient_dtype,
        attention_mode,
        sample_prompts,
    ):
        return ({
            "training_resolution": int(training_resolution),
            "batch_size": int(batch_size),
            "num_repeats": int(num_repeats),
            "blocks_to_swap": int(blocks_to_swap),
            "fp8_base": bool(fp8_base),
            "gradient_dtype": gradient_dtype,
            "attention_mode": attention_mode,
            "sample_prompts": str(sample_prompts).strip(),
        },)


class NinebotFluxLoRATrainPipeline:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "uploaded_images": ("STRING", {"default": "", "multiline": True}),
                "trigger_word": ("STRING", {"default": "ninebot_motorcycle_style", "multiline": False}),
                "dry_run": ("BOOLEAN", {"default": True}),
                "output_lora_name": ("STRING", {"default": "ninebot_motorcycle_flux_v003", "multiline": False}),
                "lora_rank": ("INT", {"default": 8, "min": 1, "max": 1024, "step": 1}),
                "max_train_steps": ("INT", {"default": 600, "min": 1, "max": 100000, "step": 1}),
                "learning_rate": ("FLOAT", {"default": 0.0001, "min": 0.0, "max": 1.0, "step": 0.000001}),
            },
            "optional": {
                "training_images": ("IMAGE",),
                "advanced_settings": ("NINEBOT_FLUX_LORA_ADVANCED",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "run"
    CATEGORY = "Ninebot/FLUX LoRA"
    OUTPUT_NODE = True

    def run(
        self,
        uploaded_images,
        trigger_word,
        dry_run,
        output_lora_name,
        lora_rank,
        max_train_steps,
        learning_rate,
        training_images=None,
        advanced_settings=None,
        unique_id=None,
    ):
        run_id = str(unique_id or "manual")
        image_list = [line.strip() for line in str(uploaded_images).splitlines() if line.strip()]
        image_list.extend(save_comfy_image_batch(training_images, DEFAULT_INPUTS_ROOT, run_id=run_id))
        inputs = PipelineInputs(
            uploaded_images=image_list,
            trigger_word=trigger_word,
            dry_run=bool(dry_run),
            output_lora_name=output_lora_name,
            lora_rank=int(lora_rank),
            max_train_steps=int(max_train_steps),
            learning_rate=float(learning_rate),
            advanced_settings=advanced_settings,
        )
        result = execute_pipeline(inputs, DEFAULT_DATASETS_ROOT, run_id=run_id)
        return {
            "ui": {"text": result.captions[:20], "lora_path": [result.lora_path] if result.lora_path else []},
            "result": (),
        }


NODE_CLASS_MAPPINGS = {
    "NinebotFluxLoRAAdvancedSettings": NinebotFluxLoRAAdvancedSettings,
    "NinebotFluxLoRATrainPipeline": NinebotFluxLoRATrainPipeline,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NinebotFluxLoRAAdvancedSettings": "Ninebot FLUX LoRA Advanced Settings",
    "NinebotFluxLoRATrainPipeline": "Ninebot FLUX LoRA Train Pipeline",
}

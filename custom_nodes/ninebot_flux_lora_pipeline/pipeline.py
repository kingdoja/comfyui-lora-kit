from __future__ import annotations

import json
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
CACHE_MODES = {"disk", "memory", "disabled"}
GRADIENT_DTYPES = {"fp32", "fp16", "bf16"}
SAVE_DTYPES = {"fp32", "fp16", "bf16"}
ATTENTION_MODES = {"sdpa", "xformers", "disabled"}
GRADIENT_CHECKPOINTING_MODES = {"enabled", "enabled_with_cpu_offloading", "disabled"}
OPTIMIZER_TYPES = {
    "adamw8bit",
    "adamw",
    "prodigy",
    "CAME",
    "Lion8bit",
    "Lion",
    "adamwschedulefree",
    "sgdschedulefree",
    "AdEMAMix8bit",
    "PagedAdEMAMix8bit",
    "ProdigyPlusScheduleFree",
}
LR_SCHEDULERS = {"constant", "cosine", "cosine_with_restarts", "polynomial", "constant_with_warmup"}
@dataclass(frozen=True)
class PipelineInputs:
    uploaded_images: Sequence[str]
    trigger_word: str = "ninebot_motorcycle_style"
    dry_run: bool = True
    output_lora_name: str = "ninebot_motorcycle_flux_v003"
    lora_rank: int = 8
    max_train_steps: int = 600
    learning_rate: float = 0.0001
    advanced_settings: Mapping[str, Any] | None = None


@dataclass(frozen=True)
class StagedDataset:
    run_id: str
    dataset_dir: Path
    image_paths: list[str]


@dataclass(frozen=True)
class PipelineResult:
    lora_name: str
    lora_path: str
    captions: list[str]
    dataset_dir: str
    manifest_path: str


class TriggerOnlyCaptioner:
    def captions_for(self, image_paths: Sequence[str], trigger_word: str) -> list[str]:
        trigger = str(trigger_word).strip()
        return [trigger for _ in image_paths]


class FluxTrainerAdapter:
    def __init__(self, node_mappings: dict | None = None):
        self.node_mappings = node_mappings

    def _mappings(self) -> dict:
        if self.node_mappings is not None:
            return self.node_mappings
        try:
            import nodes as comfy_nodes
        except Exception as exc:
            raise RuntimeError("缺少 FluxTrainer：请安装 ComfyUI-FluxTrainer") from exc
        return getattr(comfy_nodes, "NODE_CLASS_MAPPINGS", {})

    def _node(self, name: str):
        mappings = self._mappings()
        node_class = mappings.get(name)
        if node_class is None:
            raise RuntimeError(f"缺少 FluxTrainer 节点：{name}")
        return node_class()

    def train(self, config: dict) -> dict:
        flux_models = self._node("FluxTrainModelSelect").loadmodel(
            config["transformer"],
            config["vae"],
            config["clip_l"],
            config["t5"],
            config.get("lora_path", ""),
        )[0]
        dataset_general = self._node("TrainDatasetGeneralConfig").create_config(
            shuffle_caption=False,
            caption_dropout_rate=0.0,
            color_aug=False,
            flip_aug=False,
            alpha_mask=False,
            reset_on_queue=False,
            caption_extension=".txt",
        )[0]
        dataset = self._node("TrainDatasetAdd").create_config(
            dataset_general,
            config["dataset_path"],
            config["class_tokens"],
            config.get("training_resolution", 1024),
            config.get("training_resolution", 1024),
            config.get("batch_size", 1),
            config.get("num_repeats", 1),
            True,
            False,
            512,
            config.get("training_resolution", 1024),
        )[0]
        optimizer_settings = self._node("OptimizerConfig").create_config(
            min_snr_gamma=0.0,
            extra_optimizer_args="",
            optimizer_type=config.get("optimizer_type", "adamw8bit"),
            max_grad_norm=1.0,
            lr_scheduler=config.get("lr_scheduler", "constant"),
            lr_warmup_steps=0,
            lr_scheduler_num_cycles=1,
            lr_scheduler_power=1.0,
        )[0]
        network_trainer = self._node("InitFluxLoRATraining").init_training(
            flux_models=flux_models,
            dataset=dataset,
            optimizer_settings=optimizer_settings,
            sample_prompts=config.get("sample_prompts", f'{config["class_tokens"]}, product render'),
            output_name=config["output_name"],
            attention_mode=config["attention_mode"],
            gradient_dtype=config["gradient_dtype"],
            save_dtype=config["save_dtype"],
            output_dir=config.get("output_dir", f'output/ninebot_flux_lora_training/{config["output_name"]}'),
            network_dim=config["network_dim"],
            network_alpha=config["network_alpha"],
            learning_rate=config["learning_rate"],
            max_train_steps=config["max_train_steps"],
            apply_t5_attn_mask=True,
            cache_latents=config["cache_latents"],
            cache_text_encoder_outputs=config["cache_text_encoder_outputs"],
            blocks_to_swap=config["blocks_to_swap"],
            weighting_scheme=config.get("weighting_scheme", "none"),
            logit_mean=0.0,
            logit_std=1.0,
            mode_scale=1.29,
            timestep_sampling=config.get("timestep_sampling", "flux_shift"),
            sigmoid_scale=1.0,
            model_prediction_type="raw",
            guidance_scale=1.0,
            discrete_flow_shift=3.1582,
            highvram=False,
            fp8_base=config["fp8_base"],
            gradient_checkpointing=config.get("gradient_checkpointing", "enabled"),
            train_text_encoder="disabled",
            clip_l_lr=0.0,
            T5_lr=0.0,
        )[0]
        network_trainer = self._node("FluxTrainLoop").train(network_trainer)[0]
        network_trainer = self._node("FluxTrainSave").save(
            network_trainer,
            save_state=False,
            copy_to_comfy_lora_folder=True,
        )[0]
        lora_name, metadata, lora_path = self._node("FluxTrainEnd").endtrain(network_trainer, save_state=False)
        return {"lora_name": lora_name, "metadata": metadata, "lora_path": lora_path}


def _clean_name(name: str) -> str:
    chars = [c if c.isalnum() or c in "._-" else "_" for c in str(name).strip()]
    return "".join(chars).strip("._") or "ninebot_lora"


def _as_mapping(value: Any) -> Mapping[str, Any]:
    if value is None:
        return {}
    if isinstance(value, Mapping):
        return value
    if isinstance(value, (list, tuple)) and value and isinstance(value[0], Mapping):
        return value[0]
    return {}


def _clamp_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def _positive_float(value: Any, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _choice(value: Any, allowed: set[str], default: str) -> str:
    text = str(value)
    return text if text in allowed else default


def _sample_prompts(value: Any, trigger: str) -> str:
    return str(value or "").strip()


def normalize_advanced_settings(settings: Any, rank: int) -> dict:
    source = _as_mapping(settings)
    network_alpha = _positive_float(source.get("network_alpha"), float(rank))
    normalized = {
        "training_resolution": _clamp_int(source.get("training_resolution"), 1024, 64, 4096),
        "batch_size": _clamp_int(source.get("batch_size"), 1, 1, 16),
        "num_repeats": _clamp_int(source.get("num_repeats"), 1, 1, 100),
        "network_alpha": network_alpha,
        "cache_latents": _choice(source.get("cache_latents", "memory"), CACHE_MODES, "memory"),
        "cache_text_encoder_outputs": _choice(
            source.get("cache_text_encoder_outputs", "memory"),
            CACHE_MODES,
            "memory",
        ),
        "blocks_to_swap": _clamp_int(source.get("blocks_to_swap"), 8, 0, 64),
        "gradient_checkpointing": _choice(
            source.get("gradient_checkpointing", "enabled"),
            GRADIENT_CHECKPOINTING_MODES,
            "enabled",
        ),
        "fp8_base": bool(source.get("fp8_base", True)),
        "gradient_dtype": _choice(source.get("gradient_dtype", "bf16"), GRADIENT_DTYPES, "bf16"),
        "save_dtype": _choice(source.get("save_dtype", "bf16"), SAVE_DTYPES, "bf16"),
        "attention_mode": _choice(source.get("attention_mode", "sdpa"), ATTENTION_MODES, "sdpa"),
        "optimizer_type": _choice(source.get("optimizer_type", "adamw8bit"), OPTIMIZER_TYPES, "adamw8bit"),
        "lr_scheduler": _choice(source.get("lr_scheduler", "constant"), LR_SCHEDULERS, "constant"),
    }
    if str(source.get("sample_prompts", "")).strip():
        normalized["sample_prompts"] = _sample_prompts(source.get("sample_prompts"), "")
    return normalized


def stage_uploaded_images(
    uploaded_images: Iterable[str],
    datasets_root: str | Path,
    run_id: str | None = None,
) -> StagedDataset:
    images = [Path(p).expanduser().resolve() for p in uploaded_images if str(p).strip()]
    if not images:
        raise ValueError("请先上传训练图片")

    for image in images:
        if image.suffix.lower() not in IMAGE_EXTENSIONS or not image.is_file():
            raise ValueError(f"不是有效训练图片: {image}")

    resolved_run_id = _clean_name(run_id or uuid.uuid4().hex[:12])
    datasets_root = Path(datasets_root).expanduser().resolve()
    dataset_dir = datasets_root / "pipeline_uploads" / resolved_run_id / "style"
    if dataset_dir.exists():
        shutil.rmtree(dataset_dir)
    dataset_dir.mkdir(parents=True, exist_ok=True)

    staged_paths: list[str] = []
    for index, source in enumerate(images, start=1):
        target = dataset_dir / f"{index:03d}_{source.name}"
        shutil.copy2(source, target)
        staged_paths.append(str(target))

    return StagedDataset(run_id=resolved_run_id, dataset_dir=dataset_dir, image_paths=staged_paths)


def _comfy_image_arrays(training_images) -> list:
    if training_images is None:
        return []
    if isinstance(training_images, (list, tuple)):
        arrays = []
        for item in training_images:
            arrays.extend(_comfy_image_arrays(item))
        return arrays

    if hasattr(training_images, "detach"):
        training_images = training_images.detach().cpu().numpy()

    import numpy as np

    array = np.asarray(training_images)
    if array.ndim == 3:
        array = array[None, ...]
    if array.ndim != 4 or array.shape[-1] not in (1, 3, 4):
        raise ValueError(f"Unsupported IMAGE input shape: {array.shape}")
    return [array[index] for index in range(array.shape[0])]


def save_comfy_image_batch(training_images, output_root: str | Path, run_id: str | None = None) -> list[str]:
    arrays = _comfy_image_arrays(training_images)
    if not arrays:
        return []

    import numpy as np
    from PIL import Image

    target_dir = Path(output_root).expanduser().resolve() / _clean_name(run_id or uuid.uuid4().hex[:12])
    target_dir.mkdir(parents=True, exist_ok=True)

    paths: list[str] = []
    for index, array in enumerate(arrays, start=1):
        pixels = np.asarray(array)
        if pixels.dtype.kind == "f":
            pixels = pixels * 255.0
        pixels = np.clip(pixels, 0, 255).astype("uint8")
        if pixels.shape[-1] == 1:
            pixels = pixels[:, :, 0]
        image = Image.fromarray(pixels)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        path = target_dir / f"{index:03d}_training_image.png"
        image.save(path)
        paths.append(str(path))
    return paths


def write_caption_sidecars(
    image_paths: Sequence[str],
    captions: Sequence[str],
    trigger_word: str,
    dry_run: bool,
) -> Path:
    trigger = str(trigger_word).strip()
    if not trigger:
        raise ValueError("触发词不能为空")
    if len(image_paths) != len(captions):
        raise ValueError(f"Image/caption count mismatch: {len(image_paths)} images, {len(captions)} captions")
    if not image_paths:
        raise ValueError("请先上传训练图片")

    manifest_dir = Path(image_paths[0]).parent
    written: list[str] = []
    preview: list[dict[str, str]] = []

    for image_path, caption in zip(image_paths, captions):
        image = Path(image_path)
        text_path = image.with_suffix(".txt")
        text = str(caption).strip() or trigger
        preview.append({"image": str(image), "txt": str(text_path), "caption": text})
        if not dry_run:
            text_path.write_text(text, encoding="utf-8", newline="\n")
            written.append(str(text_path))

    manifest_path = manifest_dir / "_ninebot_pipeline_manifest.json"
    manifest = {
        "trigger_word": trigger,
        "dry_run": bool(dry_run),
        "written_count": len(written),
        "preview": preview,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def build_flux_train_config(inputs: PipelineInputs, dataset_dir: str) -> dict:
    rank = int(inputs.lora_rank)
    trigger = str(inputs.trigger_word).strip()
    config = {
        "transformer": "flux1-dev.safetensors",
        "vae": "ae.safetensors",
        "clip_l": "clip_l.safetensors",
        "t5": "t5xxl_fp16.safetensors",
        "dataset_path": dataset_dir,
        "class_tokens": trigger,
        "output_name": _clean_name(inputs.output_lora_name),
        "output_dir": f"output/ninebot_flux_lora_training/{_clean_name(inputs.output_lora_name)}",
        "network_dim": rank,
        "network_alpha": float(rank),
        "max_train_steps": int(inputs.max_train_steps),
        "learning_rate": float(inputs.learning_rate),
        "training_resolution": 1024,
        "batch_size": 1,
        "num_repeats": 1,
        "fp8_base": True,
        "gradient_dtype": "bf16",
        "save_dtype": "bf16",
        "cache_latents": "memory",
        "cache_text_encoder_outputs": "memory",
        "blocks_to_swap": 8,
        "weighting_scheme": "none",
        "timestep_sampling": "flux_shift",
        "attention_mode": "sdpa",
        "gradient_checkpointing": "enabled",
        "optimizer_type": "adamw8bit",
        "lr_scheduler": "constant",
        "sample_prompts": "",
    }
    if inputs.advanced_settings:
        config.update(normalize_advanced_settings(inputs.advanced_settings, rank))
    return config


def execute_pipeline(
    inputs: PipelineInputs,
    datasets_root: str | Path,
    captioner=None,
    trainer=None,
    run_id: str | None = None,
) -> PipelineResult:
    captioner = captioner or TriggerOnlyCaptioner()
    trainer = trainer or FluxTrainerAdapter()

    staged = stage_uploaded_images(inputs.uploaded_images, datasets_root, run_id=run_id)
    captions = captioner.captions_for(staged.image_paths, inputs.trigger_word)
    manifest_path = write_caption_sidecars(
        staged.image_paths,
        captions,
        inputs.trigger_word,
        dry_run=False,
    )

    if inputs.dry_run:
        return PipelineResult(
            lora_name="",
            lora_path="",
            captions=captions,
            dataset_dir=str(staged.dataset_dir),
            manifest_path=str(manifest_path),
        )

    train_config = build_flux_train_config(inputs, str(staged.dataset_dir))
    trained = trainer.train(train_config)
    return PipelineResult(
        lora_name=str(trained["lora_name"]),
        lora_path=str(trained["lora_path"]),
        captions=captions,
        dataset_dir=str(staged.dataset_dir),
        manifest_path=str(manifest_path),
    )

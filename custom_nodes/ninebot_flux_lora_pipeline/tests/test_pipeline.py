import json
import importlib.util
import sys
import tempfile
import unittest
from types import SimpleNamespace
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import (
    FluxTrainerAdapter,
    PipelineInputs,
    build_flux_train_config,
    save_comfy_image_batch,
    stage_uploaded_images,
    write_caption_sidecars,
)


def load_pipeline_nodes_module():
    path = Path(__file__).resolve().parents[1] / "nodes.py"
    spec = importlib.util.spec_from_file_location("ninebot_flux_lora_pipeline_nodes_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PipelineHelperTests(unittest.TestCase):
    def _image(self, folder: Path, name: str) -> Path:
        path = folder / name
        Image.new("RGB", (8, 8), (255, 0, 0)).save(path)
        return path

    def test_stage_uploaded_images_copies_images_to_style_dataset(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = self._image(root, "motor.png")

            staged = stage_uploaded_images([str(source)], root / "datasets", run_id="run123")

            expected = root / "datasets" / "pipeline_uploads" / "run123" / "style" / "001_motor.png"
            self.assertEqual(len(staged.image_paths), 1)
            self.assertEqual(staged.dataset_dir.name, "style")
            self.assertTrue(expected.exists())

    def test_stage_uploaded_images_replaces_stale_files_for_same_run_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = self._image(root, "fresh.png")
            stale_dir = root / "datasets" / "pipeline_uploads" / "run123" / "style"
            stale_dir.mkdir(parents=True)
            (stale_dir / "001_old.png").write_bytes(b"old")
            (stale_dir / "001_old.txt").write_text("old caption", encoding="utf-8")

            staged = stage_uploaded_images([str(source)], root / "datasets", run_id="run123")

            self.assertEqual(len(staged.image_paths), 1)
            self.assertTrue((stale_dir / "001_fresh.png").exists())
            self.assertFalse((stale_dir / "001_old.png").exists())
            self.assertFalse((stale_dir / "001_old.txt").exists())

    def test_write_caption_sidecars_writes_txt_and_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = self._image(root, "motor.png")

            manifest = write_caption_sidecars(
                image_paths=[str(image)],
                captions=["ninebot_motorcycle_style, product render"],
                trigger_word="ninebot_motorcycle_style",
                dry_run=False,
            )

            self.assertEqual(
                image.with_suffix(".txt").read_text(encoding="utf-8"),
                "ninebot_motorcycle_style, product render",
            )
            data = json.loads(manifest.read_text(encoding="utf-8"))
            self.assertEqual(data["written_count"], 1)

    def test_write_caption_sidecars_dry_run_does_not_write_txt(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = self._image(root, "motor.png")

            manifest = write_caption_sidecars(
                image_paths=[str(image)],
                captions=["ninebot_motorcycle_style, product render"],
                trigger_word="ninebot_motorcycle_style",
                dry_run=True,
            )

            self.assertFalse(image.with_suffix(".txt").exists())
            data = json.loads(manifest.read_text(encoding="utf-8"))
            self.assertEqual(data["written_count"], 0)
            self.assertEqual(data["preview"][0]["caption"], "ninebot_motorcycle_style, product render")

    def test_build_flux_train_config_maps_visible_inputs_to_fluxtrainer_defaults(self):
        inputs = PipelineInputs(
            uploaded_images=["C:/data/motor.png"],
            trigger_word="ninebot_motorcycle_style",
            dry_run=False,
            output_lora_name="ninebot_motorcycle_flux_v003",
            lora_rank=8,
            max_train_steps=600,
            learning_rate=0.0001,
        )

        config = build_flux_train_config(inputs, dataset_dir="C:/dataset/style")

        self.assertEqual(config["network_dim"], 8)
        self.assertEqual(config["network_alpha"], 8.0)
        self.assertEqual(config["max_train_steps"], 600)
        self.assertEqual(config["learning_rate"], 0.0001)
        self.assertEqual(config["fp8_base"], True)
        self.assertEqual(config["cache_latents"], "memory")
        self.assertEqual(config["cache_text_encoder_outputs"], "memory")
        self.assertEqual(config["blocks_to_swap"], 8)
        self.assertEqual(config["sample_prompts"], "")
        self.assertNotIn("three-wheeled motorcycle", config["sample_prompts"])

    def test_build_flux_train_config_applies_connected_advanced_settings(self):
        inputs = PipelineInputs(
            uploaded_images=["C:/data/motor.png"],
            trigger_word="ninebot_motorcycle_style",
            dry_run=False,
            output_lora_name="ninebot_motorcycle_flux_v003",
            lora_rank=8,
            max_train_steps=600,
            learning_rate=0.0001,
            advanced_settings={
                "training_resolution": 768,
                "batch_size": 2,
                "num_repeats": 3,
                "blocks_to_swap": 8,
                "fp8_base": False,
                "gradient_dtype": "fp16",
                "attention_mode": "xformers",
                "sample_prompts": "ninebot_style, front product view|ninebot_style, side product view",
            },
        )

        config = build_flux_train_config(inputs, dataset_dir="C:/dataset/style")

        self.assertEqual(config["training_resolution"], 768)
        self.assertEqual(config["batch_size"], 2)
        self.assertEqual(config["num_repeats"], 3)
        self.assertEqual(config["network_alpha"], 8.0)
        self.assertEqual(config["cache_latents"], "memory")
        self.assertEqual(config["cache_text_encoder_outputs"], "memory")
        self.assertEqual(config["blocks_to_swap"], 8)
        self.assertEqual(config["gradient_checkpointing"], "enabled")
        self.assertEqual(config["fp8_base"], False)
        self.assertEqual(config["gradient_dtype"], "fp16")
        self.assertEqual(config["save_dtype"], "bf16")
        self.assertEqual(config["attention_mode"], "xformers")
        self.assertEqual(config["optimizer_type"], "adamw8bit")
        self.assertEqual(config["lr_scheduler"], "constant")
        self.assertEqual(config["sample_prompts"], "ninebot_style, front product view|ninebot_style, side product view")

    def test_build_flux_train_config_zero_advanced_alpha_follows_rank(self):
        inputs = PipelineInputs(
            uploaded_images=["C:/data/motor.png"],
            lora_rank=12,
            advanced_settings={"network_alpha": 0.0},
        )

        config = build_flux_train_config(inputs, dataset_dir="C:/dataset/style")

        self.assertEqual(config["network_dim"], 12)
        self.assertEqual(config["network_alpha"], 12.0)

    def test_save_comfy_image_batch_writes_each_image_to_png(self):
        import numpy as np

        with tempfile.TemporaryDirectory() as tmp:
            images = np.zeros((2, 8, 8, 3), dtype=np.float32)
            images[0, :, :, 0] = 1.0
            images[1, :, :, 1] = 1.0

            paths = save_comfy_image_batch(images, Path(tmp), run_id="run123")

            self.assertEqual(len(paths), 2)
            self.assertEqual(Path(paths[0]).name, "001_training_image.png")
            self.assertEqual(Path(paths[1]).name, "002_training_image.png")
            self.assertTrue(Path(paths[0]).exists())
            self.assertTrue(Path(paths[1]).exists())


class PipelineNodeTests(unittest.TestCase):
    def test_node_input_types_expose_visible_controls(self):
        NinebotFluxLoRATrainPipeline = load_pipeline_nodes_module().NinebotFluxLoRATrainPipeline

        schema = NinebotFluxLoRATrainPipeline.INPUT_TYPES()
        inputs = schema["required"]
        optional = schema["optional"]

        self.assertIn("uploaded_images", inputs)
        self.assertEqual(optional["training_images"][0], "IMAGE")
        self.assertEqual(optional["advanced_settings"][0], "NINEBOT_FLUX_LORA_ADVANCED")
        self.assertIn("trigger_word", inputs)
        self.assertIn("dry_run", inputs)
        self.assertIn("output_lora_name", inputs)
        self.assertIn("lora_rank", inputs)
        self.assertIn("max_train_steps", inputs)
        self.assertIn("learning_rate", inputs)

    def test_node_does_not_expose_output_sockets(self):
        NinebotFluxLoRATrainPipeline = load_pipeline_nodes_module().NinebotFluxLoRATrainPipeline

        self.assertEqual(NinebotFluxLoRATrainPipeline.RETURN_NAMES, ())
        self.assertEqual(NinebotFluxLoRATrainPipeline.RETURN_TYPES, ())

    def test_init_exports_node_mapping_and_web_directory(self):
        import importlib

        custom_nodes_dir = Path(__file__).resolve().parents[2]
        if str(custom_nodes_dir) not in sys.path:
            sys.path.insert(0, str(custom_nodes_dir))

        module = importlib.import_module("ninebot_flux_lora_pipeline")


        self.assertIn("NinebotFluxLoRATrainPipeline", module.NODE_CLASS_MAPPINGS)
        self.assertIn("NinebotFluxLoRAAdvancedSettings", module.NODE_CLASS_MAPPINGS)
        self.assertEqual(module.WEB_DIRECTORY, "./web")

    def test_advanced_settings_node_returns_payload(self):
        module = load_pipeline_nodes_module()
        required = module.NinebotFluxLoRAAdvancedSettings.INPUT_TYPES()["required"]

        self.assertEqual(
            list(required),
            [
                "training_resolution",
                "batch_size",
                "num_repeats",
                "blocks_to_swap",
                "fp8_base",
                "gradient_dtype",
                "attention_mode",
                "sample_prompts",
            ],
        )

        payload = module.NinebotFluxLoRAAdvancedSettings().build(
            training_resolution=768,
            batch_size=2,
            num_repeats=3,
            blocks_to_swap=8,
            fp8_base=False,
            gradient_dtype="fp16",
            attention_mode="xformers",
            sample_prompts="ninebot_style, front product view|ninebot_style, side product view",
        )[0]

        self.assertEqual(payload["training_resolution"], 768)
        self.assertEqual(payload["blocks_to_swap"], 8)
        self.assertFalse(payload["fp8_base"])
        self.assertEqual(payload["sample_prompts"], "ninebot_style, front product view|ninebot_style, side product view")

    def test_node_run_returns_lora_path_as_ui_list(self):
        module = load_pipeline_nodes_module()
        original_execute_pipeline = module.execute_pipeline
        try:
            module.execute_pipeline = lambda *args, **kwargs: SimpleNamespace(
                captions=["caption"],
                lora_path="C:/out/ninebot_test.safetensors",
            )

            result = module.NinebotFluxLoRATrainPipeline().run(
                uploaded_images="C:/input/motor.png",
                trigger_word="ninebot_style",
                dry_run=False,
                output_lora_name="ninebot_test",
                lora_rank=8,
                max_train_steps=1,
                learning_rate=0.0001,
                training_images=None,
                advanced_settings={"cache_latents": "disk"},
                unique_id="unit",
            )
        finally:
            module.execute_pipeline = original_execute_pipeline

        self.assertEqual(result["ui"]["lora_path"], ["C:/out/ninebot_test.safetensors"])


class FakeCaptioner:
    def captions_for(self, image_paths, trigger_word):
        return [f"{trigger_word}, generated caption {index}" for index, _ in enumerate(image_paths, start=1)]


class FakeTrainer:
    def train(self, config):
        return {
            "lora_name": config["output_name"],
            "lora_path": str(Path(config["dataset_path"]).parent / f"{config['output_name']}.safetensors"),
        }


class FakeFluxModelSelect:
    def loadmodel(self, transformer, vae, clip_l, t5, lora_path=""):
        return ({"transformer": transformer, "vae": vae, "clip_l": clip_l, "t5": t5, "lora_path": lora_path},)


class FakeDatasetGeneral:
    def create_config(self, shuffle_caption, caption_dropout_rate, color_aug, flip_aug, alpha_mask, reset_on_queue=False, caption_extension=".txt"):
        return ({"datasets": "{}", "alpha_mask": alpha_mask, "general": caption_extension},)


class FakeDatasetAdd:
    def create_config(self, dataset_config, dataset_path, class_tokens, width, height, batch_size, num_repeats, enable_bucket, bucket_no_upscale, min_bucket_reso, max_bucket_reso, regularization=None):
        dataset_config["dataset_path"] = dataset_path
        dataset_config["class_tokens"] = class_tokens
        dataset_config["width"] = width
        dataset_config["height"] = height
        return (dataset_config,)


class FakeOptimizer:
    def create_config(self, min_snr_gamma, extra_optimizer_args, **kwargs):
        kwargs["min_snr_gamma"] = None
        kwargs["optimizer_args"] = []
        return (kwargs,)


class FakeInit:
    def init_training(self, flux_models, dataset, optimizer_settings, sample_prompts, output_name, attention_mode, gradient_dtype, save_dtype, **kwargs):
        return ({"flux_models": flux_models, "dataset": dataset, "optimizer_settings": optimizer_settings, "kwargs": kwargs}, 1, {"args": True})


class FakeLoop:
    def train(self, network_trainer):
        return ({"looped": network_trainer}, 2)


class FakeSave:
    def save(self, network_trainer, save_state, copy_to_comfy_lora_folder):
        return (network_trainer, "C:/out/step.safetensors", 2)


class FakeEnd:
    def endtrain(self, network_trainer, save_state):
        return ("ninebot_test_rank8_bf16", "{}", "C:/out/final.safetensors")


class FluxTrainerAdapterTests(unittest.TestCase):
    def test_flux_trainer_adapter_calls_existing_node_classes(self):
        mappings = {
            "FluxTrainModelSelect": FakeFluxModelSelect,
            "TrainDatasetGeneralConfig": FakeDatasetGeneral,
            "TrainDatasetAdd": FakeDatasetAdd,
            "OptimizerConfig": FakeOptimizer,
            "InitFluxLoRATraining": FakeInit,
            "FluxTrainLoop": FakeLoop,
            "FluxTrainSave": FakeSave,
            "FluxTrainEnd": FakeEnd,
        }
        adapter = FluxTrainerAdapter(node_mappings=mappings)

        result = adapter.train({
            "transformer": "flux1-dev.safetensors",
            "vae": "ae.safetensors",
            "clip_l": "clip_l.safetensors",
            "t5": "t5xxl_fp16.safetensors",
            "dataset_path": "C:/dataset/style",
            "class_tokens": "ninebot_motorcycle_style",
            "output_name": "ninebot_test",
            "network_dim": 8,
            "network_alpha": 8.0,
            "max_train_steps": 600,
            "learning_rate": 0.0001,
            "fp8_base": True,
            "gradient_dtype": "bf16",
            "save_dtype": "bf16",
            "cache_latents": "memory",
            "cache_text_encoder_outputs": "memory",
            "blocks_to_swap": 8,
            "attention_mode": "sdpa",
        })

        self.assertEqual(result["lora_name"], "ninebot_test_rank8_bf16")
        self.assertEqual(result["lora_path"], "C:/out/final.safetensors")


class PipelineExecutionTests(unittest.TestCase):
    def _image(self, folder: Path, name: str) -> Path:
        path = folder / name
        Image.new("RGB", (8, 8), (0, 255, 0)).save(path)
        return path

    def test_execute_pipeline_dry_run_skips_training(self):
        from pipeline import execute_pipeline

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = self._image(root, "motor.png")

            result = execute_pipeline(
                PipelineInputs([str(image)], dry_run=True),
                datasets_root=root / "datasets",
                captioner=FakeCaptioner(),
                trainer=FakeTrainer(),
                run_id="run123",
            )

            self.assertEqual(result.lora_path, "")
            self.assertIn("generated caption", result.captions[0])
            self.assertTrue(Path(result.manifest_path).exists())
            self.assertTrue(Path(result.dataset_dir).exists())

    def test_execute_pipeline_training_returns_lora_path(self):
        from pipeline import execute_pipeline

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = self._image(root, "motor.png")

            result = execute_pipeline(
                PipelineInputs([str(image)], dry_run=False, output_lora_name="ninebot_test"),
                datasets_root=root / "datasets",
                captioner=FakeCaptioner(),
                trainer=FakeTrainer(),
                run_id="run123",
            )

            self.assertEqual(result.lora_name, "ninebot_test")
            self.assertTrue(result.lora_path.endswith("ninebot_test.safetensors"))


if __name__ == "__main__":
    unittest.main()

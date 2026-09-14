# Ninebot FLUX LoRA Training Bundle

面向 FLUX.1-dev 的可迁移训练 bundle，包含环境脚本、训练配置、数据集 caption 规范和 ComfyUI 推理 workflow。示例以电动越野摩托车的风格一致性、车型和视角控制为目标，适合内部实验与面试展示工程闭环。

## 你能从这个 bundle 看到什么

- 如何把 FLUX 训练依赖与 ComfyUI 主环境隔离。
- 如何用 trigger token、`style`/`views` 子集和 sidecar caption 组织数据集。
- 如何针对 RTX 4080 16GB 设计 fp8/bf16/SDPA 的平衡配置。
- 如何用独立的 FLUX LoRA workflow 做训练后回归验证。

## 环境参考

- GPU：NVIDIA GeForce RTX 4080（16GB VRAM）
- Python：3.11.9 embedded
- PyTorch：2.12.1 + cu130
- 训练底层：kohya-ss/sd-scripts / FluxTrainer

这些是本地验证路径，不是运行本项目的硬性规格；请根据目标机器调整分辨率、batch size 和 blocks-to-swap。

## 快速开始

```powershell
powershell -ExecutionPolicy Bypass -File requirements\setup_flux_training.ps1
powershell -ExecutionPolicy Bypass -File training\scripts\setup_flux_trainer.ps1
```

建议阅读顺序：

1. `docs/install.md`：依赖与模型目录。
2. `docs/dataset_caption_guide.md`：trigger token、子集和 caption 模板。
3. `docs/usage.md`：训练、输出和推理验证。
4. `docs/model_sources.md`：模型来源与使用条款。

## 数据与触发词

统一触发词：

```text
ninebot_motorcycle_style
```

caption 示例：

```text
ninebot_motorcycle_style, electric off-road motorcycle, front three-quarter view, rugged tires, matte black body panels, product photography, neutral studio lighting
```

`style` 子集强调设计语言，`views` 子集强调 front/side/rear/three-quarter 等可控视角。每张图片必须有同名 `.txt`；训练前应人工复核，不把负面提示词写进 caption。

## 训练与验证入口

- 训练 workflow：由根目录 `custom_nodes/ninebot_flux_lora_pipeline` 编排，建议先执行 `dry_run`。
- 基础推理：`workflows/flux_dev_fp8_text2image.workflow.json`。
- LoRA 回归：`workflows/flux_dev_lora_test.workflow.json`，在 prompt 开头使用触发词。

## 重要边界

FLUX.1-dev 不是 SD1.5 checkpoint，不能复用旧版 SD1.5 训练脚本或模型目录。该 bundle 面向内部/非商业实验；下载和使用 FLUX.1-dev、第三方训练器前请确认各自许可证与模型条款。

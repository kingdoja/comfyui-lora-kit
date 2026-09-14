# Ninebot ComfyUI LoRA Kit

**中文** | [English](README.en.md)

> 面向 ComfyUI 的图像打标、LoRA 训练与效果验证工具包。将「数据准备 → caption → 训练 → 推理回归」整理为可导入、可复现、可迁移的工程链路。

这是一个以工程交付为目标的作品集项目：不重新实现训练算法，而是围绕 ComfyUI 自定义节点、workflow JSON、训练配置、依赖隔离和测试，把 WD14、FluxTrainer 与 sd-scripts 组合成一条可观察的工作流。

## 30 秒了解项目

| 你想做什么 | 从这里开始 | 你会得到什么 |
| --- | --- | --- |
| 给训练图片自动打标 | [caption workflow](workflows/ninebot_lora_training/lora_caption_mvp.workflow.json) | 与图片同名的 `.txt` caption，可人工复核 |
| 快速验证 SD1.5 LoRA 链路 | [SD1.5 smoke-test workflow](workflows/ninebot_lora_training/lora_training_mvp.workflow.json) | 依赖、路径和 `.safetensors` 输出验证 |
| 训练 FLUX LoRA | [NinebotFluxLoRATrainPipeline](custom_nodes/ninebot_flux_lora_pipeline/) | 上传、暂存、caption、训练和产物下载的一体化节点 |
| 检查 FLUX LoRA 是否生效 | [FLUX LoRA test workflow](workflows/ninebot_flux_lora_training/flux_dev_lora_test.workflow.json) | 使用触发词的推理回归入口 |

## 项目亮点

- **把复杂流程收敛到明确入口**：FLUX 节点负责输入校验、运行目录隔离、参数映射、状态反馈和下载路由；训练算法仍由 FluxTrainer / sd-scripts 执行。
- **打标结果可复核**：`LoRA Caption Load → WD14Tagger|pysssss → LoRA Caption Save` 将标签写回同名 sidecar，不把自动标签直接当作最终数据。
- **批次边界清晰**：新一批图片会替换旧的上传列表，每次运行使用独立 `run_id`，降低数据串批和产物混淆风险。
- **先验证、后训练**：`dry_run` 只执行暂存、caption 和 manifest；SD1.5 路线提供 1 epoch smoke test，便于先发现环境问题。
- **针对有限显存做了默认取舍**：提供 RTX 4080 16GB 参考配置，并将分辨率、batch、blocks-to-swap 等高风险旋钮收敛到 Advanced Settings。
- **适合迁移和审阅**：节点、workflow、训练 bundle、文档、测试和第三方依赖边界分层存放；仓库不携带模型权重和内部素材。

## 两条工作流

```text
SD1.5 / Legacy
图片目录 → LoRA Caption Load → WD14 Tagger → LoRA Caption Save
       → 人工复核 caption → Lora Training in ComfyUI → smoke test

FLUX
图片上传 → NinebotFluxLoRATrainPipeline
       → dry_run（staging + sidecar + manifest）
       → 正式训练（FluxTrainer）→ LoRA 保存 → 推理回归验证
```

### 打标与 SD1.5 训练

1. 打开 [打标 workflow](workflows/ninebot_lora_training/lora_caption_mvp.workflow.json)，将 `LoRA Caption Load` 指向只包含图片的目录。
2. 运行后确认每张图片旁都有同名 `.txt`，人工检查触发词、主体、视角、材质和背景。
3. 打开 [训练 smoke-test workflow](workflows/ninebot_lora_training/lora_training_mvp.workflow.json)，先用 1 epoch、batch size 1 验证 CUDA、checkpoint、`data_path` 和输出目录。
4. smoke test 通过后，再替换为正式数据集和训练参数。

### FLUX LoRA 节点

1. 将 [custom node package](custom_nodes/ninebot_flux_lora_pipeline/) 复制到目标 ComfyUI 的 `custom_nodes/`。
2. 安装 [第三方节点和模型依赖](THIRD_PARTY.md)，重启 ComfyUI。
3. 添加 `NinebotFluxLoRATrainPipeline`，一次上传本轮图片并设置唯一触发词，例如 `ninebot_motorcycle_style`。
4. 首次保持 `dry_run`，确认 staging 目录、`.txt` sidecar 和 `_ninebot_pipeline_manifest.json`。
5. 关闭 `dry_run` 后排队训练；完成后使用 [FLUX LoRA test workflow](workflows/ninebot_flux_lora_training/flux_dev_lora_test.workflow.json) 做推理回归。

## 快速开始

### 安装 FLUX bundle

```powershell
powershell -ExecutionPolicy Bypass -File bundles\flux_lora_training\requirements\setup_flux_training.ps1
powershell -ExecutionPolicy Bypass -File bundles\flux_lora_training\training\scripts\setup_flux_trainer.ps1
```

建议按这个顺序阅读：

1. [安装说明](bundles/flux_lora_training/docs/install.md)
2. [数据集与 caption 规范](bundles/flux_lora_training/docs/dataset_caption_guide.md)
3. [训练与验证用法](bundles/flux_lora_training/docs/usage.md)
4. [模型来源与条款](bundles/flux_lora_training/docs/model_sources.md)

### 依赖边界

本仓库只维护 Ninebot 封装、workflow、配置和文档。目标 ComfyUI 需要按实际路线额外安装 `ComfyUI-FluxTrainer`、`ComfyUI-WD14-Tagger`、`Image-Captioning-in-ComfyUI`、`Lora-Training-in-Comfy` 等组件；完整清单见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 工程证据

- Python 测试覆盖 pipeline、路由、输入校验、运行目录和下载路径。
- 前端测试覆盖上传列表替换、内联编辑、LoRA 路径 payload、Advanced Settings 和 widget 隐藏。
- workflow JSON、manifest、smoke-test 数据集和安装脚本共同构成可复现入口。
- 所有 workflow JSON 已通过 JSON 解析检查；仓库不声称正式模型效果评测或生产级并发调度。

## 目录结构

```text
custom_nodes/ninebot_flux_lora_pipeline/  # FLUX LoRA 编排节点、前端扩展和测试
workflows/                                # 可直接导入 ComfyUI 的 workflow JSON
bundles/flux_lora_training/               # FLUX 配置、脚本、caption 规范和推理 workflow
bundles/sd15_lora_training/               # SD1.5 / legacy 打标与训练 MVP
docs/dev_docs/                            # 架构、迁移、交付和实施文档
docs/superpowers/                         # 设计稿与执行计划
THIRD_PARTY.md                            # 第三方节点、模型和许可证边界
```

## 面试阅读路径

1. 先看本 README 的工作流总览，确认产品链路和边界。
2. 阅读 [FLUX 节点 README](custom_nodes/ninebot_flux_lora_pipeline/README.md)，关注节点职责、输入输出、dry run 和错误处理。
3. 打开 [打标/训练 workflow README](workflows/ninebot_lora_training/README.md)，查看数据集契约和 smoke-test 设计。
4. 最后阅读 `docs/dev_docs/` 与 `docs/superpowers/`，了解架构取舍、迁移方案和验收证据。

## 隐私与许可证

仓库不包含 checkpoint、LoRA、ONNX、safetensors、原始训练图片、PSD、生成图、日志、Hugging Face cache 或虚拟环境。使用 FLUX.1-dev、第三方节点和训练脚本时，请分别确认其许可证与模型使用条款；本项目默认面向内部、非商业实验。

# Ninebot ComfyUI LoRA Kit

> 面向 ComfyUI 的图像打标、LoRA 训练与效果验证工作流。把“数据准备 → caption → 训练 → 推理验证”整理成可迁移、可复现的工程交付物。

这个仓库是一个偏工程化的作品集项目：不重新实现训练算法，而是通过 ComfyUI 自定义节点、workflow JSON、训练脚本和依赖隔离，把底层的 WD14 / FluxTrainer / sd-scripts 组合成可操作的产品化链路。面试时可以重点看 `custom_nodes/ninebot_flux_lora_pipeline` 的节点封装，以及 `workflows/`、`bundles/` 中的可复现入口。

## 项目亮点

- **一体化 FLUX 节点**：`NinebotFluxLoRATrainPipeline` 将多图上传、数据集暂存、caption sidecar 生成、FluxTrainer 参数映射、产物落盘和下载校验串成单节点。
- **独立的自动打标工作流**：`WD14Tagger|pysssss` 输出标签，再由 `LoRA Caption Save` 写回与图片同名的 `.txt`，训练前可人工复核。
- **可验证的安全路径**：支持 `dry_run`，上传新批次会替换旧的 `uploaded_images` 列表，避免数据集串批；下载接口只提供已存在的 `.safetensors` 文件。
- **针对 16GB 显存的参数封装**：默认提供 rank、步数、学习率、fp8、bf16、attention、blocks-to-swap 等平衡配置，并把高风险参数收敛到独立的 Advanced Settings 节点。
- **迁移友好**：workflow、安装脚本、模型清单、数据集规范、测试和边界说明分层存放，不把 checkpoint、ONNX、训练图片或虚拟环境提交进仓库。

## 工作流总览

```text
图片目录 / 节点上传
        │
        ├─ SD1.5 / Legacy：LoRA Caption Load → WD14 Tagger → LoRA Caption Save
        │                         │
        │                         └─ 人工复核 caption → Lora Training in ComfyUI
        │
        └─ FLUX：NinebotFluxLoRATrainPipeline
                 ├─ dry run：暂存图片 + 生成 sidecar + manifest
                 └─ train：调用 FluxTrainer → 保存 LoRA → 下载 / 推理验证
```

| 场景 | 入口 | 产物 | 适合说明的能力 |
| --- | --- | --- | --- |
| 自动打标 | `workflows/ninebot_lora_training/lora_caption_mvp.workflow.json` | 同名 `.txt` captions | 节点编排、数据准备、可复核流程 |
| SD1.5 LoRA smoke test | `workflows/ninebot_lora_training/lora_training_mvp.workflow.json` | `.safetensors` LoRA | 训练参数映射、CUDA 依赖隔离 |
| FLUX LoRA 训练 | `custom_nodes/ninebot_flux_lora_pipeline` | LoRA + manifest | 自定义节点、前后端交互、错误边界 |
| FLUX 效果验证 | `workflows/ninebot_flux_lora_training/flux_dev_lora_test.workflow.json` | 生成图 | 训练/推理解耦、触发词验证 |

## 目录结构

```text
custom_nodes/ninebot_flux_lora_pipeline/  # 自研 FLUX LoRA 一体化节点、前端和测试
workflows/                                # 可直接导入 ComfyUI 的 workflow JSON
bundles/flux_lora_training/               # FLUX 配置、脚本、caption 规范和推理 workflow
bundles/sd15_lora_training/               # SD1.5 / legacy 打标与训练 MVP
docs/dev_docs/                            # 架构、迁移、交付和实施文档
docs/superpowers/                         # 设计稿与执行计划
THIRD_PARTY.md                            # 第三方节点、模型和许可证边界
```

## 快速体验

### 1. 安装自定义节点

将 `custom_nodes/ninebot_flux_lora_pipeline` 复制到目标 ComfyUI 的 `custom_nodes/`，按 [THIRD_PARTY.md](THIRD_PARTY.md) 安装 FluxTrainer、Florence2、WD14 Tagger 或 legacy caption/training 节点，然后重启 ComfyUI。

### 2. 先跑打标 workflow

打开 `workflows/ninebot_lora_training/lora_caption_mvp.workflow.json`，将 `LoRA Caption Load` 指向只包含图片的目录，执行：

```text
LoRA Caption Load → WD14Tagger|pysssss → LoRA Caption Save
```

检查每张图片旁是否出现同名 `.txt`，并在训练前人工修订触发词、主体、视角和材质等标签。

### 3. 再跑训练与验证

- SD1.5：阅读 `bundles/sd15_lora_training/docs/install.md`、`docs/usage.md`，先用 1 epoch smoke test 验证依赖和输出路径。
- FLUX：阅读 `bundles/flux_lora_training/docs/install.md`、`docs/usage.md`、`docs/dataset_caption_guide.md`，先勾选 `dry_run` 检查暂存目录与 sidecar，再关闭后正式训练。
- 训练完成后导入 `flux_dev_lora_test.workflow.json`，在 prompt 开头使用训练触发词验证 LoRA 是否生效。

## FLUX 节点的工程边界

`NinebotFluxLoRATrainPipeline` 是 orchestration/wrapper 节点，负责流程编排、输入校验、运行目录隔离、进度/错误反馈和下载路由；实际优化算法由已安装的 FluxTrainer / sd-scripts 执行。节点默认使用 trigger-only caption，caption adapter 可在不改变公共 UI 的前提下扩展到 Florence2 或 WD14。

默认平衡配置（RTX 4080 16GB 参考路径）：rank/alpha `8`、最大步数 `600`、学习率 `1e-4`、`adamw8bit`、`fp8_base`、`bf16`、`sdpa`。显存不足时优先降低分辨率/步数或调整 `blocks_to_swap`，不要直接修改稳定默认值。

## 可验证证据与边界

- 提供 Python pipeline/routes 单元测试，以及前端上传替换、内联编辑、下载路径 payload、widget 隐藏等测试。
- 提供 dry-run、smoke-test 数据集和 workflow manifest，便于复现路径、节点和参数。
- 当前仓库不声称完成正式模型效果评测、多人并发调度或生产级队列；SD1.5 训练依赖也需要在目标环境单独完成安装。

## 依赖与隐私边界

仓库不包含 checkpoint、LoRA、ONNX、safetensors、原始训练图、PSD、日志、Hugging Face cache 或 Python 虚拟环境。这样既控制仓库体积，也避免把模型权重和内部素材误公开。第三方组件、模型目录和许可证说明统一见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 面试阅读路径

1. 先看本 README 的“工作流总览”和 [FLUX 节点 README](custom_nodes/ninebot_flux_lora_pipeline/README.md)。
2. 再看 [打标/训练 workflow README](workflows/ninebot_lora_training/README.md) 和对应的 workflow JSON。
3. 最后看 `docs/dev_docs/` 及 `docs/superpowers/`，了解架构取舍、迁移方案和验收边界。

## License / Usage

本仓库主要保存流程封装与文档。使用 FLUX.1-dev、第三方节点和训练脚本时，请分别确认其许可证与模型使用条款；本项目默认面向内部、非商业实验。

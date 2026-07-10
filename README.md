# Ninebot ComfyUI LoRA Kit

这个仓库整理了 Ninebot 在 ComfyUI 里的 LoRA 训练、生图和打标工作流交付物，目标是把自研节点、workflow、训练配置和迁移文档从完整 ComfyUI 安装中拆出来，方便在新机器或 GitHub 仓库中维护。

## Contents

```text
custom_nodes/
  ninebot_flux_lora_pipeline/      # 自研 FLUX LoRA 一体化训练节点
workflows/
  ninebot_flux_lora_training/      # FLUX 图生图 / LoRA 测试 workflow
  ninebot_lora_training/           # SD1.5 打标 + LoRA 训练 MVP workflow
bundles/
  flux_lora_training/              # FLUX 训练脚本、配置、安装说明和轻量示例
  sd15_lora_training/              # 旧版 SD1.5 训练迁移包的轻量整理版
docs/
  dev_docs/                        # 开发、迁移、交付说明
  superpowers/                     # 相关设计和执行计划
```

## What Is Included

- `NinebotFluxLoRATrainPipeline` 自定义节点代码、前端扩展和测试。
- FLUX LoRA 训练配置、PowerShell 辅助脚本、模型来源说明和数据集 caption 规范。
- SD1.5/旧版打标与 LoRA 训练 workflow、安装说明、依赖清单和轻量 caption 示例。
- 可导入 ComfyUI 的 workflow JSON，包括打标、训练、FLUX LoRA 测试和 FLUX 图生图。

## What Is Not Included

仓库刻意不提交以下内容：

- ComfyUI 主程序源码。
- checkpoint、LoRA、ONNX、safetensors 等模型文件。
- 原始训练图片、PSD、输出图和 TensorBoard 日志。
- 第三方自定义节点的大体积 vendored 副本。
- Python 虚拟环境、Hugging Face cache、`__pycache__` 和本机运行缓存。

第三方节点和模型依赖见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## Install Into ComfyUI

1. 把 `custom_nodes/ninebot_flux_lora_pipeline` 复制到目标 ComfyUI 的 `custom_nodes/`。
2. 按 [THIRD_PARTY.md](THIRD_PARTY.md) 安装依赖的第三方自定义节点和模型文件。
3. 重启 ComfyUI。
4. 从 `workflows/` 或 `bundles/*/workflows/` 导入对应 workflow JSON。
5. 先使用 dry run 或 smoke workflow 验证路径、caption sidecar 和模型位置，再启动正式训练。

## FLUX Training Start Points

优先阅读：

```text
bundles/flux_lora_training/docs/install.md
bundles/flux_lora_training/docs/usage.md
bundles/flux_lora_training/docs/dataset_caption_guide.md
bundles/flux_lora_training/docs/model_sources.md
```

常用入口：

```powershell
powershell -ExecutionPolicy Bypass -File bundles\flux_lora_training\requirements\setup_flux_training.ps1
powershell -ExecutionPolicy Bypass -File bundles\flux_lora_training\training\scripts\setup_flux_trainer.ps1
```

## SD1.5 / Legacy Start Points

旧版打标 + LoRA 训练迁移资料在：

```text
bundles/sd15_lora_training/docs/install.md
bundles/sd15_lora_training/docs/usage.md
bundles/sd15_lora_training/workflows/ninebot_lora_training/
```

这个目录只保留了轻量文本、workflow、依赖和示例 caption。需要的 WD14、captioning、Lora-Training-in-Comfy 等第三方节点需要在目标 ComfyUI 中单独安装。

## Suggested Repository Name

推荐 GitHub 新仓库名：

```text
ninebot-comfyui-lora-kit
```

这个名字覆盖范围比单纯 `flux-lora` 更准确，因为仓库里同时包含打标、旧版 LoRA 训练、FLUX LoRA 训练和图生图 workflow。

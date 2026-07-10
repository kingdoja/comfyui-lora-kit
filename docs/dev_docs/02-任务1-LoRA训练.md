# 任务 1：LoRA 训练

## 目标

实现一个业务可用的 LoRA 训练器，支持素材选择、自动/人工打标、训练参数调节、优化器选择、训练进度查询和模型产物入库。

设计图中对应内容：

- 左侧图片节点/素材输入。
- 中间 LoRA 训练节点。
- 参数包含步数、循环次数、样本数量等。
- 优化器包含 AdamW8bit、DAdaptation、Lion。
- 需要打标，打标方式类似 prompt。

## 节点建议

### Ninebot LoRA Trainer

输入参数：

- `dataset_id`：来自资产库的数据集。
- `base_model`：训练底模 checkpoint。
- `lora_name`：输出 LoRA 名称。
- `trigger_word`：触发词，例如 `ninebot_atv_style`。
- `caption_mode`：`auto`、`manual`、`auto_then_review`。
- `optimizer`：`AdamW8bit`、`DAdaptation`、`Lion`、`AdamW`。
- `resolution`：512、768、1024 或自定义。
- `epochs`、`repeats`、`batch_size`、`learning_rate`。
- `network_dim`、`network_alpha`。
- `save_every_n_epochs`、`sample_every_n_steps`。
- `seed`、`mixed_precision`。

输出：

- `lora_path`：生成的 `.safetensors` 路径。
- `training_report`：训练参数、数据集版本、损失曲线、样张路径。
- `status`：queued、running、failed、completed。

### Ninebot Caption Dataset

可单独做一个节点或训练器内部步骤：

- 输入图片列表或资产库 `dataset_id`。
- 输出一组 `.txt` caption sidecar 文件和 `dataset_manifest.json`。

## 打标不是评分

这里的“打标”主要不是评分，而是给每张训练图片写 prompt/caption，让训练脚本知道图片里有什么。评分可以作为资产库的可选字段，用来过滤低质量素材，但它不是 LoRA 训练 caption 的替代品。

建议把二者分开：

- `caption`：训练用提示词，例如 `ninebot_atv_style, off-road vehicle, front three-quarter view, rugged tire, studio lighting`。
- `tags`：检索用标签，例如 `车型/实车类/越野/正侧/棚拍`。
- `quality_score`：可选质量分，例如 1 到 5，用于筛选是否进入训练集。

## Caption 规范

每张图片一个同名 `.txt`：

```text
ninebot_atv_style, off-road vehicle, front three-quarter view, rugged tire, angular body, studio lighting, clean background
```

推荐结构：

1. 触发词：固定放第一位。
2. 主体类型：车型、产品、汽车、模型。
3. 视角：front view、side view、rear view、three-quarter view、top view。
4. 关键结构：车轮、车灯、车架、座椅、材质、颜色。
5. 场景风格：studio lighting、outdoor road、desert、city street。
6. 排除信息不要写进 caption，负面词放生图阶段。

## 训练后端

ComfyUI 本身不是训练框架，建议在扩展内封装外部训练脚本，而不是手写训练循环。

推荐方案：

- MVP：调用 `kohya_ss` 或 `sd-scripts` 作为子进程。
- 扩展负责生成训练配置、启动进程、读取日志、收集产物。
- 训练输出统一复制或链接到 `models/loras/`，并在资产库登记为模型资产。

注意事项：

- `AdamW8bit` 依赖 bitsandbytes，通常要求 NVIDIA CUDA 环境；Mac/MPS 环境大概率不能用，需要降级为 `AdamW` 或 `Lion`。
- `DAdaptation`、`Lion` 的可用性取决于训练脚本和依赖版本，节点需要在启动前做可用性检查。
- 训练任务可能长时间运行，必须做异步队列，不能阻塞 ComfyUI 主线程。

## 文件结构建议

```text
custom_nodes/ninebot_lora_training/
  __init__.py
  nodes.py
  server.py
  training/
    job_runner.py
    config_builder.py
    captioner.py
    validators.py
  web/
    training_panel.js
  templates/
    sd15_lora.toml
    sdxl_lora.toml
  README.md

user/ninebot_lora_training/
  datasets/
  jobs/
  logs/
  samples/
```

## 工作流 Group 标注

LoRA 训练工作流至少分 4 组：

- `1. 数据集选择与上传`
- `2. Caption 打标与人工复核`
- `3. LoRA 训练参数`
- `4. 训练产物保存与入库`

## 验收标准

- 可以选择一组资产库图片并生成 caption。
- 可以人工编辑 caption 后再启动训练。
- 可以选择优化器并在不可用时给出明确错误。
- 训练过程有日志、进度和失败原因。
- 成功后 LoRA 文件进入 `models/loras/` 或登记到资产库模型分类。
- 输出训练报告，记录数据集版本、参数和样张。


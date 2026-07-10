# LoRA 训练 MVP 搭建执行计划

## 结论

先写计划再执行搭建。

原因是 LoRA 训练不是单纯 ComfyUI 生图节点组合，它会引入训练脚本、caption 模型、优化器依赖、长时间任务和模型产物管理。直接安装一批 GitHub custom nodes 容易造成依赖冲突，也不利于后面包装到 Ninebot 平台。

本计划采用两阶段路线：

1. MVP 验证：用现成 ComfyUI 节点快速搭出“图片 -> 打标 -> 训练 -> 输出 LoRA -> 测试生图”的完整链路。
2. 生产封装：保留成熟训练脚本，新增 Ninebot 自定义节点和后端训练 worker，把复杂参数、任务状态、日志和资产入库封装起来。

## 当前本机状态

当前目录是 ComfyUI 用户数据形态，不是完整上游源码树。现有状态：

- 已有 custom node：`custom_nodes/comfyui-gpt-image/`
- checkpoint：`models/checkpoints/v1-5-pruned-emaonly.safetensors`
- LoRA：`models/loras/lcm-lora-sdv1-5.safetensors`
- ControlNet：`models/controlnet/control_v11p_sd15_canny.safetensors`
- 尚未安装 LoRA 训练相关 custom nodes
- 已创建 LoRA 训练工作流目录：`workflows/ninebot_lora_training/`
- 已创建 LoRA 训练运行目录：`user/ninebot_lora_training/`
- 已创建 LoRA 训练输出目录：`output/ninebot_lora_training/`
- 已克隆 MVP custom nodes：
  - `custom_nodes/Lora-Training-in-Comfy/`
  - `custom_nodes/Image-Captioning-in-ComfyUI/`
  - `custom_nodes/ComfyUI-WD14-Tagger/`
- 已安装打标节点最低依赖：`onnxruntime`
- 已通过 ComfyUI 启动验证，节点可以注册到前端
- 已准备 smoke-test 数据集：`user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001/`
- 已准备 tiny smoke 数据集：`user/ninebot_lora_training/datasets/offroad_vehicle_tiny_smoke_v001/`
- 已安装 LoRA 训练隔离环境：`user/ninebot_lora_training/train_venv/`
- 已完成手动 tiny smoke 训练验证，产物：`models/loras/ninebot_atv_style_tiny_smoke_manual.safetensors`
- 已完成 ComfyUI API tiny smoke 训练验证，产物：`models/loras/ninebot_atv_style_tiny_smoke.safetensors`
- 已记录 ComfyUI API 训练日志：`user/ninebot_lora_training/logs/ninebot_atv_style_tiny_smoke_20260626_160629.log`
- 已完成 tiny smoke LoRA Loader 生图验证，产物：`output/ninebot_lora_generation/tiny_smoke_lora_test_00001_.png`

MVP 应先按 SD1.5 路线验证，避免同时处理 SDXL、FLUX、多底模兼容问题。

## 技术选型

### MVP 现成节点

推荐先验证这组：

- `LarryJane491/Lora-Training-in-Comfy`
  - 用途：在 ComfyUI 内启动 LoRA 训练。
  - 定位：MVP 验证，不作为长期生产核心。
- `LarryJane491/Image-Captioning-in-ComfyUI`
  - 用途：读取、保存 LoRA caption `.txt` sidecar 文件。
  - 定位：把每张图片和同名 caption 文件打通。
- `pythongosssss/ComfyUI-WD14-Tagger`
  - 用途：自动 tag 图片，适合批量初始打标。
  - 定位：自动打标的第一步，后续必须人工复核。

可选补充：

- BLIP / Florence / JoyCaption 类 caption 节点
  - 用途：生成自然语言 caption。
  - 定位：产品图、车、场景图比纯 tag 更适合用自然语言 caption。

### 生产训练后端

生产版推荐用 `kohya-ss/sd-scripts` 或 kohya 系训练脚本作为训练 worker，而不是让 ComfyUI 主队列长期阻塞。

Ninebot 只封装：

- 数据集准备
- caption 生成与审核
- 训练配置生成
- 训练任务启动/暂停/失败状态
- 日志和样张展示
- 训练产物复制到 `models/loras/`
- 资产库登记

## MVP 工作流结构

目标链路：

```text
图片文件夹
-> 自动打标 WD14 / BLIP
-> 人工复核 caption
-> 保存同名 .txt caption
-> LoRA Training
-> 输出 .safetensors
-> LoRA Loader 测试生图
```

ComfyUI 工作流分组：

```text
1. 数据集选择
2. 自动打标
3. Caption 人工复核
4. LoRA 训练参数
5. 训练日志与产物
6. LoRA 测试生图
```

## 数据集目录规范

MVP 目录：

```text
user/ninebot_lora_training/datasets/
  atv_style_v001/
    10_atv_style/
      0001.png
      0001.txt
      0002.png
      0002.txt
```

说明：

- `10_atv_style` 中的 `10` 表示 repeats。
- 每张图片必须有同名 `.txt`。
- `.txt` 第一位固定放 trigger word。
- 不合格图片不要进入训练集，先在资产库或筛选步骤排除。

caption 示例：

```text
ninebot_atv_style, off-road vehicle, front three-quarter view, rugged tires, angular body, studio lighting, clean background
```

字段分工：

- `caption`：训练用，写入 `.txt`
- `tags`：资产检索用，例如 `车型/越野/正侧/棚拍`
- `quality_score`：质量筛选用，例如 1 到 5

## 打标流程

### 自动打标

第一版使用 WD14 tagger：

- 输入：图片批量列表
- 输出：逗号分隔 tags
- 关键参数：
  - tag threshold
  - character threshold
  - exclude tags
  - replace underscore
  - append / prepend trigger word

产品图建议再补一个自然语言 captioner：

- WD14 输出结构化 tags
- BLIP / Florence / JoyCaption 输出自然语言描述
- 最终 caption 由规则合并，并进入人工复核

### 人工复核

人工复核界面至少支持：

- 单图预览
- caption 文本编辑
- 批量追加 trigger word
- 批量替换品牌词/产品词
- 标记不参与训练
- 质量分
- 保存同名 `.txt`

### Caption 规则

推荐顺序：

```text
trigger_word, subject, view, structure, material/color, scene, lighting/style
```

不要把负面词写进 caption。负面词属于生图阶段，不属于训练数据描述。

## 训练参数面板

按设计图，训练节点至少包含“步数、循环次数、样本数量、打标、优化器”。实际建议字段如下。

### 基础

- `base_model`
- `model_type`: `sd15`
- `output_name`
- `trigger_word`
- `seed`

### 数据

- `dataset_id`
- `train_data_dir`
- `caption_extension`: `.txt`
- `repeats`
- `resolution`: `512` first
- `enable_bucket`: true
- `min_quality_score`

### 训练

- `epochs`
- `max_train_steps`
- `batch_size`
- `gradient_accumulation_steps`
- `learning_rate`
- `lr_scheduler`
- `mixed_precision`
- `cache_latents`
- `gradient_checkpointing`

### LoRA

- `network_dim`
- `network_alpha`
- `train_unet`
- `train_text_encoder`

### 优化器

必须展示：

- `AdamW8bit`
- `DAdaptation`
- `Lion`

建议同时保留 fallback：

- `AdamW`

注意：

- `AdamW8bit` 依赖 bitsandbytes，通常更适合 NVIDIA CUDA；Mac/MPS 上要自动降级或明确报错。
- `DAdaptation` 的学习率语义和 AdamW 不同，默认配置不能照抄。
- `Lion` 通常需要更保守的学习率，必须单独给 preset。

### 产物

- `save_every_n_epochs`
- `sample_every_n_steps`
- `sample_prompts`
- `output_dir`
- `auto_register_to_asset_library`

## 建议参数预设

### 快速 smoke test

用于验证链路是否能跑通：

```text
resolution = 512
image_count = 10-20
repeats = 5
epochs = 1
batch_size = 1
network_dim = 16
network_alpha = 8
optimizer = AdamW
max_train_steps = 100-300
```

### SD1.5 产品风格 LoRA 初始预设

```text
resolution = 512
image_count = 30-80
repeats = 10
epochs = 5-10
batch_size = 1-2
network_dim = 32-64
network_alpha = 16-32
optimizer = AdamW8bit if CUDA else AdamW/Lion
learning_rate = 1e-4
unet_lr = 1e-4
text_encoder_lr = 5e-5
```

## 执行步骤

### Phase 0：准备和隔离

1. 创建目录：

```text
workflows/ninebot_lora_training/
user/ninebot_lora_training/datasets/
user/ninebot_lora_training/jobs/
user/ninebot_lora_training/logs/
output/ninebot_lora_training/
```

当前已完成。

2. 记录当前 custom nodes：

```text
custom_nodes/comfyui-gpt-image/
```

3. 不修改现有 `comfyui-gpt-image`。

### Phase 1：安装 MVP 节点

优先用 ComfyUI Manager 安装，便于回滚和查看依赖。

如果手动安装，安装到：

```text
custom_nodes/Lora-Training-in-Comfy/
custom_nodes/Image-Captioning-in-ComfyUI/
custom_nodes/ComfyUI-WD14-Tagger/
```

安装后重启 ComfyUI，确认节点能搜索到。

当前已完成源码安装和节点注册验证。

已确认可搜索节点：

```text
LoRA Caption Load
LoRA Caption Save
WD14Tagger|pysssss
Lora Training in ComfyUI
Lora Training in Comfy (Advanced)
Tensorboard Access
```

当前只安装了 `ComfyUI-WD14-Tagger` 的低风险依赖 `onnxruntime`。`Lora-Training-in-Comfy/requirements.txt` 会安装或降级大量训练依赖，包括 `accelerate`、`diffusers`、`transformers`、`xformers`、`bitsandbytes`、`dadaptation` 等；当前 ComfyUI 环境是 macOS/MPS，且已有较新的 `torch` 和 `transformers`，不建议直接全量安装该 requirements。

当前训练依赖已按隔离方案安装到：

```text
user/ninebot_lora_training/train_venv/
```

训练节点 `custom_nodes/Lora-Training-in-Comfy/train.py` 已做本地补丁：

- 优先使用隔离环境 `train_venv/bin/python`
- Mac/MPS 使用 `--sdpa`，CUDA 才使用 `--xformers`
- 相对输出目录解析到 ComfyUI 数据目录
- 训练子进程 stdout/stderr 会实时打印并写入 `user/ninebot_lora_training/logs/`
- 训练子进程返回码非 0 时抛出异常，避免 ComfyUI 误显示训练完成

### Phase 2：准备样例数据集

1. 放入 10-20 张同类产品图。
2. 图片统一清晰、主体明确，避免水印、大字、严重遮挡。
3. 自动生成 caption。
4. 人工复核并保存 `.txt`。
5. 删除低质量图片或标记不参与训练。

### Phase 3：搭 MVP 工作流

在 ComfyUI 前端搭：

```text
Load image batch / folder
-> Tagger / Captioner
-> Caption Save
-> LoRA Training
-> Save LoRA
-> Checkpoint + LoRA Loader
-> KSampler
-> Save Image
```

保存两份：

```text
workflows/ninebot_lora_training/lora_training_mvp.workflow.json
workflows/ninebot_lora_training/lora_training_mvp.api.json
```

### Phase 4：训练验证

先跑 smoke test：

- `max_train_steps`: 100-300
- `optimizer`: 先用 `AdamW`
- 输出 LoRA 后立即用固定 prompt 测试

验证点：

- 训练能启动
- 日志能看到 step/loss
- 输出 `.safetensors`
- LoRA 能被 ComfyUI 的 LoRA Loader 发现
- 生图效果有可见风格变化

当前 tiny smoke 已通过：

```text
workflow: workflows/ninebot_lora_training/lora_training_tiny_smoke.api.json
dataset: user/ninebot_lora_training/datasets/offroad_vehicle_tiny_smoke_v001
optimizer: Lion
network_dim: 8
network_alpha: 4
epochs: 1
batch_size: 1
steps: 2
runtime: 142.38 seconds
prompt_id: cfba960c-c64f-4475-a708-b395ae0a9edc
output: models/loras/ninebot_atv_style_tiny_smoke.safetensors
```

这个 tiny smoke 只证明训练链路可用，不证明模型质量。当前已用 `workflows/ninebot_lora_generation/lora_txt2img_tiny_smoke.api.json` 完成一次 LoRA Loader 生图验证，输出：

```text
output/ninebot_lora_generation/tiny_smoke_lora_test_00001_.png
```

下一步应使用 `offroad_vehicle_smoke_v001` 的 10 张图跑一次更接近真实的 smoke 训练，再接 LoRA Loader 生图验证。

### Phase 5：接生产封装

创建：

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
```

生产版节点不直接做长训练，只提交异步任务：

```text
Ninebot Caption Dataset
Ninebot LoRA Trainer
Ninebot LoRA Training Status
Ninebot Register LoRA Asset
```

平台侧只展示业务表单，后端生成训练配置并启动 worker。

## 验收标准

MVP 验收：

- 可以批量选择图片。
- 可以自动生成 caption。
- 可以人工修改 caption。
- 可以选择 optimizer。
- 可以调步数、repeats、batch size、epochs。
- 可以训练出 `.safetensors`。
- 产物进入 `models/loras/` 或指定输出目录。
- 能用该 LoRA 完成一次测试生图。

生产验收：

- 训练任务异步执行，不阻塞 ComfyUI 主线程。
- 有 job id、状态、日志、错误原因。
- 优化器不可用时有明确提示和 fallback。
- 训练配置、数据集版本、caption 版本、模型版本都写入 report。
- LoRA 产物自动登记到资产库。

## 风险和处理

1. 依赖冲突
   - 处理：先用现成节点 MVP；生产训练 worker 使用独立环境。

2. Mac/MPS 不支持 AdamW8bit
   - 处理：界面保留 AdamW8bit，但运行前检查；不可用时提示改用 AdamW/Lion。

3. Caption 质量影响训练效果
   - 处理：自动打标只做初稿，必须人工复核。

4. 训练时间长
   - 处理：MVP 可同步跑短任务；生产必须异步 job。

5. 节点 JSON 不稳定
   - 处理：工作流 JSON 只作为 MVP 验证；平台生产用 Ninebot 自定义节点和训练配置模板。

## 下一步

按这个顺序执行：

1. 在前端打开 `lora_caption_mvp.workflow.json`，用 scratch 数据集验证 WD14 打标和 `.txt` 保存。
2. 用 `offroad_vehicle_smoke_v001` 的 10 张图跑 `lora_training_mvp.workflow.json`，优先使用 `Lion` 或 `AdamW`。
3. 输出 LoRA 后接生图工作流验证 LoRA Loader 能发现并加载产物。
4. 导出 `lora_training_mvp.api.json`，作为平台接入样例。
5. 再开始做 `custom_nodes/ninebot_lora_training/` 生产封装。

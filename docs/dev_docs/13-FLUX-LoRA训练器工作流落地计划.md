# FLUX LoRA 训练器工作流落地计划

## 目标

基于 FLUX 作为底模，在 ComfyUI 里搭建一套可落地的“打标 + LoRA 训练 + LoRA 验证”工作流。

本计划不参考已有 `ninebot_flux_lora_training_bundle/`，重新从 ComfyUI 现成节点、GitHub 现成训练器和必要的二次封装角度设计。

最终目标不是只得到一个 JSON，而是得到一套可迁移交付件：

```text
workflow JSON
custom node / trainer 清单
依赖安装说明
FLUX 模型文件说明
数据集目录规范
caption 规范
训练参数 manifest
smoke test 验收记录
```

## 核心判断

本需求只做 FLUX LoRA，不做 SD1.5、SDXL 或其他 SD 系列训练路线。

这里的“只做 FLUX”包含三层含义：

- 训练底模只面向 FLUX。
- 工作流只围绕 FLUX 数据、FLUX 训练参数和 FLUX LoRA 验证设计。
- 任何历史 SD 训练节点、SD 工作流或 SD 参数模板都不能作为交付主线。

明确不做：

```text
不做 SD1.5 LoRA 训练
不做 SDXL LoRA 训练
不复用 Lora-Training-in-Comfy 作为训练主线
不把 SD 参数模板改名后冒充 FLUX 参数模板
```

FLUX 训练通常需要 transformer / diffusion model、CLIP-L、T5-XXL、AE/VAE 等组件；`AdamW8bit`、`Lion`、`DAdaptation` 等优化器是否可用，取决于 FLUX 训练器和 CUDA 依赖，而不是 ComfyUI JSON 本身。

推荐路线：

```text
FLUX 专用训练器优先
-> ComfyUI 工作流二次设计
-> 必要时做 Ninebot FLUX 薄包装节点
-> bundle 化迁移交付
```

不建议第一阶段手写 FLUX 训练循环。

## 选型调研方向

### 方案 A：ComfyUI-FluxTrainer

候选：

```text
https://github.com/kijai/ComfyUI-FluxTrainer
```

定位：

- 首选 MVP 候选。
- 目标是在 ComfyUI 内直接训练 FLUX LoRA。
- 适合导出前端 workflow JSON。

需要验证：

- 是否能在当前 ComfyUI 版本正常加载节点。
- 是否支持 FLUX.1-dev / FLUX.1-schnell 所需模型布局。
- 是否支持高级参数：dim、alpha、learning rate、optimizer、scheduler、steps、samples、保存间隔。
- 是否有稳定示例 workflow。
- 是否能输出标准 `.safetensors` LoRA 并被 ComfyUI FLUX LoRA 工作流加载。

风险：

- 训练器可能标注 experimental。
- 依赖可能较重。
- 节点参数可能不完全覆盖业务需要。
- 长时间训练可能阻塞 ComfyUI 进程或让前端状态不清晰。

进入交付候选的硬门槛：

```text
节点能在当前 ComfyUI 版本加载
官方示例 workflow 能打开
10-50 step smoke test 能启动并输出 .safetensors
输出 LoRA 能被 FLUX 验证 workflow 加载
节点参数覆盖 dim / alpha / lr / optimizer / scheduler / steps / save interval
依赖安装不覆盖或破坏当前 Torch / CUDA 栈
```

### 方案 B：AI-Toolkit / FluxGym + ComfyUI 包装

候选：

```text
https://github.com/ostris/ai-toolkit
https://github.com/cocktailpeanut/fluxgym
```

定位：

- FLUX 专用外部训练器候选。
- ComfyUI 只做参数面板、配置生成、启动训练、日志展示和产物登记。
- 适合低显存、高级训练配置或独立训练 UI。

优点：

- FLUX LoRA 训练生态成熟。
- 训练配置能力强。
- 更贴近“只做 FLUX”的需求表达。

风险：

- 不是 ComfyUI 原生节点。
- 导出 JSON 的需求需要额外包装。
- 与 ComfyUI 前端工作流的融合度低于原生 custom node。

### 方案 C：自定义 Ninebot FLUX Trainer Wrapper

定位：

- 最稳定的生产交付候选。
- ComfyUI 只做参数面板、配置生成、启动训练、日志展示和产物登记。
- 底层调用 FLUX 专用训练器，不自研训练算法。

需要设计的包装节点：

```text
Ninebot FLUX Dataset Validate
Ninebot FLUX Train Config
Ninebot FLUX Train Launch
Ninebot FLUX Train Status
Ninebot FLUX LoRA Register
```

优点：

- 训练逻辑使用成熟 FLUX 后端。
- 参数可控，适合高级需求。
- 容易做依赖隔离和错误提示。
- 后续可接平台任务队列。

风险：

- 不是纯“现成节点导入 JSON”。
- 需要开发少量 custom nodes。
- workflow JSON 必须配套自定义节点源码和训练环境。

## 推荐方案

采用“FLUX-only 双轨验证，单轨交付”：

1. 优先隔离验证 `ComfyUI-FluxTrainer`，目标是证明 ComfyUI 内直接 FLUX LoRA 训练能否跑通。
2. 同步评估 AI-Toolkit / FluxGym 这类 FLUX 专用训练器是否更适合作为训练后端。
3. 如果 `ComfyUI-FluxTrainer` 完整通过 smoke test，就以它搭 MVP 训练 workflow。
4. 如果 `ComfyUI-FluxTrainer` 参数不足或稳定性不够，就开发 `Ninebot FLUX Trainer Wrapper`，底层调用 FLUX 专用训练器。

最终交付仍然使用 ComfyUI 工作流；训练算法不自研，只封装 FLUX 训练器。

更稳的最终形态：

```text
Caption workflow：ComfyUI 内完成图片读取、自动 caption、人工复核、同名 .txt 保存
Train workflow：Ninebot FLUX Trainer Wrapper 接收参数并启动 FLUX 专用训练器
Status workflow：读取训练日志、loss、当前 step、失败原因和输出路径
Validate workflow：ComfyUI FLUX 生图链路加载训练出的 LoRA 做对比验证
```

这样做的好处是：用户仍然在 ComfyUI 里操作和导入 workflow，但训练后端可以被锁版本、隔离依赖、记录日志和迁移复现。

## 模型、授权与硬件前置条件

FLUX 训练必须先明确底模和训练组件，不应等到执行阶段才发现缺模型。

### 模型选择

第一阶段推荐只支持一个明确目标：

```text
FLUX.1-dev LoRA 训练
```

后续再扩展：

```text
FLUX.1-schnell
第三方 FLUX checkpoint
量化/蒸馏 FLUX 变体
```

注意：

- FLUX.1-dev 是 gated 模型，可能需要 Hugging Face 登录和模型条款确认。
- FLUX.1-dev 及其衍生 LoRA 的商业使用限制必须在交付文档中写清楚。
- ComfyUI 推理用的单文件 fp8 checkpoint 不一定等于训练所需组件。

### 训练组件

训练阶段通常需要：

```text
flux transformer / diffusion model
clip_l
t5xxl
ae / vae
```

验证生图阶段可以使用 ComfyUI 支持的 FLUX checkpoint 或拆分模型布局，但要在 manifest 中明确。

### 硬件门槛

第一阶段建议：

```text
NVIDIA CUDA GPU
16GB VRAM 起步做 smoke test
24GB+ VRAM 更适合稳定训练
Python / Torch / CUDA 版本锁定记录
```

## 工作流拆分

### 工作流 1：FLUX 数据集导入与筛选

目的：

- 批量读取训练图片。
- 做基础质量筛选。
- 生成训练清单。

输入：

```text
image_folder
dataset_name
trigger_word
min_quality_score
include_flag
```

输出：

```text
dataset_manifest.json
规范化图片目录
待 caption 图片列表
```

可先用文件夹规范替代复杂资产库。

### 工作流 2：FLUX Caption 打标与人工复核

目的：

- 自动生成 caption 初稿。
- 支持人工复核。
- 保存同名 `.txt` sidecar。

现成节点候选：

```text
ComfyUI-WD14-Tagger
Florence2 caption 节点
BLIP / JoyCaption 类节点
Image-Captioning-in-ComfyUI
```

推荐组合：

```text
图片读取
-> 自然语言 captioner
-> 可选 WD14 tags
-> caption 合并/清洗
-> 同名 .txt 保存
```

caption 模板：

```text
trigger_word, subject, view, structure, material/color, scene, lighting/style
```

示例：

```text
ninebot_motorcycle_style, electric off-road motorcycle, front three-quarter view, rugged tires, angular body panels, product photography, neutral studio lighting
```

注意：

- 负面词不写进 caption。
- trigger word 固定放第一位。
- 产品/车辆类不建议只依赖 WD14，优先自然语言 caption + 人工复核。

### 工作流 3：FLUX LoRA 高级训练

如果使用 `ComfyUI-FluxTrainer`：

```text
FLUX 模型加载/路径参数
-> 数据集路径
-> 高级训练参数
-> 训练节点
-> 保存 LoRA
```

如果使用 `Ninebot FLUX Trainer Wrapper`：

```text
Ninebot FLUX Dataset Validate
-> Ninebot FLUX Train Config
-> Ninebot FLUX Train Launch
-> Ninebot FLUX Train Status
-> Ninebot FLUX LoRA Register
```

训练参数至少包含：

```text
flux_model / pretrained_model_name_or_path
clip_l
t5xxl
ae / vae
train_data_dir
dataset_config
output_name
output_dir
trigger_word
resolution
batch_size
max_train_steps
epochs
save_every_n_steps
sample_every_n_steps
learning_rate
text_encoder_lr
transformer_lr
lr_scheduler
optimizer
network_dim
network_alpha
mixed_precision
gradient_checkpointing
cache_latents
cache_text_encoder_outputs
seed
sample_prompts
```

优化器下拉建议：

```text
AdamW8bit
Lion
DAdaptation
Prodigy
AdamW
```

运行前必须校验：

- CUDA 是否可用。
- bitsandbytes 是否可用。
- optimizer 依赖是否安装。
- FLUX 模型组件是否存在。
- 每张训练图片是否有同名 `.txt`。
- 数据集目录是否符合训练器要求。

### 工作流 4：FLUX LoRA 验证生图

目的：

- 训练后立即验证 LoRA 是否可加载。
- 用固定 prompt 对比基底模型和 LoRA 效果。

结构：

```text
FLUX 模型加载
-> FLUX 兼容 LoRA Loader
-> CLIP/T5 文本编码
-> FLUX sampler
-> VAE decode
-> Save Image
```

输出：

```text
验证图片
prompt
seed
LoRA 文件名
训练参数摘要
```

## 数据集目录规范

推荐统一：

```text
user/ninebot_flux_lora_training/datasets/
  flux_dataset_name_v001/
    10_trigger_word/
      0001.png
      0001.txt
      0002.png
      0002.txt
```

如果训练器要求 TOML，则生成：

```text
dataset_config.toml
```

并明确每个 subset：

```toml
[[datasets]]
resolution = 1024
batch_size = 1

  [[datasets.subsets]]
  image_dir = "..."
  caption_extension = ".txt"
  num_repeats = 10
  shuffle_caption = false
```

## 交付目录建议

```text
ninebot_flux_trainer_workflow_package/
  workflows/
    flux_caption.workflow.json
    flux_train_advanced.workflow.json
    flux_lora_validate.workflow.json
    flux_training_manifest.json
  custom_nodes/
    ComfyUI-FluxTrainer/
    ninebot_flux_lora_training_helper/   # 仅当需要二次封装时创建
  requirements/
    requirements-flux-trainer.txt
    install_windows_portable.ps1
    install_cuda_venv.sh
  docs/
    install.md
    usage.md
    dataset_caption_guide.md
    troubleshooting.md
  sample_datasets/
    flux_smoke_v001/
```

## 执行计划

### Phase 0：保护现有环境

1. 记录当前 ComfyUI Python、Torch、CUDA、显卡信息。
2. 记录当前 `custom_nodes/`。
3. 不修改现有本地 FLUX bundle。
4. 新增独立实验目录：

```text
custom_nodes/ComfyUI-FluxTrainer/
workflows/ninebot_flux_trainer_research/
user/ninebot_flux_lora_training/
```

### Phase 1：现成训练器验证

1. 克隆或通过 ComfyUI Manager 安装 `ComfyUI-FluxTrainer`。
2. 按仓库 README 安装依赖。
3. 重启 ComfyUI。
4. 确认训练节点能搜索到。
5. 打开官方示例 workflow。
6. 记录节点输入参数。
7. 判断是否覆盖本文档高级参数要求。

验收：

```text
ComfyUI 能加载节点
官方示例 workflow 能打开
训练节点参数清单已记录
依赖安装无破坏性冲突
```

### Phase 2：数据集与 caption 工作流

1. 准备 5-10 张 smoke test 图片。
2. 生成同名 `.txt` caption。
3. 固定 trigger word。
4. 设计 caption workflow。
5. 导出普通 workflow JSON。

验收：

```text
每张图片都有同名 .txt
caption 第一位为 trigger word
workflow 能迁移打开
```

### Phase 3：FLUX 训练 smoke test

1. 准备 FLUX 训练所需模型文件。
2. 使用最低成本参数跑 smoke test：

```text
resolution = 512 或 768
batch_size = 1
max_train_steps = 10-50
network_dim = 4 或 8
network_alpha = 4
optimizer = AdamW 或 AdamW8bit
```

3. 确认输出 `.safetensors`。
4. 记录日志和失败原因。

验收：

```text
训练能启动
日志能看到 step/loss
输出 LoRA 文件
ComfyUI 能发现 LoRA
```

### Phase 4：验证生图 workflow

1. 建立 FLUX 基底生图 workflow。
2. 接入 LoRA Loader。
3. 固定 prompt、seed、分辨率。
4. 输出对比图。

验收：

```text
基底图能生成
LoRA 图能生成
LoRA 文件能正常加载
结果图片和参数可追溯
```

### Phase 5：判断是否需要 Ninebot 包装节点

如果 `ComfyUI-FluxTrainer` 满足以下条件，则暂不开发包装节点：

```text
参数足够
训练稳定
错误提示可接受
workflow 可迁移
产物路径可控
```

如果不满足，则开发薄包装节点：

```text
Ninebot FLUX Dataset Validate
Ninebot FLUX Train Config
Ninebot FLUX Train Launch
Ninebot FLUX Train Status
Ninebot FLUX LoRA Register
```

包装节点只做配置、校验、启动、日志和登记，不手写训练算法。

## 验收标准

### MVP 验收

- 可以在 ComfyUI 中完成 caption 准备。
- 可以在 ComfyUI 中配置 FLUX LoRA 训练参数。
- 可以启动 FLUX LoRA 训练 smoke test。
- 可以输出 `.safetensors`。
- 可以用 FLUX 生图 workflow 加载 LoRA 验证。
- 可以导出至少 3 个 workflow JSON：

```text
caption
train
validate
```

### 迁移验收

- 在另一台 ComfyUI 上按文档安装 custom nodes 和依赖。
- workflow 打开不缺节点。
- 模型路径说明清晰。
- 数据集目录说明清晰。
- smoke test 可复现。

## 风险与处理

1. `ComfyUI-FluxTrainer` 不稳定。
   - 处理：切到 `Ninebot FLUX Trainer Wrapper`，底层调用 FLUX 专用训练器。

2. FLUX 模型文件体积大、权限复杂。
   - 处理：文档只写路径和下载说明，不把模型打包进 workflow。

3. 训练依赖污染 ComfyUI 环境。
   - 处理：优先独立 venv 或严格记录依赖；不要盲目覆盖 Torch。

4. 训练时间长，ComfyUI 前端状态不清晰。
   - 处理：MVP 先 smoke test；生产版做异步 job 和日志状态节点。

5. 自动 caption 质量不足。
   - 处理：自动 caption 只做初稿，保留人工复核步骤。

## 下一步

建议先执行 Phase 0 和 Phase 1：

1. 记录环境。
2. 安装 `ComfyUI-FluxTrainer`。
3. 确认节点能否加载。
4. 把节点参数清单记录到文档。
5. 再决定是继续用现成训练节点搭 workflow，还是开发 Ninebot 薄包装节点。

## Phase 0/1 执行记录

执行时间：2026-06-29。

### 环境快照

当前 ComfyUI portable 环境：

```text
ComfyUI root: C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI
Python: C:\Users\ninebot\ComfyUI_windows_portable\python_embeded\python.exe
Python version: 3.11.9
Torch: 2.12.1+cu130
CUDA available: true
CUDA version: 13.0
GPU: NVIDIA GeForce RTX 4080
VRAM: 16GB 级别
```

当前已发现 FLUX 相关模型文件：

```text
models\checkpoints\flux1-dev-fp8.safetensors
models\diffusion_models\flux1-dev.safetensors
models\text_encoders\clip_l.safetensors
models\text_encoders\clip_l_sd_scripts.safetensors
models\text_encoders\t5xxl_fp16.safetensors
models\vae\ae.safetensors
```

当前已存在 custom nodes：

```text
ComfyUI-FluxTrainer
ComfyUI-WD14-Tagger
Image-Captioning-in-ComfyUI
Lora-Training-in-Comfy
```

说明：`Lora-Training-in-Comfy` 仅为历史遗留节点，本 FLUX-only 路线不使用它作为训练主线。

用户指定数据集：

```text
smoke test:
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\ninebot_lora_training_bundle\datasets\offroad_vehicle_caption_scratch_v001\10_ninebot_atv_style

formal dataset:
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001\style
```

数据集检查结果：

```text
smoke test: 10 png + 10 txt, all 512x512
formal style: 25 png + 25 txt
```

### FluxTrainer 获取与检查

已下载 `kijai/ComfyUI-FluxTrainer` main 分支 zip 到：

```text
user\ninebot_flux_lora_training\research\ComfyUI-FluxTrainer-main
```

README 判断：

- 仓库明确声明 experimental。
- LoRA 训练需要正常 fp8 或 fp16 FLUX 模型。
- 示例 workflow 依赖额外节点：
  ```text
  kijai/ComfyUI-KJNodes
  rgthree/rgthree-comfy
  ```
- 训练依赖较多，不应直接无脑执行完整 `requirements.txt`。

### 依赖检查

当前 portable Python 已存在：

```text
accelerate
transformers
diffusers
bitsandbytes
prodigyopt
lion_pytorch
safetensors
altair
toml
voluptuous
huggingface_hub
imagesize
rich
sentencepiece
cv2
einops
```

初始缺失：

```text
matplotlib
came_pytorch
schedulefree
prodigy_plus_schedule_free
```

已最小安装：

```text
matplotlib==3.11.0
```

未安装：

```text
came_pytorch
schedulefree
prodigy_plus_schedule_free
```

原因：这些更像特定优化器路径依赖，先不安装，避免扩大环境扰动；等训练参数确定后再补。

### FLUX-only 入口补丁

上游 `__init__.py` 默认同时注册 FLUX、SD3、SDXL 节点。当前需求只做 FLUX，而且 SDXL 侧导入会因当前 `transformers` 版本缺少 `CLIPFeatureExtractor` 而失败。

已对 research 副本和 `custom_nodes\ComfyUI-FluxTrainer` 启用 FLUX-only 入口补丁：

```python
from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

# Ninebot FLUX-only research patch:
# the upstream package also registers SD3/SDXL nodes from this entry point.
# This project only evaluates FLUX LoRA training, and the SDXL side imports
# APIs that are incompatible with the current portable transformers build.

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
```

该补丁只影响节点注册入口，不修改 FLUX 训练算法。

### 节点导入验证

已使用 portable Python 直接导入：

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\custom_nodes\ComfyUI-FluxTrainer\__init__.py
```

结果：

```text
IMPORT_OK
node_count = 25
```

已注册 FLUX 节点：

```text
ExtractFluxLoRA
FluxKohyaInferenceSampler
FluxTrainAndValidateLoop
FluxTrainBlockSelect
FluxTrainEnd
FluxTrainLoop
FluxTrainModelSelect
FluxTrainResume
FluxTrainSave
FluxTrainSaveModel
FluxTrainValidate
FluxTrainValidationSettings
FluxTrainerLossConfig
InitFluxLoRATraining
InitFluxTraining
OptimizerConfig
OptimizerConfigAdafactor
OptimizerConfigProdigy
OptimizerConfigProdigyPlusScheduleFree
TrainDatasetAdd
TrainDatasetGeneralConfig
TrainDatasetRegularization
TrainNetworkConfig
UploadToHuggingFace
VisualizeLoss
```

### 示例 workflow 检查

上游 FLUX LoRA 示例：

```text
example_workflows\flux_lora_train_example01.json
```

该 workflow 使用 69 个节点，关键 FLUX 训练节点包括：

```text
FluxTrainModelSelect
TrainDatasetGeneralConfig
TrainDatasetAdd
OptimizerConfig
InitFluxLoRATraining
FluxTrainLoop
FluxTrainValidate
FluxTrainSave
VisualizeLoss
FluxTrainEnd
```

同时依赖辅助节点：

```text
SetNode / GetNode
AddLabel
SomethingToString
ImageBatchMulti
ImageConcatFromBatch
GetImageSizeAndCount
Display Any (rgthree)
```

这些来自 ComfyUI-KJNodes、rgthree 或其他辅助节点；正式 Ninebot workflow 应尽量减少这些外部辅助节点，或把它们列入交付依赖清单。

### 当前结论

`ComfyUI-FluxTrainer` 已通过 Phase 1 的静态节点加载预检，可以进入下一步 smoke test 设计。

但它仍未通过完整训练验收，暂不能视为最终可交付训练器。

下一步建议：

1. 安装或替换示例 workflow 所需辅助节点，或重搭一个更小的 Ninebot FLUX train workflow。
2. 准备 5-10 张 FLUX smoke dataset 和同名 `.txt` caption。
3. 用 `InitFluxLoRATraining` + `FluxTrainLoop` + `FluxTrainSave` 设计最小训练 workflow。
4. 先跑 10-50 step smoke test。
5. 训练成功后，再做 FLUX LoRA validate workflow。

## 2026-06-29 实测推进记录

### 正式数据集路径修正

用户已确认正式数据集为：

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001\style
```

当前检查结果：

```text
25 PNG
25 TXT
trigger word: ninebot_motorcycle_style
缺失 caption: 0
空 caption: 0
```

注意：该数据集存在较多不同原始尺寸，其中包含一张 183x183 小图。正式训练前建议做一次数据规范化或筛掉过小图；如果直接训练，不建议开启 `bucket_no_upscale=True` 作为正式默认。

### ComfyUI-FluxTrainer smoke test 结论

`ComfyUI-FluxTrainer` 已在当前 portable ComfyUI 环境跑通 FLUX-only LoRA 训练 smoke test。

关键环境：

```text
Python: C:\Users\ninebot\ComfyUI_windows_portable\python_embeded\python.exe
Torch: 2.12.1+cu130
GPU: NVIDIA GeForce RTX 4080
Trainer: custom_nodes\ComfyUI-FluxTrainer
入口补丁: FLUX-only，只注册 nodes.py，不注册 SD3/SDXL
```

关键模型文件：

```text
models\diffusion_models\flux1-dev.safetensors
models\vae\ae.safetensors
models\text_encoders\clip_l_sd_scripts.safetensors
models\text_encoders\t5xxl_fp16.safetensors
```

重要坑位：

```text
1. TrainDatasetAdd 的 dataset_path 必须直接指向图片所在目录，不会递归扫描父目录下的 10_xxx 子目录。
2. FluxTrainer 训练用 CLIP-L 必须使用 sd-scripts key 格式，即 clip_l_sd_scripts.safetensors。
   ComfyUI 推理常用的 clip_l.safetensors 带 text_model. 前缀，会导致 CLIP-L missing/unexpected keys，随后触发 meta tensor move 错误。
```

ATV smoke dataset 验收：

```text
数据集: user\ninebot_flux_lora_training\datasets\offroad_vehicle_flux_smoke_v001\10_ninebot_atv_style
图片/caption: 10 PNG + 10 TXT
训练参数: AdamW, rank 4, alpha 4, lr 1e-5, bf16, 10 steps, cache_latents=disk, cache_text_encoder_outputs=disk, blocks_to_swap=18
结果: TRAIN_LOOP_OK 10, END_OK
最终 LoRA: output\ninebot_flux_lora_training\smoke_fluxtrainer_10steps\ninebot_atv_flux_smoke_rank4_bf16.safetensors
step LoRA: output\ninebot_flux_lora_training\smoke_fluxtrainer_10steps\ninebot_atv_flux_smoke_rank4_bf16-step00010.safetensors
ComfyUI loras copy: models\loras\flux_trainer\ninebot_atv_flux_smoke_rank4_bf16-step00010.safetensors
```

正式 motorcycle dataset smoke 验收：

```text
数据集: user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001\style
图片/caption: 25 PNG + 25 TXT
训练参数: AdamW, rank 4, alpha 4, lr 1e-5, bf16, 10 steps, cache_latents=disk, cache_text_encoder_outputs=disk, blocks_to_swap=18
结果: TRAIN_LOOP_OK 10, END_OK
最终 LoRA: output\ninebot_flux_lora_training\motorcycle_flux_style_smoke_10steps\ninebot_motorcycle_flux_style_smoke_rank4_bf16.safetensors
step LoRA: output\ninebot_flux_lora_training\motorcycle_flux_style_smoke_10steps\ninebot_motorcycle_flux_style_smoke_rank4_bf16-step00010.safetensors
ComfyUI loras copy: models\loras\flux_trainer\ninebot_motorcycle_flux_style_smoke_rank4_bf16-step00010.safetensors
```

### 已生成训练 workflow 初版

已生成一个精简 FLUX-only 训练 workflow：

```text
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_train_minimal_v001.json
```

该 workflow 特点：

```text
只依赖 ComfyUI-FluxTrainer 节点
8 个节点，7 条连接
默认指向正式 motorcycle 数据集
默认 trigger word: ninebot_motorcycle_style
默认使用 flux1-dev.safetensors / ae.safetensors / clip_l_sd_scripts.safetensors / t5xxl_fp16.safetensors
默认 smoke 参数: AdamW, rank 4, alpha 4, lr 1e-5, 10 steps
FluxTrainSave 默认 copy_to_comfy_lora_folder=True
```

当前 workflow JSON 已做结构验证：

```text
node_types:
FluxTrainModelSelect
TrainDatasetGeneralConfig
TrainDatasetAdd
OptimizerConfig
InitFluxLoRATraining
FluxTrainLoop
FluxTrainSave
FluxTrainEnd
missing node types: 0
link problems: 0
```

### 下一步建议

1. 做数据预处理 workflow：筛掉或放大过小图，统一输出训练目录，保留同名 `.txt`。
2. 做 caption review workflow：自然语言 caption + trigger 固定在第一位，人工复核后保存 sidecar `.txt`。
3. 做 FLUX validate workflow：加载 `models\loras\flux_trainer\...safetensors`，用同一组 prompts 对比 base vs LoRA。
4. 正式训练前把 `max_train_steps` 从 10 改到正式值，并决定是否使用 AdamW8bit / Lion；高级优化器依赖不要一次性全装，按实际路线补。

## 2026-06-29 下一步推进记录

### 数据预处理脚本

已新增脚本：

```text
user\ninebot_flux_lora_training\train\prepare_flux_dataset.py
```

默认输入：

```text
user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001\style
```

默认输出：

```text
user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001_prepared_1024\style
user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001_prepared_1024\dataset_manifest.json
```

处理策略：

```text
不修改原始数据集
读取同名图片和 .txt caption
统一输出 1024x1024 PNG
保持整图构图，按原图长短边等比缩放
用原图边缘均值颜色补方形画布
复制同名 caption
manifest 记录原尺寸、缩放后尺寸、偏移、是否小图
```

执行结果：

```text
prepared_images=25
small_sources=10
输出目录: user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001_prepared_1024\style
manifest: user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001_prepared_1024\dataset_manifest.json
```

验证结果：

```text
25 PNG
25 TXT
全部图片尺寸: 1024x1024
caption trigger: ninebot_motorcycle_style
bad_caption: 0
```

### prepared 1024 训练 workflow

已生成训练 workflow：

```text
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_train_prepared_1024_v001.json
```

该 workflow 基于已跑通的最小 FLUX train workflow，但默认数据集改为：

```text
C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001_prepared_1024\style
```

默认设置：

```text
resolution: 1024 x 1024
bucket_no_upscale: False
optimizer: AdamW
network_dim: 4
network_alpha: 4
learning_rate: 1e-5
max_train_steps: 10
cache_latents: disk
cache_text_encoder_outputs: disk
blocks_to_swap: 18
```

正式训练时需要把 `max_train_steps` 从 10 改到正式步数，并按显存/速度再决定是否调 `network_dim`、LR、optimizer。

### FLUX LoRA 验证 workflow

已生成 LoRA 验证 workflow：

```text
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_validate_v001.json
```

默认加载：

```text
checkpoint: models\checkpoints\flux1-dev-fp8.safetensors
lora: models\loras\flux_trainer\ninebot_motorcycle_flux_style_smoke_rank4_bf16-step00010.safetensors
prompt: ninebot_motorcycle_style, futuristic electric three-wheeled motorcycle concept, angular white gray and black body panels, product photography, neutral gray background
negative: low quality, blurry, distorted wheels, extra wheels, broken geometry, text, watermark
seed: 123456789
steps: 20
sampler: euler
scheduler: simple
guidance: 3.5
lora strength model: 0.8
lora strength clip: 0.0
```

`strength_clip=0.0` 的原因：当前 FLUX LoRA 训练时 `train_text_encoder=disabled`，只训练 transformer/UNet 侧 LoRA，不训练文本编码器侧。

同时生成 base 对照 workflow：

```text
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_validate_base_compare_v001.json
```

该 workflow 使用同 prompt、同 seed、同 checkpoint，但 LoRA strength 设为 0，便于对比 base vs LoRA。

### Workflow 静态验证

已验证以下 workflow 的节点类型和链接结构：

```text
ninebot_flux_lora_train_minimal_v001.json
ninebot_flux_lora_train_prepared_1024_v001.json
ninebot_flux_lora_validate_base_compare_v001.json
ninebot_flux_lora_validate_v001.json
```

验证结果：

```text
missing node types: 0
bad links: 0
```

注意：命令行静态验证会加载 ComfyUI extra nodes，当前环境会警告 `nodes_replacements.py` 依赖/PromptServer 上下文问题，但目标 workflow 所需节点均可注册，未影响本轮验证结论。

## 2026-06-29 模型一致性与工作流优化处理记录

### 处理目标

针对后续复盘提出的两个问题，本轮做了实际修正：

```text
1. 训练和验证/推理的 FLUX 基底加载链路必须一致。
2. 主线工作流要减少误导项，保留可落地的打标、训练、同基底验证路线。
```

### 模型一致性修正

旧验证 workflow 使用：

```text
models\checkpoints\flux1-dev-fp8.safetensors
```

训练 workflow 使用：

```text
models\diffusion_models\flux1-dev.safetensors
models\vae\ae.safetensors
models\text_encoders\clip_l_sd_scripts.safetensors
models\text_encoders\t5xxl_fp16.safetensors
```

这两条加载链路不适合作为严格 base vs LoRA 对照，因此已新增同基底验证 workflow：

```text
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_validate_same_base_lora_v002.json
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_validate_same_base_base_compare_v002.json
```

这两条 workflow 都使用 `FluxTrainModelSelect` 加载和训练相同的 split FLUX 组件。

同时已扩展 `FluxKohyaInferenceSampler`：

```text
lora_strength: 控制 LoRA multiplier
bypass_lora: true 时完全跳过 LoRA，用同一套 FLUX 组件生成 base 对照
```

因此现在的对照方式是：

```text
LoRA 图: lora_strength = 0.8, bypass_lora = false
Base 图: lora_strength = 0.0, bypass_lora = true
```

旧 checkpoint FP8 验证 workflow 已移入归档目录，不再作为主线推荐：

```text
user\ninebot_flux_lora_training\workflows\_archive_20260629_fp8_mismatch\ninebot_flux_lora_validate_v001.json
user\ninebot_flux_lora_training\workflows\_archive_20260629_fp8_mismatch\ninebot_flux_lora_validate_base_compare_v001.json
```

### 正式训练 workflow

已新增两条正式训练 workflow：

```text
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_train_formal_adamw8bit_v001.json
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_train_formal_lion_v001.json
```

核心参数：

```text
dataset: user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001_prepared_1024\style
rank / alpha: 16 / 16
steps: 1200
AdamW8bit lr: 1e-4
Lion lr: 5e-5
```

依赖检查：

```text
bitsandbytes: OK
bitsandbytes.optim.AdamW8bit: OK
lion_pytorch: OK
schedulefree: not installed
```

当前主线不使用 schedulefree 优化器，所以不影响 AdamW8bit / Lion 两条正式 workflow。

### prepared 数据集打标 workflow

已新增 prepared_1024 数据集打标 workflow：

```text
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_caption_prepared_1024_missing_v001.json
user\ninebot_flux_lora_training\workflows\ninebot_flux_lora_caption_prepared_1024_overwrite_v001.json
```

`max_images = 0` 表示处理目录内全部图片，不是只处理 10 张。

当前 prepared 数据集检查：

```text
images = 25
txt = 25
missing_caption_count = 0
trigger = ninebot_motorcycle_style
```

### 当前推荐导入清单

详见：

```text
user\ninebot_flux_lora_training\workflows\README_FLUX_ONLY_WORKFLOWS.md
```

推荐主线：

```text
ninebot_flux_lora_caption_prepared_1024_missing_v001.json
ninebot_flux_lora_caption_prepared_1024_overwrite_v001.json
ninebot_flux_lora_train_formal_adamw8bit_v001.json
ninebot_flux_lora_train_formal_lion_v001.json
ninebot_flux_lora_validate_same_base_lora_v002.json
ninebot_flux_lora_validate_same_base_base_compare_v002.json
```

静态验证结论：

```text
以上 6 个 workflow missing node types = 0
以上 6 个 workflow bad links = 0
以上训练/验证 workflow 不包含 flux1-dev-fp8.safetensors
```

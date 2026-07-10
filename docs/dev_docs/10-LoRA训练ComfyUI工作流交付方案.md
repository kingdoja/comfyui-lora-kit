# LoRA 训练 ComfyUI 工作流交付方案

## 新需求边界

LoRA 训练模块优先采用 ComfyUI 原生方式落地：

- 直接在 ComfyUI 前端搭建工作流。
- 可以使用现成 custom nodes 或现成 workflow。
- 最终导出 JSON。
- 将 JSON 放到另一台 ComfyUI 上使用。
- 暂不优先做平台 API、异步训练服务、自研训练 UI。

## 核心结论

可以走“ComfyUI 工作流交付”路线，但不能只交付一个 JSON。

必须交付：

```text
workflow JSON
custom nodes 清单
依赖安装说明
模型路径说明
数据集目录规范
caption 规范
参数 manifest
```

原因：

- JSON 只记录节点和连线。
- 自定义节点源码不在 JSON 里。
- Python 依赖不在 JSON 里。
- checkpoint、训练图片、caption、WD14 模型不在 JSON 里。
- 目标 ComfyUI 如果没装同名节点，workflow 会直接报 missing node。

## 推荐方案

### MVP 可交付方案

用现成节点直接搭：

```text
LoRA Caption Load
-> WD14Tagger|pysssss
-> LoRA Caption Save

Lora Training in Comfy (Advanced)
-> 输出 LoRA 到 models/loras
```

当前本机已经准备：

```text
workflows/ninebot_lora_training/lora_caption_mvp.workflow.json
workflows/ninebot_lora_training/lora_training_mvp.workflow.json
workflows/ninebot_lora_training/lora_training_manifest.json
```

使用的 custom nodes：

```text
custom_nodes/Lora-Training-in-Comfy/
custom_nodes/Image-Captioning-in-ComfyUI/
custom_nodes/ComfyUI-WD14-Tagger/
```

适合：

- 内部验证。
- 迁移到另一台固定 ComfyUI。
- CUDA 机器上跑训练。
- 快速演示“导入 JSON 后能训练”。

不适合：

- 大规模产品化。
- 多用户并发训练。
- 平台任务队列。
- 严格错误恢复。

### 稳定交付方案

仍然用 ComfyUI JSON，但将节点和依赖固定版本打包：

```text
ninebot_lora_training_bundle/
  workflows/
  custom_nodes/
  requirements/
  sample_datasets/
  docs/
  install_cuda.sh
```

目标机器只做：

```text
复制 bundle
安装依赖
放模型
打开 workflow JSON
Queue
```

## 现成节点选择

### LoRA 训练节点

首选：

```text
LarryJane491/Lora-Training-in-Comfy
```

特点：

- 可以在 ComfyUI 内训练 LoRA。
- 默认输出到 ComfyUI 的 `models/loras`。
- 有普通节点和 Advanced 节点。
- Advanced 节点暴露 optimizer、network dim、alpha、resolution、epoch 等参数。

风险：

- 依赖较多。
- 作者说明可能和其他 custom nodes 有冲突。
- SDXL 支持不确定。
- 更适合 SD1.5/SD2/LCM/SDTurbo 验证。

备选：

```text
Koschpa/ComfyUI-Lora-Training
```

特点：

- 基于原 LoRA Training in Comfy 做过 sd-scripts 更新和一些重构。
- 可作为后续替换候选。

需要实测：

- 节点参数是否符合需求。
- 依赖是否更好安装。
- 是否能稳定导出/导入 JSON。

可调研：

```text
comfyUI-Realtime-Lora
```

特点：

- 有 SD1.5 / SDXL LoRA trainer 节点说明。
- 使用 sd-scripts。

需要确认：

- GitHub 源码状态。
- 是否易安装。
- 是否适合离线迁移。

### 打标 / Caption 节点

首选组合：

```text
LarryJane491/Image-Captioning-in-ComfyUI
pythongosssss/ComfyUI-WD14-Tagger
```

节点：

```text
LoRA Caption Load
WD14Tagger|pysssss
LoRA Caption Save
```

作用：

- 从图片文件夹读取图片。
- 自动生成 tags。
- 保存同名 `.txt` caption。

风险：

- WD14 更偏 booru/anime tagger。
- 产品/车辆类图片需要人工复核。
- 生产 caption 质量不能只依赖自动打标。

可补充：

```text
Florence2 / BLIP / JoyCaption 类节点
```

作用：

- 生成自然语言 caption。
- 对产品图、车辆图、场景图通常比纯 WD14 tag 更合适。

## 去哪里找节点和工作流

### ComfyUI Manager

优先从 ComfyUI Manager 搜：

```text
Lora-Training-in-Comfy
Image-Captioning-in-ComfyUI
ComfyUI-WD14-Tagger
Realtime LoRA
LoRA Training
WD14
Caption
```

优点：

- 安装方便。
- 能看到节点是否在 registry。
- 适合目标机器复现。

缺点：

- 版本可能变化。
- 有些节点会被 Manager 放到 `.disabled`。
- 依赖仍需要检查。

### GitHub

用于锁版本和打包：

```text
https://github.com/LarryJane491/Lora-Training-in-Comfy
https://github.com/LarryJane491/Image-Captioning-in-ComfyUI
https://github.com/pythongosssss/ComfyUI-WD14-Tagger
```

推荐正式交付时用 GitHub commit 固定版本，而不是只写“安装最新版”。

### 工作流网站

可参考：

```text
RunComfy
ComfyUI Cloud
ComfyOnline
社区 workflow 分享站
```

但不建议直接把网上 workflow 当交付件。原因：

- 节点版本不一定一致。
- 模型路径不一致。
- 有些 workflow 依赖私有节点。
- 训练参数可能不适合当前数据。

## 工作流如何设计

不要做一个“大而全”工作流。建议拆成两个 JSON。

### 1. Caption 工作流

文件：

```text
lora_caption_mvp.workflow.json
```

结构：

```text
LoRA Caption Load
-> WD14Tagger|pysssss
-> LoRA Caption Save
```

用途：

- 批量生成 `.txt` caption。
- 先检查 caption，再训练。

原因：

- 避免点一次 Queue 同时打标和训练。
- caption 质量需要人工复核。
- LoRA Caption Save 不适合重复覆盖已有 `.txt`，独立工作流更清晰。

### 2. LoRA 训练工作流

文件：

```text
lora_training_mvp.workflow.json
```

结构：

```text
Lora Training in Comfy (Advanced)
Tensorboard Access
```

训练节点参数：

```text
ckpt_name
data_path
batch_size
max_train_epoches
save_every_n_epochs
optimizerType
networkdimension
networkalpha
trainingresolution
learningrateText
learningrateUnet
output_name
output_dir
```

## 数据集目录规范

训练数据必须是这种结构：

```text
datasets/
  dataset_name_v001/
    10_trigger_word/
      0001.png
      0001.txt
      0002.png
      0002.txt
```

训练节点 `data_path` 填：

```text
datasets/dataset_name_v001
```

不是：

```text
datasets/dataset_name_v001/10_trigger_word
```

caption 第一位固定 trigger word：

```text
ninebot_atv_style, blue off-road vehicle, front three-quarter view, rugged tires, desert road
```

## 导出 JSON 怎么做

### 给另一台 ComfyUI 前端打开

导出普通 workflow JSON：

```text
Save Workflow
```

保留：

- 节点位置
- 分组
- widget 参数
- 连线
- UI 布局

### 给后端程序调用

导出 API JSON：

```text
Export Workflow (API)
```

API JSON 适合程序提交 `/prompt`，但不适合作为前端可编辑源文件。

本需求当前重点是“导入另一台 ComfyUI 前端使用”，所以优先交付普通 workflow JSON。

## 迁移到另一台 ComfyUI 的最小清单

目标机器必须具备：

```text
1. ComfyUI
2. custom_nodes 三个节点
3. Python 训练依赖
4. checkpoint 模型
5. workflow JSON
6. dataset 图片和 .txt caption
7. models/loras 输出目录
```

最小复制：

```text
workflows/ninebot_lora_training/
custom_nodes/Lora-Training-in-Comfy/
custom_nodes/Image-Captioning-in-ComfyUI/
custom_nodes/ComfyUI-WD14-Tagger/
user/ninebot_lora_training/datasets/
```

目标机器另放：

```text
models/checkpoints/xxx.safetensors
```

如果目标机器第一次打标，也需要 WD14 模型：

```text
custom_nodes/ComfyUI-WD14-Tagger/models/
```

## CUDA 机器建议

CUDA 上更适合正式训练。

推荐：

```text
Python 3.10 / 3.11
NVIDIA GPU 12GB+
PyTorch CUDA
xformers
bitsandbytes
accelerate
sd-scripts
```

CUDA 训练参数：

```text
optimizerType: AdamW8bit
attention: xformers
mixed_precision: fp16
batch_size: 按显存调整
```

Mac/MPS 训练参数：

```text
optimizerType: Lion 或 AdamW
attention: sdpa
mixed_precision: 谨慎
```

## 是否需要二次设计

需要，但不是一开始就自研训练节点。

建议分两层：

### 第一层：工作流二次设计

现在就做：

- 固定节点版本。
- 固定 workflow。
- 固定数据集目录规范。
- 固定参数 manifest。
- 做安装说明。
- 做 CUDA 依赖安装脚本。

这层仍然是“导入 JSON 可用”。

### 第二层：节点二次设计

后续再做：

- 更好的参数面板。
- 更好的 caption 审核。
- 更清晰的错误提示。
- 自动检测依赖。
- 自动定位 checkpoint / dataset。

这层可以做 `Ninebot LoRA Training Helper`，但不急着替代训练节点。

## 推荐交付形态

```text
ninebot_lora_training_bundle/
  workflows/
    lora_caption_mvp.workflow.json
    lora_training_mvp.workflow.json
    lora_training_manifest.json
  custom_nodes/
    Lora-Training-in-Comfy/
    Image-Captioning-in-ComfyUI/
    ComfyUI-WD14-Tagger/
  datasets/
    sample_dataset/
  requirements/
    requirements-cuda.txt
  docs/
    install.md
    usage.md
```

使用者流程：

```text
复制 custom_nodes
安装 requirements-cuda
放 checkpoint
打开 lora_caption_mvp.workflow.json
生成 caption
人工检查 caption
打开 lora_training_mvp.workflow.json
改 data_path / output_name / optimizer
Queue
训练完成后刷新 LoRA 列表
```

## 最终判断

当前需求最适合走：

```text
现成 custom nodes + 二次设计 workflow + bundle 交付
```

不建议只交付 JSON。

不建议现在自研完整训练节点。

先把“另一台 CUDA ComfyUI 导入后能跑”作为第一阶段落地目标。

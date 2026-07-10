# LoRA 训练迁移 CUDA 与打包说明

## 是否可以跳过 Mac/MPS 训练验证

可以。

如果后续正式训练会放到 NVIDIA CUDA 电脑上，当前 Mac 侧可以先跳过实际训练，只完成：

- 工作流设计
- 节点安装验证
- 样例数据集结构
- caption 打标流程
- 训练参数模板
- 打包迁移方案

原因是 LoRA 训练脚本更偏 CUDA 生态。Mac/MPS 可以用于前期搭流程，但不能代表最终 CUDA 训练环境。

## 下一步做什么

当前推荐顺序：

1. 在 Mac 上完成工作流文件整理。
2. 保留训练工作流 JSON 和参数 manifest。
3. 准备 CUDA 版依赖安装说明。
4. 把 custom nodes、workflow、数据集示例、模型目录说明打成迁移包。
5. 到 CUDA 电脑上安装 ComfyUI。
6. 安装 custom nodes 和 CUDA 训练依赖。
7. 放入 checkpoint、训练图片、caption。
8. 打开训练 workflow。
9. 先跑 100-300 step smoke test。
10. 成功后再正式训练。

## 只导出 JSON 够不够

不够。

ComfyUI workflow JSON 只保存“图怎么连”和“节点参数”，不包含：

- 自定义节点源码
- Python 依赖
- 训练脚本
- checkpoint 模型
- LoRA 输出目录
- 训练图片
- caption `.txt`
- WD14 tagger 模型

所以要分层打包。

## 推荐打包内容

### 1. Workflow 包

必须包含：

```text
workflows/ninebot_lora_training/
  lora_caption_mvp.workflow.json
  lora_training_mvp.workflow.json
  lora_training_manifest.json
  README.md
```

作用：

- 给 ComfyUI 前端打开。
- 给平台后端识别参数位置。
- 记录数据集路径和训练参数映射。

### 2. Custom Nodes 包

必须包含或在目标机器重新安装：

```text
custom_nodes/Lora-Training-in-Comfy/
custom_nodes/Image-Captioning-in-ComfyUI/
custom_nodes/ComfyUI-WD14-Tagger/
```

可以选择两种方式。

方式 A：复制目录

```text
直接把这三个 custom_nodes 目录复制到目标 ComfyUI/custom_nodes/
```

方式 B：目标机器重新 clone

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/LarryJane491/Lora-Training-in-Comfy.git
git clone https://github.com/LarryJane491/Image-Captioning-in-ComfyUI.git
git clone https://github.com/pythongosssss/ComfyUI-WD14-Tagger.git
```

如果是正式交付，推荐方式 A，因为版本固定，更可控。

### 3. 依赖包

Mac/MPS 和 CUDA 不应该共用同一份 requirements。

当前 Mac/MPS 依赖：

```text
user/ninebot_lora_training/requirements-macos-mps.txt
```

CUDA 机器建议另建：

```text
user/ninebot_lora_training/requirements-cuda.txt
```

CUDA 版需要重点包含：

```text
accelerate
diffusers
transformers
open-clip-torch
lion-pytorch
dadaptation
prodigyopt
lycoris-lora
tensorboard
xformers
bitsandbytes
```

注意：

- `xformers` 必须和 PyTorch/CUDA 版本匹配。
- `bitsandbytes` 是 `AdamW8bit` 的关键依赖。
- CUDA 机器建议 Python 3.10 或 3.11，比 Python 3.12 更稳。

### 4. 数据集包

示例结构：

```text
user/ninebot_lora_training/datasets/
  offroad_vehicle_smoke_v001/
    10_ninebot_atv_style/
      0001.png
      0001.txt
      ...
```

生产训练时替换为真实数据集：

```text
user/ninebot_lora_training/datasets/
  your_dataset_v001/
    10_trigger_word/
      image001.png
      image001.txt
```

### 5. 模型文件

目标 CUDA 机器需要自行放入：

```text
models/checkpoints/
models/loras/
```

至少需要：

```text
models/checkpoints/v1-5-pruned-emaonly.safetensors
```

或者把 workflow 里的 checkpoint 改成目标机器已有的模型。

### 6. WD14 模型缓存

可选复制：

```text
custom_nodes/ComfyUI-WD14-Tagger/models/
  wd-v1-4-moat-tagger-v2.onnx
  wd-v1-4-moat-tagger-v2.csv
```

如果不复制，目标机器第一次打标时会从 HuggingFace 下载。

## 推荐迁移包目录

建议最终整理成：

```text
ninebot_lora_training_bundle/
  workflows/
    ninebot_lora_training/
      lora_caption_mvp.workflow.json
      lora_training_mvp.workflow.json
      lora_training_manifest.json
      README.md
  custom_nodes/
    Lora-Training-in-Comfy/
    Image-Captioning-in-ComfyUI/
    ComfyUI-WD14-Tagger/
  user/
    ninebot_lora_training/
      datasets/
        offroad_vehicle_smoke_v001/
      requirements-cuda.txt
      install_train_env_cuda.sh
  docs/
    07-LoRA训练前端搭建全流程.md
    08-LoRA训练依赖隔离安装.md
    09-LoRA训练迁移CUDA与打包说明.md
```

## CUDA 机器上的执行流程

### 1. 放文件

把 bundle 内容复制到目标 ComfyUI 根目录对应位置：

```text
ComfyUI/custom_nodes/
ComfyUI/workflows/
ComfyUI/user/
```

### 2. 安装依赖

建议不要直接运行第三方节点原始 requirements。

CUDA 机器上单独执行 CUDA 版安装脚本：

```bash
cd ComfyUI
bash user/ninebot_lora_training/install_train_env_cuda.sh
```

或者如果决定使用 ComfyUI 主 venv，也要先备份环境，再安装。

### 3. 重启 ComfyUI

确认能搜到：

```text
LoRA Caption Load
WD14Tagger|pysssss
LoRA Caption Save
Lora Training in Comfy (Advanced)
Tensorboard Access
```

### 4. 打开工作流

先打开：

```text
workflows/ninebot_lora_training/lora_caption_mvp.workflow.json
```

验证 caption。

再打开：

```text
workflows/ninebot_lora_training/lora_training_mvp.workflow.json
```

### 5. CUDA 训练参数建议

CUDA smoke test：

```text
optimizerType: AdamW8bit
networkdimension: 16
networkalpha: 8
batch_size: 1
max_train_epoches: 1
save_every_n_epochs: 1
trainingresolution: 512
```

正式训练初始值：

```text
optimizerType: AdamW8bit
networkdimension: 32 或 64
networkalpha: 16 或 32
batch_size: 1-4
max_train_epoches: 5-10
trainingresolution: 512 或 768
```

## 平台化时怎么用

平台不要只依赖前端 workflow JSON。

建议平台侧使用：

```text
workflow JSON + manifest + custom node package + dependency installer
```

执行逻辑：

1. 平台 UI 收集参数。
2. 后端读取 manifest。
3. 后端替换 workflow 里的节点参数。
4. 后端提交 ComfyUI `/prompt`。
5. 后端监听训练日志和输出文件。
6. 训练完成后把 `.safetensors` 登记到资产库。

## 最终结论

如果只是自己换一台 ComfyUI 跑：

```text
复制 workflows + custom_nodes + user/ninebot_lora_training + 模型文件
```

如果要交付给别人或平台化：

```text
不要只导出 JSON，要做 bundle。
```

JSON 是工作流入口，custom nodes 和依赖才是能不能跑的关键。

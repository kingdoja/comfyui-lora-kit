# LoRA 训练落地 Bundle 实施计划

## 目标

做一个可以迁移到另一台 CUDA ComfyUI 的 LoRA 训练交付包。

交付包目标：

```text
复制到目标 ComfyUI
-> 安装依赖
-> 放 checkpoint 和训练数据
-> 打开 workflow JSON
-> 运行 caption / training
-> 输出 LoRA 到 models/loras
```

## 不做什么

第一阶段不做：

- 自研完整 LoRA 训练节点。
- 平台 API。
- 多用户任务队列。
- 训练任务数据库。
- 资产库完整闭环。

第一阶段只做：

- ComfyUI workflow 交付。
- custom nodes 固定版本随包。
- CUDA 依赖安装说明和脚本。
- 数据集规范。
- 使用文档。

## 最终目录

目标目录：

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
  datasets/
    offroad_vehicle_smoke_v001/
    offroad_vehicle_caption_scratch_v001/
  requirements/
    requirements-cuda.txt
    install_cuda.sh
  docs/
    install.md
    usage.md
    07-LoRA训练前端搭建全流程.md
    09-LoRA训练迁移CUDA与打包说明.md
    10-LoRA训练ComfyUI工作流交付方案.md
```

## 文件来源

### Workflow

来源：

```text
workflows/ninebot_lora_training/
```

复制：

```text
lora_caption_mvp.workflow.json
lora_training_mvp.workflow.json
lora_training_manifest.json
README.md
```

### Custom Nodes

来源：

```text
custom_nodes/Lora-Training-in-Comfy/
custom_nodes/Image-Captioning-in-ComfyUI/
custom_nodes/ComfyUI-WD14-Tagger/
```

复制整个目录。

注意：

- 保留 Git 目录可以记录 commit，但包会更大。
- 第一版先保留完整目录，保证可复现。
- 后续可做 clean 版，删除 `.git`、`__pycache__`、模型缓存。

### Sample Datasets

来源：

```text
user/ninebot_lora_training/datasets/
```

复制：

```text
offroad_vehicle_smoke_v001/
offroad_vehicle_caption_scratch_v001/
```

说明：

- `offroad_vehicle_smoke_v001` 已含 `.txt`，可直接训练 smoke test。
- `offroad_vehicle_caption_scratch_v001` 初始只有 `.png`，用于测试自动打标。

### Docs

复制已有文档：

```text
07-LoRA训练前端搭建全流程.md
09-LoRA训练迁移CUDA与打包说明.md
10-LoRA训练ComfyUI工作流交付方案.md
```

新增：

```text
install.md
usage.md
```

## CUDA 依赖策略

目标 CUDA 环境建议：

```text
Python 3.10 或 3.11
NVIDIA GPU 12GB+
PyTorch CUDA
```

CUDA 训练依赖：

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

- `xformers` 需要匹配 PyTorch/CUDA。
- `bitsandbytes` 是 `AdamW8bit` 所需依赖。
- 目标 CUDA 机器上不要直接使用 Mac/MPS 的 `requirements-macos-mps.txt`。

## 安装脚本设计

`install_cuda.sh` 做：

1. 检查当前路径是否为 ComfyUI 根目录。
2. 检查 `.venv/bin/python` 或 `python_embeded/python.exe`。
3. 安装 `requirements-cuda.txt`。
4. 输出 custom node 检查提示。

第一版只支持 Unix/Linux venv：

```text
.venv/bin/python
```

Windows portable 后续单独补。

## 使用流程

目标机器使用者流程：

1. 复制 bundle 内容到 ComfyUI 根目录。
2. 安装 CUDA 依赖。
3. 放 checkpoint 到 `models/checkpoints/`。
4. 重启 ComfyUI。
5. 打开 `lora_caption_mvp.workflow.json`。
6. 运行自动打标。
7. 人工检查 caption。
8. 打开 `lora_training_mvp.workflow.json`。
9. 修改 `data_path`、`output_name`、`optimizerType`。
10. Queue 训练。
11. 在 `models/loras/` 查看输出 LoRA。

## 验收标准

静态验收：

- bundle 目录存在。
- workflow JSON 合法。
- custom nodes 三个目录存在。
- sample dataset 图片和 caption 存在。
- CUDA requirements 存在。
- install/usage 文档存在。

CUDA 运行验收：

- 目标 ComfyUI 能搜索到：
  ```text
  LoRA Caption Load
  WD14Tagger|pysssss
  LoRA Caption Save
  Lora Training in Comfy (Advanced)
  Tensorboard Access
  ```
- caption workflow 能生成 `.txt`。
- training workflow 能完成 1 epoch smoke test。
- 输出：
  ```text
  models/loras/ninebot_atv_style_smoke.safetensors
  ```

## 当前执行顺序

1. 写本实施计划。
2. 创建 `ninebot_lora_training_bundle/`。
3. 复制 workflow。
4. 复制 custom nodes。
5. 复制 sample datasets。
6. 新增 CUDA requirements 和 install 脚本。
7. 新增 install/usage 文档。
8. 静态校验。

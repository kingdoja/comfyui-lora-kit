# LoRA 训练前端搭建全流程

## 当前可用内容

ComfyUI 地址：

```text
http://127.0.0.1:8000
```

已安装并验证可搜索到这些节点：

```text
LoRA Caption Load
WD14Tagger|pysssss
LoRA Caption Save
Lora Training in Comfy (Advanced)
Tensorboard Access
```

已准备两个工作流：

```text
workflows/ninebot_lora_training/lora_caption_mvp.workflow.json
workflows/ninebot_lora_training/lora_training_mvp.workflow.json
```

## 先说结论

不要从空白画布开始搭。

正确顺序是：

1. 先打开 `lora_caption_mvp.workflow.json`，验证自动打标。
2. 确认图片旁边生成 `.txt` caption。
3. 人工检查 caption。
4. 再打开 `lora_training_mvp.workflow.json`，准备训练参数。
5. 等训练依赖隔离完成后，再 Queue 训练工作流。

当前训练依赖还没完整安装，所以现在先不要 Queue 训练工作流。

## 数据集路径

### 自动打标测试数据集

这个目录初始只有图片，没有 `.txt`：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/datasets/offroad_vehicle_caption_scratch_v001/10_ninebot_atv_style
```

用于：

```text
LoRA Caption Load -> WD14Tagger|pysssss -> LoRA Caption Save
```

### 训练 ready 数据集

这个目录已经有图片和同名 `.txt`：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001/10_ninebot_atv_style
```

训练节点的 `data_path` 不填这个图片目录，而是填它的上一级：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001
```

原因是训练脚本需要看到：

```text
offroad_vehicle_smoke_v001/
  10_ninebot_atv_style/
    0001.png
    0001.txt
```

## 方法 A：直接打开我准备好的工作流

### 打开自动打标工作流

1. 打开浏览器：

```text
http://127.0.0.1:8000
```

2. 点击左上角 `Workflow` 或页面上的打开按钮。
3. 选择：

```text
/Users/ninebot/Documents/ComfyUI/workflows/ninebot_lora_training/lora_caption_mvp.workflow.json
```

4. 画布上应该看到 3 个节点：

```text
LoRA Caption Load
WD14Tagger|pysssss
LoRA Caption Save
```

5. 检查 `LoRA Caption Load` 的路径：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/datasets/offroad_vehicle_caption_scratch_v001/10_ninebot_atv_style
```

6. 检查 `LoRA Caption Save` 的 prefix：

```text
ninebot_atv_style
```

7. 点击 `Queue`。

第一次运行 WD14 会从 HuggingFace 下载 tagger 模型，可能会慢。当前我启动 ComfyUI 时带了代理环境，适合首次下载。

8. 运行完成后检查这个目录是否生成 `.txt`：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/datasets/offroad_vehicle_caption_scratch_v001/10_ninebot_atv_style
```

应该变成：

```text
0001.png
0001.txt
0002.png
0002.txt
...
0010.png
0010.txt
```

### 打开训练工作流

1. 打开：

```text
/Users/ninebot/Documents/ComfyUI/workflows/ninebot_lora_training/lora_training_mvp.workflow.json
```

2. 画布上应该看到：

```text
Lora Training in Comfy (Advanced)
Tensorboard Access
```

3. 检查训练节点参数：

```text
ckpt_name: v1-5-pruned-emaonly.safetensors
networkdimension: 16
networkalpha: 8
trainingresolution: 512
data_path: /Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001
batch_size: 1
max_train_epoches: 1
save_every_n_epochs: 1
optimizerType: Lion
output_name: ninebot_atv_style_smoke
output_dir: models/loras
```

4. 当前先不要 Queue。

原因：训练节点已经加载成功，但完整训练依赖还没隔离安装。直接 Queue 大概率会报缺 `accelerate`、`diffusers`、`lion_pytorch` 等依赖，或者触发 ComfyUI 环境版本冲突。

## 方法 B：从空白画布手动搭

如果以后要自己手动搭，按下面做。

### 自动打标工作流

1. 在 ComfyUI 空白处双击。
2. 搜索：

```text
LoRA Caption Load
```

3. 添加节点。
4. 在它的 `path` 里填：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/datasets/offroad_vehicle_caption_scratch_v001/10_ninebot_atv_style
```

5. 再双击空白处，搜索：

```text
WD14Tagger
```

6. 添加 `WD14Tagger|pysssss`。
7. 再双击空白处，搜索：

```text
LoRA Caption Save
```

8. 添加节点。

9. 连线：

```text
LoRA Caption Load: Image list -> WD14Tagger|pysssss: image
LoRA Caption Load: Name list -> LoRA Caption Save: namelist
LoRA Caption Load: path -> LoRA Caption Save: path
WD14Tagger|pysssss: STRING -> LoRA Caption Save: text
```

10. 设置 `WD14Tagger|pysssss`：

```text
model: wd-v1-4-moat-tagger-v2
threshold: 0.35
character_threshold: 0.85
replace_underscore: true
trailing_comma: false
exclude_tags: text, watermark, signature, logo
```

11. 设置 `LoRA Caption Save`：

```text
prefix: ninebot_atv_style
```

12. 点击 `Queue`。

### 训练工作流

1. 空白处双击。
2. 搜索：

```text
Lora Training in Comfy
```

3. 选择：

```text
Lora Training in Comfy (Advanced)
```

4. 设置参数：

```text
ckpt_name: v1-5-pruned-emaonly.safetensors
v2: No
networkmodule: networks.lora
networkdimension: 16
networkalpha: 8
trainingresolution: 512
data_path: /Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001
batch_size: 1
max_train_epoches: 1
save_every_n_epochs: 1
keeptokens: 1
minSNRgamma: 0
learningrateText: 0.00005
learningrateUnet: 0.0001
learningRateScheduler: constant
lrRestartCycles: 1
optimizerType: Lion
output_name: ninebot_atv_style_smoke
algorithm: lora
networkDropout: 0
clip_skip: 2
output_dir: models/loras
```

5. 可选添加：

```text
Tensorboard Access
```

6. 当前先不要 Queue，等训练依赖处理完成。

## 训练依赖下一步

当前 ComfyUI 环境是：

```text
macOS / Apple M1 Pro / MPS
Python 3.12
torch 2.13 dev
transformers 5.9
```

第三方训练节点的 requirements 比较老，直接安装会有风险。

建议下一步不是直接 `pip install -r requirements.txt`，而是做隔离方案：

1. 优先验证 caption 工作流。
2. 单独整理训练依赖清单。
3. 先安装最低训练依赖，不降级 torch/transformers。
4. 如果仍不兼容，就把训练 worker 放到独立 venv，不污染 ComfyUI 主环境。

## 常见问题

### 为什么自动打标工作流不要用已有 `.txt` 的训练数据集？

`LoRA Caption Save` 不会覆盖已有同名 `.txt`，已有 `.txt` 时可能报错或跳号。所以自动打标测试用的是 `offroad_vehicle_caption_scratch_v001`。

### 为什么训练节点的 data_path 不是图片目录？

训练脚本需要读取 repeat 文件夹结构：

```text
parent/
  10_name/
    image.png
    image.txt
```

所以 `data_path` 要填 parent。

### AdamW8bit 为什么不作为 Mac 默认？

`AdamW8bit` 依赖 `bitsandbytes`，通常适合 NVIDIA CUDA。当前机器是 Apple M1 Pro / MPS，所以 smoke-test 默认先用 `Lion`。正式平台如果部署 NVIDIA 机器，再启用 `AdamW8bit`。

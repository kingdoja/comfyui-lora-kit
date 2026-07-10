# LoRA 训练依赖隔离安装

## 目标

训练依赖不能直接装进 ComfyUI 主环境。

当前主环境是：

```text
/Users/ninebot/Documents/ComfyUI/.venv
Python 3.12.11
torch 2.13 dev
transformers 5.9
macOS / Apple M1 Pro / MPS
```

第三方训练节点的 requirements 会安装或降级大量包，包括 `transformers`、`diffusers`、`xformers`、`bitsandbytes` 等。直接安装到主环境有较高风险。

## 安装位置

独立训练环境：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/train_venv
```

当前已安装完成。

安装脚本：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/install_train_env.sh
```

依赖文件：

```text
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/requirements-macos-mps.txt
```

## Mac/MPS 策略

不安装：

```text
xformers
bitsandbytes
```

原因：

- `xformers` 主要服务 CUDA。
- `bitsandbytes` 的 `AdamW8bit` 通常依赖 NVIDIA CUDA，当前 Apple Silicon 不适合作为默认。

保留：

```text
Lion
DAdaptation
AdamW fallback
```

## 训练节点补丁

`custom_nodes/Lora-Training-in-Comfy/train.py` 已调整：

- 优先使用 `user/ninebot_lora_training/train_venv/bin/python`
- 如果设置了 `NINEBOT_LORA_TRAIN_PYTHON`，优先用该环境变量
- `train_network.py` 改为绝对路径
- 相对 `models/loras` 输出路径会解析到 ComfyUI 数据目录
- Mac/MPS 自动使用 `--sdpa`，CUDA 才使用 `--xformers`
- 训练日志写入 `user/ninebot_lora_training/logs/`
- 训练子进程返回码非 0 时抛出异常，避免失败任务误显示完成

`custom_nodes/Lora-Training-in-Comfy/sd-scripts/library/model_util.py` 已做兼容补丁：

- 加载 SD1.5 checkpoint 时移除 `text_model.embeddings.position_ids`
- 解决当前 `transformers==4.36.2` 下 CLIP state dict 的 unexpected key 报错

## 安装命令

```bash
cd /Users/ninebot/Documents/ComfyUI
bash user/ninebot_lora_training/install_train_env.sh
```

## 验证命令

```bash
/Users/ninebot/Documents/ComfyUI/user/ninebot_lora_training/train_venv/bin/python - <<'PY'
import torch
import accelerate
import diffusers
import transformers
import lion_pytorch
import dadaptation

print("torch", torch.__version__)
print("mps", torch.backends.mps.is_available())
print("accelerate", accelerate.__version__)
print("diffusers", diffusers.__version__)
print("transformers", transformers.__version__)
print("lion_pytorch ok")
print("dadaptation ok")
PY
```

## 注意

安装完成后要重启 ComfyUI，训练节点才会加载修改后的 `train.py`。

Python 3.12/macOS arm64 上不要使用第三方节点原始的 `transformers==4.30.2`，它依赖的老 `tokenizers==0.13.3` 没有可用 wheel，会要求安装 Rust 编译工具链。隔离环境改用 `transformers==4.36.2`。

安装验证结果：

```text
torch: 2.13.0.dev20260524
mps: True
accelerate: 0.23.0
diffusers: 0.21.2
transformers: 4.36.2
numpy: 1.26.4
lion_pytorch: OK
dadaptation: OK
tensorboard: 2.20.0
```

主 ComfyUI venv 已检查：

```text
No broken requirements found.
```

第一次训练建议仍然使用 smoke-test 参数：

```text
optimizerType: Lion
batch_size: 1
max_train_epoches: 1
networkdimension: 16
networkalpha: 8
trainingresolution: 512
```

## 已验证结果

手动 tiny smoke 训练已通过：

```text
output: models/loras/ninebot_atv_style_tiny_smoke_manual.safetensors
```

ComfyUI API tiny smoke 训练已通过：

```text
workflow: workflows/ninebot_lora_training/lora_training_tiny_smoke.api.json
prompt_id: cfba960c-c64f-4475-a708-b395ae0a9edc
runtime: 142.38 seconds
output: models/loras/ninebot_atv_style_tiny_smoke.safetensors
log: user/ninebot_lora_training/logs/ninebot_atv_style_tiny_smoke_20260626_160629.log
```

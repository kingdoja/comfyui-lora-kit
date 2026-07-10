# FLUX 本机可行性与路线

## 结论

当前这台 Mac M1 Pro / 16GB 统一内存机器可以尝试 FLUX 低规格生图烟测，但不建议在本机做 FLUX LoRA 训练。

推荐路线：

1. SD1.5 LoRA 训练链路继续作为本机 MVP 主线。
2. FLUX 只先做生图工作流模板和模型加载验证。
3. FLUX LoRA 训练放到 CUDA 训练 worker，建议 NVIDIA 24GB+ 显存起步。

## 当前本机状态

ComfyUI 已支持 FLUX 相关基础节点：

```text
UNETLoader
DualCLIPLoader
VAELoader
EmptySD3LatentImage
FluxGuidance
BasicGuider
BasicScheduler
SamplerCustomAdvanced
```

当前已发现模型：

```text
/Users/ninebot/ComfyUI-Shared/models/vae/ae.safetensors
```

当前未发现 FLUX 必需的主模型和文本编码器：

```text
models/diffusion_models/flux*.safetensors
models/text_encoders/t5*.safetensors
models/text_encoders/clip_l*.safetensors
```

所以当前不能直接跑 FLUX，需要先补模型文件。

## 生图需要的模型文件

典型 ComfyUI FLUX 生图需要：

```text
diffusion_models/
  flux1-schnell 或 flux1-dev 的 fp8 / quantized 版本

text_encoders/
  clip_l.safetensors
  t5xxl_fp8_e4m3fn.safetensors 或其他低显存 T5 版本

vae/
  ae.safetensors
```

这台机器优先选择 fp8 或量化版本，不建议直接加载完整 bf16 FLUX 主模型加完整 T5。

## 本机建议参数

用于 smoke test：

```text
resolution: 512x512 或 768x768
batch_size: 1
steps:
  schnell: 4-8
  dev: 12-20
guidance:
  schnell: 0 或按工作流要求
  dev: 3.5 左右
```

预期：

- 可以做低规格验证。
- 首次加载会慢。
- 生成速度会明显慢于 SD1.5。
- 内存压力大时需要降低分辨率、步数或使用更低量化模型。

## LoRA 训练建议

不建议在本机做 FLUX LoRA 训练，原因：

- FLUX 主模型和文本编码器内存占用明显高于 SD1.5。
- 当前本机是 MPS，不支持常见 CUDA 训练优化组合。
- AdamW8bit / bitsandbytes 路线主要面向 NVIDIA CUDA。
- 训练会长时间占用 ComfyUI 主进程，不适合作为平台生产任务。

生产建议：

```text
平台前端 / ComfyUI 工作流
-> 生成训练配置
-> CUDA worker 执行 FLUX LoRA 训练
-> 产物回传 models/loras 或资产库
-> ComfyUI 只负责加载与验证
```

## 下一步

如果要推进 FLUX：

1. 先补 FLUX 生图模型文件。
2. 做一个 `workflows/ninebot_lora_generation/flux_txt2img_smoke.api.json`。
3. 在本机只验证低规格生图。
4. FLUX LoRA 训练另开 CUDA worker 方案。

# Third-Party Dependencies

这个仓库不 vendoring 第三方大体积节点、模型和缓存。目标 ComfyUI 需要按实际 workflow 安装下列依赖。

## ComfyUI Custom Nodes

FLUX LoRA pipeline 相关：

- `ComfyUI-FluxTrainer`
- `ComfyUI-Florence2`
- `ComfyUI-WD14-Tagger`
- `ninebot_flux_lora_caption`（如果目标 workflow 需要独立 caption 适配节点）

SD1.5 / legacy 打标训练相关：

- `ComfyUI-WD14-Tagger`
- `Image-Captioning-in-ComfyUI`
- `Lora-Training-in-Comfy`

## Model Files

FLUX 默认配置期望目标 ComfyUI 有：

```text
models/unet/flux1-dev.safetensors
models/vae/ae.safetensors
models/clip/clip_l.safetensors
models/clip/t5xxl_fp16.safetensors
```

FLUX 图生图 / 推理 workflow 可能还需要：

```text
models/checkpoints/flux1-dev-fp8.safetensors
```

WD14 tagger 需要目标节点自己的 ONNX 模型缓存。不要把 ONNX 模型直接提交到这个仓库。

## Excluded Source Material

原 ComfyUI 工作区里以下内容没有纳入本仓库：

- `ninebot_lora_training_bundle/custom_nodes/*` 的第三方完整副本。
- `ninebot_lora_training_bundle/custom_nodes/**/models/`。
- `ninebot_lora_training_bundle/custom_nodes/**/huggingface/`。
- `ninebot_lora_training_bundle/custom_nodes/**/logs/`。
- `ninebot_lora_training_bundle/datasets/` 里的图片和 PSD 文件。

保留这些依赖为外部安装项，可以避免仓库体积膨胀，也避免把模型权重和训练素材误公开。

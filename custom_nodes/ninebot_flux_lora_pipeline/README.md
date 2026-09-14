# Ninebot FLUX LoRA Pipeline

`NinebotFluxLoRATrainPipeline` 是一个面向 ComfyUI 的 FLUX LoRA 编排节点：把多图上传、数据集暂存、caption sidecar、训练参数映射、FluxTrainer 调用、产物落盘和下载校验收敛到一条可观察的执行链路。

## 为什么做成节点

传统训练流程需要在文件管理器、caption 工具、命令行训练器和模型目录之间来回切换，容易出现旧数据串批、caption 与图片不匹配、训练产物找不到等问题。本节点将这些边界显式化：每次运行使用独立 `run_id`，上传新批次替换旧列表，训练前可用 `dry_run` 检查 staging 结果，完成后只允许下载已存在的 LoRA 文件。

## 节点能力

| 能力 | 行为 |
| --- | --- |
| 多图上传 | 支持 PNG/JPG/JPEG/WEBP；新批次替换旧 `uploaded_images`，避免混入上一次数据 |
| Caption sidecar | 默认生成包含 `trigger_word` 的同名 `.txt`，保留扩展 Florence2/WD14 adapter 的接口 |
| Dry run | 只执行暂存、caption 和 manifest，不触发训练，适合首轮路径校验 |
| FLUX 训练 | 将公开参数和 Advanced Settings 映射到已安装的 FluxTrainer 节点 |
| 进度与错误 | 通过 ComfyUI node status 回传下载/训练状态，并对未完成或缺失文件返回明确错误 |
| 产物下载 | 训练完成后在 `output_lora_name` 旁点击下载图标，后端只提供真实存在的 `.safetensors` |

## 安装依赖

本目录只包含 Ninebot wrapper，不 vendoring 训练器和模型。目标 ComfyUI 还需要：

- `ComfyUI-FluxTrainer`
- `ComfyUI-Florence2`（如果启用 Florence caption adapter）
- `ComfyUI-WD14-Tagger`（如果启用 WD14 caption adapter）
- `ninebot_flux_lora_caption`（独立 caption 适配节点，可选）

将本目录复制到目标 ComfyUI 的 `custom_nodes/` 后重启。模型文件清单和第三方许可证边界见仓库根目录 [THIRD_PARTY.md](../../THIRD_PARTY.md)。

## 使用流程

1. 从 `Ninebot/FLUX LoRA` 分类添加 `NinebotFluxLoRATrainPipeline`。
2. 在训练图片区一次性选择本轮数据；再次上传会替换旧列表。
3. 设置唯一触发词，例如 `ninebot_motorcycle_style`，不要使用 `car`、`vehicle` 等泛词。
4. 首次执行保持 `dry_run`，确认 staging 目录、`.txt` sidecar 和 manifest 正确。
5. 需要调速或节省显存时，连接 `NinebotFluxLoRAAdvancedSettings`；默认路径优先保持 `bf16` + `sdpa`。
6. 关闭 `dry_run` 后排队训练；完成后点击 `output_lora_name` 右侧下载图标。

## 默认参数（RTX 4080 16GB 参考）

- rank / alpha：`8`
- max train steps：`600`
- learning rate：`0.0001`
- optimizer：`adamw8bit`
- latent / text encoder cache：`memory`
- `fp8_base`：enabled
- gradient dtype：`bf16`
- attention：`sdpa`

Advanced 节点只暴露 8 个高价值旋钮：`training_resolution`、`batch_size`、`num_repeats`、`blocks_to_swap`、`fp8_base`、`gradient_dtype`、`attention_mode`、`sample_prompts`。其中 `sample_prompts` 仅用于训练过程的验证预览，不会替代训练图片 caption。

## 输出目录

```text
user/ninebot_flux_lora_training/datasets/pipeline_uploads/<run_id>/style/
  image_0001.png
  image_0001.txt
  _ninebot_pipeline_manifest.json

output/ninebot_flux_lora_training/<output_lora_name>/
models/loras/flux_trainer/<output_lora_name>.safetensors  # FluxTrainer copy mode 成功时
```

## 工程边界与测试

节点负责 orchestration、输入校验、运行目录隔离、状态反馈和下载路由；实际优化算法由 FluxTrainer / sd-scripts 执行。仓库包含 pipeline/routes Python 单元测试，以及前端上传替换、内联编辑、LoRA 路径 payload 和 widget 隐藏测试。当前不宣称正式效果评测、多人并发队列或生产级任务调度。

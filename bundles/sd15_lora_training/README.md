# Ninebot SD1.5 LoRA Training Bundle

这是面向 CUDA ComfyUI 的 SD1.5 / legacy LoRA 训练 MVP。它把自动打标、caption 复核、训练 smoke test、依赖安装和迁移文档整理为轻量 bundle；FLUX 训练请改用 `bundles/flux_lora_training`。

## Bundle 内容

```text
workflows/    # 打标与训练 workflow JSON
custom_nodes/ # 仅保留必要的项目节点入口
datasets/     # 轻量 caption 示例与 smoke-test manifest
requirements/ # CUDA / Windows Python 3.11 安装脚本
docs/         # 安装、使用、迁移与排错
```

## 推荐验证顺序

1. 安装目标 ComfyUI 和第三方节点。
2. 打开 `workflows/ninebot_lora_training/lora_caption_mvp.workflow.json`，用 WD14 生成同名 `.txt`。
3. 人工复核 caption 后，打开 `lora_training_mvp.workflow.json`。
4. 用 1 epoch smoke test 验证 checkpoint、`data_path`、CUDA 和 `models/loras` 输出。
5. 只有 smoke test 通过后，才替换为正式数据集和训练参数。

## 关键约束

- `data_path` 必须指向包含 `10_<trigger_word>` repeat 文件夹的父目录。
- 每张图片必须有同名 `.txt` caption。
- 训练 workflow 不是开箱即用的独立程序，目标环境仍需安装自定义节点、Python 依赖和 checkpoint。
- 样例数据只用于验证链路，不代表正式模型质量。

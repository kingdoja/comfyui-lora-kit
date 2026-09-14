# Ninebot LoRA Training Workflows

这是 SD1.5 / legacy bundle 内的打标与训练入口，与仓库根目录 `workflows/ninebot_lora_training/` 保持同一套 workflow 说明。

## Included Workflows

- `lora_caption_mvp.workflow.json`：`LoRA Caption Load → WD14Tagger|pysssss → LoRA Caption Save` 自动打标链路。
- `lora_training_mvp.workflow.json`：短时 LoRA 训练 smoke test。
- `lora_training_manifest.json`：节点、widget、数据集路径和参数映射。

## Dataset Contract

```text
user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001/
  10_ninebot_atv_style/
    0001.png
    0001.txt
```

训练节点的 `data_path` 填 repeat 文件夹的父目录，触发词使用 `ninebot_atv_style`。正式训练前请先完成人工 caption 复核和 1 epoch smoke test；样例数据不代表生产质量。

目标 ComfyUI 需要安装 `LoRA Caption Load`、`LoRA Caption Save`、`WD14Tagger|pysssss`、`Lora Training in ComfyUI`、`Lora Training in Comfy (Advanced)` 和 `Tensorboard Access`。

# Ninebot LoRA 打标与训练 Workflows

本目录保存 SD1.5 / legacy 路线的两个可导入 ComfyUI workflow：先自动打标，再用同一份数据做短时训练验证。它是理解“数据准备 → caption → 训练”链路的最小可复现入口；FLUX 训练请使用仓库中的 `NinebotFluxLoRATrainPipeline` 和对应 workflow。

## 文件与用途

| 文件 | 用途 |
| --- | --- |
| `lora_caption_mvp.workflow.json` | WD14 自动打标，将标签写回同名 `.txt` |
| `lora_training_mvp.workflow.json` | LoRA 训练 smoke test，验证依赖、路径和输出 |
| `lora_training_manifest.json` | 记录节点、widget、数据集和参数映射 |

## 打标链路

```text
LoRA Caption Load → WD14Tagger|pysssss → LoRA Caption Save
```

使用 `offroad_vehicle_caption_scratch_v001`：目录初始只放 `.png`，执行后应出现匹配的 `.txt`。生成结果必须人工复核，重点检查触发词、主体、视角、材质和背景；不要把自动标签未经审核直接当作生产数据。

## 训练 smoke test

使用 `offroad_vehicle_smoke_v001` 验证训练节点：

```text
data_path: user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001
repeat folder: 10_ninebot_atv_style/
trigger word: ninebot_atv_style
```

`data_path` 填 repeat 文件夹的上一层，而不是 `10_ninebot_atv_style` 本身。建议先用 1 epoch、batch size 1、512 分辨率和 `AdamW8bit` 完成 CUDA smoke test，确认 `.safetensors` 能写入 `models/loras` 后再扩大训练规模。

## 目标节点

- `LoRA Caption Load`
- `WD14Tagger|pysssss`
- `LoRA Caption Save`
- `Lora Training in ComfyUI`
- `Lora Training in Comfy (Advanced)`
- `Tensorboard Access`

节点缺失时 workflow 会显示红色节点；请先按仓库根目录 [THIRD_PARTY.md](../../THIRD_PARTY.md) 安装依赖。训练依赖未完整安装前，不要直接排队正式任务。

## 证据边界

已覆盖的是 workflow 导入、caption sidecar 生成路径和短时 smoke-test 设计；该目录不提供生产级模型效果结论。正式训练前应替换为 30–80 张精选、非重复图片，并人工审核全部 caption。

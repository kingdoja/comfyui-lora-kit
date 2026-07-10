# Ninebot LoRA Training Workflows

当前目录保存 SD1.5 / legacy LoRA 打标和训练相关 ComfyUI workflow。

## Included Workflows

- `lora_caption_mvp.workflow.json`: 自动打标 workflow。
- `lora_training_mvp.workflow.json`: LoRA 训练 smoke-test workflow。
- `lora_training_manifest.json`: workflow、节点和数据集路径说明。

## Confirmed Nodes

目标 ComfyUI 需要能找到这些节点：

- `LoRA Caption Load`
- `LoRA Caption Save`
- `WD14Tagger|pysssss`
- `Lora Training in ComfyUI`
- `Lora Training in Comfy (Advanced)`
- `Tensorboard Access`

## Example Dataset Layout

```text
user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001/
  10_ninebot_atv_style/
    0001.png
    0001.txt
    ...
    0010.png
    0010.txt
```

训练节点里的 `data_path` 应填写 repeat 文件夹的上一层：

```text
user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001
```

触发词：

```text
ninebot_atv_style
```

这个数据集只用于 smoke test，不用于正式训练质量评估。

## Recommended Validation

1. 在 ComfyUI 前端搭建打标链路：

```text
LoRA Caption Load
-> WD14Tagger|pysssss
-> LoRA Caption Save
```

2. 验证每张图片能生成或覆盖同名 `.txt` caption。
3. 再处理训练依赖，不要直接全量安装第三方 requirements。

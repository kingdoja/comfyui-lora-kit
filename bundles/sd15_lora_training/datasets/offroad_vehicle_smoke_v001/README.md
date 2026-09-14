# offroad_vehicle_smoke_v001

用于验证 SD1.5 caption 与 LoRA 训练 workflow 的 smoke-test 数据集，不用于生产质量评估。样例包含 10 张图片，其中部分来自同一源图或轻量增强，仅用于快速发现路径、依赖和输出问题。

```text
10_ninebot_atv_style/
  0001.png
  0001.txt
  ...
```

训练触发词：`ninebot_atv_style`

适合验证：`LoRA Caption Load`、`WD14Tagger|pysssss`、`LoRA Caption Save` 和短时训练输出。正式训练请替换为 30–80 张精选、非重复图片，并人工审核全部 caption。

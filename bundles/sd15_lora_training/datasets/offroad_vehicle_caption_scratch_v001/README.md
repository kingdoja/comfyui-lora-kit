# offroad_vehicle_caption_scratch_v001

用于验证“图片 → WD14 标签 → caption sidecar”链路的最小数据集。初始只放 `.png`，由 `LoRA Caption Save` 创建与图片同名的 `.txt`。

```text
10_ninebot_atv_style/
```

对应 workflow：`workflows/ninebot_lora_training/lora_caption_mvp.workflow.json`。

如果目录中已经存在生成过的 `.txt`，上游节点可能为避免覆盖而跳过文件。需要重新生成时，先备份并移除这些生成文件，再重新排队；生成后请人工复核触发词和主体描述。

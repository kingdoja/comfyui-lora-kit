# offroad_vehicle_smoke_v001

This is a smoke-test LoRA dataset for validating the ComfyUI caption and training workflow.

It is not a production-quality dataset. Several images are generated from the same source or lightly augmented to reach 10 samples.

## Training Folder

```text
10_ninebot_atv_style/
```

The `10` prefix is the repeat count expected by common LoRA training scripts.

## Trigger Word

```text
ninebot_atv_style
```

## Intended Use

- Validate `LoRA Caption Load`
- Validate `WD14Tagger|pysssss`
- Validate `LoRA Caption Save`
- Run a short LoRA training smoke test only

## Next Step

For production training, replace this folder with 30-80 curated, non-duplicated source images and manually reviewed captions.

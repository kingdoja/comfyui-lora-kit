# Use Ninebot LoRA Training Bundle

## Workflow 1: Caption

Open:

```text
workflows/ninebot_lora_training/lora_caption_mvp.workflow.json
```

Nodes:

```text
LoRA Caption Load
-> WD14Tagger|pysssss
-> LoRA Caption Save
```

Use a folder with PNG images and no existing `.txt` files:

```text
user/ninebot_lora_training/datasets/offroad_vehicle_caption_scratch_v001/10_ninebot_atv_style
```

Run `Queue`.

Expected result:

```text
0001.png
0001.txt
0002.png
0002.txt
...
```

Review generated `.txt` files manually before training.

## Workflow 2: Training

Open:

```text
workflows/ninebot_lora_training/lora_training_mvp.workflow.json
```

Node:

```text
Lora Training in Comfy (Advanced)
```

Important fields:

```text
ckpt_name: base checkpoint filename
data_path: parent folder containing 10_trigger_word
networkdimension: LoRA rank
networkalpha: LoRA alpha
trainingresolution: image resolution
batch_size: train batch size
max_train_epoches: epoch count
optimizerType: AdamW8bit / DAdaptation / Lion
output_name: LoRA filename without extension
output_dir: models/loras
```

For the included sample training dataset, `data_path` should be:

```text
user/ninebot_lora_training/datasets/offroad_vehicle_smoke_v001
```

The folder structure under it must be:

```text
10_ninebot_atv_style/
  0001.png
  0001.txt
```

## CUDA Smoke Test Settings

Use:

```text
optimizerType: AdamW8bit
networkdimension: 16
networkalpha: 8
trainingresolution: 512
batch_size: 1
max_train_epoches: 1
save_every_n_epochs: 1
output_name: ninebot_atv_style_smoke
```

Expected output:

```text
models/loras/ninebot_atv_style_smoke.safetensors
```

## Production Starting Settings

For 30-80 curated images:

```text
optimizerType: AdamW8bit
networkdimension: 32 or 64
networkalpha: 16 or 32
trainingresolution: 512 or 768
batch_size: 1-4
max_train_epoches: 5-10
```

Adjust by GPU VRAM and dataset quality.

## Caption Rules

Each image must have a same-name `.txt`.

Good caption:

```text
ninebot_atv_style, blue off-road vehicle, front three-quarter view, rugged tires, desert road, commercial vehicle photography
```

Do not put negative prompts in captions.

## Common Problems

### Workflow opens but nodes are red

The target ComfyUI is missing custom nodes. Copy the bundle `custom_nodes/` folders or install them via ComfyUI Manager.

### AdamW8bit fails

Check `bitsandbytes` and CUDA PyTorch. If needed, temporarily switch optimizer to `Lion` or `AdamW`.

### xformers fails

Install an `xformers` build that matches target PyTorch/CUDA, or switch the training node code to use `--sdpa`.

### No LoRA output

Check:

```text
output_dir
training logs
data_path
matching .png/.txt filenames
checkpoint path
```

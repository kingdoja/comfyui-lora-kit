# 任务 2：LoRA 生图

## 目标

实现一个面向业务使用的 LoRA 生图节点/面板，支持：

- LoRA 加载器。
- 上传参考素材。
- 生图模型选择。
- 图片尺寸选择。
- ControlNet 模型选择。
- 一键生成按钮。
- 提示词优化。

设计图中 `Contrnet` 应理解为 `ControlNet`。

## 节点建议

### Ninebot LoRA Generate

输入参数：

- `checkpoint`：基础生图模型。
- `lora`：LoRA 模型，可来自 `models/loras/` 或资产库模型分类。
- `lora_strength_model`、`lora_strength_clip`。
- `prompt`、`negative_prompt`。
- `prompt_mode`：Change、Make、Remove、Add、Imagine，对应截图里的快捷意图。
- `reference_image`：上传素材，可选。
- `width`、`height` 或 `size_preset`。
- `controlnet_type`：none、canny、depth、hed、mlsd、normal_map、openpose。
- `controlnet_model`：按类型过滤。
- `controlnet_strength`、`start_percent`、`end_percent`。
- `sampler`、`scheduler`、`steps`、`cfg`、`seed`、`batch_size`。

输出：

- `image`：生成图。
- `generation_meta`：实际提示词、模型、LoRA、ControlNet、seed、尺寸。

## ControlNet 使用方案

推荐把 ControlNet 拆成“预处理器 + 模型”两层：

- canny：边缘控制，适合保持产品轮廓。
- depth：深度结构，适合保持空间关系。
- hed：柔和边缘，适合线稿/轮廓。
- mlsd：直线结构，适合建筑、车身硬边和透视线。
- normal_map：法线，适合保持表面起伏。
- openpose：姿态，主要适合人物，不是车型主流程，但保留选项。

当前 `models/controlnet/` 为空，所以第一版必须有模型缺失提示：

- 没有对应模型时，ControlNet 下拉为空并显示安装/放置路径说明。
- 用户选择 `none` 时仍可执行纯 LoRA 生图。
- 预处理器缺失时提示需要安装 ControlNet Aux 类扩展。

## 提示词优化功能

提示词优化先做可控模板，不依赖外部大模型：

输入：

- 用户原始 prompt。
- 资产库标签。
- LoRA trigger word。
- prompt_mode。
- 产品/车型分类。

输出：

- 优化后的正向 prompt。
- 推荐负向 prompt。

规则示例：

```text
{trigger_word}, {subject}, {view}, {material}, {scene}, high detail, commercial product photography
```

快捷意图建议：

- `Change`：替换局部属性，例如背景、颜色、材质。
- `Make`：生成目标风格，例如棚拍、户外、海报。
- `Remove`：移除对象或背景元素。
- `Add`：增加配件、场景元素、文字占位。
- `Imagine`：开放式创意扩写。

后续可以接入 LLM 或已有 GPT Image 节点，但 MVP 不依赖它，避免把生图链路绑到外部 API。

## 文件结构建议

```text
custom_nodes/ninebot_lora_generation/
  __init__.py
  nodes.py
  server.py
  generation/
    model_registry.py
    prompt_optimizer.py
    controlnet_registry.py
    validators.py
  web/
    generation_panel.js
  README.md

workflows/ninebot_lora_generation/
  lora_txt2img_basic.json
  lora_img2img_controlnet.json
```

## 工作流基本结构

`lora_txt2img_basic.json`：

- `1. 模型加载`：Checkpoint Loader、LoRA Loader、CLIP Text Encode。
- `2. 提示词优化`：Ninebot Prompt Optimizer。
- `3. Latent 初始化`：Empty Latent Image。
- `4. 采样`：KSampler。
- `5. 解码与保存`：VAE Decode、Save Image。

`lora_img2img_controlnet.json`：

- `1. 素材上传与读取`
- `2. ControlNet 预处理`
- `3. 模型与 LoRA 加载`
- `4. ControlNet Apply`
- `5. 采样生成`
- `6. 结果保存与入库`

## 验收标准

- 可以列出 checkpoint、LoRA、ControlNet 模型。
- 可以上传或选择资产库图片作为参考图。
- 可以选择常用尺寸，例如 512x512、768x768、1024x1024、1024x1536、1536x1024。
- ControlNet 为空时可退化为普通 LoRA 生图。
- 生成结果保存到独立输出目录，并记录完整参数。
- 工作流里有清晰 Group 标注，业务同事能看懂每段作用。


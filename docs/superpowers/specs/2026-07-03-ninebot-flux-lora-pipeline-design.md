# NinebotFluxLoRATrainPipeline B 方案设计

## 目标

把现有两个工作流整合为一个可迁移的 ComfyUI 自定义节点：

- `01_打标工作流_车辆部件视觉理解版.json`：训练图片读取、Florence-2 视觉描述、WD14 辅助标签、车辆 Caption 精修、`.txt` sidecar 保存。
- `02_FLUX_LoRA训练_美化稳定版_RTX4080.json`：FLUX.1-dev 分体模型选择、caption 数据集配置、AdamW8bit 优化器、RTX4080 友好 LoRA 训练、保存与结束训练。

最终节点名：`NinebotFluxLoRATrainPipeline`

节点第一屏要严格贴近参考图 1 的风格：深色面板、分段标题、紧凑输入控件、底部执行按钮与输出端口。训练图片输入区要使用参考图 2 的多图上传样式：上传入口、缩略图网格、编号角标、继续添加图片、清除全部、输出图片数量。

## 推荐方案

采用 B 方案：创建真正的自定义节点包，而不是只生成一个合并后的 workflow JSON。

新包位置：

`custom_nodes/ninebot_flux_lora_pipeline/`

包内结构：

- `__init__.py`：导出节点映射与 `WEB_DIRECTORY`。
- `nodes.py`：注册 `NinebotFluxLoRATrainPipeline`，负责后端运行链路。
- `pipeline.py`：封装上传图片落盘、caption 生成、训练配置组装、训练执行。
- `web/ninebot_flux_lora_pipeline.js`：绘制图 1/图 2 风格的前端节点 UI。
- `tests/`：单元测试与轻量导入测试。
- `README.md`：迁移安装说明、依赖说明、模型文件要求。
- `requirements.txt`：只列本节点新增依赖；已有依赖通过 README 标明来自 Florence2、WD14、FluxTrainer。

## 节点输入

主输入按参考图 1 显示为两个区块。

### 数据集配置

- `训练图片 *`
  - 类型：前端多图上传控件，后端保存为数据集目录。
  - 行为：支持一次选择多张图片、继续添加、清除全部。
  - 显示：缩略图网格、右下角编号、底部输出图片数量。
  - 上传目标：`user/ninebot_flux_lora_training/datasets/pipeline_uploads/<run_id>/style/`

- `触发词`
  - 类型：文本。
  - 默认值：`ninebot_motorcycle_style`
  - 用途：Caption 精修与 FluxTrainer `class_tokens` 共用。

- `试运行`
  - 类型：布尔开关。
  - 默认值：`true`
  - `true`：只生成 caption 预览与 `.txt`，不启动训练。
  - `false`：生成 caption 后继续执行 LoRA 训练。

### 训练配置

- `输出 LoRA 名称`
  - 类型：文本。
  - 默认值：`ninebot_motorcycle_flux_v003`
  - UI 要求：输入框右侧增加一个下载小图标按钮。
  - 下载按钮行为：
    - 训练完成前置灰或禁用。
    - 训练完成后，点击下载最终 `.safetensors` LoRA 文件。
    - 如果文件不存在，节点状态显示明确错误：`LoRA 文件不存在，请先完成训练或检查输出路径`。
    - 下载图标建议使用 lucide 风格的 `Download` 图标；如果当前 ComfyUI 前端无法直接引用 lucide，则使用同等线性下载图标，保持尺寸与图 1 右侧类型标签一致。

- `LoRA Rank`
  - 类型：整数。
  - 默认值：`8`
  - 同步映射到 FluxTrainer 的 `network_dim` 与 `network_alpha`。

- `最大训练步数`
  - 类型：整数。
  - 默认值：`600`
  - 映射到 FluxTrainer 的 `max_train_steps`。

- `学习率`
  - 类型：浮点。
  - 默认值：`0.0001`
  - 映射到 FluxTrainer 的 `learning_rate`。

## 隐藏默认配置

为保持节点简洁，以下配置先作为后端默认值或高级隐藏字段：

- `transformer`: `flux1-dev.safetensors`
- `vae`: `ae.safetensors`
- `clip_l`: `clip_l.safetensors`
- `t5`: `t5xxl_fp16.safetensors`
- `dataset width/height`: `1024 x 1024`
- `batch_size`: `1`
- `caption_extension`: `.txt`
- `optimizer`: `adamw8bit`
- `lr_scheduler`: `constant`
- `cache_latents`: `memory`
- `cache_text_encoder_outputs`: `memory`
- `blocks_to_swap`: `16`
- `weighting_scheme`: `none`
- `timestep_sampling`: `flux_shift`
- `discrete_flow_shift`: `3.1582`
- `fp8_base`: `true`
- `gradient_dtype`: `bf16`
- `save_dtype`: `bf16`
- `attention_mode`: `sdpa`
- `gradient_checkpointing`: `enabled`
- `copy_to_comfy_lora_folder`: `true`

这些默认值来自现有 `02_FLUX_LoRA训练_美化稳定版_RTX4080.json`，目的是优先保证 RTX4080 本机可运行。

## 后端数据流

1. 前端上传图片，后端保存到本次运行的数据集目录。
2. 后端收集图片路径并生成 ComfyUI `IMAGE` batch。
3. 运行 Florence-2 视觉描述。
4. 运行 WD14 辅助标签；如果目标 ComfyUI 未安装 WD14，降级为仅使用 Florence-2。
5. 运行车辆 Caption 精修。
6. 写入同名 `.txt` sidecar 文件，并写入 `_ninebot_pipeline_manifest.json`。
7. 如果 `试运行=true`，返回 caption 预览、数据集目录、空训练结果。
8. 如果 `试运行=false`，按 FluxTrainer 参数组装数据集与优化器配置。
9. 执行 `InitFluxLoRATraining -> FluxTrainLoop -> FluxTrainSave -> FluxTrainEnd`。
10. 返回最终 `lora_name`、`lora_path`、`captions`。

## 节点输出

- `lora_name`
  - 类型：`STRING`
  - 训练完成后返回最终 LoRA 名称。

- `lora_path`
  - 类型：`STRING`
  - 训练完成后返回最终 `.safetensors` 路径。

- `captions`
  - 类型：`STRING`
  - 列表输出，供检查或连接其他节点。

前端下载按钮使用 `lora_path` 对应文件。若 LoRA 同时复制到 `models/loras/flux_trainer/`，下载按钮优先使用最终训练输出路径；若该路径失效，再尝试复制后的 LoRA 路径。

## UI 设计要求

整体视觉：

- 节点标题：`NinebotFluxLoRATrainPipeline`
- 副标题：`自动打标 + Caption 精化 + FLUX LoRA 训练一体化`
- 顶部左侧显示绿色工具/魔棒类图标。
- 颜色分区：
  - 数据集配置：玫红色强调。
  - 训练配置：橙色强调。
  - 输出端口：文本输出用粉色，caption 输出用蓝色。
- 控件高度、间距、边框、背景要贴近图 1。
- 训练图片区域采用图 2 的卡片式上传体验，但作为图 1 中 `训练图片 *` 字段的前置控件。

下载按钮：

- 位置：`输出 LoRA 名称` 输入框右侧。
- 图标：下载箭头入托盘的小图标。
- 状态：
  - 未训练：灰色禁用。
  - 训练完成：高亮可点。
  - 文件丢失：点击后显示状态错误，不吞掉异常。
- 交互：点击后通过自定义后端下载路由或 ComfyUI 静态下载能力触发浏览器下载。

## 迁移要求

打包到另一套 ComfyUI 时，至少复制：

- `custom_nodes/ninebot_flux_lora_pipeline/`
- `custom_nodes/ninebot_flux_lora_caption/`，除非本节点把必要 caption 逻辑内联。
- `custom_nodes/ComfyUI-FluxTrainer/`
- `custom_nodes/ComfyUI-Florence2/`
- `custom_nodes/ComfyUI-WD14-Tagger/`，可选但推荐。

目标 ComfyUI 还需要具备以下模型文件：

- `models/unet/flux1-dev.safetensors`
- `models/vae/ae.safetensors`
- `models/clip/clip_l.safetensors`
- `models/clip/t5xxl_fp16.safetensors`

首次运行 Florence-2 可能需要下载 Hugging Face 模型。README 必须写清楚离线迁移时如何预先复制模型缓存。

## 错误处理

- 未上传图片：阻止执行并提示 `请先上传训练图片`。
- 触发词为空：阻止执行并提示 `触发词不能为空`。
- 缺少 FluxTrainer：阻止训练并提示安装 `ComfyUI-FluxTrainer`。
- 缺少 Florence2：阻止自动打标并提示安装 `ComfyUI-Florence2`；不自动训练空 caption 数据集。
- 缺少 WD14：继续运行，仅跳过 WD14 辅助标签，并在 manifest 记录 `wd14_available=false`。
- 模型文件缺失：在训练前报出缺失的模型类型与文件名。
- LoRA 下载文件缺失：下载按钮显示状态错误，后端返回 404。
- 磁盘空间不足：沿用 FluxTrainer 检查，并把错误透出到节点 UI。

## 测试计划

使用 portable Python：

`C:/Users/ninebot/ComfyUI_windows_portable/python_embeded/python.exe`

测试覆盖：

- 导入节点包不会报错。
- `INPUT_TYPES` 暴露主输入与隐藏默认值。
- 上传图片列表会生成稳定的数据集目录与 manifest。
- `试运行=true` 时生成 `.txt` 与 manifest，不调用 FluxTrainer 训练。
- 缺少 WD14 时仍可生成 Florence-2 caption。
- 缺少 Florence2 时不会进入训练。
- 训练参数正确映射到 FluxTrainer：rank、alpha、steps、learning_rate、fp8、bf16、cache。
- 训练完成后返回 `lora_path`，下载路由能读取文件。
- 下载路由对不存在文件返回明确错误。

已有基线：

- `custom_nodes/ninebot_flux_lora_caption/tests` 当前 15 个测试通过。

## 实施顺序

1. 写测试：节点导入、参数映射、dry-run、下载路由。
2. 创建 `ninebot_flux_lora_pipeline` 包骨架。
3. 实现后端 pipeline，不先做复杂 UI。
4. 接入前端上传控件与图 1 风格绘制。
5. 接入输出 LoRA 名称右侧下载按钮。
6. 用 dry-run 小样本验证 caption 写入。
7. 用极小训练步数验证 FluxTrainer 链路能跑通。
8. 整理 README 与迁移清单。

## 不做的范围

- 不重写 FluxTrainer 训练核心。
- 不把 Florence-2、WD14、FluxTrainer 的第三方依赖复制进本节点包。
- 不覆盖现有两个 workflow JSON。
- 不默认覆盖已有同名 `.txt` caption，除非后续明确增加覆盖开关。

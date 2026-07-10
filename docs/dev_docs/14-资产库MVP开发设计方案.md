# 资产库 MVP 开发设计方案

## 目标

本方案设计一个可在 ComfyUI 内直接使用的 Ninebot 资产库。第一版不是独立 CMS，也不是只展示缩略图的文件浏览器，而是服务于 ComfyUI 工作流的本地资产基础设施。

MVP 需要覆盖：

- 图片素材库：上传、分类、打标、caption、缩略图、搜索筛选。
- 模型资产索引：checkpoint、LoRA、ControlNet 扫描、标注、筛选、填入节点。
- 工作流模板库：导入、收藏、发布状态、打开 workflow JSON。
- 参数预设：保存和应用参考图权重、模型权重、重绘幅度等参数组合。
- 生成结果回收入库：保存结果图、prompt、seed、模型、输入资产和 workflow 溯源。

明确暂不做：

- 多用户权限和审批。
- 云同步。
- 在线素材市场。
- 大批量资产后台治理。
- 任意路径文件管理器。

## 设计依据

现有需求资料包含两类信息：

1. 资产库随时调用：左侧面板、图片打标、筛选显示、持续更新、素材拖入图片节点。
2. 工作流库：我的全部、我的收藏、已发布工作流、方案发散、方案推敲、评审工作流、标准模板发布和采用。

因此第一版设计不应只做图 3 的图片面板，而应做统一的资产入口：

```text
Ninebot 资产库 MVP
= 图片素材库
+ 模型资产索引
+ 工作流模板库
+ 参数预设
+ 生成结果回收入库
```

## 总体架构

采用方案 C：Ninebot 独立资产库 + ComfyUI 能力桥接。

代码放在独立扩展目录：

```text
custom_nodes/ninebot_asset_library/
  __init__.py
  nodes.py
  server.py
  asset_library/
  web/
  docs/
```

运行数据放在配置指定资产根目录，默认：

```text
user/ninebot_asset_library/
```

后续部署到固态硬盘时，只需要修改配置：

```text
D:\NinebotAssetLibrary
```

分层如下：

```text
ComfyUI 前端
  -> Ninebot 左侧资产库面板
  -> 点选/拖拽/打开工作流/应用预设

Ninebot HTTP API
  -> /ninebot/assets/*
  -> 上传、查询、编辑、扫描、入库、预设、工作流

Ninebot 服务层
  -> 配置、路径保护、索引、缩略图、搜索、模型扫描、工作流导入

Ninebot 节点层
  -> Asset Selector
  -> Model Asset Selector
  -> Workflow Template Loader
  -> Asset Register
  -> Generated Result Register

ComfyUI 桥接
  -> 图片填入节点
  -> 模型名填入加载节点
  -> workflow JSON 打开
  -> output 结果复制回资产库
```

## 前端信息架构

左侧面板名称：

```text
Ninebot 资产库
```

主 Tab：

```text
图片
模型
工作流
预设
```

顶部快捷筛选：

```text
我的全部
我的收藏
已发布
```

### 图片 Tab

用于管理和调用参考图、设计图、构图图、颜色质感图、logo、生成结果。

核心能力：

- 上传图片。
- 扫描指定资产根目录。
- 搜索、分类、角色、标签、评分筛选。
- 点选图片写入 `Ninebot Asset Selector`。
- 拖拽图片到 Ninebot 节点或图片输入节点。
- 入库最近输出。

图片角色：

```text
reference_design          设计图输入
composition_reference     构图输入
color_texture_reference   颜色质感输入
logo_reference            标准 logo 输入
style_reference           风格参考
controlnet_input          ControlNet 输入
training_image            训练素材
generated_result          生成结果
```

### 模型 Tab

用于 checkpoint、LoRA、ControlNet 的索引和调用。

第一版不移动模型文件，只扫描和登记：

```text
models/checkpoints
models/loras
models/controlnet
```

模型卡片显示：

- 模型名。
- 模型类型。
- 底模。
- 触发词。
- 推荐权重。
- 预览图。
- 收藏状态。

### 工作流 Tab

工作流分类：

```text
方案发散工作流
方案推敲工作流
评审工作流
```

第一版模板示例：

```text
一键风格发散
一键生成前后45度方案
标准视角三视图
场景图
```

工作流模板能力：

- 导入当前 workflow。
- 导入 workflow JSON 文件。
- 收藏。
- 本地发布/取消发布。
- 打开 workflow。
- 记录 required inputs。
- 绑定默认参数预设。

### 预设 Tab

用于保存参数组合。

参数包括：

```text
reference_image_weight
reference_model_weight
denoise
lora_strength
controlnet_strength
seed_mode
steps
guidance/cfg
width
height
```

第一版支持：

- 保存当前参数为预设。
- 编辑预设。
- 收藏预设。
- 应用预设到当前工作流。

## 后端 API

统一前缀：

```text
/ninebot/assets/*
```

API 分组：

```text
配置
GET    /ninebot/assets/config
POST   /ninebot/assets/config/reload

通用资产
GET    /ninebot/assets
GET    /ninebot/assets/{asset_id}
PUT    /ninebot/assets/{asset_id}
DELETE /ninebot/assets/{asset_id}
POST   /ninebot/assets/{asset_id}/favorite
POST   /ninebot/assets/{asset_id}/publish

图片资产
POST   /ninebot/assets/images/upload
GET    /ninebot/assets/images/{asset_id}/file
GET    /ninebot/assets/images/{asset_id}/thumb
POST   /ninebot/assets/images/import-output

模型资产
POST   /ninebot/assets/models/scan
GET    /ninebot/assets/models
PUT    /ninebot/assets/models/{asset_id}

工作流资产
POST   /ninebot/assets/workflows/import-current
POST   /ninebot/assets/workflows/import-file
GET    /ninebot/assets/workflows
GET    /ninebot/assets/workflows/{asset_id}/file
POST   /ninebot/assets/workflows/{asset_id}/open

参数预设
GET    /ninebot/assets/presets
POST   /ninebot/assets/presets
PUT    /ninebot/assets/presets/{preset_id}
POST   /ninebot/assets/presets/{preset_id}/apply

维护
POST   /ninebot/assets/scan
POST   /ninebot/assets/reindex
POST   /ninebot/assets/thumbs/rebuild
GET    /ninebot/assets/taxonomy
```

## 服务模块

```text
asset_library/
  config.py          # 配置、资产根目录、模型目录
  path_guard.py      # 防止任意路径访问
  schema.py          # schema
  store.py           # SQLite + JSONL manifest
  taxonomy.py        # 分类、角色、标签体系
  images.py          # 上传、复制、缩略图、caption
  models.py          # checkpoint / LoRA / ControlNet 扫描
  workflows.py       # workflow 导入、发布、预览
  presets.py         # 参数预设保存和应用
  generated.py       # 生成结果回收入库
  search.py          # 统一筛选、排序、分页
```

## 数据目录

```text
user/ninebot_asset_library/
  config/
    library.config.json
    taxonomy.json

  db/
    ninebot_assets.sqlite

  images/
    originals/
    generated/
    references/
    logos/

  thumbs/
    images/
    models/
    workflows/

  captions/
    image/
    generated/

  models/
    index_only/
      checkpoints.jsonl
      loras.jsonl
      controlnet.jsonl

  workflows/
    imported/
    published/
    previews/

  presets/
    workflow_presets.jsonl

  manifests/
    assets.jsonl
    scan_history.jsonl
    ingest_history.jsonl

  trash/
```

## 统一资产类型

```text
image             图片素材
model             checkpoint / LoRA / ControlNet
workflow          工作流模板
preset            参数预设
generated_result 生成结果
```

所有资产都支持：

- 收藏。
- 发布状态。
- 分类。
- 标签。
- 来源。
- 创建/更新时间。
- 使用次数。
- 软删除。

不同资产类型再追加自己的扩展字段。

## 节点设计

节点分类：

```text
Ninebot/Asset Library
```

第一版节点：

```text
Ninebot Asset Selector
Ninebot Model Asset Selector
Ninebot Workflow Template Loader
Ninebot Asset Register
Ninebot Generated Result Register
```

### Ninebot Asset Selector

输入：

```text
asset_id
category
subtype
roles
tags
quality_min
limit
selection_mode
```

输出：

```text
image
image_path
caption
asset_meta
asset_ids
```

### Ninebot Model Asset Selector

输入：

```text
model_type
asset_id
base_model
tags
task
```

输出：

```text
model_name
model_path
trigger_words
recommended_strength
model_meta
```

### Ninebot Workflow Template Loader

输入：

```text
workflow_id
template_key
preset_id
```

输出：

```text
workflow_path
workflow_json
required_inputs
preset_params
workflow_meta
```

### Ninebot Asset Register

输入：

```text
image
file_path
asset_type
category
subtype
roles
tags
caption
quality_score
source
```

输出：

```text
asset_id
asset_meta
```

### Ninebot Generated Result Register

输入：

```text
image
source_output_path
workflow_id
preset_id
prompt
seed
model_asset_ids
input_asset_ids
category
tags
```

输出：

```text
result_asset_id
asset_meta
```

## 工作流模板约定

为了和截图中的“设计图输入 / 构图输入 / 颜色质感输入 / 标准 logo 输入”对应，模板中建议放置命名清楚的资产选择节点：

```text
Ninebot Asset Selector - 设计图输入
roles = reference_design

Ninebot Asset Selector - 构图输入
roles = composition_reference

Ninebot Asset Selector - 颜色质感输入
roles = color_texture_reference

Ninebot Asset Selector - 标准logo输入
roles = logo_reference
```

前端面板可以根据节点标题或 roles 推荐对应素材。

## 安全边界

- 资产根目录由配置指定，不从前端随意输入。
- 前端不能直接请求任意绝对路径。
- 所有读取、复制、删除都通过 `path_guard.py` 校验。
- 生成结果入库只允许从 ComfyUI `output/` 或已配置允许目录复制。
- 模型扫描只读，不移动、不删除模型文件。
- 删除第一版采用软删除，移动到 `trash/` 或仅标记 `deleted_at`。

## 验收标准

MVP 验收需要满足：

- 可以上传图片并生成缩略图。
- 可以编辑分类、roles、tags、caption、评分。
- 可以筛选图片、模型、工作流、预设。
- 可以点选图片写入 `Ninebot Asset Selector`。
- 可以拖拽图片到 Ninebot 资产节点。
- 可以扫描 checkpoint、LoRA、ControlNet。
- 可以导入 workflow JSON 并在工作流 Tab 显示。
- 可以收藏和本地发布工作流。
- 可以保存参数预设并应用。
- 可以把生成结果回收入库并保留 prompt/seed/model/workflow 溯源。
- 所有运行数据保存在配置资产根目录，不污染 ComfyUI 核心文件。


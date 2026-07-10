# 资产库 MVP 实施计划

## 实施原则

- 不修改 ComfyUI 核心代码。
- 所有新增代码放入 `custom_nodes/ninebot_asset_library/`。
- 所有运行数据放入配置指定资产根目录，默认 `user/ninebot_asset_library/`。
- 第一版先完成可演示闭环，再扩展复杂后台能力。
- 模型资产第一版只扫描和索引，不移动模型文件。
- 工作流发布第一版是本地状态，不做多人权限。

## Phase 0：插件骨架与配置

目标：

- ComfyUI 能加载 `ninebot_asset_library` 扩展。
- 能读取配置文件。
- 能创建资产根目录。
- 能初始化 SQLite。

交付：

```text
custom_nodes/ninebot_asset_library/
  __init__.py
  nodes.py
  server.py
  asset_library/
    config.py
    path_guard.py
    store.py
    schema.py
```

配置文件：

```text
custom_nodes/ninebot_asset_library/config.json
```

默认内容：

```json
{
  "asset_root": "user/ninebot_asset_library",
  "image_extensions": [".png", ".jpg", ".jpeg", ".webp"],
  "model_roots": {
    "checkpoint": "models/checkpoints",
    "lora": "models/loras",
    "controlnet": "models/controlnet"
  },
  "thumbnail": {
    "size": 320,
    "format": "webp"
  }
}
```

验收：

- 启动 ComfyUI 不报错。
- 可以访问 `GET /ninebot/assets/config`。
- 首次启动自动创建资产根目录和 SQLite。

## Phase 1：图片上传、缩略图、索引

目标：

- 上传图片。
- 保存原图副本。
- 生成缩略图。
- 写入资产索引。
- 支持基础查询。

交付模块：

```text
asset_library/images.py
asset_library/search.py
asset_library/taxonomy.py
```

接口：

```text
POST /ninebot/assets/images/upload
GET  /ninebot/assets
GET  /ninebot/assets/images/{asset_id}/thumb
GET  /ninebot/assets/images/{asset_id}/file
PUT  /ninebot/assets/{asset_id}
```

验收：

- 上传 10 到 30 张图后可看到资产记录。
- 缩略图能正常加载。
- 可按 category、roles、tags、favorite 查询。
- 编辑 metadata 后重启仍保留。

## Phase 2：左侧图片面板与 Asset Selector

目标：

- ComfyUI 左侧出现 Ninebot 资产库面板。
- 图片 Tab 可搜索和筛选。
- 点击图片能写入选中的 `Ninebot Asset Selector` 节点。

交付：

```text
web/asset_panel.js
web/asset_panel.css
nodes.py
```

节点：

```text
Ninebot Asset Selector
```

验收：

- 面板显示图片网格。
- 选中画布上的 `Ninebot Asset Selector` 后，点击图片能写入 `asset_id`。
- 节点运行后输出 image、image_path、caption、asset_meta。
- 拖拽到 Ninebot 节点可写入 `asset_id`。

## Phase 3：模型扫描和模型资产卡片

目标：

- 扫描 checkpoint、LoRA、ControlNet。
- 在模型 Tab 显示模型资产。
- 可编辑底模、触发词、推荐权重、标签和预览图。

交付：

```text
asset_library/models.py
```

接口：

```text
POST /ninebot/assets/models/scan
GET  /ninebot/assets/models
PUT  /ninebot/assets/models/{asset_id}
```

节点：

```text
Ninebot Model Asset Selector
```

验收：

- 能扫描 `models/checkpoints`、`models/loras`、`models/controlnet`。
- 不移动模型文件。
- 模型资产重启后仍存在。
- 节点可输出 model_name、model_path、trigger_words、recommended_strength。

## Phase 4：工作流模板库

目标：

- 导入 workflow JSON。
- 在工作流 Tab 显示模板。
- 支持收藏和本地发布。
- 支持打开 workflow。

交付：

```text
asset_library/workflows.py
```

接口：

```text
POST /ninebot/assets/workflows/import-current
POST /ninebot/assets/workflows/import-file
GET  /ninebot/assets/workflows
GET  /ninebot/assets/workflows/{asset_id}/file
POST /ninebot/assets/workflows/{asset_id}/open
```

节点：

```text
Ninebot Workflow Template Loader
```

验收：

- 可导入一个 workflow JSON。
- 可设置分类：方案发散、方案推敲、评审。
- 可收藏。
- 可设置 publish_status。
- 可从面板打开 workflow。

## Phase 5：参数预设

目标：

- 保存参数组合。
- 关联 workflow。
- 应用到当前 workflow。

交付：

```text
asset_library/presets.py
```

接口：

```text
GET  /ninebot/assets/presets
POST /ninebot/assets/presets
PUT  /ninebot/assets/presets/{preset_id}
POST /ninebot/assets/presets/{preset_id}/apply
```

验收：

- 可保存参考图权重、模型权重、denoise、LoRA strength、ControlNet strength。
- 可按 workflow 筛选预设。
- 可收藏预设。
- 可应用预设到对应节点 widget。

## Phase 6：生成结果回收入库

目标：

- 从 ComfyUI output 或节点 image 输入把结果保存回资产库。
- 记录 prompt、seed、模型、输入资产、workflow、preset。

交付：

```text
asset_library/generated.py
```

接口：

```text
POST /ninebot/assets/images/import-output
```

节点：

```text
Ninebot Generated Result Register
```

验收：

- 生成结果保存到 `images/generated/`。
- 缩略图生成。
- 面板中出现在图片 Tab 的生成结果筛选下。
- 详情里可看到 prompt、seed、模型、输入资产、workflow。

## Phase 7：维护能力与文档验收

目标：

- 扫描新增文件。
- 重建索引。
- 修复缩略图。
- 检查丢失文件。
- 完成用户文档。

接口：

```text
POST /ninebot/assets/scan
POST /ninebot/assets/reindex
POST /ninebot/assets/thumbs/rebuild
GET  /ninebot/assets/taxonomy
```

验收：

- 删除或移动底层文件后，资产状态能标记为 missing。
- 重建缩略图后缺失 thumb 恢复。
- 文档包含安装、配置、使用、迁移、测试计划。

## 风险与处理

### ComfyUI 前端 API 变化

处理：

- 前端交互优先写入 Ninebot 自己节点。
- 对通用图片节点和模型加载节点的自动填入作为增强能力。
- 失败时降级为复制路径或提示用户选择 Ninebot 节点。

### 模型路径不稳定

处理：

- 模型资产保存相对 ComfyUI 根目录的路径。
- 扫描时重新校验存在性。
- 不移动模型文件。

### 大量图片导致面板变慢

处理：

- API 分页。
- 缩略图懒加载。
- 搜索和筛选走 SQLite。
- 首屏限制数量。

### SSD 迁移后路径变化

处理：

- 资产内部保存相对资产根目录路径。
- 配置只存一个 `asset_root`。
- 模型保存相对 ComfyUI 根目录或明确的 model root。

### 误删资产

处理：

- 第一版删除采用软删除。
- 文件进入 `trash/` 或只标记 `deleted_at`。
- 后续再做清理工具。

## 第一轮推荐交付

最小可演示闭环：

1. 启动 ComfyUI 能加载 Ninebot 资产库面板。
2. 上传图片并打标。
3. 在左侧筛选图片。
4. 点选图片写入 `Ninebot Asset Selector`。
5. 扫描 LoRA/checkpoint/ControlNet。
6. 导入一个 workflow 模板并收藏。
7. 保存一个参数预设。
8. 生成结果回收入库。


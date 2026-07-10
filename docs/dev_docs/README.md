# Ninebot ComfyUI 开发规划文档

本目录只放本次需求的分析、开发方案和验收文档，不修改 ComfyUI 现有代码。

## 需求来源

- `需求设计文件夹/comfyui需求截图.docx`
- `需求设计文件夹/需求设计图/设计节点（lora训练+lora生图）.jpg`
- `需求设计文件夹/需求设计图/设计资产库.jpg`
- `需求设计文件夹/需求设计图/图像修改节点.jpg`
- `需求设计文件夹/需求设计图/重绘功能.jpg`

## 文档列表

1. `01-总体架构与开发边界.md`
2. `02-任务1-LoRA训练.md`
3. `03-任务2-LoRA生图.md`
4. `04-任务3-资产库.md`
5. `05-文档规范与实施计划.md`
6. `06-LoRA训练MVP搭建执行计划.md`
7. `07-LoRA训练前端搭建全流程.md`
8. `08-LoRA训练依赖隔离安装.md`
9. `09-LoRA训练迁移CUDA与打包说明.md`
10. `10-LoRA训练ComfyUI工作流交付方案.md`
11. `11-LoRA训练落地Bundle实施计划.md`

## 结论摘要

这 3 个任务建议按独立扩展开发，避免污染现有 ComfyUI 和已有 `custom_nodes/comfyui-gpt-image`：

- `custom_nodes/ninebot_lora_training/`：LoRA 训练器、数据集打标、训练任务状态。
- `custom_nodes/ninebot_lora_generation/`：LoRA 生图加载器、ControlNet 组合、尺寸/模型选择、生成入口。
- `custom_nodes/ninebot_asset_library/`：资产库上传、分类、标签/提示词、模型资产索引。

对应工作流也放在独立目录：

- `workflows/ninebot_lora_training/`
- `workflows/ninebot_lora_generation/`
- `workflows/ninebot_asset_library/`

资产和运行时数据建议放在独立数据目录：

- `user/ninebot_asset_library/`
- `user/ninebot_lora_training/`
- `output/ninebot_lora_generation/`

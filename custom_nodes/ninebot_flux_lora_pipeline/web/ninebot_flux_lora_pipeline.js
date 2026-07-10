import { app } from "../../scripts/app.js";

const NODE_NAME = "NinebotFluxLoRATrainPipeline";
const COLORS = {
  panel: "#1b1f2c",
  header: "#222738",
  band: "#10131c",
  input: "#10131c",
  border: "#34394b",
  text: "#dce2f2",
  muted: "#68718b",
  faint: "#505972",
  pink: "#cf5b98",
  orange: "#d49532",
  blue: "#4ca7e8",
  green: "#39d37c",
  danger: "#e4636b",
};
const TITLE_MODE_NO_TITLE = 1;
const NODE_SIZE = [720, 1288];
const ADVANCED_NODE_NAME = "NinebotFluxLoRAAdvancedSettings";
const ADVANCED_NODE_SIZE = [560, 1240];
const ADVANCED_WIDGETS = [
  "training_resolution",
  "batch_size",
  "num_repeats",
  "blocks_to_swap",
  "fp8_base",
  "gradient_dtype",
  "attention_mode",
  "sample_prompts",
];
const ADVANCED_DEFAULTS = {
  training_resolution: 1024,
  batch_size: 1,
  num_repeats: 1,
  blocks_to_swap: 8,
  fp8_base: true,
  gradient_dtype: "bf16",
  attention_mode: "sdpa",
  sample_prompts: "",
};
const ADVANCED_GRADIENT_DTYPES = ["bf16", "fp16", "fp32"];
const ADVANCED_ATTENTION_MODES = ["sdpa", "xformers", "disabled"];

function widget(node, name) {
  return node.widgets?.find((item) => item.name === name);
}

function getWidget(node, name, fallback = "") {
  const item = widget(node, name);
  return item ? item.value : fallback;
}

function setWidget(node, name, value) {
  const item = widget(node, name);
  if (item) {
    item.value = value;
  }
}

function sanitizeAdvancedWidgets(node) {
  for (const [name, value] of Object.entries(ADVANCED_DEFAULTS)) {
    if (widget(node, name) && (getWidget(node, name) === undefined || getWidget(node, name) === null)) {
      setWidget(node, name, value);
    }
  }
  if (!ADVANCED_GRADIENT_DTYPES.includes(getWidget(node, "gradient_dtype", ADVANCED_DEFAULTS.gradient_dtype))) {
    setWidget(node, "gradient_dtype", ADVANCED_DEFAULTS.gradient_dtype);
  }
  if (!ADVANCED_ATTENTION_MODES.includes(getWidget(node, "attention_mode", ADVANCED_DEFAULTS.attention_mode))) {
    setWidget(node, "attention_mode", ADVANCED_DEFAULTS.attention_mode);
  }
  if (["enabled", "disabled", "memory", "disk", "bf16", "fp16", "fp32", "sdpa", "xformers"].includes(getWidget(node, "sample_prompts", ""))) {
    setWidget(node, "sample_prompts", ADVANCED_DEFAULTS.sample_prompts);
  }
}

function hideWidget(item, options = {}) {
  item.hidden = true;
  item.computeSize = () => [0, 0];
  item.serializeValue = item.serializeValue || (() => item.value);
  if (options.submit === false) {
    item.options = item.options || {};
    item.options.serialize = false;
  }
  if (options.persist === false) {
    item.serialize = false;
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawText(ctx, text, x, y, options = {}) {
  ctx.save();
  ctx.fillStyle = options.color || COLORS.text;
  ctx.font = options.font || "16px sans-serif";
  ctx.textBaseline = options.baseline || "alphabetic";
  ctx.textAlign = options.align || "left";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDownloadIcon(ctx, x, y, active) {
  ctx.save();
  ctx.strokeStyle = active ? COLORS.pink : COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 6);
  ctx.lineTo(x + 14, y + 20);
  ctx.moveTo(x + 8, y + 14);
  ctx.lineTo(x + 14, y + 20);
  ctx.lineTo(x + 20, y + 14);
  ctx.moveTo(x + 7, y + 24);
  ctx.lineTo(x + 21, y + 24);
  ctx.stroke();
  ctx.restore();
}

function pointIn(rect, pos) {
  if (!rect) {
    return false;
  }
  return pos[0] >= rect.x && pos[0] <= rect.x + rect.w && pos[1] >= rect.y && pos[1] <= rect.y + rect.h;
}

function ensureState(node) {
  if (!node.ninebotPipeline) {
    node.ninebotPipeline = {
      images: [],
      progress: 0,
      status: "",
      rects: {},
    };
  }
  return node.ninebotPipeline;
}

function ensureAdvancedState(node) {
  if (!node.ninebotAdvanced) {
    node.ninebotAdvanced = {
      rects: {},
    };
  }
  return node.ninebotAdvanced;
}

function findSlot(items, name) {
  return items?.findIndex((item) => item.name === name) ?? -1;
}

function findInputSlot(node, name) {
  if (typeof node.findInputSlot === "function") {
    return node.findInputSlot(name);
  }
  return findSlot(node.inputs, name);
}

function findOutputSlot(node, name) {
  if (typeof node.findOutputSlot === "function") {
    return node.findOutputSlot(name);
  }
  return findSlot(node.outputs, name);
}

function focusGraphNode(node) {
  app.canvas?.selectNode?.(node, false);
  app.canvas?.centerOnNode?.(node);
  app.graph?.setDirtyCanvas?.(true, true);
}

function linkedInputNode(node, inputSlot) {
  const graph = node.graph || app.graph;
  const linkId = node.inputs?.[inputSlot]?.link;
  if (!graph || linkId == null) {
    return null;
  }
  const link = graph.links?.[linkId];
  if (!link) {
    return null;
  }
  if (typeof graph.getNodeById === "function") {
    return graph.getNodeById(link.origin_id);
  }
  return graph._nodes?.find((item) => item.id === link.origin_id) || null;
}

function pointNearInput(node, inputName, pos, radius = 28) {
  const input = node.inputs?.find((item) => item.name === inputName);
  if (!input?.pos) {
    return false;
  }
  return pos[0] >= input.pos[0] - radius
    && pos[0] <= input.pos[0] + radius
    && pos[1] >= input.pos[1] - radius
    && pos[1] <= input.pos[1] + radius;
}

function createOrFocusAdvancedSettings(node) {
  const state = ensureState(node);
  const graph = node.graph || app.graph;
  const inputSlot = findInputSlot(node, "advanced_settings");
  if (!graph || inputSlot < 0) {
    state.status = "未找到高级参数接口";
    app.graph.setDirtyCanvas(true, true);
    return true;
  }

  const existingNode = linkedInputNode(node, inputSlot);
  if (existingNode) {
    state.status = "已选中高级参数节点";
    focusGraphNode(existingNode);
    return true;
  }

  try {
    if (typeof LiteGraph === "undefined" || typeof LiteGraph.createNode !== "function") {
      throw new Error("当前前端未暴露 LiteGraph.createNode");
    }
    const advancedNode = LiteGraph.createNode(ADVANCED_NODE_NAME);
    if (!advancedNode) {
      throw new Error("高级参数节点未注册，请重启 ComfyUI 并强刷页面");
    }
    const outputSlot = findOutputSlot(advancedNode, "advanced_settings");
    if (outputSlot < 0 || typeof advancedNode.connect !== "function") {
      throw new Error("高级参数节点缺少 advanced_settings 输出");
    }

    const nodePos = node.pos || [420, 160];
    advancedNode.pos = [Math.max(40, nodePos[0] - 380), nodePos[1]];
    graph.add(advancedNode);
    advancedNode.connect(outputSlot, node, inputSlot);
    state.status = "已添加并连接高级参数节点";
    focusGraphNode(advancedNode);
  } catch (error) {
    state.status = `高级节点添加失败: ${error.message}`;
    console.error(error);
    app.graph.setDirtyCanvas(true, true);
  }
  return true;
}

async function uploadFiles(node, files) {
  const state = ensureState(node);
  const images = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
  if (!images.length) {
    state.status = "请选择图片文件";
    state.progress = 0;
    app.graph.setDirtyCanvas(true, true);
    return;
  }

  const form = new FormData();
  for (const image of images) {
    form.append("images", image, image.name);
  }

  state.status = "上传图片中...";
  state.progress = 0.08;
  app.graph.setDirtyCanvas(true, true);
  try {
    const response = await fetch("/ninebot_flux_lora_pipeline/upload", {
      method: "POST",
      body: form,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const previews = images.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    for (const image of state.images) {
      if (image.url) {
        URL.revokeObjectURL(image.url);
      }
    }
    state.images = previews.map((preview, index) => ({
      ...preview,
      path: data.image_paths[index],
    }));
    setWidget(node, "uploaded_images", state.images.map((image) => image.path).join("\n"));
    state.status = `已替换为 ${state.images.length} 张训练图片`;
    state.progress = 0.16;
  } catch (error) {
    state.status = `上传失败: ${error.message}`;
    state.progress = 0;
    console.error(error);
  }
  app.graph.setDirtyCanvas(true, true);
}

function openFilePicker(node) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.multiple = true;
  input.onchange = () => uploadFiles(node, input.files);
  input.click();
}

function clearImages(node) {
  const state = ensureState(node);
  for (const image of state.images) {
    if (image.url) {
      URL.revokeObjectURL(image.url);
    }
  }
  state.images = [];
  state.progress = 0;
  setWidget(node, "uploaded_images", "");
  state.status = "已清空图片";
  app.graph.setDirtyCanvas(true, true);
}

function queueCurrentNode(node) {
  const state = ensureState(node);
  state.status = "已提交训练任务";
  state.progress = Math.max(state.progress || 0, 0.2);
  app.canvas?.selectNode?.(node);
  if (typeof app.queuePrompt === "function") {
    app.queuePrompt(0, 1);
  } else {
    app.extensionManager?.command?.execute?.("Comfy.QueuePrompt");
  }
  app.graph.setDirtyCanvas(true, true);
}

function downloadLora(node) {
  const state = ensureState(node);
  const loraPath = getWidget(node, "last_lora_path") || getWidget(node, "lora_path");
  if (!loraPath) {
    state.status = "LoRA 尚未训练完成";
    app.graph.setDirtyCanvas(true, true);
    return;
  }
  window.open(`/ninebot_flux_lora_pipeline/download?path=${encodeURIComponent(loraPath)}`, "_blank");
}

function firstUiValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function rectToClient(node, rect, graphCanvas) {
  const canvas = graphCanvas?.canvas || app.canvas?.canvas;
  const bounds = canvas?.getBoundingClientRect?.() || { left: 0, top: 0 };
  const ds = graphCanvas?.ds || app.canvas?.ds || {};
  const scale = ds.scale || 1;
  const offset = ds.offset || [0, 0];
  const nodePos = node.pos || [0, 0];
  return {
    left: bounds.left + (nodePos[0] + rect.x) * scale + offset[0],
    top: bounds.top + (nodePos[1] + rect.y) * scale + offset[1],
    width: rect.w * scale,
    height: rect.h * scale,
  };
}

function stopInlineEvent(event) {
  event?.stopPropagation?.();
}

function startInlineEdit(node, name, rect, graphCanvas, options = {}) {
  const state = ensureState(node);
  state.inlineEditor?.remove?.();

  const current = getWidget(node, name);
  const clientRect = rectToClient(node, rect, graphCanvas);
  const input = document.createElement("input");
  input.type = "text";
  input.value = String(current ?? "");
  input.dataset.ninebotInlineEditor = name;
  input.style.position = "fixed";
  input.style.left = `${clientRect.left}px`;
  input.style.top = `${clientRect.top}px`;
  input.style.width = `${clientRect.width}px`;
  input.style.height = `${clientRect.height}px`;
  input.style.boxSizing = "border-box";
  input.style.zIndex = "10000";
  input.style.padding = "0 16px";
  input.style.border = `1px solid ${COLORS.green}`;
  input.style.borderRadius = "7px";
  input.style.outline = "none";
  input.style.background = COLORS.input;
  input.style.color = COLORS.text;
  input.style.font = "700 18px monospace";

  let finished = false;
  const close = () => {
    if (finished) {
      return;
    }
    finished = true;
    input.remove();
    if (state.inlineEditor === input) {
      state.inlineEditor = null;
    }
  };
  const commit = () => {
    if (finished) {
      return;
    }
    const parsed = options.parse ? options.parse(input.value) : input.value;
    if (!options.validate || options.validate(parsed)) {
      setWidget(node, name, parsed);
    }
    close();
    app.graph.setDirtyCanvas(true, true);
  };

  input.addEventListener("pointerdown", stopInlineEvent);
  input.addEventListener("mousedown", stopInlineEvent);
  input.addEventListener("keydown", (event) => {
    stopInlineEvent(event);
    if (event.key === "Escape") {
      event.preventDefault?.();
      close();
      return;
    }
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault?.();
      commit();
    }
  });
  input.addEventListener("blur", commit);

  state.inlineEditor = input;
  document.body.appendChild(input);
  input.focus();
  input.select();
}

function startInlineSelect(node, name, rect, graphCanvas, values) {
  const state = ensureState(node);
  state.inlineEditor?.remove?.();

  const current = getWidget(node, name, values[0]);
  const clientRect = rectToClient(node, rect, graphCanvas);
  const select = document.createElement("select");
  select.dataset.ninebotInlineEditor = name;
  select.style.position = "fixed";
  select.style.left = `${clientRect.left}px`;
  select.style.top = `${clientRect.top}px`;
  select.style.width = `${clientRect.width}px`;
  select.style.height = `${clientRect.height}px`;
  select.style.boxSizing = "border-box";
  select.style.zIndex = "10000";
  select.style.padding = "0 14px";
  select.style.border = `1px solid ${COLORS.blue}`;
  select.style.borderRadius = "7px";
  select.style.outline = "none";
  select.style.background = COLORS.input;
  select.style.color = COLORS.text;
  select.style.font = "700 18px monospace";

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  select.value = String(current ?? values[0]);

  let finished = false;
  const close = () => {
    if (finished) {
      return;
    }
    finished = true;
    select.remove();
    if (state.inlineEditor === select) {
      state.inlineEditor = null;
    }
  };
  const commit = () => {
    if (finished) {
      return;
    }
    setWidget(node, name, select.value);
    close();
    app.graph.setDirtyCanvas(true, true);
  };

  select.addEventListener("pointerdown", stopInlineEvent);
  select.addEventListener("mousedown", stopInlineEvent);
  select.addEventListener("change", (event) => {
    stopInlineEvent(event);
    commit();
  });
  select.addEventListener("keydown", (event) => {
    stopInlineEvent(event);
    if (event.key === "Escape") {
      event.preventDefault?.();
      close();
    }
  });
  select.addEventListener("blur", commit);

  state.inlineEditor = select;
  document.body.appendChild(select);
  select.focus();
  if (typeof select.showPicker === "function") {
    try {
      select.showPicker();
    } catch {
      // Some browsers only allow showPicker during a trusted user gesture.
    }
  }
}

function editTextWidget(node, name, rect, graphCanvas) {
  startInlineEdit(node, name, rect, graphCanvas);
}

function editNumberWidget(node, name, rect, graphCanvas, parser) {
  startInlineEdit(node, name, rect, graphCanvas, {
    parse: parser,
    validate: (value) => Number.isFinite(value) && value > 0,
  });
}

function editNonNegativeNumberWidget(node, name, rect, graphCanvas, parser) {
  startInlineEdit(node, name, rect, graphCanvas, {
    parse: parser,
    validate: (value) => Number.isFinite(value) && value >= 0,
  });
}

function toggleDryRun(node) {
  setWidget(node, "dry_run", !Boolean(getWidget(node, "dry_run")));
  app.graph.setDirtyCanvas(true, true);
}

function toggleBooleanWidget(node, name) {
  setWidget(node, name, !Boolean(getWidget(node, name)));
  app.graph.setDirtyCanvas(true, true);
}

function cycleWidget(node, name, values) {
  const current = getWidget(node, name, values[0]);
  const index = values.indexOf(current);
  setWidget(node, name, values[(index + 1) % values.length]);
  app.graph.setDirtyCanvas(true, true);
}

function drawBadge(ctx, label, x, y, color, width = 56) {
  roundRect(ctx, x, y, width, 32, 7);
  ctx.strokeStyle = color;
  ctx.stroke();
  drawText(ctx, label, x + width / 2, y + 16, {
    align: "center",
    baseline: "middle",
    color,
    font: "700 15px sans-serif",
  });
}

function drawInput(ctx, value, x, y, width, height = 50, options = {}) {
  roundRect(ctx, x, y, width, height, 7);
  ctx.fillStyle = COLORS.input;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();
  drawText(ctx, String(value), x + 16, y + height / 2 + 1, {
    baseline: "middle",
    color: options.color || COLORS.text,
    font: "700 18px monospace",
  });
}

function drawProgress(ctx, rect, progress) {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
  ctx.fillStyle = "#18212f";
  ctx.fill();
  if (clamped > 0) {
    roundRect(ctx, rect.x, rect.y, rect.w * clamped, rect.h, rect.h / 2);
    ctx.fillStyle = COLORS.blue;
    ctx.fill();
  }
}

function drawFormField(ctx, { label, hint, value, x, y, width, badge, badgeColor, inputY }) {
  drawText(ctx, label, x, y, { font: "700 20px sans-serif" });
  if (badge) {
    drawBadge(ctx, badge, x + width - 58, y - 26, badgeColor);
  }
  if (hint) {
    drawText(ctx, hint, x, y + 40, { color: COLORS.faint, font: "16px sans-serif" });
  }
  drawInput(ctx, value, x, inputY, width);
}

function drawSwitch(ctx, value, x, y, label) {
  roundRect(ctx, x, y, 66, 34, 17);
  ctx.fillStyle = value ? "#1c683d" : COLORS.input;
  ctx.fill();
  ctx.strokeStyle = value ? COLORS.green : COLORS.border;
  ctx.stroke();
  roundRect(ctx, value ? x + 32 : x + 4, y + 4, 26, 26, 13);
  ctx.fillStyle = value ? "#6cff9c" : COLORS.muted;
  ctx.fill();
  drawText(ctx, label, x + 82, y + 17, {
    baseline: "middle",
    color: value ? COLORS.green : COLORS.faint,
    font: "700 16px sans-serif",
  });
}

function displayAdvancedValue(node, name) {
  const value = getWidget(node, name, ADVANCED_DEFAULTS[name] ?? "");
  const text = String(value);
  return text.length > 34 ? `${text.slice(0, 31)}...` : text;
}

function drawAdvancedRow(ctx, node, { name, label, hint, y, badge, badgeColor, height = 48, valueColor }) {
  const state = ensureAdvancedState(node);
  const left = 24;
  const width = node.size[0] - left * 2;
  const rect = { x: left, y: y + 48, w: width, h: height };
  state.rects[name] = rect;
  drawText(ctx, label, left, y, { font: "700 19px sans-serif" });
  if (badge) {
    drawBadge(ctx, badge, left + width - 58, y - 23, badgeColor);
  }
  if (hint) {
    drawText(ctx, hint, left, y + 28, { color: COLORS.faint, font: "15px sans-serif" });
  }
  drawInput(ctx, displayAdvancedValue(node, name), rect.x, rect.y, rect.w, rect.h, {
    color: valueColor || COLORS.text,
  });
}

function drawAdvancedNode(node, ctx) {
  const state = ensureAdvancedState(node);
  const w = node.size[0];
  const h = node.size[1];
  const left = 24;
  const contentW = w - left * 2;
  state.rects = {};
  sanitizeAdvancedWidgets(node);

  ctx.save();
  roundRect(ctx, 0, 0, w, h, 18);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = "#30374d";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = COLORS.pink;
  ctx.beginPath();
  ctx.moveTo(14, 1);
  ctx.lineTo(w * 0.45, 1);
  ctx.stroke();
  ctx.strokeStyle = COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(w * 0.45, 1);
  ctx.lineTo(w - 16, 1);
  ctx.stroke();

  ctx.fillStyle = COLORS.header;
  roundRect(ctx, 0, 0, w, 84, 18);
  ctx.fill();
  drawText(ctx, "高级训练参数", left, 38, { font: "700 22px sans-serif" });
  drawText(ctx, "只在需要调速度、显存或预览提示词时调整", left, 64, {
    color: COLORS.faint,
    font: "15px sans-serif",
  });

  ctx.fillStyle = COLORS.band;
  ctx.fillRect(0, 84, w, 44);
  ctx.fillStyle = COLORS.orange;
  roundRect(ctx, left, 98, 5, 16, 2);
  ctx.fill();
  drawText(ctx, "训练基础", left + 18, 112, { color: COLORS.orange, font: "700 16px sans-serif" });

  drawAdvancedRow(ctx, node, {
    name: "training_resolution",
    label: "训练分辨率",
    hint: "默认 1024；训练太慢时先降到 768",
    y: 158,
    badge: "整数",
    badgeColor: COLORS.orange,
  });
  drawAdvancedRow(ctx, node, {
    name: "batch_size",
    label: "批量大小",
    hint: "RTX4080 建议 1；显存充足再尝试 2",
    y: 286,
    badge: "整数",
    badgeColor: COLORS.orange,
  });
  drawAdvancedRow(ctx, node, {
    name: "num_repeats",
    label: "图片重复次数",
    hint: "通常 1；图片很少时可加到 2-3",
    y: 414,
    badge: "整数",
    badgeColor: COLORS.orange,
  });
  drawAdvancedRow(ctx, node, {
    name: "blocks_to_swap",
    label: "显存换出层数",
    hint: "默认 8 比较平衡；显存不足改 16，显存充足可改 0 提速",
    y: 542,
    badge: "整数",
    badgeColor: COLORS.orange,
  });

  ctx.fillStyle = "#242638";
  ctx.fillRect(0, 690, w, 42);
  ctx.fillStyle = "rgba(207, 91, 152, 0.10)";
  ctx.fillRect(0, 690, w, 42);
  ctx.fillStyle = COLORS.pink;
  roundRect(ctx, left, 703, 5, 16, 2);
  ctx.fill();
  drawText(ctx, "精度与预览", left + 18, 717, { color: COLORS.pink, font: "700 16px sans-serif" });

  state.rects.fp8_base = { x: left, y: 776, w: contentW, h: 74 };
  drawText(ctx, "FP8 基础模型", left, 770, { font: "700 19px sans-serif" });
  drawText(ctx, "开启可省显存，RTX4080 建议开启", left, 800, { color: COLORS.faint, font: "15px sans-serif" });
  drawSwitch(ctx, Boolean(getWidget(node, "fp8_base")), left, 818, "开启");

  drawAdvancedRow(ctx, node, {
    name: "gradient_dtype",
    label: "梯度计算精度",
    hint: "默认 bf16，通常不用改",
    y: 880,
    badge: "选项",
    badgeColor: COLORS.blue,
    valueColor: COLORS.orange,
  });
  drawAdvancedRow(ctx, node, {
    name: "attention_mode",
    label: "注意力模式",
    hint: "默认 sdpa；xformers 需要环境支持",
    y: 994,
    badge: "选项",
    badgeColor: COLORS.blue,
    valueColor: COLORS.blue,
  });
  drawAdvancedRow(ctx, node, {
    name: "sample_prompts",
    label: "预览提示词",
    hint: "可留空；多条用 | 分隔",
    y: 1108,
    badge: "文本",
    badgeColor: COLORS.pink,
  });

  ctx.restore();
}

function drawImageCard(ctx, image, x, y, width, height, index) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 8);
  ctx.fillStyle = "#141722";
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();
  const preview = image.previewElement;
  if (preview?.complete) {
    const scale = Math.min(width / preview.width, height / preview.height);
    const drawW = preview.width * scale;
    const drawH = preview.height * scale;
    ctx.drawImage(preview, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
  } else if (image.url && !image.previewElement) {
    image.previewElement = new Image();
    image.previewElement.src = image.url;
  }
  roundRect(ctx, x + width - 24, y + height - 24, 22, 22, 6);
  ctx.fillStyle = "#05070d";
  ctx.fill();
  drawText(ctx, String(index), x + width - 13, y + height - 13, {
    align: "center",
    baseline: "middle",
    font: "700 13px sans-serif",
  });
  ctx.restore();
}

function drawPipelineNode(node, ctx) {
  const state = ensureState(node);
  const w = node.size[0];
  const h = node.size[1];
  const left = 20;
  const contentW = w - left * 2;
  const rects = {};
  state.rects = rects;

  ctx.save();
  roundRect(ctx, 0, 0, w, h, 18);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();

  ctx.strokeStyle = "#30374d";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = COLORS.pink;
  ctx.beginPath();
  ctx.moveTo(14, 1);
  ctx.lineTo(w * 0.45, 1);
  ctx.stroke();
  ctx.strokeStyle = COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(w * 0.45, 1);
  ctx.lineTo(w - 16, 1);
  ctx.stroke();

  ctx.fillStyle = COLORS.header;
  roundRect(ctx, 0, 0, w, 88, 18);
  ctx.fill();
  drawText(ctx, "NinebotFluxLoRATrainPipeline", left, 39, { font: "700 22px sans-serif" });
  drawText(ctx, "自动打标 + Caption 精化 + FLUX LoRA 训练一体化", left, 66, { color: COLORS.faint, font: "16px sans-serif" });
  drawText(ctx, "↺", w - 32, 36, { align: "center", baseline: "middle", color: COLORS.faint, font: "22px sans-serif" });

  ctx.fillStyle = COLORS.band;
  ctx.fillRect(0, 88, w, 48);
  drawText(ctx, "执行", left, 117, { color: COLORS.faint, font: "16px sans-serif" });
  drawText(ctx, "执行", w - 55, 117, { color: COLORS.faint, font: "16px sans-serif" });

  rects.addImages = { x: left, y: 154, w: contentW, h: 42 };
  drawText(ctx, "训练图片", left, 175, { font: "700 20px sans-serif" });
  drawText(ctx, "*", left + 88, 174, { color: COLORS.pink, font: "700 20px sans-serif" });
  drawBadge(ctx, "图片", w - 80, 153, COLORS.blue, 58);

  ctx.fillStyle = "#242638";
  ctx.fillRect(0, 200, w, 42);
  ctx.fillStyle = "rgba(207, 91, 152, 0.10)";
  ctx.fillRect(0, 200, w, 42);
  ctx.fillStyle = COLORS.pink;
  roundRect(ctx, left, 213, 5, 17, 2);
  ctx.fill();
  drawText(ctx, "数据集配置", left + 18, 227, { color: COLORS.pink, font: "700 16px sans-serif" });

  rects.trigger = { x: left, y: 264, w: contentW, h: 122 };
  rects.triggerInput = { x: left, y: 336, w: contentW, h: 50 };
  drawFormField(ctx, {
    label: "触发词",
    hint: "建议用独特标识词，如 ninebot_xxx_style；避免 car、motorcycle 这类通用词",
    value: getWidget(node, "trigger_word", "ninebot_motorcycle_style"),
    x: left,
    y: 283,
    width: contentW,
    badge: "文本",
    badgeColor: COLORS.pink,
    inputY: rects.triggerInput.y,
  });

  rects.dryRun = { x: left, y: 416, w: 320, h: 116 };
  drawText(ctx, "试运行", left, 438, { font: "700 20px sans-serif" });
  drawBadge(ctx, "布尔", w - 80, 415, COLORS.border, 58);
  drawText(ctx, "开启时只生成打标预览清单，不写 .txt，不启动训练", left, 478, { color: COLORS.faint, font: "16px sans-serif" });
  roundRect(ctx, left, 496, 66, 34, 17);
  ctx.fillStyle = getWidget(node, "dry_run") ? "#1c683d" : COLORS.input;
  ctx.fill();
  ctx.strokeStyle = getWidget(node, "dry_run") ? COLORS.green : COLORS.border;
  ctx.stroke();
  roundRect(ctx, getWidget(node, "dry_run") ? left + 32 : left + 4, 500, 26, 26, 13);
  ctx.fillStyle = getWidget(node, "dry_run") ? "#6cff9c" : COLORS.muted;
  ctx.fill();
  drawText(ctx, getWidget(node, "dry_run") ? "ON - 仅预览，不执行" : "OFF - 生成并训练", left + 82, 514, {
    baseline: "middle",
    color: getWidget(node, "dry_run") ? COLORS.green : COLORS.orange,
    font: "700 17px sans-serif",
  });

  rects.clearImages = { x: 0, y: 0, w: 0, h: 0 };

  ctx.fillStyle = "#242638";
  ctx.fillRect(0, 542, w, 42);
  ctx.fillStyle = "rgba(212, 149, 50, 0.08)";
  ctx.fillRect(0, 542, w, 42);
  ctx.fillStyle = COLORS.orange;
  roundRect(ctx, left, 555, 5, 17, 2);
  ctx.fill();
  drawText(ctx, "训练配置", left + 18, 569, { color: COLORS.orange, font: "700 16px sans-serif" });

  rects.outputName = { x: left, y: 676, w: 604, h: 50 };
  drawFormField(ctx, {
    label: "输出 LoRA 名称",
    hint: "建议含版本号，如 ninebot_motorcycle_v003_r8",
    value: getWidget(node, "output_lora_name", "ninebot_motorcycle_flux_v003"),
    x: left,
    y: 624,
    width: contentW,
    badge: "文本",
    badgeColor: COLORS.pink,
    inputY: rects.outputName.y,
  });
  rects.download = { x: left + 616, y: rects.outputName.y, w: 64, h: 50 };
  roundRect(ctx, rects.download.x, rects.download.y, rects.download.w, rects.download.h, 7);
  ctx.fillStyle = COLORS.input;
  ctx.fill();
  ctx.strokeStyle = getWidget(node, "last_lora_path") ? COLORS.pink : COLORS.border;
  ctx.stroke();
  drawDownloadIcon(ctx, rects.download.x + 18, rects.download.y + 10, Boolean(getWidget(node, "last_lora_path")));

  rects.rank = { x: left, y: 836, w: contentW, h: 50 };
  drawFormField(ctx, {
    label: "LoRA Rank",
    hint: "8 = 快速验证；16 = 质量跑。alpha 自动等于 rank",
    value: getWidget(node, "lora_rank", 8),
    x: left,
    y: 784,
    width: contentW,
    badge: "整数",
    badgeColor: COLORS.orange,
    inputY: rects.rank.y,
  });
  drawText(ctx, "⌄", w - 42, rects.rank.y + 26, { align: "center", baseline: "middle", color: COLORS.faint, font: "22px sans-serif" });

  rects.steps = { x: left, y: 996, w: contentW, h: 50 };
  drawFormField(ctx, {
    label: "最大训练步数",
    hint: "600 步快速跑；1200 步质量跑",
    value: getWidget(node, "max_train_steps", 600),
    x: left,
    y: 944,
    width: contentW,
    badge: "整数",
    badgeColor: COLORS.orange,
    inputY: rects.steps.y,
  });

  rects.lr = { x: left, y: 1088, w: contentW, h: 50 };
  drawFormField(ctx, {
    label: "学习率",
    hint: "",
    value: getWidget(node, "learning_rate", 0.0001),
    x: left,
    y: 1068,
    width: contentW,
    badge: "浮点",
    badgeColor: COLORS.orange,
    inputY: rects.lr.y,
  });

  const footerY = h - 132;
  rects.footer = { x: 0, y: footerY, w, h: 132 };
  ctx.fillStyle = "rgba(16, 19, 28, 0.78)";
  ctx.fillRect(0, footerY, w, 132);
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(w, footerY);
  ctx.stroke();

  const done = (state.progress || 0) >= 1;
  drawText(ctx, done ? "完成 · LoRA 已保存至 output/" : (state.status || "准备 · 等待运行"), left, footerY + 30, {
    color: done ? COLORS.blue : COLORS.faint,
    font: "700 17px sans-serif",
  });
  rects.progressTrack = { x: left, y: footerY + 48, w: contentW, h: 7 };
  drawProgress(ctx, rects.progressTrack, state.progress);

  rects.runNode = { x: left, y: footerY + 74, w: 154, h: 52 };
  roundRect(ctx, rects.runNode.x, rects.runNode.y, rects.runNode.w, rects.runNode.h, 8);
  ctx.fillStyle = done ? "rgba(26, 117, 127, 0.24)" : "#202539";
  ctx.fill();
  ctx.strokeStyle = done ? COLORS.blue : COLORS.border;
  ctx.stroke();
  drawText(ctx, "▶", left + 28, footerY + 100, { align: "center", baseline: "middle", color: done ? COLORS.blue : COLORS.faint, font: "18px sans-serif" });
  drawText(ctx, done ? "重新运行" : "运行此节点", left + 88, footerY + 100, { align: "center", baseline: "middle", color: done ? COLORS.blue : COLORS.faint, font: "17px sans-serif" });

  ctx.restore();
}

function syncNodeLayout(node) {
  node.size = [...NODE_SIZE];
  node.color = COLORS.panel;
  node.bgcolor = COLORS.panel;
  node.outputs = [];

  node.inputs?.forEach((input) => {
    if (input.name === "training_images") {
      input.label = " ";
      input.pos = [0, 174];
    }
    if (input.name === "advanced_settings") {
      input.label = " ";
      input.pos = [0, 568];
    }
  });

}

function syncAdvancedNodeLayout(node) {
  node.size = [...ADVANCED_NODE_SIZE];
  node.color = COLORS.panel;
  node.bgcolor = COLORS.panel;
  node.outputs?.forEach((output) => {
    if (output.name === "advanced_settings") {
      output.label = " ";
      output.pos = [node.size[0], 112];
    }
  });
}

app.registerExtension({
  name: "Ninebot.FluxLoRATrainPipeline",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_NAME && nodeData.name !== ADVANCED_NODE_NAME) {
      return;
    }

    if (nodeData.name === ADVANCED_NODE_NAME) {
      nodeType.title_mode = TITLE_MODE_NO_TITLE;

      const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
      nodeType.prototype.onNodeCreated = function () {
        originalOnNodeCreated?.apply(this, arguments);
        ensureAdvancedState(this);
        sanitizeAdvancedWidgets(this);
        syncAdvancedNodeLayout(this);
        for (const item of this.widgets || []) {
          if (ADVANCED_WIDGETS.includes(item.name)) {
            hideWidget(item);
          }
        }
      };

      const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
      nodeType.prototype.onDrawForeground = function (ctx) {
        syncAdvancedNodeLayout(this);
        originalOnDrawForeground?.apply(this, arguments);
        drawAdvancedNode(this, ctx);
      };

      const originalOnMouseDown = nodeType.prototype.onMouseDown;
      nodeType.prototype.onMouseDown = function (event, pos, graphCanvas) {
        const state = ensureAdvancedState(this);
        if (pointIn(state.rects.training_resolution, pos)) {
          editNumberWidget(this, "training_resolution", state.rects.training_resolution, graphCanvas, (value) => parseInt(value, 10));
          return true;
        }
        if (pointIn(state.rects.batch_size, pos)) {
          editNumberWidget(this, "batch_size", state.rects.batch_size, graphCanvas, (value) => parseInt(value, 10));
          return true;
        }
        if (pointIn(state.rects.num_repeats, pos)) {
          editNumberWidget(this, "num_repeats", state.rects.num_repeats, graphCanvas, (value) => parseInt(value, 10));
          return true;
        }
        if (pointIn(state.rects.blocks_to_swap, pos)) {
          editNonNegativeNumberWidget(this, "blocks_to_swap", state.rects.blocks_to_swap, graphCanvas, (value) => parseInt(value, 10));
          return true;
        }
        if (pointIn(state.rects.fp8_base, pos)) {
          toggleBooleanWidget(this, "fp8_base");
          return true;
        }
        if (pointIn(state.rects.gradient_dtype, pos)) {
          startInlineSelect(this, "gradient_dtype", state.rects.gradient_dtype, graphCanvas, ["bf16", "fp16", "fp32"]);
          return true;
        }
        if (pointIn(state.rects.attention_mode, pos)) {
          startInlineSelect(this, "attention_mode", state.rects.attention_mode, graphCanvas, ["sdpa", "xformers", "disabled"]);
          return true;
        }
        if (pointIn(state.rects.sample_prompts, pos)) {
          editTextWidget(this, "sample_prompts", state.rects.sample_prompts, graphCanvas);
          return true;
        }
        return originalOnMouseDown?.apply(this, arguments);
      };

      return;
    }

    nodeType.title_mode = TITLE_MODE_NO_TITLE;

    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      originalOnNodeCreated?.apply(this, arguments);
      ensureState(this);
      syncNodeLayout(this);
      for (const item of this.widgets || []) {
        if (["uploaded_images", "trigger_word", "dry_run", "output_lora_name", "lora_rank", "max_train_steps", "learning_rate"].includes(item.name)) {
          hideWidget(item);
        }
      }
      const lastPath = widget(this, "last_lora_path") || this.addWidget("text", "last_lora_path", "", () => {}, { serialize: false });
      hideWidget(lastPath, { submit: false, persist: false });
    };

    const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      syncNodeLayout(this);
      originalOnDrawForeground?.apply(this, arguments);
      drawPipelineNode(this, ctx);
    };

    const originalOnMouseDown = nodeType.prototype.onMouseDown;
    nodeType.prototype.onMouseDown = function (event, pos, graphCanvas) {
      const state = ensureState(this);
      if (pointNearInput(this, "advanced_settings", pos)) {
        return createOrFocusAdvancedSettings(this);
      }
      if (pointIn(state.rects.addImages, pos)) {
        openFilePicker(this);
        return true;
      }
      if (pointIn(state.rects.trigger, pos)) {
        editTextWidget(this, "trigger_word", state.rects.triggerInput || state.rects.trigger, graphCanvas);
        return true;
      }
      if (pointIn(state.rects.dryRun, pos)) {
        toggleDryRun(this);
        return true;
      }
      if (pointIn(state.rects.outputName, pos)) {
        editTextWidget(this, "output_lora_name", state.rects.outputName, graphCanvas);
        return true;
      }
      if (pointIn(state.rects.rank, pos)) {
        editNumberWidget(this, "lora_rank", state.rects.rank, graphCanvas, (value) => parseInt(value, 10));
        return true;
      }
      if (pointIn(state.rects.steps, pos)) {
        editNumberWidget(this, "max_train_steps", state.rects.steps, graphCanvas, (value) => parseInt(value, 10));
        return true;
      }
      if (pointIn(state.rects.lr, pos)) {
        editNumberWidget(this, "learning_rate", state.rects.lr, graphCanvas, (value) => parseFloat(value));
        return true;
      }
      if (pointIn(state.rects.clearImages, pos)) {
        clearImages(this);
        return true;
      }
      if (pointIn(state.rects.download, pos)) {
        downloadLora(this);
        return true;
      }
      if (pointIn(state.rects.runNode, pos)) {
        queueCurrentNode(this);
        return true;
      }
      return originalOnMouseDown?.apply(this, arguments);
    };

    const originalOnExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
      originalOnExecuted?.apply(this, arguments);
      const loraPath = firstUiValue(message?.lora_path) || "";
      if (loraPath) {
        setWidget(this, "last_lora_path", loraPath);
        const state = ensureState(this);
        state.status = "完成 · LoRA 已保存至 output/";
        state.progress = 1;
      }
    };
  },
});

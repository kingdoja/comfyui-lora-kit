import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const sourcePath = path.resolve(
  "custom_nodes/ninebot_flux_lora_pipeline/web/ninebot_flux_lora_pipeline.js",
);

const source = fs
  .readFileSync(sourcePath, "utf8")
  .replace(/^import\s+\{\s*app\s*\}\s+from\s+["'][^"']+["'];\s*/u, "");

let registeredExtension = null;
let selectedNode = null;
const createdGraphNodes = [];
const fakeGraph = {
  _nodes: [],
  _lastLinkId: 0,
  links: {},
  add(node) {
    node.graph = this;
    this._nodes.push(node);
    createdGraphNodes.push(node);
  },
  getNodeById(id) {
    return this._nodes.find((node) => node.id === id) || null;
  },
  setDirtyCanvas() {},
};
const fakeApp = {
  graph: fakeGraph,
  canvas: {
    selectNode(node) {
      selectedNode = node;
    },
    centerOnNode(node) {
      this.centeredNode = node;
    },
  },
  registerExtension(extension) {
    registeredExtension = extension;
  },
};

const context = vm.createContext({
  app: fakeApp,
  console,
  document: {
    createElement() {
      return {
        click() {},
        set onchange(value) {
          this._onchange = value;
        },
      };
    },
  },
  fetch: async () => ({ ok: true, json: async () => ({ image_paths: [] }) }),
  FormData: class FormData {},
  Image: class Image {},
  LiteGraph: {
    createNode(type) {
      if (type !== "NinebotFluxLoRAAdvancedSettings") {
        return null;
      }
      const node = {
        id: `advanced-${createdGraphNodes.length + 1}`,
        type,
        pos: [0, 0],
        outputs: [{ name: "advanced_settings", type: "NINEBOT_FLUX_LORA_ADVANCED" }],
        findOutputSlot(name) {
          return this.outputs.findIndex((output) => output.name === name);
        },
        connect(outputSlot, targetNode, inputSlot) {
          const linkId = ++fakeGraph._lastLinkId;
          targetNode.inputs[inputSlot].link = linkId;
          fakeGraph.links[linkId] = { origin_id: this.id, origin_slot: outputSlot, target_id: targetNode.id, target_slot: inputSlot };
          this.connected = { outputSlot, targetNode, inputSlot };
        },
      };
      return node;
    },
  },
  URL,
  window: {
    open() {},
    prompt(_label, value) {
      return value;
    },
  },
});

vm.runInContext(source, context, { filename: sourcePath });
assert.ok(registeredExtension, "frontend extension should register itself");

function makeWidget(name, value) {
  return {
    name,
    value,
    serialize: true,
  };
}

class FakeNodeType {}

await registeredExtension.beforeRegisterNodeDef(FakeNodeType, {
  name: "NinebotFluxLoRATrainPipeline",
});

assert.equal(FakeNodeType.title_mode, 1, "native LiteGraph title bar should be disabled");

const node = Object.create(FakeNodeType.prototype);
node.id = "train-1";
node.pos = [500, 300];
node.graph = fakeGraph;
node.size = [320, 240];
node.inputs = [
  { name: "training_images", type: "IMAGE" },
  { name: "advanced_settings", type: "NINEBOT_FLUX_LORA_ADVANCED" },
];
fakeGraph._nodes.push(node);
node.findInputSlot = function findInputSlot(name) {
  return this.inputs.findIndex((input) => input.name === name);
};
node.outputs = [
  { name: "lora_name", type: "STRING" },
  { name: "captions", type: "STRING" },
];
node.widgets = [
  makeWidget("uploaded_images", ""),
  makeWidget("trigger_word", "ninebot_motorcycle_style"),
  makeWidget("dry_run", true),
  makeWidget("output_lora_name", "ninebot_test"),
  makeWidget("lora_rank", 8),
  makeWidget("max_train_steps", 600),
  makeWidget("learning_rate", 0.0001),
];
node.addWidget = function addWidget(_type, name, value, callback, options = {}) {
  const item = makeWidget(name, value);
  item.callback = callback;
  Object.assign(item, options);
  this.widgets.push(item);
  return item;
};

node.onNodeCreated();

assert.equal(node.size[0], 720, "node should keep the approved mockup width");
assert.equal(node.size[1], 1288, "node should use the tall form layout from the approved mockup");
assert.ok(
  node.inputs[0].pos[1] >= 150 && node.inputs[0].pos[1] <= 190,
  "training image input socket should align with the training image row",
);
assert.equal(node.inputs[1].label, " ", "advanced settings socket label should not draw over the custom node");
assert.ok(
  node.inputs[1].pos[1] >= 550 && node.inputs[1].pos[1] <= 590,
  "advanced settings socket should align with the training config band",
);
assert.equal(node.outputs.length, 0, "stale output sockets should be removed from the visual node");

const hiddenWidgetNames = [
  "uploaded_images",
  "trigger_word",
  "dry_run",
  "output_lora_name",
  "lora_rank",
  "max_train_steps",
  "learning_rate",
  "last_lora_path",
];

assert.deepEqual(
  node.widgets.map((item) => item.name),
  hiddenWidgetNames,
  "widgets should remain available for graphToPrompt and workflow serialization",
);

for (const name of hiddenWidgetNames) {
  const item = node.widgets.find((widget) => widget.name === name);
  assert.equal(item.hidden, true, `${name} should be hidden from native canvas drawing`);
}

const promptInputs = {};
for (const [index, item] of node.widgets.entries()) {
  if (!item.name || item.options?.serialize === false) continue;
  promptInputs[item.name] = item.serializeValue ? await item.serializeValue(node, index) : item.value;
}

assert.equal(promptInputs.output_lora_name, "ninebot_test");
assert.equal(promptInputs.lora_rank, 8);
assert.equal(promptInputs.max_train_steps, 600);
assert.equal(promptInputs.learning_rate, 0.0001);
assert.ok(
  !Object.hasOwn(promptInputs, "last_lora_path"),
  "download-only last_lora_path should not be submitted to the backend prompt",
);

function makeCanvasContext() {
  const calls = [];
  const ctx = {
    calls,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    fill() {},
    stroke() {},
    fillRect() {},
    setLineDash() {},
    drawImage() {
      calls.push({ type: "drawImage" });
    },
    fillText(text, x, y) {
      calls.push({ type: "text", text, x, y });
    },
  };
  return ctx;
}

const drawContext = makeCanvasContext();
node.ninebotPipeline.images = Array.from({ length: 25 }, (_, index) => ({
  name: `training-${index + 1}.png`,
  path: `C:/training-${index + 1}.png`,
}));
context.drawPipelineNode(node, drawContext);

assert.equal(node.ninebotPipeline.rects.rank.w, 680, "LoRA Rank should be a full-width form row");
assert.equal(node.ninebotPipeline.rects.steps.w, 680, "max train steps should be a full-width form row");
assert.equal(node.ninebotPipeline.rects.lr.w, 680, "learning rate should be a full-width form row");
assert.ok(node.ninebotPipeline.rects.footer.y + node.ninebotPipeline.rects.footer.h <= node.size[1], "footer should stay inside the node bounds");
assert.ok(node.ninebotPipeline.rects.progressTrack.w > 0, "footer should draw a progress bar");
assert.ok(node.ninebotPipeline.rects.runNode.w > 0, "footer should expose a run-node button hit area");
assert.ok(node.ninebotPipeline.rects.steps.y > node.ninebotPipeline.rects.rank.y, "max steps should appear below rank");
assert.ok(node.ninebotPipeline.rects.lr.y > node.ninebotPipeline.rects.steps.y, "learning rate should appear below max steps");
assert.ok(
  node.ninebotPipeline.rects.lr.y + node.ninebotPipeline.rects.lr.h <= node.ninebotPipeline.rects.footer.y - 12,
  "learning rate input should leave clear space above the footer progress area",
);
assert.ok(
  node.ninebotPipeline.rects.download.x > node.ninebotPipeline.rects.outputName.x + node.ninebotPipeline.rects.outputName.w,
  "download icon should sit to the right of the output LoRA name field",
);

const drawnText = drawContext.calls.map((call) => call.text);
assert.ok(!drawnText.includes("▔"), "form labels should not draw a stray underline glyph");
assert.ok(!drawnText.includes("✣"), "decorative header icon should not be drawn");
assert.ok(!drawnText.includes("lora_path"), "LoRA path should not be exposed as a node socket yet");
assert.ok(!drawnText.includes("lora_name"), "LoRA name should not be exposed as a node socket yet");
assert.ok(!drawnText.includes("captions"), "captions should not be exposed as a node socket yet");
assert.ok(!drawnText.includes("× 清除全部（25 张）"), "uploaded images should not add an overlapping middle clear row");
for (const previewIndex of ["1", "2", "3", "4", "5", "6"]) {
  assert.ok(!drawnText.includes(previewIndex), `uploaded image preview ${previewIndex} should not be drawn into the middle layout`);
}
assert.equal(drawContext.calls.filter((call) => call.type === "drawImage").length, 0, "uploaded images should not draw thumbnails over form sections");
assert.ok(drawnText.includes("运行此节点"), "footer should draw a run-node button");
assert.ok(drawnText.includes("建议用独特标识词，如 ninebot_xxx_style；避免 car、motorcycle 这类通用词"));
assert.ok(drawnText.includes("开启时只生成打标预览清单，不写 .txt，不启动训练"));
assert.ok(drawnText.includes("8 = 快速验证；16 = 质量跑。alpha 自动等于 rank"));
assert.ok(drawnText.includes("600 步快速跑；1200 步质量跑"));

const advancedClickHandled = node.onMouseDown(
  { stopPropagation() {}, preventDefault() {} },
  [4, 568],
  {},
);
assert.equal(advancedClickHandled, true, "advanced settings socket click should be handled");
assert.equal(createdGraphNodes.length, 1, "clicking advanced socket should create one advanced settings node");
const advancedNode = createdGraphNodes[0];
assert.equal(advancedNode.type, "NinebotFluxLoRAAdvancedSettings");
assert.equal(advancedNode.pos[0], 120, "advanced settings node should be placed to the left of the train node");
assert.equal(advancedNode.pos[1], 300, "advanced settings node should align vertically with the train node");
assert.equal(advancedNode.connected.targetNode, node, "advanced settings node should connect to the training node");
assert.equal(advancedNode.connected.inputSlot, 1, "advanced settings output should connect to the advanced_settings input");
assert.equal(selectedNode, advancedNode, "created advanced node should be selected for editing");

const repeatClickHandled = node.onMouseDown(
  { stopPropagation() {}, preventDefault() {} },
  [4, 568],
  {},
);
assert.equal(repeatClickHandled, true, "repeat advanced socket click should still be handled");
assert.equal(createdGraphNodes.length, 1, "repeat click should focus the existing advanced node instead of creating duplicates");

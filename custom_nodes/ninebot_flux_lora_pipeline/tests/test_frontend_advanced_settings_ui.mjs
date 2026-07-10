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
let createdInput = null;
let createdSelect = null;

const fakeApp = {
  graph: {
    setDirtyCanvas() {},
  },
  registerExtension(extension) {
    registeredExtension = extension;
  },
};

const context = vm.createContext({
  app: fakeApp,
  console,
  document: {
    body: {
      appendChild(element) {
        element.isConnected = true;
      },
    },
    createElement(tagName) {
      const element = {
        tagName,
        style: {},
        dataset: {},
        listeners: {},
        children: [],
        isConnected: false,
        addEventListener(type, listener) {
          this.listeners[type] = listener;
        },
        appendChild(child) {
          this.children.push(child);
          if (child.value !== undefined) {
            this.options = this.options || [];
            this.options.push(child);
          }
        },
        click() {},
        focus() {
          this.focused = true;
        },
        select() {
          this.selected = true;
        },
        remove() {
          this.isConnected = false;
          this.removed = true;
        },
      };
      if (tagName === "input") {
        createdInput = element;
      }
      if (tagName === "select") {
        createdSelect = element;
      }
      return element;
    },
  },
  fetch: async () => ({ ok: true, json: async () => ({ image_paths: [] }) }),
  FormData: class FormData {},
  Image: class Image {},
  URL,
  window: {
    open() {},
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

class AdvancedNodeType {}

await registeredExtension.beforeRegisterNodeDef(AdvancedNodeType, {
  name: "NinebotFluxLoRAAdvancedSettings",
});

assert.equal(AdvancedNodeType.title_mode, 1, "advanced node should hide the native LiteGraph title");

const node = Object.create(AdvancedNodeType.prototype);
node.pos = [240, 160];
node.size = [320, 240];
node.inputs = [];
node.outputs = [{ name: "advanced_settings", type: "NINEBOT_FLUX_LORA_ADVANCED" }];
node.widgets = [
  makeWidget("training_resolution", 1024),
  makeWidget("batch_size", 1),
  makeWidget("num_repeats", 1),
  makeWidget("blocks_to_swap", 8),
  makeWidget("fp8_base", true),
  makeWidget("gradient_dtype", "bf16"),
  makeWidget("attention_mode", "sdpa"),
  makeWidget("sample_prompts", "enabled"),
];

node.onNodeCreated();

assert.equal(node.size[0], 560, "advanced node should use enough width for Chinese labels");
assert.ok(node.size[1] < 1288, "advanced node should stay visually smaller than the main node");
assert.equal(node.outputs[0].label, " ", "advanced output label should not draw over the custom style");
assert.ok(node.outputs[0].pos[1] > 0, "advanced output socket should be aligned with the custom node");
assert.equal(
  node.widgets.find((item) => item.name === "sample_prompts").value,
  "",
  "stale boolean-like sample prompt values from old workflows should reset to the automatic prompt",
);

for (const item of node.widgets) {
  assert.equal(item.hidden, true, `${item.name} should be hidden from native canvas drawing`);
}

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
    drawImage() {},
    fillText(text, x, y) {
      calls.push({ type: "text", text, x, y });
    },
  };
  return ctx;
}

const drawContext = makeCanvasContext();
context.drawAdvancedNode(node, drawContext);

assert.ok(node.ninebotAdvanced.rects.training_resolution.w > 0, "resolution row should be drawn");
assert.ok(node.ninebotAdvanced.rects.batch_size.w > 0, "batch size row should be drawn");
assert.ok(node.ninebotAdvanced.rects.num_repeats.w > 0, "repeat count row should be drawn");
assert.ok(node.ninebotAdvanced.rects.blocks_to_swap.w > 0, "block swap row should be drawn");
assert.ok(node.ninebotAdvanced.rects.fp8_base.w > 0, "FP8 toggle should be drawn");
assert.ok(node.ninebotAdvanced.rects.gradient_dtype.w > 0, "gradient precision row should be drawn");
assert.ok(node.ninebotAdvanced.rects.attention_mode.w > 0, "attention mode row should be drawn");
assert.ok(node.ninebotAdvanced.rects.sample_prompts.w > 0, "sample prompt field should be drawn");
assert.ok(
  node.ninebotAdvanced.rects.sample_prompts.y + node.ninebotAdvanced.rects.sample_prompts.h <= node.size[1] - 20,
  "sample prompt field should stay inside the advanced node",
);
for (const [firstName, secondName] of [
  ["training_resolution", "batch_size"],
  ["batch_size", "num_repeats"],
  ["num_repeats", "blocks_to_swap"],
  ["blocks_to_swap", "fp8_base"],
  ["fp8_base", "gradient_dtype"],
  ["gradient_dtype", "attention_mode"],
  ["attention_mode", "sample_prompts"],
]) {
  const first = node.ninebotAdvanced.rects[firstName];
  const second = node.ninebotAdvanced.rects[secondName];
  assert.ok(
    first.y + first.h + 18 <= second.y,
    `${secondName} should have clear vertical spacing below ${firstName}`,
  );
}
assert.equal(
  node.ninebotAdvanced.rects.gradient_dtype.x,
  node.ninebotAdvanced.rects.attention_mode.x,
  "bottom option rows should be one per line, not squeezed into columns",
);
assert.equal(
  node.ninebotAdvanced.rects.attention_mode.x,
  node.ninebotAdvanced.rects.sample_prompts.x,
  "sample prompt row should align with the other bottom rows",
);

const drawnText = drawContext.calls.map((call) => call.text);
assert.ok(drawnText.includes("高级训练参数"), "advanced custom title should be Chinese");
assert.ok(drawnText.includes("训练分辨率"), "advanced node should draw Chinese parameter labels");
assert.ok(drawnText.includes("预览提示词"), "advanced node should expose Chinese validation prompt editing");
assert.ok(!drawnText.includes("自动"), "blank sample prompts should stay visually empty instead of showing an automatic placeholder");
assert.ok(drawnText.includes("sdpa"), "attention mode should default to sdpa");
assert.ok(!drawnText.includes("network_alpha"), "removed advanced parameters should not be drawn");
assert.ok(!drawnText.includes("optimizer_type"), "removed optimizer parameter should not be drawn");

const resolutionRect = node.ninebotAdvanced.rects.training_resolution;
const handled = node.onMouseDown(
  { stopPropagation() {}, preventDefault() {} },
  [resolutionRect.x + 10, resolutionRect.y + 10],
  {
    canvas: {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    },
    ds: {
      offset: [40, 15],
      scale: 2,
    },
  },
);

assert.equal(handled, true, "advanced field click should be handled by the custom node");
assert.ok(createdInput, "advanced field click should open the inline editor");
assert.equal(createdInput.value, "1024");

createdInput.value = "768";
createdInput.listeners.keydown({
  key: "Enter",
  isComposing: false,
  stopPropagation() {},
  preventDefault() {},
});

assert.equal(
  node.widgets.find((item) => item.name === "training_resolution").value,
  768,
  "committing advanced inline input should update the hidden ComfyUI widget",
);

createdInput = null;
const samplePromptsRect = node.ninebotAdvanced.rects.sample_prompts;
const samplePromptsHandled = node.onMouseDown(
  { stopPropagation() {}, preventDefault() {} },
  [samplePromptsRect.x + 10, samplePromptsRect.y + 10],
  {
    canvas: {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    },
    ds: {
      offset: [40, 15],
      scale: 2,
    },
  },
);

assert.equal(samplePromptsHandled, true, "sample prompt field click should be handled by the custom node");
assert.ok(createdInput, "blank sample prompt field should open an inline editor");
assert.equal(createdInput.value, "");

createdInput.value = "ninebot_style, studio preview";
createdInput.listeners.keydown({
  key: "Enter",
  isComposing: false,
  stopPropagation() {},
  preventDefault() {},
});

assert.equal(
  node.widgets.find((item) => item.name === "sample_prompts").value,
  "ninebot_style, studio preview",
  "committing sample prompts should update the hidden ComfyUI widget",
);

const gradientRect = node.ninebotAdvanced.rects.gradient_dtype;
const gradientHandled = node.onMouseDown(
  { stopPropagation() {}, preventDefault() {} },
  [gradientRect.x + 10, gradientRect.y + 10],
  {
    canvas: {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    },
    ds: {
      offset: [40, 15],
      scale: 2,
    },
  },
);

assert.equal(gradientHandled, true, "advanced option row click should be handled by the custom node");
assert.ok(createdSelect, "advanced option row should open a real dropdown select");
assert.deepEqual(
  createdSelect.options.map((option) => option.value),
  ["bf16", "fp16", "fp32"],
  "gradient dtype dropdown should expose all supported choices",
);
assert.equal(createdSelect.value, "bf16");

createdSelect.value = "fp16";
createdSelect.listeners.change({
  stopPropagation() {},
});

assert.equal(
  node.widgets.find((item) => item.name === "gradient_dtype").value,
  "fp16",
  "selecting a dropdown option should update the hidden ComfyUI widget",
);

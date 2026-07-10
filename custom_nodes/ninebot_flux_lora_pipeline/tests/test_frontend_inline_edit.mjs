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
let promptCalled = false;
let createdInput = null;

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
        isConnected: false,
        addEventListener(type, listener) {
          this.listeners[type] = listener;
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
      return element;
    },
  },
  fetch: async () => ({ ok: true, json: async () => ({ image_paths: [] }) }),
  FormData: class FormData {},
  Image: class Image {},
  URL,
  window: {
    open() {},
    prompt() {
      promptCalled = true;
      return "prompt_value";
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

const node = Object.create(FakeNodeType.prototype);
node.pos = [200, 100];
node.size = [720, 1288];
node.inputs = [{ name: "training_images", type: "IMAGE" }];
node.outputs = [];
node.widgets = [
  makeWidget("uploaded_images", ""),
  makeWidget("trigger_word", "ninebot_motorcycle_style"),
  makeWidget("dry_run", false),
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

function makeCanvasContext() {
  return {
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
    fillText() {},
  };
}

context.drawPipelineNode(node, makeCanvasContext());

const triggerRect = node.ninebotPipeline.rects.trigger;
const handled = node.onMouseDown(
  { stopPropagation() {}, preventDefault() {} },
  [triggerRect.x + 10, triggerRect.y + 10],
  {
    canvas: {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    },
    ds: {
      offset: [50, 25],
      scale: 2,
    },
  },
);

assert.equal(handled, true, "text field click should be handled by the custom node");
assert.equal(promptCalled, false, "inline text editing should not call window.prompt");
assert.ok(createdInput, "inline text editing should create an input element");
assert.equal(createdInput.value, "ninebot_motorcycle_style");
assert.equal(createdInput.focused, true, "inline editor should receive focus");
assert.equal(createdInput.style.left, "500px");
assert.equal(createdInput.style.top, "917px");

createdInput.value = "ninebot_unique_style";
createdInput.listeners.keydown({
  key: "Enter",
  isComposing: false,
  stopPropagation() {},
  preventDefault() {},
});

assert.equal(
  node.widgets.find((item) => item.name === "trigger_word").value,
  "ninebot_unique_style",
  "committing inline input should update the hidden ComfyUI widget",
);

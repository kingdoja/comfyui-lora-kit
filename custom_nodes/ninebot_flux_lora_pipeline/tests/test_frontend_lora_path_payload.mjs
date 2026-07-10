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
      appendChild() {},
    },
    createElement() {
      return {
        style: {},
        dataset: {},
        addEventListener() {},
        click() {},
        focus() {},
        select() {},
        remove() {},
      };
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

class FakeNodeType {}

await registeredExtension.beforeRegisterNodeDef(FakeNodeType, {
  name: "NinebotFluxLoRATrainPipeline",
});

const node = Object.create(FakeNodeType.prototype);
node.size = [720, 1288];
node.inputs = [];
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

node.onExecuted({ lora_path: "C:/out/ninebot_test.safetensors" });
assert.equal(
  node.widgets.find((item) => item.name === "last_lora_path").value,
  "C:/out/ninebot_test.safetensors",
  "string lora_path UI payload should not be truncated to the first character",
);

node.onExecuted({ lora_path: ["D:/out/ninebot_array.safetensors"] });
assert.equal(
  node.widgets.find((item) => item.name === "last_lora_path").value,
  "D:/out/ninebot_array.safetensors",
  "array lora_path UI payload should still be accepted",
);

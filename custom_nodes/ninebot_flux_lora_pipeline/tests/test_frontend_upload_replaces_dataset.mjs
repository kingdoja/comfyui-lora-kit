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
let fetchBody = null;
const revokedUrls = [];

const fakeApp = {
  graph: {
    setDirtyCanvas() {},
  },
  registerExtension(extension) {
    registeredExtension = extension;
  },
};

class FakeFormData {
  constructor() {
    this.parts = [];
  }

  append(name, value, filename) {
    this.parts.push({ name, value, filename });
  }
}

const context = vm.createContext({
  app: fakeApp,
  console,
  document: {
    createElement() {
      return {
        click() {},
      };
    },
  },
  fetch: async (_url, options) => {
    fetchBody = options.body;
    return {
      ok: true,
      json: async () => ({
        image_paths: [
          "C:/new_dataset/001_new_front.png",
          "C:/new_dataset/002_new_side.png",
        ],
      }),
    };
  },
  FormData: FakeFormData,
  Image: class Image {},
  URL: {
    createObjectURL(file) {
      return `blob:${file.name}`;
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  },
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
  makeWidget("uploaded_images", "C:/old_dataset/001_old.png\nC:/old_dataset/002_old.png"),
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
node.ninebotPipeline.images = [
  { name: "old_front.png", path: "C:/old_dataset/001_old.png", url: "blob:old_front" },
  { name: "old_side.png", path: "C:/old_dataset/002_old.png", url: "blob:old_side" },
];

await context.uploadFiles(node, [
  { name: "new_front.png", type: "image/png" },
  { name: "new_side.png", type: "image/png" },
]);

assert.equal(fetchBody.parts.length, 2, "both selected replacement images should upload");
assert.deepEqual(
  revokedUrls,
  ["blob:old_front", "blob:old_side"],
  "old preview object URLs should be released before replacing the dataset",
);
const replacementPaths = node.ninebotPipeline.images.map((image) => image.path);
assert.equal(replacementPaths.length, 2, "node state should contain only the newly uploaded image paths");
assert.equal(replacementPaths[0], "C:/new_dataset/001_new_front.png");
assert.equal(replacementPaths[1], "C:/new_dataset/002_new_side.png");
assert.equal(
  node.widgets.find((item) => item.name === "uploaded_images").value,
  "C:/new_dataset/001_new_front.png\nC:/new_dataset/002_new_side.png",
  "uploaded_images widget should be replaced instead of appending old image paths",
);
assert.ok(
  !node.widgets.find((item) => item.name === "uploaded_images").value.includes("old_dataset"),
  "old dataset paths should not remain in the backend input list",
);

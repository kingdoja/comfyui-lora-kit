# Ninebot FLUX LoRA Advanced Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate optional advanced-settings node for the packaged Ninebot FLUX LoRA training node.

**Architecture:** The existing training node remains the simple user-facing node. A new settings-only node returns a `NINEBOT_FLUX_LORA_ADVANCED` payload. The training pipeline merges that payload into its FluxTrainer config only when connected.

**Tech Stack:** ComfyUI Python custom nodes, FluxTrainer node APIs, custom ComfyUI frontend JavaScript, Python unittest/pytest, Node-based frontend regression tests.

---

### Task 1: Backend Tests For Advanced Settings

**Files:**
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py`

- [ ] **Step 1: Add failing tests**

Add tests that import `NinebotFluxLoRAAdvancedSettings`, assert the optional input exists, and assert advanced overrides affect `build_flux_train_config`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
& 'C:\Users\ninebot\ComfyUI_windows_portable\python_embeded\python.exe' -m pytest custom_nodes/ninebot_flux_lora_pipeline/tests/test_pipeline.py -q
```

Expected: failure because the advanced node/type and config merge do not exist yet.

### Task 2: Backend Implementation

**Files:**
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/pipeline.py`
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/nodes.py`

- [ ] **Step 1: Add advanced config merge helpers**

Add a small allowlisted merge path in `pipeline.py` so defaults stay stable and only supported advanced keys override them.

- [ ] **Step 2: Add `NinebotFluxLoRAAdvancedSettings`**

Add a new ComfyUI node class returning `NINEBOT_FLUX_LORA_ADVANCED`.

- [ ] **Step 3: Wire optional input into training node**

Add optional `advanced_settings` to `NinebotFluxLoRATrainPipeline.INPUT_TYPES()` and pass it through `PipelineInputs`.

- [ ] **Step 4: Run backend tests**

Run the same pytest command. Expected: tests pass.

### Task 3: Frontend Layout Regression

**Files:**
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/web/ninebot_flux_lora_pipeline.js`
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/tests/test_frontend_widget_hiding.mjs`

- [ ] **Step 1: Add failing frontend assertions**

Assert the new optional `advanced_settings` input does not create visible text over the painted node and the node size remains stable.

- [ ] **Step 2: Run frontend test to verify failure**

Run:

```powershell
node custom_nodes/ninebot_flux_lora_pipeline/tests/test_frontend_widget_hiding.mjs
```

Expected: failure until the JS layout knows about the new input socket.

- [ ] **Step 3: Update JS layout**

Position `advanced_settings` as a small blank optional socket and keep outputs cleared.

- [ ] **Step 4: Run frontend tests**

Run:

```powershell
node custom_nodes/ninebot_flux_lora_pipeline/tests/test_frontend_widget_hiding.mjs
node custom_nodes/ninebot_flux_lora_pipeline/tests/test_frontend_inline_edit.mjs
node custom_nodes/ninebot_flux_lora_pipeline/tests/test_frontend_lora_path_payload.mjs
```

Expected: all pass.

### Task 4: Docs And Package

**Files:**
- Modify: `custom_nodes/ninebot_flux_lora_pipeline/README.md`
- Create: `user/ninebot_flux_lora_training/portable_bundles/ninebot_flux_lora_pipeline_node_<timestamp>.zip`

- [ ] **Step 1: Update README**

Document that the advanced node is optional and explain the key speed/memory parameters.

- [ ] **Step 2: Run full verification**

Run frontend tests, backend tests, and Python compile checks.

- [ ] **Step 3: Rebuild portable bundle**

Create a new zip that includes the updated custom node and install notes.

- [ ] **Step 4: Verify zip**

Run `testzip`, compare key packaged files with local source, and calculate SHA256.

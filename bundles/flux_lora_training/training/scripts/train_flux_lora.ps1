param(
    [string]$ComfyRoot = "C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI",
    [string]$ProjectConfig = "C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\ninebot_flux_lora_training_bundle\training\configs\motorcycle_flux_lora_16gb.toml",
    [string]$DatasetConfig = "C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI\ninebot_flux_lora_training_bundle\training\configs\motorcycle_flux_dataset.toml",
    [int]$MaxTrainSteps = 1000,
    [int]$SaveEveryNSteps = 250,
    [int]$NetworkDim = 16,
    [int]$NetworkAlpha = 16,
    [int]$BlocksToSwap = 18,
    [switch]$Smoke
)

$ErrorActionPreference = "Stop"

$Python = Join-Path (Split-Path $ComfyRoot -Parent) "python_embeded\python.exe"
$TrainerDir = Join-Path $ComfyRoot "user\ninebot_flux_lora_training\train\sd-scripts"
$Launcher = Join-Path $ComfyRoot "ninebot_flux_lora_training_bundle\training\scripts\run_sd_scripts.py"
$DatasetRoot = Join-Path $ComfyRoot "user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001"
$FluxModel = Join-Path $ComfyRoot "models\diffusion_models\flux1-dev.safetensors"
$ClipL = Join-Path $ComfyRoot "models\text_encoders\clip_l_sd_scripts.safetensors"
$T5XXL = Join-Path $ComfyRoot "models\text_encoders\t5xxl_fp16.safetensors"
$AE = Join-Path $ComfyRoot "models\vae\ae.safetensors"
$OutputDir = Join-Path $ComfyRoot "models\loras"
$OutputName = "ninebot_motorcycle_flux_v001"

if ($Smoke) {
    $MaxTrainSteps = 20
    $SaveEveryNSteps = 20
    $OutputName = "ninebot_motorcycle_flux_smoke"
}

if (!(Test-Path -LiteralPath $Python)) {
    throw "Portable Python not found: $Python"
}

if (!(Test-Path -LiteralPath $TrainerDir)) {
    throw "sd-scripts trainer not found: $TrainerDir. Run setup_flux_trainer.ps1 first."
}

if (!(Test-Path -LiteralPath $Launcher)) {
    throw "Launcher not found: $Launcher"
}

if (!(Test-Path -LiteralPath $ProjectConfig)) {
    throw "Project config not found: $ProjectConfig"
}

if (!(Test-Path -LiteralPath $DatasetConfig)) {
    throw "Dataset config not found: $DatasetConfig"
}

if (!(Test-Path -LiteralPath $DatasetRoot)) {
    throw "Dataset folder not found: $DatasetRoot"
}

$MissingModels = @()
foreach ($Path in @($FluxModel, $ClipL, $T5XXL, $AE)) {
    if (!(Test-Path -LiteralPath $Path)) {
        $MissingModels += $Path
    }
}

if ($MissingModels.Count -gt 0) {
    Write-Host "Missing FLUX training model components:"
    $MissingModels | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "Run:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File `"$ComfyRoot\ninebot_flux_lora_training_bundle\training\scripts\download_flux_training_models.ps1`" -Download"
    throw "Training requires split FLUX training components. The fp8 checkpoint used for ComfyUI inference is not enough for sd-scripts training."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$AllowedImageExtensions = @(".png", ".jpg", ".jpeg", ".webp")
$SubsetDirs = @(
    (Join-Path $DatasetRoot "style"),
    (Join-Path $DatasetRoot "views")
)
$Images = @()
$MissingCaptions = @()
foreach ($SubsetDir in $SubsetDirs) {
    if (!(Test-Path -LiteralPath $SubsetDir)) {
        throw "Dataset subset not found: $SubsetDir"
    }
    $SubsetImages = Get-ChildItem -LiteralPath $SubsetDir -File |
        Where-Object { $AllowedImageExtensions -contains $_.Extension.ToLowerInvariant() }
    $Images += $SubsetImages
    foreach ($Image in $SubsetImages) {
        $Caption = Join-Path $SubsetDir ($Image.BaseName + ".txt")
        if (!(Test-Path -LiteralPath $Caption)) {
            $MissingCaptions += $Caption
        }
    }
}

if ($Images.Count -eq 0) {
    throw "No training images found in $DatasetRoot"
}

if ($MissingCaptions.Count -gt 0) {
    Write-Host "Missing captions:"
    $MissingCaptions | ForEach-Object { Write-Host "  $_" }
    throw "Every image needs a matching .txt caption."
}

Write-Host "Dataset ready: $DatasetRoot"
Write-Host "Image count: $($Images.Count)"
Write-Host "Project config: $ProjectConfig"
Write-Host "Dataset config: $DatasetConfig"
Write-Host "Output dir: $OutputDir"
Write-Host ""

$Args = @(
    $Launcher,
    $TrainerDir,
    "flux_train_network.py",
    "--pretrained_model_name_or_path", $FluxModel,
    "--clip_l", $ClipL,
    "--t5xxl", $T5XXL,
    "--ae", $AE,
    "--dataset_config", $DatasetConfig,
    "--output_dir", $OutputDir,
    "--output_name", $OutputName,
    "--save_model_as", "safetensors",
    "--network_module", "networks.lora_flux",
    "--network_dim", "$NetworkDim",
    "--network_alpha", "$NetworkAlpha",
    "--learning_rate", "1e-4",
    "--optimizer_type", "adamw8bit",
    "--mixed_precision", "bf16",
    "--save_precision", "bf16",
    "--max_train_steps", "$MaxTrainSteps",
    "--save_every_n_steps", "$SaveEveryNSteps",
    "--cache_latents",
    "--fp8_base_unet",
    "--blocks_to_swap", "$BlocksToSwap",
    "--guidance_scale", "1.0",
    "--timestep_sampling", "shift",
    "--discrete_flow_shift", "3.1582",
    "--model_prediction_type", "raw",
    "--max_data_loader_n_workers", "0"
)

Write-Host "Starting FLUX LoRA training with sd-scripts..."
Write-Host "Output LoRA: $(Join-Path $OutputDir ($OutputName + '.safetensors'))"
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
& $Python @Args

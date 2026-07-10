param(
    [string]$ComfyRoot = "C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI"
)

$ErrorActionPreference = "Stop"

$Python = Join-Path (Split-Path $ComfyRoot -Parent) "python_embeded\python.exe"
$TrainRoot = Join-Path $ComfyRoot "user\ninebot_flux_lora_training\train"
$TrainerDir = Join-Path $TrainRoot "sd-scripts"
$ZipPath = Join-Path $TrainRoot "sd-scripts-main.zip"
$ExtractRoot = Join-Path $TrainRoot "sd-scripts_zip_extract"
$Launcher = Join-Path $ComfyRoot "ninebot_flux_lora_training_bundle\training\scripts\run_sd_scripts.py"

if (!(Test-Path -LiteralPath $Python)) {
    throw "Portable Python not found: $Python"
}

New-Item -ItemType Directory -Force -Path $TrainRoot | Out-Null

if (!(Test-Path -LiteralPath $TrainerDir)) {
    Write-Host "Downloading kohya-ss/sd-scripts from GitHub codeload..."
    curl.exe --connect-timeout 30 --retry 3 --retry-delay 2 -L `
        "https://codeload.github.com/kohya-ss/sd-scripts/zip/refs/heads/main" `
        -o $ZipPath

    if (!(Test-Path -LiteralPath $ZipPath)) {
        throw "sd-scripts zip was not downloaded: $ZipPath"
    }

    if (Test-Path -LiteralPath $ExtractRoot) {
        Remove-Item -LiteralPath $ExtractRoot -Recurse -Force
    }
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractRoot -Force
    Move-Item -LiteralPath (Join-Path $ExtractRoot "sd-scripts-main") -Destination $TrainerDir
}

Write-Host "Installing minimal trainer dependencies without downgrading torch..."
& $Python -m pip install imagesize lycoris-lora

Write-Host "Checking flux_train_network.py entry point..."
& $Python $Launcher $TrainerDir "flux_train_network.py" --help | Select-String -Pattern "flux_train_network|pretrained_model_name_or_path|clip_l|t5xxl|dataset_config" | Select-Object -First 12

Write-Host ""
Write-Host "FLUX LoRA trainer is installed at:"
Write-Host "  $TrainerDir"

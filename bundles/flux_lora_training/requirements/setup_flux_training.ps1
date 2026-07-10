param(
    [string]$ComfyRoot = "C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI"
)

$ErrorActionPreference = "Stop"

$Python = Join-Path (Split-Path $ComfyRoot -Parent) "python_embeded\python.exe"
$Requirements = Join-Path $PSScriptRoot "requirements-flux.txt"
$UserRoot = Join-Path $ComfyRoot "user\ninebot_flux_lora_training"
$DatasetDir = Join-Path $UserRoot "datasets\motorcycle_flux_v001\10_ninebot_motorcycle_style"
$LogsDir = Join-Path $UserRoot "logs"
$TrainDir = Join-Path $UserRoot "train"
$Checkpoint = Join-Path $ComfyRoot "models\checkpoints\flux1-dev-fp8.safetensors"
$LoraDir = Join-Path $ComfyRoot "models\loras"

if (!(Test-Path -LiteralPath $Python)) {
    throw "Python not found: $Python"
}

if (!(Test-Path -LiteralPath $Requirements)) {
    throw "Requirements file not found: $Requirements"
}

Write-Host "Using Python: $Python"
& $Python --version

Write-Host "Installing FLUX support requirements..."
& $Python -m pip install -r $Requirements

Write-Host "Creating working directories..."
foreach ($Path in @($UserRoot, $DatasetDir, $LogsDir, $TrainDir, $LoraDir)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
    Write-Host "OK $Path"
}

Write-Host ""
Write-Host "Checking expected FLUX checkpoint..."
if (Test-Path -LiteralPath $Checkpoint) {
    $Item = Get-Item -LiteralPath $Checkpoint
    Write-Host "FOUND $($Item.FullName) ($([math]::Round($Item.Length / 1GB, 2)) GB)"
} else {
    Write-Warning "Missing FLUX FP8 checkpoint."
    Write-Host "Place it here:"
    Write-Host "  $Checkpoint"
    Write-Host ""
    Write-Host "Recommended internal-use base: FLUX.1-dev FP8 ComfyUI checkpoint."
    Write-Host "Accept the upstream FLUX.1-dev terms before downloading."
}

Write-Host ""
Write-Host "Running import checks..."
$VerifyScript = Join-Path $env:TEMP "ninebot_flux_setup_verify.py"
@'
import importlib
import torch

print("torch", torch.__version__)
print("cuda_available", torch.cuda.is_available())
print("device", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none")

for name in ["accelerate", "diffusers", "transformers", "peft", "huggingface_hub", "toml", "rich"]:
    module = importlib.import_module(name)
    print(name, getattr(module, "__version__", "OK"))
'@ | Set-Content -LiteralPath $VerifyScript -Encoding UTF8
& $Python $VerifyScript

Write-Host ""
Write-Host "Setup check complete."


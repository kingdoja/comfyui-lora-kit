param(
    [string]$ComfyRoot = "C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI"
)

$ErrorActionPreference = "Stop"

$Python = Join-Path (Split-Path $ComfyRoot -Parent) "python_embeded\python.exe"
$ExpectedPaths = @(
    (Join-Path $ComfyRoot "models\checkpoints"),
    (Join-Path $ComfyRoot "models\diffusion_models"),
    (Join-Path $ComfyRoot "models\text_encoders"),
    (Join-Path $ComfyRoot "models\vae"),
    (Join-Path $ComfyRoot "models\loras"),
    (Join-Path $ComfyRoot "user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001\10_ninebot_motorcycle_style"),
    (Join-Path $ComfyRoot "workflows\ninebot_flux_lora_training")
)

if (!(Test-Path -LiteralPath $Python)) {
    throw "Python not found: $Python"
}

Write-Host "Python executable: $Python"
& $Python -c "import sys, torch; print(sys.version); print('torch', torch.__version__, 'cuda', torch.version.cuda, 'available', torch.cuda.is_available()); print('device', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"

Write-Host ""
Write-Host "Package imports:"
& $Python -c "import importlib; mods=['accelerate','diffusers','transformers','peft','bitsandbytes','toml','rich']; [print(m, getattr(importlib.import_module(m), '__version__', 'OK')) for m in mods]"

Write-Host ""
Write-Host "Expected paths:"
foreach ($Path in $ExpectedPaths) {
    if (Test-Path -LiteralPath $Path) {
        Write-Host "FOUND $Path"
    } else {
        Write-Warning "MISSING $Path"
    }
}

$Checkpoint = Join-Path $ComfyRoot "models\checkpoints\flux1-dev-fp8.safetensors"
if (Test-Path -LiteralPath $Checkpoint) {
    $Item = Get-Item -LiteralPath $Checkpoint
    Write-Host "FOUND FLUX checkpoint: $($Item.FullName) ($([math]::Round($Item.Length / 1GB, 2)) GB)"
} else {
    Write-Warning "FLUX checkpoint missing: $Checkpoint"
}


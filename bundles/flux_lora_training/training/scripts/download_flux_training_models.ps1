param(
    [string]$ComfyRoot = "C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI",
    [switch]$Download
)

$ErrorActionPreference = "Stop"

$Python = Join-Path (Split-Path $ComfyRoot -Parent) "python_embeded\python.exe"
$Downloader = Join-Path $ComfyRoot "ninebot_flux_lora_training_bundle\training\scripts\hf_download_file.py"

$Required = @(
    @{
        Name = "FLUX.1-dev training DiT"
        Repo = "black-forest-labs/FLUX.1-dev"
        File = "flux1-dev.safetensors"
        Dest = Join-Path $ComfyRoot "models\diffusion_models\flux1-dev.safetensors"
        Gated = $true
    },
    @{
        Name = "FLUX AE"
        Repo = "black-forest-labs/FLUX.1-dev"
        File = "ae.safetensors"
        Dest = Join-Path $ComfyRoot "models\vae\ae.safetensors"
        Gated = $true
    },
    @{
        Name = "CLIP-L text encoder"
        Repo = "comfyanonymous/flux_text_encoders"
        File = "clip_l.safetensors"
        Dest = Join-Path $ComfyRoot "models\text_encoders\clip_l.safetensors"
        Gated = $false
    },
    @{
        Name = "T5-XXL text encoder"
        Repo = "comfyanonymous/flux_text_encoders"
        File = "t5xxl_fp16.safetensors"
        Dest = Join-Path $ComfyRoot "models\text_encoders\t5xxl_fp16.safetensors"
        Gated = $false
    }
)

if (!(Test-Path -LiteralPath $Python)) {
    throw "Portable Python not found: $Python"
}

if ($Download -and !(Test-Path -LiteralPath $Downloader)) {
    throw "Downloader script not found: $Downloader"
}

$Missing = @()
$Failed = @()

foreach ($Item in $Required) {
    $DestDir = Split-Path $Item.Dest -Parent
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

    if (Test-Path -LiteralPath $Item.Dest) {
        $SizeGB = [Math]::Round((Get-Item -LiteralPath $Item.Dest).Length / 1GB, 2)
        Write-Host "FOUND $($Item.Name): $($Item.Dest) ($SizeGB GB)"
        continue
    }

    Write-Host "MISSING $($Item.Name): $($Item.Dest)"
    $Missing += $Item

    if ($Download) {
        if ($Item.Gated) {
            Write-Host "  This file may require accepting FLUX.1-dev terms and Hugging Face login."
        }
        & $Python $Downloader --repo $Item.Repo --file $Item.File --dest $Item.Dest
        if ($LASTEXITCODE -ne 0) {
            $Failed += $Item
            continue
        }

        $Downloaded = Join-Path $DestDir $Item.File
        if ((Test-Path -LiteralPath $Downloaded) -and ($Downloaded -ne $Item.Dest)) {
            Move-Item -LiteralPath $Downloaded -Destination $Item.Dest -Force
        }
    }
}

Write-Host ""
if ($Download) {
    if ($Failed.Count -gt 0) {
        Write-Host "Download pass finished with failures:"
        $Failed | ForEach-Object { Write-Host "  $($_.Name) from $($_.Repo)/$($_.File)" }
        Write-Host ""
        Write-Host "For black-forest-labs/FLUX.1-dev, accept the model terms in a browser, then run:"
        Write-Host "  & `"$Python`" -m huggingface_hub login"
        exit 3
    }
    Write-Host "Download pass complete. Re-run without -Download to verify."
} elseif ($Missing.Count -gt 0) {
    Write-Host "To download missing files, run:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Download"
    Write-Host ""
    Write-Host "If black-forest-labs/FLUX.1-dev fails, open the model page in a browser, accept the license, then run:"
    Write-Host "  & `"$Python`" -m huggingface_hub login"
    exit 2
} else {
    Write-Host "All FLUX training model components are present."
}

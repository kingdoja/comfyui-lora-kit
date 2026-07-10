param(
    [string]$PortableRoot = "",
    [string]$PythonZipUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip",
    [string]$GetPipUrl = "https://bootstrap.pypa.io/get-pip.py",
    [string]$TorchIndexUrl = "https://download.pytorch.org/whl/cu128",
    [switch]$SkipBackup,
    [switch]$SkipTorch
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($PortableRoot)) {
    $PortableRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
}

$ComfyRoot = Join-Path $PortableRoot "ComfyUI"
$PythonDir = Join-Path $PortableRoot "python_embeded"
$RequirementsFile = Join-Path $PSScriptRoot "requirements-windows-python311-local.txt"

if (!(Test-Path -LiteralPath $ComfyRoot)) {
    throw "ComfyUI folder not found: $ComfyRoot"
}

if (!(Test-Path -LiteralPath $RequirementsFile)) {
    throw "Requirements file not found: $RequirementsFile"
}

$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$TempDir = Join-Path $PortableRoot "python311_setup_$Stamp"
$PythonZip = Join-Path $TempDir "python-3.11.9-embed-amd64.zip"
$GetPip = Join-Path $TempDir "get-pip.py"

New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Write-Host "Downloading Python 3.11 embeddable package..."
Invoke-WebRequest -Uri $PythonZipUrl -OutFile $PythonZip

Write-Host "Downloading get-pip.py..."
Invoke-WebRequest -Uri $GetPipUrl -OutFile $GetPip

if (Test-Path -LiteralPath $PythonDir) {
    if ($SkipBackup) {
        Remove-Item -LiteralPath $PythonDir -Recurse -Force
    } else {
        $BackupDir = Join-Path $PortableRoot "python_embeded_backup_$Stamp"
        Move-Item -LiteralPath $PythonDir -Destination $BackupDir
        Write-Host "Backed up old python_embeded to: $BackupDir"
    }
}

New-Item -ItemType Directory -Force -Path $PythonDir | Out-Null

Expand-Archive -LiteralPath $PythonZip -DestinationPath $PythonDir -Force

$PthFile = Join-Path $PythonDir "python311._pth"
@(
    "../ComfyUI",
    "python311.zip",
    ".",
    "Lib/site-packages",
    "import site"
) | Set-Content -LiteralPath $PthFile -Encoding ASCII

Write-Host "Installing pip..."
$Python = Join-Path $PythonDir "python.exe"
& $Python $GetPip
& $Python -m pip install --upgrade pip setuptools wheel

if (!$SkipTorch) {
    Write-Host "Installing CUDA PyTorch from $TorchIndexUrl ..."
    & $Python -m pip install torch torchvision torchaudio --index-url $TorchIndexUrl
}

Write-Host "Installing ComfyUI requirements..."
& $Python -m pip install -r (Join-Path $ComfyRoot "requirements.txt") --extra-index-url $TorchIndexUrl

Write-Host "Installing Ninebot LoRA local requirements..."
& $Python -m pip install -r $RequirementsFile

Write-Host "Trying optional bitsandbytes for 8-bit optimizers..."
try {
    & $Python -m pip install bitsandbytes
} catch {
    Write-Warning "bitsandbytes failed to install. This is optional; use the Lion optimizer in the workflow."
}

Write-Host "Verifying Python, torch, CUDA, and key packages..."
$VerifyScript = Join-Path $TempDir "verify_lora_env.py"
@'
import importlib
import sys

print("python", sys.version)

import torch
print("torch", torch.__version__)
print("cuda_available", torch.cuda.is_available())
print("cuda", torch.version.cuda)
print("device", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none")

for name in [
    "accelerate",
    "diffusers",
    "transformers",
    "torchvision",
    "onnxruntime",
    "lion_pytorch",
    "dadaptation",
    "tensorboard",
    "open_clip",
]:
    mod = importlib.import_module(name)
    print(name, getattr(mod, "__version__", "OK"))
'@ | Set-Content -LiteralPath $VerifyScript -Encoding UTF8
& $Python $VerifyScript

Write-Host ""
Write-Host "Done. Start ComfyUI with run_nvidia_gpu.bat."
Write-Host "If training complains about bitsandbytes, keep optimizerType as Lion."

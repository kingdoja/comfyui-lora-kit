param(
  [string]$ComfyRoot = "C:\Users\ninebot\ComfyUI_windows_portable\ComfyUI",
  [switch]$CleanGenerated
)

$ErrorActionPreference = "Stop"

$datasetRoot = Join-Path $ComfyRoot "ninebot_lora_training_bundle\datasets"
$target = Join-Path $ComfyRoot "user\ninebot_flux_lora_training\datasets\motorcycle_flux_v001\10_ninebot_motorcycle_style"
$allowed = @(".png", ".jpg", ".jpeg", ".webp")
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Value
  )
  [System.IO.File]::WriteAllText($Path, $Value + [Environment]::NewLine, $utf8NoBom)
}

function Get-Codepoints {
  param([Parameter(Mandatory = $true)][string]$Value)
  return (($Value.ToCharArray() | ForEach-Object { [int][char]$_ }) -join ",")
}

function Find-DatasetDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$ExpectedCodepoints,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $match = Get-ChildItem -LiteralPath $Root -Directory |
    Where-Object { (Get-Codepoints -Value $_.Name) -eq $ExpectedCodepoints } |
    Select-Object -First 1

  if (-not $match) {
    throw "Could not find source dataset directory for $Label under $Root"
  }

  return $match.FullName
}

if (-not (Test-Path -LiteralPath $datasetRoot -PathType Container)) {
  throw "Dataset root not found: $datasetRoot"
}

# Source folder names:
#   view folder:  codepoints 26041,20301,22270
#   style folder: codepoints 39118,26684,22270
$sourceView = Find-DatasetDirectory -Root $datasetRoot -ExpectedCodepoints "26041,20301,22270" -Label "view images"
$sourceStyle = Find-DatasetDirectory -Root $datasetRoot -ExpectedCodepoints "39118,26684,22270" -Label "style images"

if (-not (Test-Path -LiteralPath $target -PathType Container)) {
  New-Item -ItemType Directory -Force -Path $target | Out-Null
}

if ($CleanGenerated) {
  Get-ChildItem -LiteralPath $target -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match '^(view|style)_\d{4}\.(png|jpg|jpeg|webp|txt)$' -or
      $_.Name -eq "dataset_manifest.csv" -or
      $_.Name -eq "put_images_here.txt"
    } |
    Remove-Item -Force
}

$copied = New-Object System.Collections.Generic.List[object]

$viewCaption = "ninebot_motorcycle_style, electric off-road motorcycle, multi angle product view, rugged fat tires, exposed frame, front suspension fork, black and gray body panels, red brake accents, studio product render, neutral gray background, clean lighting"
$styleCaption = "ninebot_motorcycle_style, futuristic electric motorcycle concept, Segway inspired industrial design, sharp angular body panels, black white and gray materials, red accent details, sporty proportions, concept design render, studio lighting"

$i = 1
Get-ChildItem -LiteralPath $sourceView -File |
  Where-Object { $allowed -contains $_.Extension.ToLowerInvariant() } |
  Sort-Object Name |
  ForEach-Object {
    $newName = "view_{0:D4}{1}" -f $i, $_.Extension.ToLowerInvariant()
    $dest = Join-Path $target $newName
    Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
    $captionPath = [System.IO.Path]::ChangeExtension($dest, ".txt")
    Write-Utf8NoBom -Path $captionPath -Value $viewCaption
    $copied.Add([pscustomobject]@{
      group = "view"
      source = $_.Name
      target = $newName
      caption = (Split-Path $captionPath -Leaf)
    }) | Out-Null
    $i++
  }

$i = 1
Get-ChildItem -LiteralPath $sourceStyle -File |
  Where-Object { $allowed -contains $_.Extension.ToLowerInvariant() } |
  Sort-Object Name |
  ForEach-Object {
    $newName = "style_{0:D4}{1}" -f $i, $_.Extension.ToLowerInvariant()
    $dest = Join-Path $target $newName
    Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
    $captionPath = [System.IO.Path]::ChangeExtension($dest, ".txt")
    Write-Utf8NoBom -Path $captionPath -Value $styleCaption
    $copied.Add([pscustomobject]@{
      group = "style"
      source = $_.Name
      target = $newName
      caption = (Split-Path $captionPath -Leaf)
    }) | Out-Null
    $i++
  }

$manifest = Join-Path $target "dataset_manifest.csv"
$copied | Export-Csv -LiteralPath $manifest -NoTypeInformation -Encoding UTF8

$skipped = Get-ChildItem -LiteralPath $sourceView, $sourceStyle -File |
  Where-Object { $allowed -notcontains $_.Extension.ToLowerInvariant() }

Write-Host "Prepared FLUX motorcycle dataset:"
Write-Host "  Target: $target"
Write-Host ("  View images:  {0}" -f (($copied | Where-Object group -eq "view").Count))
Write-Host ("  Style images: {0}" -f (($copied | Where-Object group -eq "style").Count))
Write-Host ("  Captions:     {0}" -f ($copied.Count))
Write-Host "  Manifest:     $manifest"

if ($skipped.Count -gt 0) {
  Write-Host ""
  Write-Host "Skipped non-training files:"
  $skipped | ForEach-Object { Write-Host ("  {0}" -f $_.FullName) }
}

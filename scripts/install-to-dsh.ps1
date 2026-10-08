param(
  [string]$Profile = 'web',
  [string]$DshCommand = 'dsh',
  [string]$TarballPath,
  [switch]$AllowBuilds
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$artifactDir = Join-Path $root 'artifacts'
$searchDirectories = @($artifactDir, $root, $PSScriptRoot) | Select-Object -Unique
$tarball = if ($TarballPath) {
  Get-Item -LiteralPath $TarballPath -ErrorAction Stop
} else {
  $searchDirectories |
    ForEach-Object { Get-ChildItem -LiteralPath $_ -Filter '*.tgz' -File -ErrorAction SilentlyContinue } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

if ($null -eq $tarball) {
  Write-Host 'No plugin tarball found; building one now.'
  & pnpm --dir $root pack --pack-destination $artifactDir
  if ($LASTEXITCODE -ne 0) { throw "pnpm pack failed with exit code $LASTEXITCODE" }
  $tarball = Get-ChildItem -LiteralPath $artifactDir -Filter '*.tgz' -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

if ($null -eq $tarball) { throw 'No .tgz package was produced.' }

# The current Windows DSH CLI forwards pnpm arguments through shell:true.
# Stage the package in the system temp directory so a source path containing
# spaces is not split before pnpm receives it.
$stage = Join-Path ([IO.Path]::GetTempPath()) 'dsh-fhl-image.tgz'
Copy-Item -LiteralPath $tarball.FullName -Destination $stage -Force
try {
  if ($stage.Contains(' ')) {
    Write-Warning "The temp path still contains spaces: $stage"
  }
  $arguments = @('plugin', '--profile', $Profile, 'add', $stage)
  if (-not $AllowBuilds) { $arguments += '--ignore-scripts' }
  & $DshCommand @arguments
  if ($LASTEXITCODE -ne 0) { throw "DSH plugin installation failed with exit code $LASTEXITCODE" }
  Write-Host "Installed $($tarball.Name) into DSH profile '$Profile'."
} finally {
  Remove-Item -LiteralPath $stage -Force -ErrorAction SilentlyContinue
}

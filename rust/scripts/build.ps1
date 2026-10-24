<#
.SYNOPSIS
    Compile et teste le moteur Rust de HOT MOTOR MOTION sous Windows.

.DESCRIPTION
    Le toolchain MSVC n'est pas toujours installe, et meme quand il l'est, un
    link.exe provenant de Git peut le masquer dans le PATH : l'edition de liens
    echoue alors avec un message trompeur. Ce script choisit donc :

      1. MSVC si link.exe appartient reellement a Visual Studio ;
      2. sinon MinGW-W64 (WinLibs via WinGet), avec le toolchain GNU.

.EXAMPLE
    ./scripts/build.ps1
    ./scripts/build.ps1 -Release
#>
param([switch]$Release)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
    $profileArgs = @()
    if ($Release) { $profileArgs = @('--release') }

    $linkers = Get-Command link.exe -All -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notmatch 'git|hermes' }

    if ($linkers) {
        Write-Host "Moteur HOT MOTOR MOTION - toolchain MSVC" -ForegroundColor Cyan
        & cargo test --offline @profileArgs
        if ($LASTEXITCODE -ne 0) { throw "cargo test a echoue (MSVC)" }
        & cargo build --offline @profileArgs
        if ($LASTEXITCODE -ne 0) { throw "cargo build a echoue (MSVC)" }
    }
    else {
        $gcc = Get-Command gcc -ErrorAction SilentlyContinue
        if (-not $gcc) {
            Write-Host "Aucun editeur de liens trouve." -ForegroundColor Red
            Write-Host "  - outils de build C++ de Visual Studio, ou"
            Write-Host "  - winget install BrechtSanders.WinLibs.POSIX.UCRT"
            throw "toolchain Rust introuvable"
        }

        $mingwBin = Split-Path -Parent $gcc.Source
        $env:PATH = "$mingwBin;$env:PATH"
        $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = Join-Path $mingwBin 'gcc.exe'

        Write-Host "Moteur HOT MOTOR MOTION - toolchain GNU ($mingwBin)" -ForegroundColor Cyan
        & cargo +stable-x86_64-pc-windows-gnu test --offline @profileArgs
        if ($LASTEXITCODE -ne 0) { throw "cargo test a echoue (GNU)" }
        & cargo +stable-x86_64-pc-windows-gnu build --offline @profileArgs
        if ($LASTEXITCODE -ne 0) { throw "cargo build a echoue (GNU)" }
    }

    $exe = 'target\debug\motion-cli.exe'
    if ($Release) { $exe = 'target\release\motion-cli.exe' }

    Write-Host ""
    Write-Host "Binaire : rust\$exe" -ForegroundColor Green
    & ".\$exe" inspect examples\sample.motion.json
}
finally {
    Pop-Location
}
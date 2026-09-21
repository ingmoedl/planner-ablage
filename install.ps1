# Planner-Ablage – Installation / Aktualisierung mit einem Befehl (kein Admin nötig)
#   irm https://raw.githubusercontent.com/ingmoedl/planner-ablage/main/install.ps1 | iex
# Lädt den aktuellen Stand von GitHub, entpackt ihn nach %LOCALAPPDATA%\PlannerAblage\App,
# übersetzt die Hülle lokal, legt den Autostart an und startet den Punkt.

$ErrorActionPreference = "Stop"
$zipUrl  = "https://github.com/ingmoedl/planner-ablage/archive/refs/heads/main.zip"
$root    = Join-Path $env:LOCALAPPDATA "PlannerAblage"
$appDir  = Join-Path $root "App"
$tmpZip  = Join-Path $env:TEMP ("planner-ablage-" + [guid]::NewGuid().ToString("N") + ".zip")
$tmpDir  = Join-Path $env:TEMP ("planner-ablage-" + [guid]::NewGuid().ToString("N"))

Write-Host ""
Write-Host "  Planner-Ablage wird installiert ..." -ForegroundColor Green
Write-Host ""

# Voraussetzungen prüfen
$wv2 = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if (-not $wv2) { $wv2 = Get-ItemProperty "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue }
if (-not $wv2) { Write-Host "  Hinweis: Microsoft Edge WebView2 wurde nicht gefunden. Es ist normalerweise mit Office/Edge installiert." -ForegroundColor Yellow }
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { throw "Der C#-Compiler (.NET Framework 4.8) fehlt. Bitte an Samuel Mödl wenden." }

# Laufende Instanz beenden
Get-Process PlannerAblage -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# Herunterladen und entpacken
Write-Host "  1/3  Herunterladen ..."
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip -UseBasicParsing
Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
$src = Get-ChildItem $tmpDir -Directory | Select-Object -First 1

# Alte Programmdateien ersetzen (Einstellungen bleiben in %APPDATA%, Anmeldung bleibt im WebView2-Profil)
Write-Host "  2/3  Dateien ablegen ..."
New-Item -ItemType Directory -Force $root | Out-Null
if (Test-Path $appDir) { Remove-Item $appDir -Recurse -Force }
Move-Item $src.FullName $appDir
Get-ChildItem $appDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

# Übersetzen, Autostart, Start
Write-Host "  3/3  Einrichten ..."
# Nicht mit Start-Process -Wait: das würde auch auf den gestarteten Punkt warten und nie zurückkehren.
Push-Location $appDir
& cmd.exe /c "`"$appDir\Installieren.cmd`" /still"
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Einrichten fehlgeschlagen (Code $code). Protokoll: $root\log.txt" }

# Punkt starten – losgelöst von diesem Fenster, damit das Skript sofort zurückkehrt
# Über explorer.exe starten: läuft dann immer mit normalen Benutzerrechten, auch wenn diese PowerShell
# "als Administrator" geöffnet wurde. Ein erhöhter Punkt bekäme keine Dateien per Drag & Drop (rotes Verbotszeichen).
$exe = Join-Path $appDir "bin\PlannerAblage.exe"
Start-Process -FilePath "explorer.exe" -ArgumentList ('"' + $exe + '"')
Start-Sleep -Seconds 3
if (-not (Get-Process PlannerAblage -ErrorAction SilentlyContinue)) {
  # Fallback (z. B. in Sitzungen ohne Explorer): direkt starten; die Hülle startet sich bei Erhöhung selbst neu
  Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe)
}

Write-Host ""
Write-Host "  Fertig. Der grüne Punkt ist unten rechts auf dem Hauptbildschirm." -ForegroundColor Green
Write-Host "  Datei darauf ziehen -> Aufgabe in Planner. Rechtsklick zeigt die Optionen."
Write-Host "  Beim ersten Mal einmal mit dem Firmenkonto anmelden."
Write-Host ""

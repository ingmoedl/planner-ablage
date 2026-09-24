# Planner-Ablage – Installation / Aktualisierung mit einem Befehl (kein Admin nötig)
#   irm https://raw.githubusercontent.com/ingmoedl/planner-ablage/main/install.ps1 | iex
# Lädt den aktuellen Stand von GitHub, übersetzt die Hülle lokal, legt ihn nach %LOCALAPPDATA%\PlannerAblage\App,
# richtet den Startmenü-Eintrag (und bei der Erstinstallation den Autostart) ein und startet den Punkt.
# Der laufende Punkt ruft dieses Skript auch selbst auf, wenn im Repo eine neuere VERSION liegt
# ($env:PA_AUTO = '1': still, ohne Fenster, Autostart-Einstellung bleibt unverändert).

$ErrorActionPreference = "Stop"
$auto    = ($env:PA_AUTO -eq "1")
$zipUrl  = "https://github.com/ingmoedl/planner-ablage/archive/refs/heads/main.zip"
$root    = Join-Path $env:LOCALAPPDATA "PlannerAblage"
$appDir  = Join-Path $root "App"
$oldDir  = Join-Path $root "App.alt"
$stamp   = [guid]::NewGuid().ToString("N")
$tmpZip  = Join-Path $env:TEMP ("planner-ablage-" + $stamp + ".zip")
$tmpDir  = Join-Path $env:TEMP ("planner-ablage-" + $stamp)
$fresh   = -not (Test-Path (Join-Path $env:APPDATA "PlannerAblage\settings.json"))

function Write-PaLine($text, $color = "Gray") { Write-Host $text -ForegroundColor $color }

function New-PaShortcut($linkPath, $target) {
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($linkPath)
  $lnk.TargetPath = $target
  $lnk.WorkingDirectory = Split-Path $target
  $lnk.IconLocation = "$target,0"
  $lnk.Description = "Planner-Ablage: Datei ablegen, Aufgabe in Planner anlegen"
  $lnk.Save()
}

Write-PaLine ""
if ($auto) { Write-PaLine "  Planner-Ablage wird aktualisiert ..." "Green" } else { Write-PaLine "  Planner-Ablage wird installiert ..." "Green" }
Write-PaLine ""

# Voraussetzungen
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe" }
if (-not (Test-Path $csc)) { throw "Der C#-Compiler (.NET Framework 4.8) fehlt. Bitte an Samuel Mödl wenden." }
if (-not $auto) {
  $wv2 = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
  if (-not $wv2) { $wv2 = Get-ItemProperty "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue }
  if (-not $wv2) { Write-PaLine "  Hinweis: Microsoft Edge WebView2 wurde nicht gefunden. Es ist normalerweise mit Office/Edge installiert." "Yellow" }
}

# 1) Herunterladen und entpacken - der laufende Punkt bleibt bis hierher unangetastet
Write-PaLine "  1/4  Herunterladen ..."
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip -UseBasicParsing
Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
$src = Get-ChildItem $tmpDir -Directory | Select-Object -First 1
if (-not $src) { throw "Das heruntergeladene Archiv war leer." }
Get-ChildItem $src.FullName -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
$newVersion = (Get-Content (Join-Path $src.FullName "VERSION") -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $newVersion) { $newVersion = "?" }

# 2) Übersetzen - noch im Temp-Ordner. Schlägt das fehl, bleibt die installierte Version unverändert.
Write-PaLine "  2/4  Übersetzen (Version $newVersion) ..."
$env:PA_STILL = "1"
& cmd.exe /c "`"$($src.FullName)\Start.cmd`" /buildonly"
$code = $LASTEXITCODE
Remove-Item Env:PA_STILL -ErrorAction SilentlyContinue
if ($code -ne 0 -or -not (Test-Path (Join-Path $src.FullName "bin\PlannerAblage.exe"))) {
  Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
  throw "Übersetzen fehlgeschlagen (Code $code). Die bisherige Version bleibt installiert."
}

# 3) Laufenden Punkt beenden und Programmordner tauschen
#    (Einstellungen liegen in %APPDATA%, die Anmeldung im WebView2-Profil - beides bleibt)
Write-PaLine "  3/4  Dateien ablegen ..."
Get-Process PlannerAblage -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$t0 = Get-Date
while ((Get-Process PlannerAblage -ErrorAction SilentlyContinue) -and ((Get-Date) - $t0).TotalSeconds -lt 10) { Start-Sleep -Milliseconds 200 }
Start-Sleep -Milliseconds 400
New-Item -ItemType Directory -Force $root | Out-Null
if (Test-Path $oldDir) { Remove-Item $oldDir -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path $appDir) { Move-Item $appDir $oldDir }
try {
  Move-Item $src.FullName $appDir
} catch {
  # Tausch fehlgeschlagen: alten Stand zurück und wieder starten, damit der Punkt nicht verschwindet
  if ((Test-Path $oldDir) -and -not (Test-Path $appDir)) { Move-Item $oldDir $appDir }
  $oldExe = Join-Path $appDir "bin\PlannerAblage.exe"
  if (Test-Path $oldExe) { Start-Process -FilePath "explorer.exe" -ArgumentList ('"' + $oldExe + '"') }
  throw
}
Remove-Item $oldDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

# 4) Verknüpfungen und Start
Write-PaLine "  4/4  Einrichten ..."
$exe = Join-Path $appDir "bin\PlannerAblage.exe"
# Startmenü: Windows-Taste, "Planner-Ablage" tippen, Enter - funktioniert auch ohne Autostart
New-PaShortcut (Join-Path ([Environment]::GetFolderPath("Programs")) "Planner-Ablage.lnk") $exe
# Autostart nur bei der Erstinstallation setzen; später entscheidet der Nutzer (Rechtsklick -> "Mit Windows starten")
$startupLnk = Join-Path ([Environment]::GetFolderPath("Startup")) "Planner-Ablage.lnk"
if ($fresh) { New-PaShortcut $startupLnk $exe }
$autostart = Test-Path $startupLnk

# Punkt starten - losgelöst von diesem Fenster. Über explorer.exe läuft er immer mit normalen Benutzerrechten,
# auch wenn diese PowerShell "als Administrator" geöffnet wurde (ein erhöhter Punkt bekäme keine Dateien per Drag & Drop).
Start-Process -FilePath "explorer.exe" -ArgumentList ('"' + $exe + '"')
Start-Sleep -Seconds 3
if (-not (Get-Process PlannerAblage -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe)
}

Write-PaLine ""
Write-PaLine "  Fertig. Planner-Ablage v$newVersion läuft - der grüne Punkt ist unten rechts auf dem Hauptbildschirm." "Green"
Write-PaLine "  Datei darauf ziehen -> Aufgabe in Planner. Doppelklick -> Aufgabe ohne Datei. Rechtsklick -> Optionen."
if ($autostart) { Write-PaLine "  Autostart mit Windows: an." } else { Write-PaLine "  Autostart mit Windows: aus (Rechtsklick auf den Punkt -> 'Mit Windows starten')." }
Write-PaLine "  Manuell starten: Windows-Taste, 'Planner-Ablage' tippen, Enter."
Write-PaLine "  Neue Versionen holt sich der Punkt ab jetzt selbst."
if ($fresh) { Write-PaLine "  Beim ersten Mal einmal mit dem Firmenkonto anmelden." }
Write-PaLine ""

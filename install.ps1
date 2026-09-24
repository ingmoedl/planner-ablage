# Planner-Ablage – Installation / Aktualisierung mit einem Befehl (kein Admin nötig)
#   irm https://raw.githubusercontent.com/ingmoedl/planner-ablage/main/install.ps1 | iex
# Lädt den aktuellen Stand von GitHub, übersetzt die Hülle lokal und legt sie in einen NEUEN Versionsordner
# %LOCALAPPDATA%\PlannerAblage\App-<Version>. Startmenü- (und ggf. Autostart-)Verknüpfung zeigen danach dorthin,
# der Punkt wird gestartet, alte Versionsordner werden gelöscht (noch gesperrte beim nächsten Lauf).
# Kein Umbenennen des laufenden Programmordners - das schlug direkt nach dem Beenden der exe schon einmal fehl.
# Der laufende Punkt ruft dieses Skript auch selbst auf, wenn im Repo eine neuere VERSION liegt
# ($env:PA_AUTO = '1': still, ohne Fenster, Autostart-Einstellung bleibt unverändert).

$ErrorActionPreference = "Stop"
$auto    = ($env:PA_AUTO -eq "1")
$zipUrl  = "https://github.com/ingmoedl/planner-ablage/archive/refs/heads/main.zip"
$root    = Join-Path $env:LOCALAPPDATA "PlannerAblage"
$stamp   = [guid]::NewGuid().ToString("N")
$tmpZip  = Join-Path $env:TEMP ("planner-ablage-" + $stamp + ".zip")
$tmpDir  = Join-Path $env:TEMP ("planner-ablage-" + $stamp)
$fresh   = -not (Test-Path (Join-Path $env:APPDATA "PlannerAblage\settings.json"))
$menuLnk    = Join-Path ([Environment]::GetFolderPath("Programs")) "Planner-Ablage.lnk"
$startupLnk = Join-Path ([Environment]::GetFolderPath("Startup")) "Planner-Ablage.lnk"
$hadAutostart = Test-Path $startupLnk

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
if (-not $newVersion) { Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue; throw "Im Archiv fehlt die Datei VERSION." }
$newVersion = $newVersion.Trim()

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

# 3) Laufenden Punkt beenden, neuen Versionsordner einsetzen
#    (Einstellungen liegen in %APPDATA%, die Anmeldung im WebView2-Profil - beides bleibt)
Write-PaLine "  3/4  Dateien ablegen ..."
Get-Process PlannerAblage -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$t0 = Get-Date
while ((Get-Process PlannerAblage -ErrorAction SilentlyContinue) -and ((Get-Date) - $t0).TotalSeconds -lt 10) { Start-Sleep -Milliseconds 200 }
New-Item -ItemType Directory -Force $root | Out-Null
$appDir = Join-Path $root ("App-" + $newVersion)
if (Test-Path $appDir) {
  # Gleiche Version schon vorhanden (Reparatur): weg damit; ist sie gesperrt, eigenen Ordner nehmen
  try { Remove-Item -LiteralPath $appDir -Recurse -Force -ErrorAction Stop }
  catch { $appDir = Join-Path $root ("App-" + $newVersion + "-" + $stamp.Substring(0, 8)) }
}
Move-Item -LiteralPath $src.FullName -Destination $appDir
$exe = Join-Path $appDir "bin\PlannerAblage.exe"
if (-not (Test-Path (Join-Path $appDir "VERSION")) -or -not (Test-Path $exe)) {
  Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
  throw "Der neue Programmordner $appDir ist unvollständig. Bitte den Befehl erneut ausführen."
}
Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

# 4) Verknüpfungen, Start, Aufräumen
Write-PaLine "  4/4  Einrichten ..."
# Startmenü: Windows-Taste, "Planner-Ablage" tippen, Enter - funktioniert auch ohne Autostart
New-PaShortcut $menuLnk $exe
# Autostart: bei Erstinstallation einschalten; war er an, auf den neuen Ordner umbiegen; war er aus, bleibt er aus
if ($fresh -or $hadAutostart) { New-PaShortcut $startupLnk $exe }
$autostart = Test-Path $startupLnk

# Punkt starten - losgelöst von diesem Fenster. Über explorer.exe läuft er immer mit normalen Benutzerrechten,
# auch wenn diese PowerShell "als Administrator" geöffnet wurde (ein erhöhter Punkt bekäme keine Dateien per Drag & Drop).
Start-Process -FilePath "explorer.exe" -ArgumentList ('"' + $exe + '"')
Start-Sleep -Seconds 3
if (-not (Get-Process PlannerAblage -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe)
}

# Alte Versionsordner (App, App.alt, App-0.4 ...) entfernen; noch gesperrte bleiben bis zum nächsten Lauf liegen
Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "App*" -and $_.FullName -ne $appDir } |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

Write-PaLine ""
Write-PaLine "  Fertig. Planner-Ablage v$newVersion läuft - der grüne Punkt ist unten rechts auf dem Hauptbildschirm." "Green"
Write-PaLine "  Datei darauf ziehen -> Aufgabe in Planner. Doppelklick -> Aufgabe ohne Datei. Rechtsklick -> Optionen."
if ($autostart) { Write-PaLine "  Autostart mit Windows: an." } else { Write-PaLine "  Autostart mit Windows: aus (Rechtsklick auf den Punkt -> 'Mit Windows starten')." }
Write-PaLine "  Manuell starten: Windows-Taste, 'Planner-Ablage' tippen, Enter."
Write-PaLine "  Neue Versionen holt sich der Punkt ab jetzt selbst."
if ($fresh) { Write-PaLine "  Beim ersten Mal einmal mit dem Firmenkonto anmelden." }
Write-PaLine ""

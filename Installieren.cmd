@echo off
rem Planner-Ablage ohne Internet-Befehl einrichten (Ordner kopiert bekommen, Doppelklick hierauf):
rem Internet-Sperrkennzeichen entfernen, uebersetzen, Startmenue-Eintrag (und beim ersten Mal Autostart) anlegen, starten.
rem Kein Admin noetig. Kann jederzeit erneut ausgefuehrt werden.
rem Parameter /still: keine Pause am Ende.
setlocal
if "%~1"=="/still" set PA_STILL=1
cd /d "%~dp0"
if not "%~1"=="/still" (
  echo.
  echo  Planner-Ablage wird eingerichtet ...
  echo.
)

rem 0) Laufende Instanz beenden, sonst laesst sich die exe nicht ersetzen
taskkill /im PlannerAblage.exe /f >nul 2>&1

rem 1) Nur die WebView2-DLLs aus dem Internet/ZIP freigeben (sonst laedt .NET sie nicht); alles andere bleibt markiert
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse -File -Filter *.dll | Unblock-File -ErrorAction SilentlyContinue"

rem 2) Uebersetzen und starten
call "%~dp0Start.cmd" /build
if errorlevel 1 exit /b 1

rem 3) Startmenue-Eintrag immer; Autostart nur, wenn noch keine Einstellungen existieren (Erstinstallation)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$exe = '%~dp0bin\PlannerAblage.exe';" ^
  "function Mk($p) { $s = New-Object -ComObject WScript.Shell; $l = $s.CreateShortcut($p); $l.TargetPath = $exe; $l.WorkingDirectory = (Split-Path $exe); $l.IconLocation = \"$exe,0\"; $l.Description = 'Planner-Ablage: Datei ablegen, Aufgabe in Planner anlegen'; $l.Save() };" ^
  "Mk ([IO.Path]::Combine([Environment]::GetFolderPath('Programs'), 'Planner-Ablage.lnk'));" ^
  "if (-not (Test-Path (Join-Path $env:APPDATA 'PlannerAblage\settings.json'))) { Mk ([IO.Path]::Combine([Environment]::GetFolderPath('Startup'), 'Planner-Ablage.lnk')) }"

if "%~1"=="/still" exit /b 0
echo.
echo  Fertig. Der gruene Punkt sitzt unten rechts auf dem Hauptbildschirm.
echo  Starten jederzeit: Windows-Taste, "Planner-Ablage" tippen, Enter.
echo  Rechtsklick auf den Punkt: Autostart, Aktualisierung, Groesse, Beenden.
echo.
pause
exit /b 0

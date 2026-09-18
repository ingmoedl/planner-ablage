@echo off
rem Planner-Ablage einrichten: Internet-Sperrkennzeichen entfernen, uebersetzen, Autostart anlegen, starten.
rem Kein Admin noetig. Kann jederzeit erneut ausgefuehrt werden (z. B. nach einem Update).
setlocal
cd /d "%~dp0"
echo.
echo  Planner-Ablage wird eingerichtet ...
echo.

rem 1) Dateien aus dem Internet/ZIP freigeben (sonst blockiert Windows die DLLs)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue"

rem 2) Uebersetzen und starten
call "%~dp0Start.cmd" /build
if errorlevel 1 exit /b 1

rem 3) Autostart-Verknuepfung im Benutzer-Startordner
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = New-Object -ComObject WScript.Shell; $l = $s.CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Startup'), 'Planner-Ablage.lnk')); $l.TargetPath = '%~dp0bin\PlannerAblage.exe'; $l.WorkingDirectory = '%~dp0bin'; $l.IconLocation = '%~dp0bin\PlannerAblage.exe,0'; $l.Description = 'Planner-Ablage: Datei ablegen, Aufgabe in Planner anlegen'; $l.Save()"

echo.
echo  Fertig. Der gruene Punkt sitzt unten rechts auf dem Hauptbildschirm.
echo  Er startet ab jetzt automatisch mit Windows. Rechtsklick auf den Punkt zeigt die Optionen.
echo.
pause

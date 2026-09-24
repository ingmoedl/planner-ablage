@echo off
rem Planner-Ablage starten. Kompiliert die Huelle beim ersten Mal (oder nach Aenderungen) mit dem
rem C#-Compiler, der in jedem Windows enthalten ist. Kein Admin, keine Installation.
rem   Start.cmd            bei Bedarf uebersetzen, dann starten
rem   Start.cmd /build     immer uebersetzen, dann starten
rem   Start.cmd /buildonly immer uebersetzen, nicht starten (install.ps1)
rem Nur ASCII in dieser Datei: Umlaute bringen cmd.exe unter Codepage 65001 dazu, Zeilenanfaenge zu verschlucken.
setlocal
cd /d "%~dp0"
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo Der C#-Compiler wurde nicht gefunden. .NET Framework 4.8 ist Teil von Windows - bitte IT fragen.
  if not defined PA_STILL pause
  exit /b 1
)

set EXE=bin\PlannerAblage.exe
set SRC=Huelle\PlannerAblage.cs
set BUILD=0
if not exist "%EXE%" set BUILD=1
if "%~1"=="/build" set BUILD=1
if "%~1"=="/buildonly" set BUILD=1
if "%BUILD%"=="0" (
  for /f %%A in ('powershell -NoProfile -Command "if ((Get-Item '%SRC%').LastWriteTime -gt (Get-Item '%EXE%').LastWriteTime) { 1 } else { 0 }"') do set BUILD=%%A
)

if "%BUILD%"=="1" (
  echo Planner-Ablage wird uebersetzt ...
  if not exist bin mkdir bin
  copy /y Huelle\lib\*.dll bin\ >nul
  "%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /out:"%EXE%" /win32icon:Huelle\app.ico /codepage:65001 ^
    /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll ^
    /r:Huelle\lib\Microsoft.Web.WebView2.Core.dll /r:Huelle\lib\Microsoft.Web.WebView2.WinForms.dll ^
    "%SRC%"
  if errorlevel 1 (
    echo Uebersetzen fehlgeschlagen. Bitte Samuel Moedl melden.
    if not defined PA_STILL pause
    exit /b 1
  )
)

if "%~1"=="/buildonly" exit /b 0
rem Falls schon ein Punkt laeuft, beendet sich der zweite Start von selbst.
rem Bei stiller Installation (PA_STILL) startet das aufrufende Skript den Punkt selbst.
if not defined PA_STILL start "" "%EXE%"
exit /b 0

@echo off
rem Planner-Ablage starten. Kompiliert die Hülle beim ersten Mal (oder nach Änderungen) mit dem
rem C#-Compiler, der in jedem Windows enthalten ist. Kein Admin, keine Installation.
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
if exist "%EXE%" (
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

rem Falls schon ein Punkt laeuft, beendet sich der zweite Start von selbst.
rem Bei stiller Installation (install.ps1) startet das Skript den Punkt selbst.
if not defined PA_STILL start "" "%EXE%"
exit /b 0

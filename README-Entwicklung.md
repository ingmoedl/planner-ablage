# Planner-Ablage – Entwicklungsstand und Übergabe

Stand 24.09.2026, v0.5. Vorgeschichte und Entscheidungen: `00-Recherche-Planner-Ablage.md`.
Schwesterprojekt: Planner-Knopf (Outlook-Add-in) in `..\PPR\planner-knopf` – **dort nichts ändern**.

## Was ist das

Runder grüner Punkt auf dem Desktop. Datei darauf ziehen → daneben öffnet sich das Formular
„Aufgabe in Planner" (gleiche Felder wie der Planner-Knopf). Die Datei wird in die Bibliothek
**„Websiteobjekte" (SiteAssets)** der Team-Site des Jahres-Teams hochgeladen (Gruppe = `plan.owner`,
Ordner `Planner-Anlagen/<Plantitel>/`) und als Referenz an die Aufgabe gehängt. Original bleibt liegen.
**Nicht** in den Projektordner der Bibliothek „Freigegebene Dokumente" – die ist bei allen per OneDrive
im Explorer synchronisiert, und die Anlage tauchte dort als Datei auf (Nutzer-Beschwerde 24.09.2026).
Der Punkt hält sich selbst aktuell (Datei `VERSION` im Repo) und steht im Startmenü.

## Aufbau

```
Huelle\PlannerAblage.cs    C#-Quelltext der Hülle (WinForms + WebView2), C# 5, wird lokal kompiliert
Huelle\lib\*.dll           WebView2-SDK 1.0.4191.47 (Core, WinForms, Loader x64), BSD-Lizenz
Huelle\app.ico             Symbol (aus dem Knopf-Icon erzeugt)
docs\index.html, app.js    Formular-Seite (für GitHub Pages: Ordner "docs" auf Branch main)
docs\msal-browser.min.js   MSAL.js v3 (Kopie aus dem Planner-Knopf)
Start.cmd                  kompiliert bei Bedarf (csc.exe aus .NET Framework 4.8) und startet; /build, /buildonly
Installieren.cmd           Offline-Installation aus kopiertem Ordner: Unblock-File, Start.cmd /build, Verknüpfungen
install.ps1                Ein-Befehl-Installation UND Selbst-Update (irm … | iex), siehe v0.5
VERSION                    Versionsnummer – der Auslöser für das Selbst-Update der Punkte
LIESMICH.txt               Kurzanleitung für Kollegen
skill\                     Cowork-Skill „planner-ablage-installation" (Quelle + .skill-Paket)
bin\                       Build-Ausgabe (nicht im Git)
```
**Nur ASCII in .cmd-Dateien** (Umlaute → cmd.exe verschluckt unter Codepage 65001 Zeilenanfänge).

### Hülle (PlannerAblage.cs)
- `App.Main`: Einzelinstanz (Mutex), DPI-Awareness (Per-Monitor v2), Einstellungen laden.
  Kommandozeile `PlannerAblage.exe <Datei> …` öffnet das Formular sofort mit diesen Dateien (Test).
- `Settings`: `%APPDATA%\PlannerAblage\settings.json` (X, Y, Size, TopMost, Opacity, PageUrl,
  FormWidth, FormHeight). **Entwicklung:** `PageUrl` auf den lokalen Pfad zu `docs\index.html`
  setzen → die Hülle blendet den Ordner als `https://planner-ablage.local/` ein.
- `DropForm`: rahmenlos, runde Region, Ziehen mit linker Maustaste, Mausrad = Größe (56–400),
  Rechtsklick-Menü (Vordergrund, Formular ohne Datei, Größe, Deckkraft, Autostart, Protokoll,
  Beenden), Doppelklick = Formular ohne Datei. Position wird geprüft, ob noch auf einem Monitor.
- `Dropped.Extract`: kopiert abgelegte Dateien in `%LOCALAPPDATA%\PlannerAblage\drop\<guid>\`
  (CF_HDROP) oder liest virtuelle Dateien (klassisches Outlook: `FileGroupDescriptorW` +
  `FileContents` als IStream/IStorage → .msg). Ordner werden ignoriert.
- `TaskWindow`: WebView2 mit UserDataFolder `%LOCALAPPDATA%\PlannerAblage\WebView2` (dort liegt
  auch der MSAL-Token-Cache), Virtual Host `https://ablage.local/` → Übergabeordner (CORS erlaubt).
  Nachrichten Seite→Hülle: `ready`, `close`, `done`, `open {url}`, `log {text}`.
  Hülle→Seite: `files {version, files:[{name,url,size,path}]}` (nach jedem `ready`, also auch
  nach der Rückkehr von der Microsoft-Anmeldung). Neue Fenster (Links) gehen in den Standardbrowser.
  Beim Schließen wird der Übergabeordner gelöscht.

### Seite (docs/app.js)
- `CONFIG.clientId` = App-Registrierung „Planner-Ablage", fest verdrahtet. Scopes: `User.Read`,
  `User.ReadBasic.All`, `Tasks.ReadWrite`, `Files.ReadWrite.All`. Die frühere Test-Übersteuerung per
  `?client=<id>&scopes=knopf` (localStorage `pa_override`) wurde in v0.6 entfernt (Review: fremde App-Registrierung
  einschleusbar). Für Tests mit anderer App: Konstante lokal ändern, `PageUrl` auf die lokale index.html setzen.
- MSAL: `PublicClientApplication`, **cacheLocation localStorage** (jedes Formularfenster ist ein
  neuer Tab), Redirect-Flow (`acquireTokenRedirect`), `handleRedirectPromise` beim Start.
- Pläne/Buckets/Personen: identisch zum Knopf v2.1 (memberOf → `$batch` je Gruppe), zusätzlich
  wird `owner` (Gruppen-ID) je Plan gespeichert. Cache-Keys `pa_*`.
- Projekterkennung aus Dateiname + Herkunftspfad (Regex wie im Knopf). Titel = Dateiname ohne
  Endung, Unterstriche → Leerzeichen.
- `createTask`: erst Upload, dann `POST /planner/tasks`, dann `PATCH details` mit `description` und
  `references` (webUrl der Dateien, Typ nach Endung, `previewType: reference`).
  Upload seit v0.5: `resolveTarget(groupId)`: `/groups/{id}/sites/root` → Team-Site; dann die versteckte
  Bibliothek „Websiteobjekte" **per Listentitel** `/sites/{id}/lists/Websiteobjekte` (Fallback „Site Assets",
  dann sprachunabhängig `/sites/{id}/lists?$select=…,system` und `webUrl` endet auf `/SiteAssets`), von der
  Liste `/lists/{listId}/drive` → Drive-ID. **`/groups/{id}/drives`, `/sites/{id}/drives` und `/sites/{id}/lists`
  ohne `system` führen Websiteobjekte NICHT auf** (geprüft 24.09.2026, Sites 2025 und 2026). 6 h gecacht in
  `pa_target_v2_<gid>`. Ordner `CONFIG.uploadRootFolder`/`folderName(plantitel)`;
  `uploadFile(target, folder, file)` → `PUT /drives/{driveId}/root:/<Ordner>/<Datei>:/content` bis 4 MB,
  sonst `createUploadSession` in 5-MiB-Blöcken, `conflictBehavior=rename`; bei 404 legt `ensureFolder`
  die Ordnerkette an und wiederholt. Notbehelf ohne Websiteobjekte: Standardbibliothek, Ordner
  `_Planner-Anlagen/<Plan>` (`kind: "library"`, wird im Statustext genannt).
- Dateien aus der Hülle werden sofort per `fetch` gelesen (`verifyFile`): ✓ oder „⚠ nicht lesbar".

## Bauen und testen
```
Start.cmd /build                      kompiliert neu und startet
bin\PlannerAblage.exe "C:\…\Datei.pdf" startet und öffnet das Formular mit der Datei
```
Getestet am 18.09.2026 auf dem PC des Nutzers: Punkt rund, verschiebbar, Formular öffnet neben
dem Punkt, zwei Testdateien kommen in der Seite an (Titel und Größe stimmen), Abbrechen schließt.
**Nicht getestet** (braucht App-Registrierung): Anmeldung, Planliste, Upload, Aufgabe.

## Entra-App „Planner-Ablage" (angelegt 18.09.2026 im Browser durch Claude, Konto moedl@)
- Client-ID `239b6012-5d61-4e37-9041-75b0218e6a09`, Tenant `1571141a-75a9-43a3-ad47-8d613cfbb3e6`,
  Objekt-ID `dbccf354-969b-43c3-93b4-154529edd44d`, „Nur ein Mandant".
- SPA-Redirect: `https://ingmoedl.github.io/planner-ablage/index.html`.
- Delegierte Berechtigungen: User.Read, User.ReadBasic.All, Tasks.ReadWrite, Files.ReadWrite.All.
  **Admin-Zustimmung ist erteilt** (21.09.2026: Login im Formular lief durch, 623 Pläne geladen).

## v0.2 (21.09.2026)
- Drei Datumsfelder Start / Ende / Fällig am: Start → `startDateTime`, Fällig → `dueDateTime`,
  Ende → erste Zeile der Beschreibung „Geplantes Ende: TT.MM.JJJJ" (Planner kennt kein drittes Datum).
- Anlagen: `previewType: "reference"` in den Details, damit die Karte im Board die Anlage zeigt.
  **Falle (21.09.):** `previewPriority` muss ein gültiger orderHint sein (`" !"`); `" !" + Zeichen` ist ungültig →
  Graph 400 beim PATCH, und `patchDetails` hatte das still verschluckt → Aufgabe ohne Anlage. Seit app.js v=6
  wirft `patchDetails` einen Fehler, der im Statustext erscheint (Aufgabe bleibt bestehen) und ins log.txt geht.
- Autostart wird beim allerersten Start (keine settings.json) automatisch gesetzt.
- Doppelklick: eigene Erkennung in `OnMouseUp` (zwei Klicks ohne Bewegung innerhalb
  `SystemInformation.DoubleClickTime`), weil der WinForms-Doppelklick auf dem rahmenlosen Form
  nicht zuverlässig kam. Getestet per PostMessage.
- Ein-Befehl-Installation `install.ps1` (Repo-Wurzel, über raw.githubusercontent.com):
  `irm https://raw.githubusercontent.com/ingmoedl/planner-ablage/main/install.ps1 | iex`
  → ZIP von GitHub nach `%LOCALAPPDATA%\PlannerAblage\App`, Unblock, `Installieren.cmd /still`
  (kompiliert, Autostart, Start). Rechtsklick-Menü „Aktualisieren" ruft denselben Befehl.
  Falle: nicht `Start-Process -Wait` verwenden, das wartet auch auf den gestarteten Punkt.
- Skill `skill/planner-ablage-installation` (+ .skill-Paket) für Kollegen.
- Der Nutzer-PC läuft aus `%LOCALAPPDATA%\PlannerAblage\App-<Version>\bin` (bis v0.4: `App\bin`); der
  Dev-Ordner `bin\` ist nur noch für Tests (`Start.cmd /build`).

## v0.4 (21.09.2026)
- **Kollegen-PC: Drop auf den Punkt zeigte rotes Verbotszeichen**, Drop ins Formular ging. Ursache sehr
  wahrscheinlich: `install.ps1` in einer *als Administrator* geöffneten PowerShell → Punkt lief erhöht →
  UIPI blockiert Drag & Drop aus dem nicht erhöhten Explorer. Fix: Hülle startet sich bei Erhöhung über
  `explorer.exe` neu (normale Rechte); `install.ps1` startet den Punkt ebenfalls über `explorer.exe`.
  Zusätzlich akzeptiert `Dropped.HasFiles` auch `FileGroupDescriptor` (ANSI) und `Shell IDList Array`, und
  abgelehnte Drags schreiben ihre Formate ins log.txt („Drag abgelehnt, Formate: …").
- **Endtermin (neues Planner-UI)** ist per Graph NICHT setzbar: PATCH `endDateTime` liefert 204, wird aber
  ignoriert (Property fehlt in v1.0 und beta, lastModified unverändert; live getestet 21.09.). Bleibt als
  erste Zeile der Beschreibung „Geplantes Ende: …".

## v0.5 (24.09.2026) – Selbst-Update, Startmenü, Ablageort

Nutzerwünsche 24.09.: (1) Befehl für die aktuelle Version, (2) der Punkt soll sich selbst aktuell halten,
(3) wo startet man ihn ohne Autostart, (4) die Anlage darf nicht im Projektordner (Explorer) auftauchen.

- **Ablageort** (app.js): Bibliothek „Websiteobjekte" (SiteAssets) der Team-Site statt Projektordner, siehe
  „Seite". Jede Team-Site hat sie (OneNote-Notizbuch liegt dort), Mitglieder dürfen schreiben, niemand
  synchronisiert sie. Die Referenz auf der Planner-Karte funktioniert wie zuvor (SharePoint-URL).
  Der Nutzer löscht alte Test-Anlagen im Projektordner „25542-02 …" selbst (Referenzen der alten Aufgaben
  zeigen dann ins Leere).
- **Selbst-Update** (`Updater` in PlannerAblage.cs): 45 s nach dem Start und dann alle 6 h wird
  `raw.githubusercontent.com/…/main/VERSION?t=` gelesen und mit `App\VERSION` verglichen
  (`System.Version`, Fallback Stringvergleich). Neuer → wenn kein Formular offen (`OpenForms.Count > 1` →
  in 10 min erneut): Tooltip am Punkt, dann `powershell -WindowStyle Hidden -Command "$env:PA_AUTO='1';
  irm …/install.ps1?t=… | iex" *> %LOCALAPPDATA%\PlannerAblage\update.log`. `Settings.AutoUpdate` (Menü
  „Automatisch aktualisieren", Standard an). Menü außerdem: „Jetzt auf neue Version prüfen" (Rückfrage vor
  dem Update), „Neu installieren / reparieren" (install.ps1 sichtbar).
- **install.ps1 neu geordnet**: 1) ZIP laden + entpacken, 2) **im Temp-Ordner übersetzen** (`Start.cmd
  /buildonly`; scheitert das, bleibt die alte Version unangetastet), 3) Punkt beenden, Temp →
  **neuer Versionsordner `%LOCALAPPDATA%\PlannerAblage\App-<Version>`** (Prüfung: VERSION + exe vorhanden),
  4) Startmenü-Verknüpfung immer, Autostart bei Erstinstallation neu bzw. auf den neuen Ordner umgebogen, wenn
  er an war (`$hadAutostart`), Start (direkt; nur bei erhöhter PowerShell über explorer.exe), danach alle
  anderen `App*`-Ordner löschen (gesperrte beim nächsten Lauf). `$env:PA_AUTO='1'` unterdrückt nur den
  WebView2-Hinweis; die Ausgabe landet beim stillen Lauf in update.log.
  **Falle (24.09.):** die erste Fassung benannte `App` → `App.alt` um und verschob Temp nach `App`. Direkt nach
  `Stop-Process` blieb die Umbenennung ohne Fehlermeldung wirkungslos (exe noch gesperrt), Move-Item legte den
  neuen Stand als *Unterordner* `App\planner-ablage-main` ab und explorer.exe startete die alte exe. Deshalb:
  nie den bisherigen Programmordner umbenennen, immer in einen frischen Ordner installieren und das Ergebnis
  prüfen. `Autostart.Ensure()` in der Hülle biegt eine Verknüpfung auf den aktuellen Pfad um.
  **Falle 2 (24.09.), aufgeklärt:** Alle Merkwürdigkeiten des Tages aus der Claude-Werkzeugumgebung heraus
  (Explorer „Pfad nicht vorhanden", Aufgabenplanung 0x80070002, ShellExecute „Zugriff verweigert", wirkungslose
  Umbenennung) hatten eine Ursache: Die Claude-Desktop-App ist ein MSIX-Paket, ihre Kindprozesse schreiben unter
  `%LOCALAPPDATA%`/`%TEMP%` **virtualisiert** nach `…\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\`.
  Der „installierte" Ordner `App-0.5` existierte nur dort; Explorer, Aufgabenplanung und Autostart sehen ihn nicht.
  Folge: Installationen für den echten PC muss der Nutzer selbst in seiner PowerShell ausführen; Claude-Läufe von
  install.ps1 sind nur Logiktests. Die Änderungen (Direktstart statt explorer.exe, CreateProcess statt
  ShellExecute, Versionsordner statt Umbenennen) bleiben trotzdem – sie sind robuster.
- **Startmenü** (`StartMenu.Ensure()` beim Start, install.ps1, Installieren.cmd):
  `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Planner-Ablage.lnk` → „Windows-Taste, Planner tippen,
  Enter" findet den Punkt immer, auch ohne Autostart. Wird neu angelegt, wenn er fehlt oder auf eine andere
  exe zeigt.
- Versionen vereinheitlicht: Hülle `App.Version`, Datei `VERSION`, Seite `CONFIG.version` = **0.5**.

**Neue Version veröffentlichen (Checkliste):**
1. `VERSION` hochzählen (das ist der Auslöser), `App.Version` in PlannerAblage.cs und `CONFIG.version` in
   app.js gleich setzen, Cache-Buster `app.js?v=N` in index.html erhöhen.
2. Probeweise übersetzen: `Start.cmd /buildonly` (oder csc direkt; Quellpfad mit Backslash angeben).
3. `git add -A`, commit, `git push origin main`. Pages (Seite) 30–90 s; raw.githubusercontent (VERSION,
   install.ps1) bis 5 min Cache.
4. Punkte ab v0.5 holen das Update von selbst (spätestens nach 6 h bzw. 45 s nach dem nächsten Start).
   Punkte ≤ v0.4 einmal per Rechtsklick → „Aktualisieren" oder mit dem irm-Befehl nachziehen.

## v0.6 (24.09.2026) – Härtung nach Code-Review

Ein Kollege (Mathias) hat den Code mit Claude durchgesehen; die Punkte und ihr Stand:

1. ✅ **Beliebige Programme startbar** (`Process.Start(url)` in `NewWindowRequested` und `open`-Nachricht): jetzt
   `Web.OpenExternal` – nur `https` und nur Hosts `*.sharepoint.com`, `*.cloud.microsoft`, `*.office.com`,
   `*.microsoft.com`; alles andere wird verworfen und protokolliert.
2. ✅ **Keine Herkunftsprüfung**: `OnMessage` nimmt nur Nachrichten an, deren `e.Source` vom Host der
   konfigurierten `PageUrl` (bzw. `planner-ablage.local` in der Entwicklung) stammt. `NavigationStarting` lässt
   nur die eigene Seite, Microsoft-Anmeldung (`*.microsoftonline.com`, `*.microsoft.com`, `*.msftauth.net`,
   `*.msauth.net`, `*.live.com`, `*.microsoftazuread-sso.com`, `*.office.com/.net`, `*.cloud.microsoft`,
   `*.sharepoint.com`) und `ablage.local` zu; Blockierungen stehen im log.txt („Navigation blockiert: …").
   **Achtung:** ein föderierter Anmeldedienst (ADFS o. ä. auf eigener Domain) würde blockiert – dann Host in
   `Web.NavHosts` ergänzen.
3. ⏳ **Organisatorisch** (Entscheidung Geschäftsführung, siehe Abschlussbericht 24.09.): Trust-Anker ist das
   GitHub-Konto `ingmoedl`. Umgesetzt: Branch `main` gegen Force-Push und Löschen geschützt (auch für den Besitzer).
   Offen: 2FA am Konto prüfen/erzwingen, Repo in eine Firmen-Organisation, Entra-App auf eine Nutzergruppe
   beschränken, Berechtigung `Files.ReadWrite.All` durch `Sites.Selected` (nur Sites 2020–2026) ersetzen –
   Letzteres ändert das Scope-Set und braucht eine neue Admin-Zustimmung.
4. ✅ **Test-Hintertür** `?client=<id>` in app.js entfernt (Funktion `applyQueryOverrides`, localStorage `pa_override`
   wird beim Start gelöscht).
5. ✅ **Fremde DLLs**: SHA-256 der drei WebView2-DLLs am 24.09.2026 gegen das offizielle NuGet-Paket
   `Microsoft.Web.WebView2` 1.0.4191.47 (nuget.org) verglichen – **alle identisch**:
   `Microsoft.Web.WebView2.Core.dll` (lib/net462) `e6f54c8c…f550`, `Microsoft.Web.WebView2.WinForms.dll`
   (lib/net462) `cc3d2937…e849`, `WebView2Loader.dll` (runtimes/win-x64/native) `c66e4a92…c5bc`.
   Prüfbefehl: `curl -L -o wv2.nupkg https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.4191.47`,
   entpacken, `sha256sum` vergleichen.
6. ✅ **Fehlertexte**: `esc()` um `msg(e)` in „Startfehler" und „Pläne konnten nicht geladen werden".
7. ✅ **Temporäre Kopien**: `App.CleanupDrop()` löscht beim Start alle `drop\<guid>`-Ordner (beim Start ist kein
   Formular offen).
- Installer: `Unblock-File` nur noch für `*.dll` (install.ps1, Installieren.cmd).
- **Feldtest der Selbst-Aktualisierung (v0.5 → v0.6, 24.09. 12:16):** Erkennung lief („Automatische Aktualisierung
  v0.5 → v0.6"), aber `Process.Start(powershell)` mit `UseShellExecute = true` + `WindowStyle Hidden` scheiterte mit
  „Zugriff verweigert". Fix: `UseShellExecute = false`, `CreateNoWindow` im stillen Fall, `WorkingDirectory`
  = LocalDir. (Der Punkt lief dabei MSIX-virtualisiert als Kindprozess der Claude-App – der Fehler war sehr
  wahrscheinlich ein Sandbox-Artefakt. Der Auto-Update-Pfad ist im echten Kontext noch NICHT beobachtet: beim
  nächsten Release `%LOCALAPPDATA%\PlannerAblage\log.txt` und `update.log` auf dem Nutzer-PC prüfen.)
- `Shortcuts.Target()` lieferte immer "" (IDispatch-GetProperty mit `null`-Argumenten) → Start- und Autostart-
  Verknüpfung wurden bei jedem Start neu geschrieben und protokolliert. Fix: `new object[0]`.
- Auto-Update ohne Signatur: bewusst so belassen – eine Signaturprüfung mit Schlüssel im selben Repo brächte nichts;
  ein getrennter Signierschlüssel wäre der nächste Schritt, falls die Geschäftsführung das verlangt.

## Noch zu tun
1. ✅ Admin-Zustimmung erteilt.
2. ✅ GitHub-Repo https://github.com/ingmoedl/planner-ablage (public) angelegt 18.09.2026, Pages aus
   `docs/` → https://ingmoedl.github.io/planner-ablage/index.html. Deployment wie beim Knopf:
   Cache-Buster in `docs/index.html` erhöhen, `git add -A`, commit, `git push origin main`, 30–90 s warten.
3. ✅ settings.json `PageUrl` zeigt auf die Pages-URL (Standard).
4. Echttests: ✅ Anmeldung, 623 Pläne, Upload, Referenz auf der Karte (21.09.). Offen: Upload groß (>4 MB
   per Session in Websiteobjekte), Drag aus klassischem Outlook (virtuelle .msg), Drag aus neuem Outlook.
5. ✅ Skill „planner-ablage-installation" (v0.5 angepasst).
6. ✅ Live-Test 24.09.2026 (Browser-Pane, Nutzerkonto, produktiver `createTask`-Pfad): Aufgabe in Plan 25542-02
   angelegt, PNG-Anlage lag unter `…/sites/2025/SiteAssets/Planner-Anlagen/25542-02 BYN P2480 P2401H HyPipe/`,
   `previewType: reference`, Board-Karte zeigt Bildvorschau + Dateiname, Aufgabenreiter „Anlagen (1)" mit
   SharePoint-Link. Testaufgabe, Datei und Planordner danach per Graph gelöscht (Wurzelordner `Planner-Anlagen`
   bleibt leer stehen). Offen: Bestätigung des Nutzers aus dem Alltag, erster automatischer Update-Lauf im Feld
   (update.log), Kollegen ≤ v0.4 einmal mit dem irm-Befehl nachziehen.

## Fallen
- csc 4.8 = C# 5: kein `$"…"`, kein `?.`, kein `nameof`, keine Expression-Bodies.
- csc direkt aufrufen: Quellpfad `Huelle\PlannerAblage.cs` mit Backslash (mit `/` sucht csc im Wurzelordner);
  aus Git Bash Optionen mit `-` statt `/` (MSYS-Pfadumwandlung).
- PowerShell 5.1 liest .ps1 ohne BOM als ANSI: UTF-8-Bytes von „–", „→", „Ä" ergeben cp1252-Anführungszeichen
  („ “ ” ’), die PowerShell als String-Begrenzer nimmt → Parser-Fehler. In install.ps1 deshalb nur ASCII-Strich
  und keine Pfeile in Strings; über `irm` (charset utf-8) ist das ohnehin unkritisch.
- .cmd-Dateien: nur ASCII (siehe Aufbau).
- `/codepage:65001` beim Kompilieren, sonst Umlaute in Strings kaputt.
- `ClientSize` statt `Size` für rahmenlose Fenster setzen und in `OnShown` erzwingen.
- PowerShell 5.1: `$pid` ist reserviert; Pfade mit „Ü" in Skripten über Wildcard auflösen.
- Nach Änderungen an app.js den Cache-Buster in index.html erhöhen (`app.js?v=N`).

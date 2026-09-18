# Recherche: Drop-Punkt „Planner-Ablage" (Stand 18.09.2026, nur Recherche, nichts gebaut)

Ziel: Ein fester, frei bewegbarer, skalierbarer Punkt auf einem der drei Bildschirme.
Datei per Drag-and-drop darauf ablegen, sofort erscheint das gleiche Formular wie im
Planner-Knopf (Projekt/Plan, Bucket, Titel, Zuweisen an, Start, Ende, Notizen) und
legt die Planner-Aufgabe an. Der Punkt muss sich in den Vordergrund oder Hintergrund
stellen lassen und ganz einfach an Kollegen weitergegeben werden können.

Der Ordner `planner-knopf` bleibt unverändert. Alles Neue entsteht in diesem Ordner.

## 1. Ergebnis in einem Satz

Robust baubar, ohne Admin-Rechte auf dem PC, als Weitergabe-Paket für Kollegen.
Die einzige Abhängigkeit außerhalb unserer Hand: Für das Hochladen der Datei nach
SharePoint braucht es eine neue Entra-App mit der Berechtigung `Files.ReadWrite.All`,
und die muss der M365-Admin einmal freigeben (wie damals beim Planner-Knopf).
Ohne diese Freigabe geht nur eine eingeschränkte Variante (siehe 5).

## 2. Gemessene Rahmenbedingungen (nur lesend geprüft)

| Punkt | Befund | Bedeutung |
|---|---|---|
| Admin-Rechte | nein | Alles muss als normaler Benutzer laufen (Startordner, %APPDATA%) |
| Windows | 11 Pro 10.0.26200, Domain `ing.local`, Intune-Registrierung | Kollegen-PCs vermutlich gleiches Image |
| AppLocker / SRP / WDAC (Benutzermodus) | keine Regeln, nicht erzwungen | unsignierte Programme und Skripte laufen |
| PowerShell 5.1 | vorhanden, ExecutionPolicy RemoteSigned (CurrentUser), keine GPO | lokale Skripte laufen; Start mit `-ExecutionPolicy Bypass` sicher |
| .NET Framework 4.8.1 (Release 533509) | vorhanden, C#-Compiler `csc.exe` 4.8 in Windows enthalten | eigene .exe lokal kompilierbar, kein SDK nötig |
| .NET 8 / 10 Runtime | vorhanden, aber KEIN SDK | `dotnet build` geht nicht |
| Node.js | fehlt | keine Electron-/Node-Lösung |
| Python 3.12 | nur Store-Version des Nutzers | bei Kollegen nicht sicher, nicht darauf bauen |
| AutoHotkey v2 | in Program Files installiert | bei Kollegen nicht garantiert, nicht darauf bauen |
| WebView2-Laufzeit | 153.0.4234.32 (Edge gleiche Version) | Web-Oberfläche in einem eigenen Fenster möglich |
| Outlook | klassisch 16.0.20326 UND neues Outlook installiert | Drag aus beiden testen (siehe 6) |
| Monitore | 3 x 2560x1440 (links, Mitte primär, rechts) | Fensterposition muss über den ganzen virtuellen Desktop speicherbar sein |
| OneDrive | 26.163, synchronisiert Projektordner aus den Jahres-Sites | siehe 4 |
| GitHub | Konto `ingmoedl`, gh CLI angemeldet, Repo planner-knopf ist PUBLIC mit Pages | zweites Pages-Repo möglich |
| nuget.org | erreichbar | WebView2-DLLs (Paket Microsoft.Web.WebView2, aktuell 1.0.4191.47) ladbar |

## 3. Empfohlene Architektur: dünne Hülle + Web-Oberfläche

```
+------------------------------+        +----------------------------------+
| Hülle (Windows-Fenster)      |        | Web-Seite "Planner-Ablage"       |
| rahmenlos, verschiebbar,     | zeigt  | GitHub Pages (neues Repo)        |
| skalierbar, Topmost-Schalter | -----> | Kopie/Anpassung des Planner-     |
| merkt Position + Größe       |        | Knopf-Codes: MSAL, Pläne,        |
| Autostart über Startordner   |        | Buckets, Personen, Aufgabe       |
| Inhalt = WebView2            |        | NEU: Drop-Zone, Datei-Upload     |
+------------------------------+        +----------------------------------+
```

Warum so:

- **Wiederverwendung**: Rund 90 Prozent der Logik des Planner-Knopfs (Anmeldung mit
  MSAL, alle Pläne über memberOf und $batch, Buckets, interne Personen, Aufgabe
  anlegen, Referenz setzen) ist erprobt und läuft schon im Standalone-Modus ohne
  Office.js. Die Web-Seite wird eine angepasste Kopie in einem neuen Repo, der
  Planner-Knopf bleibt unberührt.
- **Drop landet direkt in der Seite**: WebView2 erlaubt externe Drops standardmäßig
  (`AllowExternalDrop` = true). Die Seite bekommt die Datei mit Inhalt als
  `dataTransfer.files`, kann sie also selbst per Graph hochladen. Chromium versteht
  seit 2019 auch die „virtuellen Dateien" des klassischen Outlook (Mail als .msg).
- **Zentrale Updates**: Änderungen an Formular oder Logik werden per git push auf
  GitHub Pages veröffentlicht, alle Kollegen haben sie beim nächsten Start. Die Hülle
  ändert sich fast nie. Das ist derselbe Verteilweg wie beim Knopf.
- **Anmeldung**: MSAL im Redirect-Flow (wie beim Browser-Test des Knopfs), Token-Cache
  im WebView2-Profil unter %LOCALAPPDATA%, danach stille Anmeldung. Einmal anmelden
  wie beim Knopf.

Hülle, zwei gleichwertige Umsetzungen:

1. **C# (WPF oder WinForms), beim ersten Start lokal mit `csc.exe` kompiliert.**
   Vorteil: die .exe entsteht auf dem PC des Kollegen, trägt kein Internet-Kennzeichen
   und löst keine SmartScreen-Warnung aus. Quelltext liegt lesbar bei (IT kann prüfen).
2. **PowerShell 5.1 mit WPF.** Kein Kompilieren, aber WebView2-DLLs müssen per
   `Add-Type -Path` geladen werden; nach dem Entpacken aus einer ZIP ist `Unblock-File`
   auf den Ordner nötig (Internet-Kennzeichen). Etwas fehleranfälliger.

Empfehlung: Variante 1, gestartet über eine kleine `Start.cmd`, die bei Bedarf kompiliert
und dann startet. Benötigte Fremddateien: `Microsoft.Web.WebView2.Core.dll`,
`Microsoft.Web.WebView2.Wpf.dll` (oder WinForms) und `WebView2Loader.dll` (x64) aus dem
NuGet-Paket, zusammen etwa 1 MB, lizenzfrei weitergebbar.

Fensterfunktionen (alle ohne Admin, Standard-Windows-API):
- Rahmenlos, halbtransparent oder als runder Punkt, Ziehen mit gedrückter Maustaste.
- Größe ändern über Ecke oder Mausrad plus Strg, mit Mindest- und Höchstgröße.
- Topmost ein/aus per Rechtsklick-Menü oder Doppelklick (Vordergrund/Hintergrund).
- Position, Größe und Topmost-Zustand in `%APPDATA%\PlannerAblage\settings.json`;
  beim Start prüfen, ob der Monitor noch da ist, sonst auf den Hauptmonitor.
- Beim Drop wächst das Fenster zur Formulargröße (oder öffnet ein zweites Fenster
  neben dem Punkt); nach „Aufgabe erstellen" schrumpft es zurück.
- Autostart über eine Verknüpfung im Benutzer-Startordner
  (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`).

Verworfene Alternativen:
- **Alles nativ in C# mit MSAL.NET**: doppelte Logik, jede Änderung heißt neue .exe an
  alle verteilen, keine Wiederverwendung. Nein.
- **Edge im App-Modus** (`msedge --app=URL`) statt WebView2: kein Topmost, keine Kontrolle
  über Rahmen und Größe, Datei kommt nicht in die Seite. Nein.
- **AutoHotkey**: bei Kollegen nicht sicher vorhanden, Outlook-Drops nicht ohne Zusatz.
  Nein.
- **Überwachter Desktop-Ordner** (ursprüngliche Idee laut Ordnername): Explorer würde
  Mails automatisch als Datei ablegen, aber ein Desktop-Symbol ist nicht skalierbar
  und nicht Topmost. Als Ergänzung denkbar (Ordner „Ablage" zusätzlich überwachen).

## 4. Wohin mit der Datei? SharePoint der Jahres-Teams

Planner-Anhänge sind Links. Die Graph-Doku zu `plannerExternalReference` verlangt
`http`/`https`; `file://` und UNC-Pfade werden abgelehnt. Also muss die Datei an einen
Ort mit Web-Adresse.

Befund auf diesem PC (OneDrive-Registrierung `HKCU\Software\SyncEngines`):

| Jahr | SharePoint-Site | Bibliothek | Projektordner |
|---|---|---|---|
| 2023 | `/sites/20232` | Freigegebene Dokumente | `23547-G01 Wohnen am Stadtpark MFH SiGeKo` |
| 2024 | `/sites/2024` | Freigegebene Dokumente | `24634-10 Nitrochemie Firepower` |
| 2025 | `/sites/2025` | Freigegebene Dokumente | `25542-02 BYN P2480 P2401H HyPipe` |
| 2026 | `/sites/2026` | Freigegebene Dokumente | `26510-03 MAN F9 Schleuse` |

Jeder Projektordner hat dieselben Unterordner: `00 PM`, `01 Kom`, `02 Ext`, `03 Foto`,
`04 OPL`, `05 BL`, `06 TWP`, `07 BS`, `08 SiGeKo`, `09 Wärmeschutz`, `10 Schallschutz`,
`11 BWU`, `20 Transfer`. Der Projektordner heißt genauso wie der Planner-Plan.

Das passt perfekt: Der Plan gehört der Gruppe des Jahres-Teams, die Gruppe besitzt die
Site, die Site hat die Bibliothek mit dem Projektordner. Ablauf nach dem Drop:

1. Plan wählen (wie im Knopf, Nummer aus dem Dateinamen vorerkannt).
2. Graph: `GET /groups/{groupId}/drive/root/children` → Ordner suchen, dessen Name mit
   der Projektnummer beginnt (Fallback: Ordnername = Plantitel).
3. `PUT /groups/{groupId}/drive/root:/{Projektordner}/{Unterordner}/{Dateiname}:/content`
   (bis 4 MB direkt, darüber Upload-Session). Antwort enthält `webUrl`.
4. Aufgabe anlegen wie bisher, Referenz mit der `webUrl` und Alias = Dateiname,
   Notizen als Beschreibung.

Offene Entscheidung: **Welcher Unterordner** bekommt abgelegte Dateien? Vorschläge:
`01 Kom` (Kommunikation) oder ein neuer Ordner `21 Aufgaben`. Noch nicht festgelegt.

Projekte vor 2024 liegen auf `S:\Projekte` (kein SharePoint). Dort ist kein Upload
möglich. Vorschlag: Aufgabe trotzdem anlegen, Pfad der Datei in die Notizen schreiben,
Hinweis im Formular. Betrifft nur noch Altprojekte.

## 5. Berechtigungen: der eine Punkt, den wir nicht allein lösen

Der Planner-Knopf hat genau vier Scopes (`User.Read`, `User.ReadBasic.All`,
`Tasks.ReadWrite`, `Mail.ReadWrite`), zentral vom Admin freigegeben. Harte Regel: dieses
Set nie ändern. Für den Upload fehlt `Files.ReadWrite.All` (delegiert). Der Tenant erlaubt
keine Nutzer-Zustimmung, also braucht jede neue Berechtigung den Admin.

Empfehlung: **neue App-Registrierung „Planner-Ablage"** mit `User.Read`,
`User.ReadBasic.All`, `Tasks.ReadWrite`, `Files.ReadWrite.All`, Redirect-URI (SPA)
`https://ingmoedl.github.io/planner-ablage/index.html`. Einmalige Admin-Zustimmung
anfordern, wie damals. Der Knopf bleibt völlig unberührt.

Zu klären: Darf Samuel Mödl im Tenant selbst App-Registrierungen anlegen? Prüfung unter
entra.microsoft.com → App-Registrierungen → „Neue Registrierung" sichtbar? Falls nicht,
legt der Admin die App an und trägt Samuel als Besitzer ein.

Variante ohne Admin (Notlösung, nicht empfohlen als Hauptweg): Die Hülle kopiert die
Datei in den lokal per OneDrive synchronisierten Projektordner
(`C:\Users\<Name>\ing Burghausen GmbH\2026 - 26510-03 …\01 Kom`) und baut die Web-Adresse
aus der OneDrive-Registrierung zusammen. Funktioniert nur für Projekte, die der jeweilige
Kollege gerade synchronisiert (hier 13 von 620 Plänen). Die Aufgabe selbst ließe sich mit
der bestehenden Knopf-App anlegen, dafür müsste aber deren Redirect-URI ergänzt werden.

## 6. Drag aus Outlook: Grenzen

- **Klassisches Outlook**: Mail ziehen liefert eine virtuelle .msg-Datei
  (FileGroupDescriptor). Chromium unterstützt das seit 2019, WebView2 sollte es also
  auch. **Muss auf diesem PC getestet werden.**
- **Neues Outlook**: Drag in Web-Seiten funktioniert laut Microsoft nicht (bekannte
  Einschränkung). Umweg: erst auf den Desktop ziehen (.eml), dann die Datei ablegen.
- Empfehlung: Für Mails bleibt der Planner-Knopf der Weg. Der Drop-Punkt ist für Dateien
  (PDF, Pläne, Fotos, Excel). Mails gehen zusätzlich, wo das Ziehen technisch klappt.

## 7. Weitergabe an Kollegen

Paket (ZIP oder Ordner im Teams-Kanal / SharePoint):

```
Planner-Ablage\
  Start.cmd                 kompiliert bei Bedarf, startet die Hülle
  Installieren.cmd          legt Autostart-Verknüpfung an, entfernt Internet-Kennzeichen
  Hülle\  PlannerAblage.cs  Quelltext der Hülle (lesbar)
  Hülle\  *.dll             drei WebView2-DLLs
  LIESMICH.txt              drei Sätze: entpacken, Installieren.cmd, anmelden
```

- Voraussetzungen beim Kollegen: Windows 10/11 mit WebView2-Laufzeit (kommt mit Edge und
  Office), .NET Framework 4.8 (in Windows enthalten), PowerShell 5.1. Alles auf jedem
  Firmen-PC vorhanden, keine Installation, kein Admin.
- Erster Start: Microsoft-Anmeldung einmal, Zustimmung ist vom Admin schon erteilt.
- Danach Pflege wie beim Knopf: Web-Seite per git push, Hülle nur bei Bedarf.
- Begleitend ein Skill „planner-ablage-installation" analog zum vorhandenen
  Installations-Skill, damit Kollegen sich per Cowork führen lassen können.
- Später möglich: zentrale Verteilung durch die IT per Intune (Win32-App). Nicht nötig
  für den Start.

Bekannte Stolperfallen und Gegenmittel:
- Internet-Kennzeichen (Mark of the Web) auf DLLs und Skripten aus ZIP/Teams →
  `Installieren.cmd` ruft `Unblock-File` auf den Ordner.
- SmartScreen bei fremden .exe → lokal kompilieren statt .exe verteilen.
- Firmenproxy blockt github.io → wie beim Knopf nicht der Fall (Pages läuft dort schon).
- Monitor abgesteckt → Position prüfen und auf Hauptmonitor fallen.
- Fehlende Team-Mitgliedschaft → 403 beim Upload oder beim Task, gleiche verständliche
  Meldung wie im Knopf.

## 8. Vor dem Bauen zu klären (Entscheidungen des Nutzers)

1. Admin-Freigabe für neue App „Planner-Ablage" mit `Files.ReadWrite.All` anfragen? (ja/nein
   entscheidet zwischen Hauptweg und Notlösung)
2. Darf Samuel Mödl App-Registrierungen anlegen (entra.microsoft.com prüfen)?
3. Ziel-Unterordner für abgelegte Dateien: `01 Kom`, `20 Transfer` oder neu `21 Aufgaben`?
4. Verhalten nach Drop: Fenster wächst am Ort zum Formular, oder eigenes Formularfenster
   neben dem Punkt?
5. Datei am Ursprungsort belassen (Kopie hochladen) oder nach Erfolg löschen? Vorschlag:
   belassen, nie löschen.
6. Altprojekte vor 2024 (S:): Aufgabe ohne Anhang mit Pfad in den Notizen akzeptabel?

## 9. Testplan nach dem Bauen (auf diesem PC)

- Hülle: Ziehen über alle drei Monitore, Größe ändern, Topmost an/aus, Neustart merkt sich alles.
- Drop aus Explorer (PDF, DWG, Bild, mehrere Dateien), aus klassischem Outlook (Mail,
  Anhang), aus neuem Outlook (erwartet: geht nicht direkt).
- Anmeldung, Planliste (620 Pläne), Bucket, Zuweisen, Upload in den Projektordner,
  Aufgabe mit Referenz in Planner sichtbar, Link öffnet die Datei in SharePoint.
- Kollegen-Simulation: Paket in neuen Ordner entpacken, `Installieren.cmd`, Neuanmeldung.

## 10. Quellen

- plannerExternalReference (nur http/https): https://learn.microsoft.com/en-us/graph/api/resources/plannerexternalreference?view=graph-rest-1.0
- Chromium-Unterstützung virtueller Outlook-Dateien (2019): https://chromium.googlesource.com/chromium/src.git/+/e524176b0fb387f1c3e509364cde09af045b8a91
- Neues Outlook, Drag in Web-Upload geht nicht: https://learn.microsoft.com/en-us/answers/questions/5770202/drag-and-drop-email-from-new-outlook-to-web-file-u
- WebView2 AllowExternalDrop: https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.wpf.webview2.allowexternaldrop
- WebView2 mit PowerShell 5.1 (net462-DLLs): https://learn.microsoft.com/en-us/answers/questions/1261967/using-webview2-with-powershell
- Redirect-URI ergänzen: https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri
- Files.ReadWrite.All: https://graphpermissions.merill.net/permission/Files.ReadWrite.All

---
name: planner-ablage-installation
description: Führt Mitarbeitende der ing Burghausen GmbH Schritt für Schritt durch Installation, erste Anmeldung und Bedienung der „Planner-Ablage" (der grüne Drop-Punkt von Samuel Mödl auf dem Desktop, auf den man eine Datei zieht und sofort eine Planner-Aufgabe im richtigen Projekt anlegt, die Datei hängt als Anlage dran) – inklusive Fehlerbehebung und Update. Immer verwenden, wenn jemand die Planner-Ablage, den „grünen Punkt", den Drop-Punkt, „Datei auf den Punkt ziehen" oder ein Desktop-Programm von Samuel/Mödl für Planner installieren, einrichten, aktualisieren oder reparieren will, wenn der Punkt nach dem Neustart fehlt, das Formular „Anmeldung nicht möglich" oder „Administratorgenehmigung erforderlich" zeigt – und auch dann, wenn jemand nur fragt, wie er aus einer Datei schnell eine Planner-Aufgabe macht. Für Aufgaben aus E-Mails heraus stattdessen planner-knopf-installation verwenden.
---

# Planner-Ablage installieren und nutzen

Du begleitest eine Kollegin oder einen Kollegen der ing Burghausen GmbH dabei, die
**Planner-Ablage** einzurichten und das erste Mal zu benutzen. Das ist ein kleiner grüner
Punkt auf dem Bildschirm: Datei darauf ziehen, daneben öffnet sich sofort das Formular
„Aufgabe in Planner" (Projekt, Bucket, Titel, Zuweisen an, Start, Ende, Fällig am, Notizen).
Die Datei hängt danach als Anlage an der Aufgabe; gespeichert wird sie in der Anlagen-Bibliothek
des Jahres-Teams, **nicht** im Projektordner (taucht also nicht im Explorer auf). Das Original
bleibt, wo es war. Doppelklick auf den Punkt öffnet das Formular ohne Datei.

Die Installation dauert etwa eine Minute, braucht **keine Admin-Rechte** und besteht aus
einem einzigen Befehl. Derselbe Befehl bringt eine ältere Installation auf den neuesten Stand.
Ab Version 0.5 hält sich der Punkt danach selbst aktuell. Die Installation geht nur über den
Bildschirm der Person selbst: Du bereitest vor, erklärst und prüfst – die Klicks macht sie.

## So begleitest du

Die meisten Kolleginnen und Kollegen sind Bauingenieure, keine IT-Leute. Deshalb:

- **Ein Schritt pro Nachricht**, dann auf Rückmeldung warten. Nenne die Position
  („Schritt 2 von 4").
- Kurze Einleitung (zwei Sätze: was der Punkt bringt, dass es ein Befehl ohne Admin ist),
  dann direkt Schritt 1.
- Sag bei jedem Schritt in einem Satz, **wozu** er dient, und schließe mit einer
  **Erfolgskontrolle** („Du solltest jetzt … sehen").
- Screenshots genau lesen; die Fehlerbehebung unten deckt die typischen Bilder ab.
- Deutsch; duzen oder siezen wie die Person dich anspricht.

## Der Ablauf

### Schritt 1 – PowerShell öffnen

Das ist das blaue Befehlsfenster von Windows. Kein Admin nötig, ganz normal öffnen:

- **Windows-Taste** drücken, `PowerShell` tippen, **Enter**. **Nicht** „Als Administrator ausführen"
  wählen: Ein mit Adminrechten gestarteter Punkt darf aus Sicherheitsgründen von Windows keine Dateien
  per Drag & Drop annehmen (rotes Verbotszeichen). Seit v0.4 fängt die Ablage das selbst ab, trotzdem
  normal öffnen.

Erfolgskontrolle: Ein blaues (oder schwarzes) Fenster mit einer Zeile, die auf `>` endet,
zum Beispiel `PS C:\Users\mustermann>`.

### Schritt 2 – Installationsbefehl ausführen

Diese eine Zeile kopieren, im PowerShell-Fenster mit Rechtsklick (oder Strg+V) einfügen
und **Enter** drücken:

```
irm https://raw.githubusercontent.com/ingmoedl/planner-ablage/main/install.ps1 | iex
```

Was passiert: Der Befehl lädt den aktuellen Stand der Planner-Ablage von GitHub (dort
liegt nur Programmcode, keine Firmendaten), übersetzt das kleine Programm direkt auf dem PC
(deshalb gibt es keine Warnung wegen fremder Programme), legt es im eigenen Benutzerprofil
unter `%LOCALAPPDATA%\PlannerAblage` ab, trägt es ins Startmenü ein, schaltet bei der
Erstinstallation den Autostart ein und startet den Punkt. Es wird nichts systemweit
installiert. Bei einer bestehenden Installation bleiben Einstellungen, Anmeldung und die
Autostart-Wahl erhalten.

Erfolgskontrolle: Im Fenster erscheinen die Zeilen „1/4 Herunterladen", „2/4 Übersetzen",
„3/4 Dateien ablegen", „4/4 Einrichten" und am Ende grün **„Fertig. Planner-Ablage v0.5
läuft - der grüne Punkt ist unten rechts auf dem Hauptbildschirm."** (Versionsnummer kann
höher sein.) Unten rechts auf dem Hauptbildschirm (über der Uhr) sitzt ein runder grüner
Punkt mit Pfeil und dem Wort „Planner". Das PowerShell-Fenster kann jetzt geschlossen werden.

Häufige Falle: Wenn stattdessen „irm : Der Remotename konnte nicht aufgelöst werden"
erscheint, fehlt gerade die Internetverbindung oder github.com ist blockiert – siehe
Fehlerbehebung.

### Schritt 3 – Erstes Ablegen und einmalig anmelden

Eine beliebige Datei (z. B. ein PDF vom Desktop) mit der Maus auf den grünen Punkt ziehen
und loslassen. Sofort öffnet sich daneben das Fenster „Aufgabe in Planner". Oben steht
beim ersten Mal ein grüner Knopf **„Bei Microsoft anmelden"**.

Erkläre vorher, was passiert:
- Klick auf den Knopf → Microsoft-Anmeldung mit dem Firmenkonto. Vier Berechtigungen:
  Profil lesen, Namen der Kollegen lesen (für „Zuweisen an"), Aufgaben erstellen, Dateien
  lesen und schreiben (für das Ablegen der Datei im Team). Alles wirkt nur im Namen der
  Person selbst.
- Der Admin der ing Burghausen GmbH hat die App bereits zentral freigegeben. Erscheint
  trotzdem „Administratorgenehmigung erforderlich", ist die Freigabe noch nicht erteilt –
  siehe Fehlerbehebung.
- Anmelden ist **genau einmal** nötig; danach öffnet sich das Formular künftig ohne Nachfrage.

Erfolgskontrolle: Nach der Anmeldung steht unter „Projekt / Plan" kurz „Pläne werden
geladen …" (beim ersten Mal einige Sekunden, weil alle Jahres-Teams durchsucht werden),
dann eine Zeile wie „620 Pläne · Teams: 2020, 2021, …, 2026". Bei „Zuweisen an" steht
der eigene Name. In der Anlagenliste steht die Datei mit grünem Haken.

### Schritt 4 – Probelauf

Am besten mit einer Datei, in deren Namen eine Projektnummer steht (z. B.
`26510-03 Grundriss.pdf`). Im Formular:

1. **Anlage** – die abgelegte Datei mit Größe und grünem Haken. Weitere Dateien lassen sich
   direkt ins Fenster dazu ziehen; × entfernt eine Datei wieder.
2. **Projekt / Plan** – wurde die Nummer im Dateinamen erkannt, steht der Plan schon drin
   („✓ … erkannt"). Sonst Projektnummer oder Namensteil tippen und aus der Liste wählen.
3. **Bucket** – erscheint nach der Planwahl mit den Buckets dieses Plans; vorausgewählt ist
   der zuletzt in diesem Plan genutzte. Plan ohne Buckets → Feld fehlt, das ist normal.
4. **Titel** – vorausgefüllt mit dem Dateinamen ohne Endung, frei änderbar.
5. **Zuweisen an** – vorbelegt mit sich selbst, per Tippen auf jede interne Person umstellbar.
6. **Start**, **Ende**, **Fällig am** – alle optional. Planner zeigt Start und Fällig am auf
   der Karte; das Ende schreibt die Ablage als erste Zeile „Geplantes Ende: …" in die
   Beschreibung, weil Planner kein drittes Datum kennt.
7. **Notizen** – optional, wird zur Beschreibung der Aufgabe.
8. **„Aufgabe erstellen"** → Fortschrittsbalken beim Ablegen der Datei, dann
   „✓ Aufgabe angelegt in … → Bucket …", „1 Datei als Anlage angehängt – gespeichert in der
   Anlagen-Bibliothek des Teams, nicht im Projektordner" und der Link **„In Planner öffnen"**.
   Im Planner steht die Datei unter „Anlagen" der Aufgabe (mit Vorschau auf der Karte). Sie
   liegt in der Bibliothek „Websiteobjekte" des Jahres-Teams im Ordner
   `Planner-Anlagen\<Projekt>` – die wird nicht mit dem Explorer synchronisiert, deshalb
   taucht die Datei dort nicht auf. Erreichbar ist sie über die Aufgabe.

Danach das Formular mit „Schließen" zumachen. Der Punkt bleibt.

Bedienung des Punkts (kurz mitgeben):
- **Ziehen** mit gedrückter Maustaste → verschieben, auch auf einen anderen Bildschirm.
- **Mausrad** über dem Punkt → größer/kleiner.
- **Rechtsklick** → „Im Vordergrund halten" an/aus, Größe, Deckkraft, „Mit Windows
  starten", „Automatisch aktualisieren", „Jetzt auf neue Version prüfen",
  „Neu installieren / reparieren", „Protokoll-Ordner öffnen", Versionsnummer, „Beenden".
- **Doppelklick** → Formular ohne Datei (Aufgabe ohne Anlage).
- **Punkt weg?** Windows-Taste, „Planner-Ablage" tippen, Enter – er steht im Startmenü.

## Fehlerbehebung

| Symptom | Ursache | Lösung |
|---|---|---|
| PowerShell: „irm : Der Remotename konnte nicht aufgelöst werden" oder Zeitüberschreitung | Kein Internet oder github.com blockiert | Verbindung prüfen; bleibt es dabei, Samuel Mödl bitten, den Ordner „Planner-Ablage" als ZIP zu schicken – entpacken, `Installieren.cmd` doppelklicken |
| Beim Ziehen auf den Punkt erscheint ein rotes Verbotszeichen, Drop ins Formularfenster geht | Punkt läuft mit Administratorrechten (PowerShell wurde „als Administrator" geöffnet); Windows blockiert Drag & Drop in erhöhte Programme | Rechtsklick → Beenden, dann Befehl aus Schritt 2 in einer *normalen* PowerShell erneut ausführen (oder PC neu starten). Seit v0.4 startet sich der Punkt bei Erhöhung selbst mit normalen Rechten neu |
| PowerShell: rote Meldung „… kann nicht geladen werden, da die Ausführung von Skripts … deaktiviert ist" | Gilt nur für Skriptdateien, nicht für den Befehl oben; erscheint, wenn jemand `install.ps1` als Datei doppelgeklickt hat | Den Befehl aus Schritt 2 im PowerShell-Fenster ausführen (kein Doppelklick auf die Datei) |
| „Der C#-Compiler (.NET Framework 4.8) fehlt" | Sehr alter oder stark reduzierter PC | Samuel Mödl informieren |
| Punkt erscheint nicht / verschwindet nach Neustart | Autostart ist aus (Rechtsklick-Menü oder Task-Manager „Autostart") oder der Punkt wurde mit „Beenden" geschlossen | Windows-Taste, „Planner-Ablage" tippen, Enter (Startmenü-Eintrag, ab v0.5 immer vorhanden); soll er wieder mit Windows starten: Rechtsklick → „Mit Windows starten" anhaken. Fehlt der Startmenü-Eintrag: Befehl aus Schritt 2 erneut ausführen |
| Punkt zeigt kurz „wird auf Version … aktualisiert", verschwindet und kommt nach etwa einer Minute wieder | Normal: automatische Aktualisierung (ab v0.5, alle 6 Stunden geprüft) | Nichts tun. Kommt der Punkt nicht wieder: Windows-Taste, „Planner-Ablage", Enter; Details in `%LOCALAPPDATA%\PlannerAblage\update.log` |
| Die abgelegte Datei taucht im Projektordner im Explorer auf | Alte Version (bis 0.4) legte die Datei in den Projektordner der Team-Bibliothek | Rechtsklick auf den Punkt → Versionsnummer prüfen; unter 0.5: Befehl aus Schritt 2 ausführen. Die alte Datei im Projektordner darf gelöscht werden (die Anlage der alten Aufgabe zeigt dann ins Leere) |
| Punkt ist da, Fenster zeigt aber nur „Formular wird geladen …" oder „Seite konnte nicht geladen werden" | Kein Internet oder github.io blockiert; Formular liegt auf GitHub Pages | Verbindung prüfen, Fenster schließen, Datei erneut ablegen |
| „Die Microsoft Edge WebView2-Laufzeit fehlt" | WebView2 nicht installiert (sehr selten, kommt mit Office/Edge) | Samuel Mödl informieren |
| Microsoft-Fenster: „Administratorgenehmigung erforderlich" | Der Tenant lässt keine eigene Zustimmung zu; der M365-Admin muss die App „Planner-Ablage" einmal freigeben | „Zur Anwendung zurückkehren" klicken, Fenster schließen, Samuel Mödl Bescheid geben – er holt die Freigabe ein. Danach klappt es ohne weiteres Zutun |
| Formular: „Anmeldung nicht möglich" / „Noch keine App-Registrierung hinterlegt" | Veraltete Formularversion im Zwischenspeicher | Fenster schließen, Rechtsklick auf den Punkt → „Aktualisieren", danach erneut ablegen |
| Datei zeigt „⚠ nicht lesbar" | Datei war während des Ablegens gesperrt oder wurde verschoben | Mit × entfernen, Datei schließen (z. B. in Acrobat) und erneut ablegen |
| „Hier kam keine Datei an" beim Ziehen aus dem neuen Outlook | Das neue Outlook übergibt Mails nicht direkt an Programme | Mail erst auf den Desktop ziehen, dann die entstandene Datei auf den Punkt. Für Mails ist der **Planner-Knopf** in Outlook der bessere Weg |
| Ordner wird nicht übernommen | Absichtlich: nur Dateien | Dateien einzeln oder mehrere zusammen markieren und ziehen |
| Projekt ist nicht in der Liste | Sichtbar sind nur Pläne aus Teams, in denen man Mitglied ist (Jahres-Teams 2020–2026) | Vom Team-Besitzer ins Jahres-Team aufnehmen lassen; Formular schließen und neu öffnen |
| Beim Erstellen: „Keine Berechtigung, … im Team dieses Projekts abzulegen" oder „Keine Berechtigung für diesen Plan" | Nicht Mitglied im Jahres-Team des Projekts | Vom Team-Besitzer aufnehmen lassen, erneut versuchen |
| „Zu diesem Plan ist kein Team bekannt" | Privater Plan ohne Team – dort gibt es keine Dateiablage | Anderen Plan wählen oder Aufgabe über den Planner-Knopf ohne Datei anlegen |
| Kollegin/Kollege fehlt unter „Zuweisen an" | Nur interne Konten „Nachname, Vorname" werden gezeigt | Samuel Mödl informieren |

Update: Ab Version 0.5 prüft der Punkt 45 Sekunden nach dem Start und dann alle sechs
Stunden, ob es eine neue Version gibt, und installiert sie selbst im Hintergrund (nicht,
während ein Formular offen ist). Einstellungen und Anmeldung bleiben erhalten. Von Hand:
Rechtsklick → **„Jetzt auf neue Version prüfen"** (fragt vor dem Update nach) oder
**„Neu installieren / reparieren"**. Ältere Punkte (bis 0.4) einmal mit dem Befehl aus
Schritt 2 nachziehen; danach läuft es von selbst. Abschalten geht per Rechtsklick →
„Automatisch aktualisieren". Das Formular selbst aktualisiert sich ohnehin sofort, weil es
online liegt.

## Hintergrund für Rückfragen

- **Was wird installiert?** Nur im Benutzerprofil (`%LOCALAPPDATA%\PlannerAblage`): ein
  kleines Windows-Programm (der Punkt, Quelltext liegt bei und wird lokal übersetzt), drei
  Microsoft-WebView2-Bibliotheken, ein Startmenü-Eintrag und bei der Erstinstallation eine
  Autostart-Verknüpfung im eigenen Startordner. Keine Admin-Rechte, keine Registry-Änderungen
  außerhalb des Benutzers. Updates holt der Punkt selbst von GitHub (nur Programmcode).
- **Wo liegen die Daten?** Ausschließlich in Microsoft 365 der Firma: Die Datei geht direkt
  vom PC in die SharePoint-Bibliothek „Websiteobjekte" der Team-Site des Jahres-Teams
  (Ordner `Planner-Anlagen\<Projekt>`), die Aufgabe nach Planner. Diese Bibliothek gehört zum
  Team wie die Projektdateien, wird aber nicht mit dem Explorer synchronisiert – deshalb bleibt
  der Projektordner sauber. Zugriff haben alle Team-Mitglieder. Das Formular wird von GitHub
  Pages geladen und enthält nur Programmcode; der Hosting-Server sieht nie Dateien oder Aufgaben.
- **Was sieht Samuel Mödl?** Nichts. Es gibt keinen zentralen Server; jede Person arbeitet
  mit ihrem eigenen Microsoft-Konto.
- **Original löschen?** Nein, nie. Es wird eine Kopie hochgeladen.
- **Zusammenhang mit dem Planner-Knopf:** Der Knopf macht dasselbe aus einer geöffneten
  E-Mail in Outlook; die Ablage macht es für Dateien. Beide legen die Aufgabe im gleichen
  Plan an und lassen sich nebeneinander nutzen.

## Ansprechpartner

Bei allem, was hier nicht gelöst wird: **Samuel Mödl** (moedl@ing-burghausen.de), er
betreut die Planner-Ablage und holt Admin-Freigaben ein.

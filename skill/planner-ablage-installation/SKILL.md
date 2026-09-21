---
name: planner-ablage-installation
description: Führt Mitarbeitende der ing Burghausen GmbH Schritt für Schritt durch Installation, erste Anmeldung und Bedienung der „Planner-Ablage" (der grüne Drop-Punkt von Samuel Mödl auf dem Desktop, auf den man eine Datei zieht und sofort eine Planner-Aufgabe im richtigen Projekt anlegt, die Datei hängt als Anlage dran) – inklusive Fehlerbehebung und Update. Immer verwenden, wenn jemand die Planner-Ablage, den „grünen Punkt", den Drop-Punkt, „Datei auf den Punkt ziehen" oder ein Desktop-Programm von Samuel/Mödl für Planner installieren, einrichten, aktualisieren oder reparieren will, wenn der Punkt nach dem Neustart fehlt, das Formular „Anmeldung nicht möglich" oder „Administratorgenehmigung erforderlich" zeigt – und auch dann, wenn jemand nur fragt, wie er aus einer Datei schnell eine Planner-Aufgabe macht. Für Aufgaben aus E-Mails heraus stattdessen planner-knopf-installation verwenden.
---

# Planner-Ablage installieren und nutzen

Du begleitest eine Kollegin oder einen Kollegen der ing Burghausen GmbH dabei, die
**Planner-Ablage** einzurichten und das erste Mal zu benutzen. Das ist ein kleiner grüner
Punkt auf dem Bildschirm: Datei darauf ziehen, daneben öffnet sich sofort das Formular
„Aufgabe in Planner" (Projekt, Bucket, Titel, Zuweisen an, Start, Ende, Fällig am, Notizen).
Die Datei wird im Jahres-Team des Projekts abgelegt und hängt als Anlage an der Aufgabe.
Das Original bleibt, wo es war. Doppelklick auf den Punkt öffnet das Formular ohne Datei.

Die Installation dauert etwa eine Minute, braucht **keine Admin-Rechte** und besteht aus
einem einzigen Befehl. Sie geht nur über den Bildschirm der Person selbst: Du bereitest vor,
erklärst und prüfst – die Klicks macht sie.

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

- **Windows-Taste** drücken, `PowerShell` tippen, **Enter**.

Erfolgskontrolle: Ein blaues (oder schwarzes) Fenster mit einer Zeile, die auf `>` endet,
zum Beispiel `PS C:\Users\mustermann>`.

### Schritt 2 – Installationsbefehl ausführen

Diese eine Zeile kopieren, im PowerShell-Fenster mit Rechtsklick (oder Strg+V) einfügen
und **Enter** drücken:

```
irm https://raw.githubusercontent.com/ingmoedl/planner-ablage/main/install.ps1 | iex
```

Was passiert: Der Befehl lädt den aktuellen Stand der Planner-Ablage von GitHub (dort
liegt nur Programmcode, keine Firmendaten), legt ihn im eigenen Benutzerprofil unter
`%LOCALAPPDATA%\PlannerAblage` ab, übersetzt das kleine Programm direkt auf dem PC (deshalb
gibt es keine Warnung wegen fremder Programme), richtet den Autostart ein und startet den
Punkt. Es wird nichts systemweit installiert.

Erfolgskontrolle: Im Fenster erscheinen die Zeilen „1/3 Herunterladen", „2/3 Dateien
ablegen", „3/3 Einrichten" und am Ende grün **„Fertig. Der grüne Punkt ist unten rechts
auf dem Hauptbildschirm."** Unten rechts auf dem Hauptbildschirm (über der Uhr) sitzt ein
runder grüner Punkt mit Pfeil und dem Wort „Planner". Das PowerShell-Fenster kann jetzt
geschlossen werden.

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
   „✓ Aufgabe angelegt in … → Bucket …", „1 Datei im Team abgelegt und angehängt" und der
   Link **„In Planner öffnen"**. Im Planner steht die Datei unter „Anlagen" der Aufgabe und
   liegt in den Dateien des Jahres-Teams im Ordner des Projekts.

Danach das Formular mit „Schließen" zumachen. Der Punkt bleibt.

Bedienung des Punkts (kurz mitgeben):
- **Ziehen** mit gedrückter Maustaste → verschieben, auch auf einen anderen Bildschirm.
- **Mausrad** über dem Punkt → größer/kleiner.
- **Rechtsklick** → „Im Vordergrund halten" an/aus, Größe, Deckkraft, „Mit Windows
  starten", „Aktualisieren", „Protokoll-Ordner öffnen", „Beenden".
- **Doppelklick** → Formular ohne Datei (Aufgabe ohne Anlage).

## Fehlerbehebung

| Symptom | Ursache | Lösung |
|---|---|---|
| PowerShell: „irm : Der Remotename konnte nicht aufgelöst werden" oder Zeitüberschreitung | Kein Internet oder github.com blockiert | Verbindung prüfen; bleibt es dabei, Samuel Mödl bitten, den Ordner „Planner-Ablage" als ZIP zu schicken – entpacken, `Installieren.cmd` doppelklicken |
| PowerShell: rote Meldung „… kann nicht geladen werden, da die Ausführung von Skripts … deaktiviert ist" | Gilt nur für Skriptdateien, nicht für den Befehl oben; erscheint, wenn jemand `install.ps1` als Datei doppelgeklickt hat | Den Befehl aus Schritt 2 im PowerShell-Fenster ausführen (kein Doppelklick auf die Datei) |
| „Der C#-Compiler (.NET Framework 4.8) fehlt" | Sehr alter oder stark reduzierter PC | Samuel Mödl informieren |
| Punkt erscheint nicht / verschwindet nach Neustart | Autostart-Verknüpfung fehlt oder Punkt wurde mit „Beenden" geschlossen | Windows-Taste, „Planner-Ablage" tippen und starten; dann Rechtsklick → „Mit Windows starten" anhaken. Alternativ Befehl aus Schritt 2 erneut ausführen |
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

Update: Rechtsklick auf den Punkt → **„Aktualisieren (neueste Version holen)"**. Das führt
denselben Befehl wie bei der Installation aus; Einstellungen und Anmeldung bleiben erhalten.
Das Formular selbst aktualisiert sich ohnehin automatisch, weil es online liegt.

## Hintergrund für Rückfragen

- **Was wird installiert?** Nur im Benutzerprofil (`%LOCALAPPDATA%\PlannerAblage`): ein
  kleines Windows-Programm (der Punkt, Quelltext liegt bei und wird lokal übersetzt), drei
  Microsoft-WebView2-Bibliotheken und eine Autostart-Verknüpfung im eigenen Startordner.
  Keine Admin-Rechte, keine Registry-Änderungen außerhalb des Benutzers.
- **Wo liegen die Daten?** Ausschließlich in Microsoft 365 der Firma: Die Datei geht direkt
  vom PC in die SharePoint-Bibliothek des Jahres-Teams (dort, wo auch Planner selbst
  Anlagen speichert), die Aufgabe nach Planner. Das Formular wird von GitHub Pages geladen
  und enthält nur Programmcode; der Hosting-Server sieht nie Dateien oder Aufgaben.
- **Was sieht Samuel Mödl?** Nichts. Es gibt keinen zentralen Server; jede Person arbeitet
  mit ihrem eigenen Microsoft-Konto.
- **Original löschen?** Nein, nie. Es wird eine Kopie hochgeladen.
- **Zusammenhang mit dem Planner-Knopf:** Der Knopf macht dasselbe aus einer geöffneten
  E-Mail in Outlook; die Ablage macht es für Dateien. Beide legen die Aufgabe im gleichen
  Plan an und lassen sich nebeneinander nutzen.

## Ansprechpartner

Bei allem, was hier nicht gelöst wird: **Samuel Mödl** (moedl@ing-burghausen.de), er
betreut die Planner-Ablage und holt Admin-Freigaben ein.

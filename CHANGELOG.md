# Änderungen an Azubix

## v3.1: weniger Eingaben auf einmal

- **Einrichtung Schritt für Schritt:** Statt vier langer Formulare kommt eine Frage nach der anderen („Was lernst du?“, „Wann bist du in der Schule?“, „Wo wohnst du?“, „Was machst du im Betrieb?“), mit „Weiter“ und Fortschrittspunkten.
- **Freiwilliges ist eingeklappt:** Name, Betrieb, Logo, Arbeitszeiten, Urlaub, Schreibstil und Zeichenlimit liegen unter aufklappbaren Bereichen. Die Kurzfassung daneben zeigt, was eingestellt ist.
- **Übersicht nach dem Schreiben:** Die Einrichtung klappt zu einer Karte „Deine Angaben“ zusammen. Ein Klick auf einen Wert öffnet direkt den passenden Schritt.
- Die Leiste „Nachweise schreiben“ erscheint nur noch im letzten Schritt oder wenn Wochen offen sind.
- Die Register-Navigation nummeriert die Schritte 1 bis 5.
- README neu bebildert, Entwicklerteil entfernt.

## v3.0: alles aus der Ideenliste

**Neu**

- **Übertragen-Assistent** fürs IHK-Portal: Tag für Tag oder Woche für Woche kopieren, übertragene Wochen werden markiert.
- **Stichworte pro Tag**, aus denen die KI den Eintrag schreibt. „Erst Stichworte eintragen“ legt die Wochen vorher an.
- **Unterweisungen** als drittes IHK-Feld pro Woche, auf Wunsch mit KI-Vorschlag.
- **Mehrere Ausbildungsjahre**: Menü neben dem Logo, das nächste Jahr schließt bei Zeitraum und Nachweis-Nummer an.
- **Berufsschul-Blöcke**, **Stunden pro Wochentag** (Teilzeit), **regionale und einmalige Feiertage**.
- **Kalender-Import** (.ics) für Urlaub, Krankheit, Ferien und Schulblöcke.
- **PDF- und Word-Export** (.docx) und eine **Prüfansicht für Ausbilder/innen** mit Kommentaren zum Zurückladen.
- **Ausbildungsrahmenplan**: zeigt, welche Positionen in den Einträgen vorkommen.
- **Wiederholungs-Check** für sehr ähnliche Einträge, **Qualitätscheck** nach dem Schreiben (Datum raus, Zeichenlimit).
- **Für alle Wochen**: Textbaustein-Wochen neu schreiben, zu lange Einträge kürzen, Stempel entfernen.
- **Firmenlogo** für Druck, PDF und Word.
- **Einführung**, **Beispiel ansehen**, **Tastenkürzel** (`?`), **Rückgängig** auch für eigene Änderungen.
- **Als App installierbar** (PWA) mit Offline-Speicher.

**KI**

- **Weiter schreiben** nach Neuladen, wenn das Schreiben unterbrochen wurde.
- Ein eigener Schlüssel springt als **Reserve** ein, wenn die kostenlose KI ausfällt.
- Typische Aufgaben je Beruf gehen in den Prompt. Lernfelder für alle vier IT-Berufe der Neuordnung 2020; dabei zwei falsche Bezeichnungen korrigiert (LF10c–12c, LF12b).
- Vorlage für einen **eigenen KI-Server** (Cloudflare Worker). Liegt nur in der Entwicklerkopie, nicht im öffentlichen Repo.

**Technik**

- **IndexedDB** statt localStorage, alte Daten werden automatisch übernommen. API-Schlüssel auf Wunsch nur für die Sitzung.
- **Automatische Tests** (nur lokal, nicht im Repo) mit Logik-Tests (2 Testdateien, rund 100 Prüfungen), ESLint und Browser-Tests (Playwright, 9 Tests) inklusive Barrierefreiheits-Prüfung mit axe-core.
- **Prettier**, **JSDoc-Typen** (`core/types.js`), `jsconfig.json`.
- Barrierefreiheit: Kontrast der Abwesenheits-Labels verbessert. Wochen bleiben nach dem Schreiben nicht mehr alle aufgeklappt.

**README**

- Neu gestaltet: Banner und Screenshots für hellen und dunklen Modus, Badges, Funktions-Übersicht, aufklappbare Fragen. Bilder liegen in `docs/images/`.

**Lizenz**

- Mit Azubix darf kein Geld verdient werden (kein Verkauf, kein bezahlter Dienst, keine Werbung). Das eigene Berichtsheft schreiben bleibt erlaubt, auch in Firmen.

## 🤖 KI

- **Kostenlose KI ohne Anmeldung**: Pollinations.ai statt Anthropic-API (die ging ohne Key nicht).
- **Wochen werden gebündelt** (Standard: 3 pro Anfrage), damit das Free-Limit (1 Anfrage / 30 s) reicht.
- **Rate-Limit-Handling**: wartet automatisch mit Countdown (immer volle 30 s, frühere Versuche verlängern das Limit) und versucht es dann erneut.
- **Abgeschnittene Antworten werden gerettet**: Vollständige Tage werden übernommen, nur fehlende Tage werden nachgefordert.
- `reasoning_effort: low` für das Gratis-Modell, damit es nicht das ganze Token-Budget fürs „Nachdenken“ verbraucht (sonst kamen oft leere Antworten zurück).
- **Eigener API-Key optional** (Groq, OpenRouter, OpenAI, Ollama) oder **Offline-Vorlagen**. Dazu ein Button zum Testen der Verbindung.
- **Besserer Prompt**: Lernfelder passend zum Ausbildungsjahr, Bezug auf die Vorwochen, Schreibstil (Ich-Form, neutral oder Stichpunkte) und Länge wählbar, Feld für eigene Hinweise.
- **Datenschutz**: Name und Betrieb werden nicht mehr an die KI geschickt.
- **Robustes Parsen**: JSON wird auch aus fehlerhaften Antworten gelesen. Fehlende Tage werden mit Vorlagen aufgefüllt.

## 🗓️ Logik / Bugfixes

- **Zeitzonen-Bug behoben**: `toISOString()` hat in Deutschland Daten um einen Tag verschoben. Deshalb lagen alle Feiertage einen Tag daneben und der Start war der 31.07.
- **Feiertage korrigiert** für alle 16 Länder: u.a. fehlte der Reformationstag, der Buß- und Bettag lag fest auf dem 18.11. und in RP war fälschlich Mariä Himmelfahrt eingetragen.
- **Schulferien automatisch** für alle 16 Bundesländer über die OpenHolidays API. Vorher gab es nur hartcodierte Daten für 2024/25 in 3 Ländern.
- **Schulferien ≠ frei**: In den Ferien arbeitet man im Betrieb. Vorher wurden ganze Wochen als frei markiert.
- **Urlaub & Krankheit** lassen sich als eigene Abwesenheiten eintragen.
- **Kalenderwoche** um das ISO-Jahr ergänzt (KW 1 im Dezember wird richtig zugeordnet).
- **XSS-Lücke** bei Ferien-Namen geschlossen, Export-Dateinamen bereinigt.

## 🎨 UI / UX (v2.1: neues Design)

- **Modern und clean**: eine Schriftfamilie (Instrument Sans), dunkle „Tinte“ als einzige Akzentfarbe, Farbe nur für Wochentypen. Keine Emojis, keine Verläufe, keine Großbuchstaben-Labels.
- **Farben geprüft**: Schule, Betrieb und Ferien sind auch für Farbenblinde unterscheidbar, im hellen und im dunklen Modus (mit dem Palette-Validator aus dem dataviz-Skill getestet).
- **Register-Navigation A–E** links mit Häkchen pro erledigtem Abschnitt und Fortschritt („51/51“). Auf dem Handy als Leiste oben.
- **Jahresplaner**: Wochen nach Monaten gruppiert, die aktuelle Woche ist markiert, noch nicht geschriebene Wochen sind schraffiert.
- **Wochen als Nachweis-Tabelle** (Tag | Tätigkeit | Std.) mit Summe. Zugeklappt zeigt jede Woche eine Textvorschau.
- **Neu: „Als geprüft stempeln“**: Markiert Wochen, die du kontrolliert hast, mit Stempel und Datum. Der Zähler zeigt, wie viele noch fehlen.
- Schultage als Ankreuzkästchen, Rhythmus als Segment-Schalter, schlichte Felder mit Fokusring.
- Texte überarbeitet: klare Sätze statt Punkt-Listen, Buttons und Meldungen benutzen dieselben Wörter („Nachweise schreiben“ → „51 Wochen geschrieben“).
- Fortschritt mit **Abbrechen**, „Neu schreiben lassen“ und „Text kopieren“ pro Woche, Suche, Hell/Dunkel, mobilfreundlich.

## 🧑‍💻 v2.2

- **Ausbildungsberuf als Auswahlliste** mit allen IT-Berufen: 4× Fachinformatiker/in, IT-System-Elektroniker/in, Kaufleute für Digitalisierungs- und IT-System-Management, dazu MATSE, Elektroniker/in für Informations- und Systemtechnik, Informationselektroniker/in und E-Commerce. Über „Anderer Beruf“ lässt sich jeder Beruf eintragen. Vorher war es ein Textfeld, das andere Berufe ausgeblendet hat.
- **Lernfelder 1 bis 5** gelten jetzt für alle vier IT-Berufe der Neuordnung 2020, nicht nur für Fachinformatiker.
- **Schulferien eindeutig beschriftet**: „Betrieb, Schulferien“ statt nur „Schulferien“, und an jedem Tag steht „keine Schule“. Die KI bekommt den Hinweis „kein Unterricht“. In den Ferien sind alle Tage Betriebstage, wie bisher.

## ✏️ v2.3: Tage einzeln bearbeiten

- **Jeder Tag hat eigene Werkzeuge**: „Kopieren“, „Mit KI ändern“ und „KI-Änderung rückgängig“ (merkt sich die letzten 5 Versionen).
- **Mit KI ändern**: Fertige Knöpfe für Umschreiben, Kürzer, Ausführlicher, Fachlicher, Einfacher und Rechtschreibung. Dazu ein Feld für eigene Anweisungen wie „Erwähne den Laptop für die Kollegin“. Die KI kennt die anderen Tage der Woche und wiederholt sie nicht.
- **Für das IHK-Portal**: Kopiert wird immer reiner Text. Pro Woche gibt es „Betrieb kopieren“ und „Schule kopieren“ für die Wochenfelder im IHK-Formular, mit Stundensumme in der Meldung.
- **Zeichenzähler** pro Tag und optionales **Zeichenlimit** (Abschnitt D). Die KI hält das Limit ein, Einträge darüber werden rot markiert.
- KI schreibt kein Datum und keinen Wochentag mehr in den Text, weil die schon im Formular stehen. Die Offline-Textbausteine wiederholen sich nicht mehr.

## 📁 v2.4: Azubix und neue Ordnerstruktur

- **Neuer Name: Azubix.** Die Startdatei heißt jetzt `index.html` (läuft so direkt auf GitHub Pages).
- **Ordner nach Themen**: `core/`, `data/`, `ai/`, `app/` und `ui/` statt aller Skripte in einem Ordner. Die großen Dateien sind aufgeteilt, z.B. die KI in Anbieter, Prompts, Schreiben und Vorlagen.
- **CSS in 9 Dateien** (Farben, Grundlagen, Layout, Formulare, Abschnitte, Ergebnisse, Dialoge, Handy, Druck) statt einer Datei mit 1900 Zeilen.
- **Tests im Repo**: `npm test` prüft Feiertage, Kalenderwochen, Wochenplan und KI-Antworten (28 Tests).
- Dazu `LICENSE` (MIT mit Pflicht zur Namensnennung: s4bt, Link zum Repo und zu s4bt.de), `.gitignore`, Favicon als eigene Datei, Screenshot in `docs/`.
- **README neu** und **idea.md** mit Ideen für später.
- KI nennt Lernfelder nur noch an Schultagen.

## 💾 Speichern & Export

- **Autosave** aller Eingaben und Texte im Browser.
- **Backup** als JSON exportieren und importieren (ohne API-Key).
- **Druck / PDF**: ein Ausbildungsnachweis pro A4-Seite mit Tabelle, Stunden und Unterschriftsfeldern (funktioniert auch mit Strg+P).
- **CSV** mit BOM (Umlaute in Excel korrekt) plus Stunden und Zusammenfassung. **TXT** übersichtlicher.

## 🛠️ Technik

- Code aufgeteilt in `holidays.js` und `ai.js`, zentraler `state` statt verstreuter Globals und DOM-Auslesen.
- Event-Delegation statt `onclick` im HTML.
- Weiterhin ohne Build-Schritt: Die HTML-Datei lässt sich direkt öffnen.
- README nach UTF-8 konvertiert (war UTF-16 und auf GitHub kaputt) und aktualisiert. GitHub-Repo verlinkt.

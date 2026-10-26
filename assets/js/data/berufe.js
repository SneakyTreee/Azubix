// Ausbildungsberufe und Lernfelder (Rahmenlehrplan IT-Berufe, Neuordnung 2020)

// IT-Ausbildungsberufe (Wert = Anzeige = Text im Nachweis)
const IT_BERUFE = {
  "Fachinformatiker/in": [
    "Fachinformatiker/in – Anwendungsentwicklung",
    "Fachinformatiker/in – Systemintegration",
    "Fachinformatiker/in – Daten- und Prozessanalyse",
    "Fachinformatiker/in – Digitale Vernetzung",
  ],
  "Weitere IT-Berufe (Neuordnung 2020)": [
    "IT-System-Elektroniker/in",
    "Kaufmann/-frau für Digitalisierungsmanagement",
    "Kaufmann/-frau für IT-System-Management",
  ],
  "IT-nahe Berufe": [
    "Mathematisch-technische/r Softwareentwickler/in (MATSE)",
    "Elektroniker/in für Informations- und Systemtechnik",
    "Elektroniker/in – Informations- und Telekommunikationstechnik",
    "Informationselektroniker/in",
    "Kaufmann/-frau im E-Commerce",
  ],
};

// Lernfelder laut KMK-Rahmenlehrplänen vom 13.12.2019 (gültig ab 01.08.2020).
// LF1-5 sind für alle vier IT-Berufe gleich, LF6-9 teilen sich
// Fachinformatiker und IT-System-Elektroniker.
const LERNFELDER = {
  1: [
    "LF1 Das Unternehmen und die eigene Rolle im Betrieb beschreiben",
    "LF2 Arbeitsplätze nach Kundenwunsch ausstatten",
    "LF3 Clients in Netzwerke einbinden",
    "LF4 Schutzbedarfsanalyse im eigenen Arbeitsbereich durchführen",
    "LF5 Software zur Verwaltung von Daten anpassen",
  ],
  2: [
    "LF6 Serviceanfragen bearbeiten",
    "LF7 Cyber-physische Systeme ergänzen",
    "LF8 Daten systemübergreifend bereitstellen",
    "LF9 Netzwerke und Dienste bereitstellen",
  ],
  3: {
    Anwendungsentwicklung: [
      "LF10a Benutzerschnittstellen gestalten und entwickeln",
      "LF11a Funktionalität in Anwendungen realisieren",
      "LF12a Kundenspezifische Anwendungsentwicklung durchführen",
    ],
    Systemintegration: [
      "LF10b Serverdienste bereitstellen und Administrationsaufgaben automatisieren",
      "LF11b Betrieb und Sicherheit vernetzter Systeme gewährleisten",
      "LF12b Kundenspezifische Systemintegration durchführen",
    ],
    "Daten- und Prozessanalyse": [
      "LF10c Werkzeuge des maschinellen Lernens einsetzen",
      "LF11c Prozesse analysieren und gestalten",
      "LF12c Kundenspezifische Prozess- und Datenanalyse durchführen",
    ],
    "Digitale Vernetzung": [
      "LF10d Cyber-physische Systeme entwickeln",
      "LF11d Betrieb und Sicherheit vernetzter Systeme gewährleisten",
      "LF12d Kundenspezifisches cyber-physisches System optimieren",
    ],
    "IT-System-Elektroniker": [
      "LF10 Energieversorgung bereitstellen und die Betriebssicherheit gewährleisten",
      "LF11 Betrieb und Sicherheit vernetzter Systeme gewährleisten",
      "LF12 Instandhaltung planen und durchführen",
    ],
  },
};

// Kaufleute für Digitalisierungsmanagement / IT-System-Management:
// gemeinsame LF6-9, eigene Lernfelder ab LF10 (IT-System-Management bis LF13)
const LERNFELDER_KAUFLEUTE = {
  2: [
    "LF6 Serviceanfragen bearbeiten",
    "LF7 Softwareprojekte durchführen",
    "LF8 Beschaffungsprozesse durchführen",
    "LF9 Netzwerkbasierte IT-Lösungen umsetzen",
  ],
  3: {
    Digitalisierungsmanagement: [
      "LF10 Wertschöpfungsprozesse erfolgsorientiert steuern und preispolitische Maßnahmen ableiten",
      "LF11 Informationen und Daten aufbereiten",
      "LF12 Unternehmen digital weiterentwickeln",
    ],
    "IT-System-Management": [
      "LF10 Wertschöpfungsprozesse erfolgsorientiert steuern",
      "LF11 Absatzmarketing-Maßnahmen planen und bewerten",
      "LF12 Absatzprozesse durchführen und überwachen",
      "LF13 Netzwerkinfrastruktur planen und kalkulieren",
    ],
  },
};

function getLernfelder(beruf, jahr) {
  const name = beruf || "";
  const year = String(jahr);
  const technisch = /fachinformatiker|it-system-elektroniker/i.test(name);
  const kaufmaennisch = /digitalisierungsmanagement|it-system-management/i.test(name);
  if (!technisch && !kaufmaennisch) {
    return [];
  }
  if (year === "1") {
    return LERNFELDER[1];
  }
  const source = technisch ? LERNFELDER : LERNFELDER_KAUFLEUTE;
  const entry = source[year];
  if (!entry) {
    return [];
  }
  if (Array.isArray(entry)) {
    return entry;
  }
  const match = Object.keys(entry).find((key) => name.includes(key));
  return match ? entry[match] : [];
}

// Typische Aufgaben im Betrieb je Beruf (Anregung für die KI-Texte)
const BERUF_HINTS = {
  "Fachinformatiker/in – Anwendungsentwicklung": [
    "neue Funktionen nach Ticket umsetzen",
    "Fehler analysieren und beheben (Debugging)",
    "Unit-Tests schreiben und ausführen",
    "Code-Reviews mit Kollegen durchführen",
    "REST-Schnittstellen entwickeln und testen",
    "Datenbankabfragen in SQL schreiben und optimieren",
    "Benutzeroberflächen nach Entwurf umsetzen",
    "Änderungen mit Git versionieren und Merge-Requests erstellen",
    "technische Dokumentation ergänzen",
    "Anforderungen im Daily oder Sprint-Planning besprechen",
  ],
  "Fachinformatiker/in – Systemintegration": [
    "Arbeitsplatzrechner einrichten und Software verteilen",
    "Benutzerkonten und Berechtigungen im Active Directory pflegen",
    "Tickets im Helpdesk bearbeiten",
    "Server und virtuelle Maschinen aufsetzen und aktualisieren",
    "Netzwerkkomponenten konfigurieren (Switches, VLANs, WLAN)",
    "Datensicherungen prüfen und Wiederherstellung testen",
    "Updates und Patches einspielen",
    "Monitoring-Meldungen auswerten",
    "Abläufe mit PowerShell oder Bash-Skripten automatisieren",
    "Netzwerkpläne und Dokumentation aktualisieren",
  ],
  "Fachinformatiker/in – Daten- und Prozessanalyse": [
    "Daten aus verschiedenen Quellen zusammenführen und bereinigen",
    "SQL-Abfragen für Auswertungen erstellen",
    "Dashboards und Berichte erstellen",
    "Geschäftsprozesse aufnehmen und als Prozessmodell darstellen",
    "Kennzahlen definieren und auswerten",
    "Datenqualität prüfen und Fehler dokumentieren",
    "Auswertungen mit Python oder R automatisieren",
    "Ergebnisse für Fachabteilungen aufbereiten und vorstellen",
  ],
  "Fachinformatiker/in – Digitale Vernetzung": [
    "Sensoren und Aktoren anbinden und in Betrieb nehmen",
    "Steuerungen und IoT-Geräte konfigurieren",
    "Netzwerkverbindungen von Maschinen einrichten und prüfen",
    "Messdaten erfassen und auswerten",
    "Störungen an vernetzten Anlagen analysieren",
    "Firmware-Updates auf Geräten einspielen",
    "Kommunikationsprotokolle wie MQTT oder OPC UA testen",
    "Sicherheitseinstellungen vernetzter Systeme prüfen",
    "Anlagendokumentation aktualisieren",
  ],
  "IT-System-Elektroniker/in": [
    "IT-Geräte und Arbeitsplätze installieren und anschließen",
    "Netzwerkkabel verlegen, auflegen und durchmessen",
    "Netzwerkschränke und Patchfelder aufbauen",
    "elektrische Sicherheit von Geräten prüfen (DGUV V3)",
    "Störungen an Hardware und Netzwerk beheben",
    "Telefonanlagen und Endgeräte einrichten",
    "USV-Anlagen und Stromversorgung prüfen",
    "Kunden vor Ort in die Bedienung einweisen",
    "Prüfprotokolle und Aufträge dokumentieren",
  ],
  "Kaufmann/-frau für Digitalisierungsmanagement": [
    "Geschäftsprozesse analysieren und Verbesserungen vorschlagen",
    "Anforderungen der Fachabteilungen aufnehmen",
    "Angebote für Software und IT-Dienstleistungen vergleichen",
    "Beschaffungen vorbereiten und Bestellungen auslösen",
    "Lizenzen und Verträge verwalten",
    "Daten für Auswertungen aufbereiten",
    "Digitalisierungsprojekte planen und begleiten",
    "Kosten und Nutzen von IT-Lösungen berechnen",
    "Schulungsunterlagen für Mitarbeitende erstellen",
  ],
  "Kaufmann/-frau für IT-System-Management": [
    "Kunden zu IT-Lösungen beraten",
    "Angebote kalkulieren und erstellen",
    "Kundenanfragen und Reklamationen bearbeiten",
    "Hardware und Software beschaffen und Lieferungen prüfen",
    "Verträge und Lizenzen verwalten",
    "IT-Projekte bei Kunden koordinieren",
    "Rechnungen prüfen und Aufträge abrechnen",
    "Vertriebs- und Marketingaktionen vorbereiten",
    "Arbeitsplätze einrichten und an Kunden übergeben",
  ],
  "Mathematisch-technische/r Softwareentwickler/in (MATSE)": [
    "Algorithmen entwerfen und implementieren",
    "mathematische Modelle in Programmcode umsetzen",
    "Programme in Java oder Python entwickeln",
    "Software testen und Fehler beheben",
    "Daten statistisch auswerten",
    "Laufzeit und Speicherbedarf von Programmen optimieren",
    "Programmcode und Verfahren dokumentieren",
  ],
  "Elektroniker/in für Informations- und Systemtechnik": [
    "elektronische Baugruppen aufbauen und prüfen",
    "Schaltpläne lesen und erstellen",
    "Mikrocontroller programmieren",
    "Messungen mit Oszilloskop und Multimeter durchführen",
    "Fehler in Systemen eingrenzen und beheben",
    "Hardware und Software zu Systemen integrieren",
    "Prüfprotokolle und technische Dokumentation erstellen",
  ],
  "Elektroniker/in – Informations- und Telekommunikationstechnik": [
    "Telefon- und Kommunikationsanlagen installieren",
    "Netzwerk- und Glasfaserkabel verlegen und anschließen",
    "Netzwerkkomponenten konfigurieren",
    "Messungen an Leitungen und Anlagen durchführen",
    "Störungen bei Kunden beheben",
    "Brandmelde- oder Sicherheitstechnik prüfen",
    "Anlagen an Kunden übergeben und einweisen",
    "Messprotokolle und Dokumentation erstellen",
  ],
  "Informationselektroniker/in": [
    "Computer und Peripheriegeräte reparieren",
    "Fernseh-, Audio- und Multimediatechnik einrichten",
    "Netzwerke und WLAN bei Kunden installieren",
    "Fehler an Geräten messen und eingrenzen",
    "Kunden beraten und Kostenvoranschläge erstellen",
    "Ersatzteile bestellen und einbauen",
    "Reparaturen dokumentieren",
  ],
  "Kaufmann/-frau im E-Commerce": [
    "Produkte im Onlineshop anlegen und pflegen",
    "Produkttexte und Bilder aufbereiten",
    "Kundenanfragen per E-Mail und Chat beantworten",
    "Bestellungen, Retouren und Zahlungen bearbeiten",
    "Online-Marketing-Kampagnen betreuen",
    "Verkaufszahlen und Webanalyse auswerten",
    "Preise und Angebote auf Marktplätzen pflegen",
    "Newsletter erstellen und versenden",
  ],
};

function getBerufHints(beruf) {
  return BERUF_HINTS[beruf] || [];
}

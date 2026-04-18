async function startGeneration() {
  const azubiName =
    document.getElementById("azubiName").value.trim() || "Azubi";
  const beruf = document.getElementById("beruf").value;
  const betrieb =
    document.getElementById("betrieb").value.trim() || "Ausbildungsbetrieb";
  const ausbildungsjahr = document.getElementById("ausbildungsjahr").value;
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const schoolDays = document.querySelectorAll(
    'input[name="schoolDay"]:checked',
  );
  const betriebTaetigkeiten = document
    .getElementById("betriebTaetigkeiten")
    .value.trim();
  const technologies = document.getElementById("technologies").value.trim();

  if (!start || !end) {
    showToast("error", "Bitte Start- und Enddatum ausfüllen");
    return;
  }

  if (end < start) {
    showToast("error", "Enddatum muss nach Startdatum liegen");
    return;
  }

  if (schoolDays.length === 0) {
    showToast("error", "Mindestens einen Schultag auswählen");
    return;
  }

  const weeks = buildWeeks();
  if (weeks.length === 0) {
    showToast("error", "Keine Wochen im Zeitraum gefunden");
    return;
  }

  document.getElementById("loader").classList.add("visible");
  document.getElementById("genBtn").disabled = true;
  document.getElementById("results").classList.remove("visible");

  generatedWeeks = weeks;
  const workWeeks = weeks.filter((week) => !week.inFerien);
  let processed = 0;

  for (const week of workWeeks) {
    updateProgress(
      processed,
      workWeeks.length,
      `KW ${week.kw} wird generiert...`,
    );
    try {
      await generateWeekContent(
        week,
        beruf,
        ausbildungsjahr,
        betrieb,
        betriebTaetigkeiten,
        technologies,
      );
    } catch (error) {
      console.error("AI error for week", week.kw, error);
      fillFallback(week, beruf, betriebTaetigkeiten);
    }
    processed += 1;
  }

  updateProgress(workWeeks.length, workWeeks.length, "Fertig!");

  setTimeout(() => {
    document.getElementById("loader").classList.remove("visible");
    document.getElementById("genBtn").disabled = false;
    renderResults(weeks, azubiName, beruf, betrieb, ausbildungsjahr);
    document.getElementById("results").classList.add("visible");
    document
      .getElementById("results")
      .scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("success", `${workWeeks.length} Wochen erfolgreich generiert`);
  }, 500);
}

async function generateWeekContent(
  week,
  beruf,
  ausbildungsjahr,
  betrieb,
  taetigkeiten,
  technologies,
) {
  const schoolDays = week.days.filter((day) => day.isSchoolDay);
  const workDays = week.days.filter(
    (day) => !day.isSchoolDay && !day.isFerien && !day.isHoliday,
  );

  const prompt = `Du bist ein Ausbildungsberater für Fachinformatiker (${beruf}), ${ausbildungsjahr}. Ausbildungsjahr.

Generiere realistische, glaubwürdige Einträge für den Ausbildungsnachweis (Berichtsheft) für KW ${week.kw} (${formatDate(week.monday)} - ${formatDate(week.friday)}).

${schoolDays.length > 0 ? `Schultage: ${schoolDays.map((day) => `${day.name} (${formatDate(day.date)})`).join(", ")}` : ""}
${workDays.length > 0 ? `Betriebstage: ${workDays.map((day) => `${day.name} (${formatDate(day.date)})`).join(", ")}` : ""}
${betrieb ? `Ausbildungsbetrieb: ${betrieb}` : ""}
${taetigkeiten ? `Typische Tätigkeiten: ${taetigkeiten}` : ""}
${technologies ? `Technologien: ${technologies}` : ""}

Antworte NUR mit einem JSON-Objekt. Kein Text davor oder danach. Kein Markdown.
Format:
{
  "days": {
    "YYYY-MM-DD": "2-3 Sätze Beschreibung der Tätigkeit/des Unterrichtsinhalts"
  },
  "summary": "1 Satz Wochenzusammenfassung"
}

Wichtig:
- Betriebstage: konkrete praktische Tätigkeiten (3-5 Tätigkeiten aufzählen, als Fließtext)
- Schultage: Lernfelder/Fächer wie Wirtschaft, Netzwerktechnik, Programmierung, Betriebssysteme, Projektmanagement etc.
- Abwechslungsreich, nicht jede Woche gleich
- Professioneller, sachlicher Stil`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content.map((chunk) => chunk.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);

  for (const day of week.days) {
    if (day.isFerien) {
      day.content = "Schulferien / Betriebsferien";
      continue;
    }

    if (day.isHoliday) {
      day.content = "Gesetzlicher Feiertag";
      continue;
    }

    day.content = parsed.days?.[day.date] || "";
  }

  week.summary = parsed.summary || "";
}

function fillFallback(week, beruf, taetigkeiten) {
  const taetigkeitenListe = taetigkeiten
    ? taetigkeiten
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : ["Softwareentwicklung", "Testing", "Dokumentation"];

  for (const day of week.days) {
    if (day.isFerien) {
      day.content = "Schulferien / Betriebsferien";
      continue;
    }

    if (day.isHoliday) {
      day.content = "Gesetzlicher Feiertag";
      continue;
    }

    if (day.isSchoolDay) {
      day.content = `Unterricht in der Berufsschule: Lernfelder zu ${beruf} - Inhalte zu Netzwerktechnik, Programmierung und betrieblicher Organisation.`;
    } else {
      const taetigkeit =
        taetigkeitenListe[Math.floor(Math.random() * taetigkeitenListe.length)];
      day.content = `${taetigkeit} - praktische Mitarbeit im Fachbereich, Einarbeitung in laufende Projekte und Abstimmung mit dem Ausbildungsteam.`;
    }
  }

  week.summary = `Arbeitswoche KW ${week.kw}: Tägliche Mitarbeit an betrieblichen Projekten und Aufgaben.`;
}

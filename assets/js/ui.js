function setWeekType(type, element) {
  weekType = type;
  document.querySelectorAll(".week-selector .week-option").forEach((option) => {
    if (option.closest("#firstWeekPicker")) {
      return;
    }
    option.classList.remove("active");
  });
  element.classList.add("active");
  document.getElementById("alternatingHint").style.display =
    type === "alternating" ? "flex" : "none";
  document.getElementById("firstWeekPicker").style.display =
    type === "alternating" ? "block" : "none";
}

function setFirstWeek(type, element) {
  firstWeekType = type;
  document
    .querySelectorAll("#firstWeekPicker .week-option")
    .forEach((option) => option.classList.remove("active"));
  element.classList.add("active");
}

function selectState(element) {
  document
    .querySelectorAll(".state-btn")
    .forEach((button) => button.classList.remove("active"));
  element.classList.add("active");
  selectedState = element.dataset.state;
  loadFerienVorschlaege();
}

function loadFerienVorschlaege() {
  const suggestions = FERIEN_VORSCHLAEGE[selectedState] || [];
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  let filtered = suggestions;
  if (start && end) {
    filtered = suggestions.filter(
      (ferien) => ferien.end >= start && ferien.start <= end,
    );
  }

  if (filtered.length > 0) {
    ferienData = filtered.map((ferien) => ({ ...ferien }));
    renderFerienList();
    showToast(
      "success",
      `${filtered.length} Ferienvorschläge für ${selectedState} geladen`,
    );
  }
}

function toggleFerienForm() {
  document.getElementById("ferienForm").classList.toggle("visible");
}

function addFerien() {
  const name = document.getElementById("ferienName").value.trim();
  const start = document.getElementById("ferienStart").value;
  const end = document.getElementById("ferienEnd").value;

  if (!name || !start || !end) {
    showToast("error", "Alle Ferien-Felder ausfüllen");
    return;
  }

  if (end < start) {
    showToast("error", "Enddatum muss nach Startdatum liegen");
    return;
  }

  ferienData.push({ name, start, end });
  renderFerienList();
  document.getElementById("ferienName").value = "";
  document.getElementById("ferienStart").value = "";
  document.getElementById("ferienEnd").value = "";
  document.getElementById("ferienForm").classList.remove("visible");
  showToast("success", "Ferien hinzugefügt");
}

function removeFerien(index) {
  ferienData.splice(index, 1);
  renderFerienList();
}

function renderFerienList() {
  const list = document.getElementById("ferienList");
  if (ferienData.length === 0) {
    list.innerHTML =
      '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);padding:8px 0">Keine Ferien eingetragen</div>';
    return;
  }

  list.innerHTML = ferienData
    .map(
      (ferien, index) => `
    <div class="ferien-item">
      <div class="ferien-dot"></div>
      <div class="ferien-name">${ferien.name}</div>
      <div class="ferien-dates">${formatDate(ferien.start)} - ${formatDate(ferien.end)}</div>
      <button class="ferien-remove" onclick="removeFerien(${index})">×</button>
    </div>
  `,
    )
    .join("");
}

function updateProgress(done, total, text) {
  document.getElementById("loaderText").textContent = text;
  document.getElementById("progressBar").style.width =
    total > 0 ? `${(done / total) * 100}%` : "0%";
}

function showToast(type, message) {
  const toast = document.getElementById("toast");
  toast.textContent = (type === "success" ? "✅ " : "❌ ") + message;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function updateGenInfo() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  if (start && end && end >= start) {
    const weeks = Math.ceil((new Date(end) - new Date(start)) / (7 * 86400000));
    document.getElementById("generateInfo").textContent =
      `~${weeks} Wochen · KI generiert Tageseinträge automatisch`;
  }
}

// Dialoge, Meldungen, Fortschritt, Speicheranzeige, Design-Umschalter und Zurücksetzen

let toastTimer;

function askChoice(title, text, options) {
  const dialog = document.getElementById("choiceDialog");
  dialog.querySelector("h2").textContent = title;
  dialog.querySelector("p").textContent = text;
  const actions = dialog.querySelector(".dialog-actions");
  actions.innerHTML =
    '<button type="button" class="btn btn-text" value="">Abbrechen</button>' +
    options
      .map(
        (option) =>
          `<button type="button" class="btn ${option.primary ? "btn-ink" : option.danger ? "btn-danger" : "btn-quiet"}" value="${option.value}">${option.label}</button>`,
      )
      .join("");

  return new Promise((resolve) => {
    const onClick = (event) => {
      const button = event.target.closest("button");
      if (button) {
        dialog.close(button.value);
      }
    };
    actions.addEventListener("click", onClick);
    dialog.addEventListener(
      "close",
      () => {
        actions.removeEventListener("click", onClick);
        resolve(dialog.returnValue || null);
      },
      { once: true },
    );
    dialog.returnValue = "";
    dialog.showModal();
  });
}

function showToast(type, message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), type === "success" ? 3000 : 6000);
}

function setGenerating(active) {
  document.getElementById("progressPanel").hidden = !active;
  document.getElementById("genBtn").disabled = active;
  document.getElementById("genBtn").classList.toggle("is-loading", active);
  if (active) {
    updateProgress(0, 1, "Starte …");
    updateProgressDetail("");
  }
  updateRunbarVisibility();
}

function updateProgress(done, total, text) {
  document.getElementById("progressText").textContent = text;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById("progressBar");
  bar.style.width = `${percent}%`;
  bar.parentElement.setAttribute("aria-valuenow", String(percent));
}

function updateProgressDetail(text) {
  document.getElementById("progressDetail").textContent = text;
}

function setSaveIndicator(text) {
  const indicator = document.getElementById("saveIndicator");
  indicator.textContent = text;
  indicator.classList.add("flash");
  setTimeout(() => indicator.classList.remove("flash"), 600);
}

// ---------- Theme ----------

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.dataset.theme = state.theme;
  }
  const labels = { auto: "Design: System", light: "Design: Hell", dark: "Design: Dunkel" };
  const button = document.getElementById("themeBtn");
  button.title = labels[state.theme];
  button.setAttribute("aria-label", labels[state.theme]);
  button.dataset.mode = state.theme;
}

function cycleTheme() {
  const order = ["auto", "light", "dark"];
  state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
  applyTheme();
  saveState();
}

async function resetAll() {
  const answer = await askChoice(
    "Alles löschen?",
    "Das löscht alle Eingaben und alle geschriebenen Wochen in diesem Browser. Speichere vorher ein Backup, wenn du etwas behalten willst.",
    [{ value: "reset", label: "Alles löschen", danger: true }],
  );
  if (answer !== "reset") {
    return;
  }
  resetState();
  setDefaultPeriod();
  applyStateToForm();
  renderResults();
  initSetupView();
  loadSchoolHolidays();
  showToast("success", "Alles gelöscht");
}

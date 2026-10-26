// Dialog „Wer schreibt die Texte?“ (KI-Anbieter, eigener Schlüssel, Test)

function openSettings() {
  const dialog = document.getElementById("settingsDialog");
  const form = dialog.querySelector("form");
  form.elements.provider.value = state.ai.provider;
  form.elements.baseUrl.value = state.ai.baseUrl;
  form.elements.model.value = state.ai.model;
  form.elements.apiKey.value = state.ai.apiKey;
  form.elements.batchSize.value = state.ai.batchSize;
  form.elements.sessionOnlyKey.checked = Boolean(state.ai.sessionOnlyKey);
  form.elements.fallbackToCustom.checked = state.ai.fallbackToCustom !== false;
  document.getElementById("testResult").textContent = "";
  updateSettingsVisibility();
  dialog.showModal();
}

function updateSettingsVisibility() {
  const form = document.querySelector("#settingsDialog form");
  document.getElementById("customFields").hidden = form.elements.provider.value !== "custom";
}

function readSettingsForm() {
  const form = document.querySelector("#settingsDialog form");
  return {
    provider: form.elements.provider.value,
    baseUrl: form.elements.baseUrl.value.trim(),
    model: form.elements.model.value.trim(),
    apiKey: form.elements.apiKey.value.trim(),
    batchSize: Math.max(1, Math.min(8, Number(form.elements.batchSize.value) || 3)),
    sessionOnlyKey: form.elements.sessionOnlyKey.checked,
    fallbackToCustom: form.elements.fallbackToCustom.checked,
  };
}

function saveSettings() {
  state.ai = readSettingsForm();
  saveState();
  updatePreview();
  showToast("success", "Einstellung übernommen");
}

function applyPreset(key) {
  const preset = AI_PRESETS[key];
  if (!preset) {
    return;
  }
  const form = document.querySelector("#settingsDialog form");
  form.elements.baseUrl.value = preset.baseUrl;
  form.elements.model.value = preset.model;
}

async function testConnection() {
  const result = document.getElementById("testResult");
  const previous = state.ai;
  state.ai = readSettingsForm();
  if (state.ai.provider === "offline") {
    result.textContent = "Offline-Modus braucht keine Verbindung.";
    state.ai = previous;
    return;
  }
  result.textContent = "Verbindung wird geprüft";
  try {
    const answer = await requestCompletion(
      [{ role: "user", content: 'Antworte nur mit dem JSON {"ok":true}' }],
      AbortSignal.timeout(60000),
    );
    lastReplyAt = Date.now();
    result.textContent = "Verbindung steht. Die KI hat geantwortet.";
  } catch (error) {
    result.textContent =
      error instanceof RateLimitError
        ? `Verbindung steht. Die kostenlose KI ist in ${Math.ceil(error.waitMs / 1000)} s wieder frei.`
        : `✗ Fehler: ${error.message}`;
  } finally {
    state.ai = previous;
  }
}

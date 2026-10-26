// Übertragen-Assistent: geht Tag für Tag oder Woche für Woche durch,
// kopiert den Text und merkt sich, welche Wochen schon im IHK-Portal stehen.

const transfer = { mode: "day", items: [], index: 0 };

function buildTransferItems(mode) {
  const items = [];
  for (const week of state.weeks) {
    const range = `KW ${week.kw}, ${formatDateShort(week.monday)} bis ${formatDate(week.friday)}`;
    if (mode === "day") {
      for (const day of week.days.filter((entry) => entry.content.trim())) {
        items.push({
          week,
          where: `${range}`,
          field: `${day.name}, ${formatDate(day.date)}: ${DAY_KINDS[day.kind].label}, ${day.hours} Std.`,
          text: plainText(day.content),
        });
      }
      continue;
    }
    const sections = [
      ["betrieb", "Betriebliche Tätigkeiten"],
      ["unterweisung", "Unterweisungen, betrieblicher Unterricht"],
      ["schule", "Berufsschule"],
    ];
    for (const [kind, label] of sections) {
      const text = kind === "unterweisung" ? plainText(week.unterweisung) : sectionText(week, kind);
      if (!text) {
        continue;
      }
      const hours =
        kind === "unterweisung" ? Number(week.unterweisungHours) || 0 : sectionHours(week, kind);
      items.push({ week, where: range, field: `${label}, ${hours} Std.`, text });
    }
  }
  return items;
}

function openTransfer() {
  if (state.weeks.length === 0) {
    showToast("error", "Es gibt noch keine Nachweise. Lass sie zuerst schreiben.");
    return;
  }
  transfer.mode = readPrefs().transferMode || "day";
  startTransferMode(transfer.mode);
  document.getElementById("transferDialog").showModal();
  document.getElementById("transferNext").focus();
}

// Startet bei der ersten Woche, die noch nicht übertragen ist
function startTransferMode(mode) {
  transfer.mode = mode;
  transfer.items = buildTransferItems(mode);
  const first = transfer.items.findIndex((item) => !item.week.transferred);
  transfer.index = first === -1 ? 0 : first;
  writePrefs({ transferMode: mode });
  document.querySelectorAll("[data-transfer-mode]").forEach((button) => {
    const active = button.dataset.transferMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderTransfer();
}

function renderTransfer() {
  const { items, index } = transfer;
  const done = index >= items.length;
  const item = items[Math.min(index, items.length - 1)];
  document.getElementById("transferWhere").textContent = done
    ? "Alles übertragen. Die Wochen sind jetzt als „übertragen“ markiert."
    : item.where;
  document.getElementById("transferField").textContent = done ? "" : item.field;
  document.getElementById("transferCount").textContent = items.length
    ? `${Math.min(index + 1, items.length)} von ${items.length}`
    : "";
  document.getElementById("transferText").textContent = done ? "" : item.text;
  document.getElementById("transferBar").style.width =
    `${items.length ? (index / items.length) * 100 : 0}%`;
  document.getElementById("transferPrev").disabled = index === 0;
  document.getElementById("transferSkip").disabled = done;
  const next = document.getElementById("transferNext");
  next.textContent = done ? "Fertig" : "Kopieren und weiter";
}

function markWeekTransferred(week) {
  if (!week.transferred) {
    week.transferred = todayStr();
    updateWeekCard(week);
  }
}

async function transferNext() {
  const { items, index } = transfer;
  if (index >= items.length) {
    document.getElementById("transferDialog").close();
    return;
  }
  const item = items[index];
  await copyText(item.text, null);
  transfer.index += 1;
  // Woche fertig, wenn das nächste Element zu einer anderen Woche gehört
  if (transfer.index >= items.length || items[transfer.index].week !== item.week) {
    markWeekTransferred(item.week);
    saveState();
    updateStats();
  }
  renderTransfer();
}

function transferMove(step) {
  transfer.index = Math.max(0, Math.min(transfer.items.length, transfer.index + step));
  renderTransfer();
}

function initTransfer() {
  const dialog = document.getElementById("transferDialog");
  document.getElementById("transferBtn").addEventListener("click", openTransfer);
  document.getElementById("transferNext").addEventListener("click", transferNext);
  document.getElementById("transferPrev").addEventListener("click", () => transferMove(-1));
  document.getElementById("transferSkip").addEventListener("click", () => transferMove(1));
  document.getElementById("transferClose").addEventListener("click", () => dialog.close());
  dialog.querySelector(".switch").addEventListener("click", (event) => {
    const button = event.target.closest("[data-transfer-mode]");
    if (button) {
      startTransferMode(button.dataset.transferMode);
    }
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.target.closest("button")) {
      event.preventDefault();
      transferNext();
    }
  });
}

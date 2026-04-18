window.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 7, 1);
  const endOfYear = new Date(today.getFullYear() + 1, 6, 31);

  document.getElementById("startDate").value = startOfYear
    .toISOString()
    .split("T")[0];
  document.getElementById("endDate").value = endOfYear
    .toISOString()
    .split("T")[0];

  document.querySelector('input[value="2"]').checked = true;

  loadFerienVorschlaege();

  document
    .getElementById("startDate")
    .addEventListener("change", updateGenInfo);
  document.getElementById("endDate").addEventListener("change", updateGenInfo);
  updateGenInfo();
});

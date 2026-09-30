const SOURCE_URL = "https://downdetector.com.br/fora-do-ar/sefaz/";
const statusElement = document.querySelector("#status");

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

async function renderStatus() {
  const { collectorStatus } = await chrome.storage.local.get("collectorStatus");
  if (!collectorStatus) return;
  statusElement.className = collectorStatus.ok ? "ok" : "error";
  statusElement.textContent = collectorStatus.ok
    ? `Último envio concluído em ${formatDate(collectorStatus.collectedAt)}.`
    : `Falha no último envio: ${collectorStatus.error}`;
}

document.querySelector("#collect").addEventListener("click", async () => {
  statusElement.className = "";
  statusElement.textContent = "Abrindo a fonte e iniciando a coleta...";
  const tabs = await chrome.tabs.query({ url: `${SOURCE_URL}*` });
  if (tabs[0]?.id) await chrome.tabs.reload(tabs[0].id);
  else await chrome.tabs.create({ url: SOURCE_URL, active: false });
  window.setTimeout(renderStatus, 7_000);
});

void renderStatus();

import { COLLECTOR_PRIVATE_KEY } from "./collector-config.local.js";

const SOURCE_URL = "https://downdetector.com.br/fora-do-ar/sefaz/";
const FUNCTION_URL = "https://vbkbbfeujqmvgmmhmeao.supabase.co/functions/v1/downdetector-snapshot";
const ALARM_NAME = "collect-sefaz-reports";

async function ensureAlarm() {
  const alarm = await chrome.alarms.get(ALARM_NAME);
  if (!alarm || alarm.periodInMinutes !== 10) {
    await chrome.alarms.create(ALARM_NAME, { delayInMinutes: 10, periodInMinutes: 10 });
  }
}

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(value) {
  let binary = "";
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sendSnapshot(snapshot) {
  const body = JSON.stringify(snapshot);
  const timestamp = Date.now().toString();
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64(COLLECTOR_PRIVATE_KEY),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-collector-timestamp": timestamp,
      "x-collector-signature": encodeBase64(signature),
    },
    body,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`CRM respondeu ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

async function saveStatus(status) {
  await chrome.storage.local.set({
    collectorStatus: { ...status, checkedAt: new Date().toISOString() },
  });
}

let refreshInFlight;
function refreshSource() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshSourceTab().finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}

async function refreshSourceTab() {
  const tabs = await chrome.tabs.query({ url: `${SOURCE_URL}*` });
  if (tabs[0]?.id) {
    await chrome.tabs.update(tabs[0].id, { autoDiscardable: false });
    await chrome.tabs.reload(tabs[0].id, { bypassCache: true });
    return;
  }
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  const target =
    windows.find((window) => window.focused && !window.incognito) ??
    windows.find((window) => !window.incognito);
  if (!target?.id) {
    setBadge("", "#08a9d1");
    await saveStatus({ ok: false, waitingForWindow: true });
    return;
  }
  const created = await chrome.tabs.create({ windowId: target.id, url: SOURCE_URL, active: false });
  if (created.id) await chrome.tabs.update(created.id, { autoDiscardable: false });
}

function reportRefreshError(error) {
  setBadge("!", "#dc3545");
  void saveStatus({ ok: false, error: error instanceof Error ? error.message : String(error) });
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.url?.startsWith(SOURCE_URL)) return;

  if (message?.type === "downdetector-refresh-request") {
    if (sender.tab?.id)
      void chrome.tabs.reload(sender.tab.id, { bypassCache: true }).catch(reportRefreshError);
    return;
  }

  if (message?.type === "downdetector-collector-diagnostic") {
    const detail = String(message.error ?? "A página não liberou os dados para coleta.");
    setBadge("!", "#dc3545");
    void saveStatus({ ok: false, error: detail });
    return;
  }

  if (message?.type !== "downdetector-snapshot") return;
  sendSnapshot(message.snapshot)
    .then(() => {
      setBadge("OK", "#0f9f6e");
      void saveStatus({ ok: true, collectedAt: message.snapshot.collectedAt });
      sendResponse({ ok: true });
    })
    .catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      setBadge("!", "#dc3545");
      void saveStatus({ ok: false, error: detail });
      sendResponse({ ok: false, error: detail });
    });
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarm().catch(reportRefreshError);
  void refreshSource().catch(reportRefreshError);
});

chrome.runtime.onStartup.addListener(() => {
  void ensureAlarm().catch(reportRefreshError);
  void refreshSource().catch(reportRefreshError);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void refreshSource().catch(reportRefreshError);
});

chrome.windows.onCreated.addListener((window) => {
  if (window.type === "normal" && !window.incognito) void refreshSource().catch(reportRefreshError);
});

// Recria o alarme caso o Chrome tenha removido o agendamento ao suspender ou
// atualizar o service worker da extensão.
void ensureAlarm().catch(reportRefreshError);

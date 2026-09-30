import { COLLECTOR_PRIVATE_KEY } from "./collector-config.local.js";

const SOURCE_URL = "https://downdetector.com.br/fora-do-ar/sefaz/";
const FUNCTION_URL =
  "https://vbkbbfeujqmvgmmhmeao.supabase.co/functions/v1/downdetector-snapshot";
const ALARM_NAME = "collect-sefaz-reports";

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
  await chrome.storage.local.set({ collectorStatus: { ...status, checkedAt: new Date().toISOString() } });
}

async function refreshSource() {
  const tabs = await chrome.tabs.query({ url: `${SOURCE_URL}*` });
  if (tabs[0]?.id) {
    await chrome.tabs.reload(tabs[0].id);
    return;
  }
  await chrome.tabs.create({ url: SOURCE_URL, active: false });
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "downdetector-snapshot" || !sender.url?.startsWith(SOURCE_URL)) return;
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
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.1, periodInMinutes: 10 });
  void refreshSource();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.1, periodInMinutes: 10 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void refreshSource();
});

import { createPrivateKey, sign } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const SOURCE_URL = "https://downdetector.com.br/fora-do-ar/sefaz/";
const FUNCTION_URL =
  process.env.DOWNDETECTOR_FUNCTION_URL ??
  "https://vbkbbfeujqmvgmmhmeao.supabase.co/functions/v1/downdetector-snapshot";
const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const PROFILE_PATH = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  ".cache",
  "downdetector-profile",
);

function privateKey() {
  const encoded = process.env.DOWNDETECTOR_COLLECTOR_PRIVATE_KEY?.trim();
  if (!encoded)
    throw new Error("Execute npm run collect:downdetector:setup antes da primeira coleta.");
  return createPrivateKey({ key: Buffer.from(encoded, "base64"), type: "pkcs8", format: "der" });
}

function chromePath() {
  const configured = process.env.DOWNDETECTOR_CHROME_PATH?.trim();
  const found = [configured, ...CHROME_PATHS].find((path) => path && existsSync(path));
  if (!found) throw new Error("Google Chrome não foi encontrado neste computador.");
  return found;
}

function normalizeLabel(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[:\-–—]+$/, "")
    .trim();
}

async function extractSnapshot(page) {
  return page.evaluate(() => {
    const text = (element) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    };

    const statusText = [...document.querySelectorAll("h1,h2,h3,p")]
      .map(text)
      .find((value) =>
        /não (?:indica|detecta|há|mostra|mostram).*problema|problemas? (?:com|na|no) sefaz/i.test(
          value,
        ),
      );

    const failureHeading = [...document.querySelectorAll("h1,h2,h3,h4")].find((element) =>
      /falhas mais relatadas|problemas mais relatados/i.test(text(element)),
    );
    const lines = document.body.innerText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const failureStart = lines.findIndex((line) =>
      /falhas mais relatadas|problemas mais relatados/i.test(line),
    );
    const reportedFailures = [];
    for (let index = failureStart + 1; index > 0 && index < failureStart + 25; index += 1) {
      const percentage = lines[index]?.match(/^(\d{1,3})%$/);
      const label = lines[index + 1];
      if (!percentage || !label || /^(\d{1,3})%$/.test(label)) continue;
      reportedFailures.push({ label, percent: Number(percentage[1]) });
      index += 1;
    }

    const chartRoots = [
      ...document.querySelectorAll("svg,[class*='chart'],[class*='graph']"),
    ].filter(visible);
    const rawPoints = [];
    for (const root of chartRoots) {
      for (const element of root.querySelectorAll("[aria-label],[data-value],[data-y]")) {
        const value = [
          element.getAttribute("aria-label"),
          element.getAttribute("data-value"),
          element.getAttribute("data-y"),
        ]
          .filter(Boolean)
          .join(" ");
        const reports = value.match(/(\d+(?:[.,]\d+)?)\s*(?:relatos?|reports?)?/i);
        const time = value.match(/(?:às?\s*)?(\d{1,2}(?::\d{2})?\s*h?)/i);
        if (reports && time) {
          rawPoints.push({
            time: time[1].replace(/\s/g, ""),
            reports: Math.round(Number(reports[1].replace(",", "."))),
          });
        }
      }
    }

    if (rawPoints.length < 2) {
      for (const script of document.scripts) {
        const source = script.textContent ?? "";
        if (!/report|relato|chart|graph/i.test(source)) continue;
        for (const match of source.matchAll(
          /\{\s*x:\s*['"]([^'"]{1,40})['"]\s*,\s*y:\s*(\d+(?:\.\d+)?)\s*\}/gi,
        )) {
          rawPoints.push({ time: match[1], reports: Math.round(Number(match[2])) });
        }
        for (const match of source.matchAll(
          /(?:"(?:x|time|date)"\s*:\s*"([^"]{1,30})"[^{}]{0,120}"(?:y|value|reports|count)"\s*:\s*)(\d+(?:\.\d+)?)/gi,
        )) {
          rawPoints.push({ time: match[1], reports: Math.round(Number(match[2])) });
        }
      }
    }

    if (rawPoints.length < 2) {
      const chart = document.querySelector("svg.recharts-surface");
      const curve = chart?.querySelector(".recharts-area-curve");
      const axisTicks = [
        ...(chart?.querySelectorAll(".recharts-yAxis-tick-labels text") ?? []),
      ]
        .map((tick) => ({
          y: Number(tick.getAttribute("y")),
          value: Number(tick.textContent?.trim()),
        }))
        .filter((tick) => Number.isFinite(tick.y) && Number.isFinite(tick.value));
      const path = curve?.getAttribute("d") ?? "";
      if (axisTicks.length >= 2 && path) {
        const [firstTick, secondTick] = axisTicks;
        const valuePerPixel =
          (secondTick.value - firstTick.value) / (secondTick.y - firstTick.y);
        const coordinates = [...path.matchAll(/[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
        const end = new Date(Math.floor(Date.now() / 900_000) * 900_000);
        coordinates.forEach((coordinate, index) => {
          const pointTime = new Date(end.getTime() - (coordinates.length - 1 - index) * 900_000);
          const reports = Math.max(
            0,
            Math.round(firstTick.value + (Number(coordinate[2]) - firstTick.y) * valuePerPixel),
          );
          rawPoints.push({
            time: pointTime.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            reports,
          });
        });
      }
    }

    return {
      statusText: statusText ?? "Situação informada pelo Downdetector",
      reportedFailures,
      chartPoints: rawPoints.slice(0, 96),
      title: document.title,
      bodyText: document.body.innerText.slice(0, 4000),
      debugHtml: chartRoots
        .slice(0, 8)
        .map((root) => root.outerHTML)
        .join("\n")
        .slice(0, 18000),
      debugScripts: [...document.scripts]
        .map((script) => script.textContent ?? "")
        .filter((source) => /report|relato|chart|graph/i.test(source))
        .join("\n")
        .slice(0, 15000),
    };
  });
}

function cleanSnapshot(raw) {
  const failures = [];
  for (const item of raw.reportedFailures) {
    const label = normalizeLabel(item.label);
    if (!label || failures.some((known) => known.label === label)) continue;
    failures.push({ label, percent: item.percent });
  }
  const points = [];
  for (const item of raw.chartPoints) {
    const time = String(item.time).slice(0, 20);
    if (!time || !Number.isFinite(item.reports)) continue;
    const existing = points.find((known) => known.time === time);
    if (existing) existing.reports = Math.max(existing.reports, item.reports);
    else points.push({ time, reports: Math.max(0, item.reports) });
  }
  return {
    serviceSlug: "sefaz",
    statusText: raw.statusText,
    sourceUrl: SOURCE_URL,
    collectedAt: new Date().toISOString(),
    chartPoints: points.slice(-200),
    reportedFailures: failures.slice(0, 10),
  };
}

async function sendSnapshot(snapshot) {
  const body = JSON.stringify(snapshot);
  const timestamp = Date.now().toString();
  const signature = sign(null, Buffer.from(`${timestamp}.${body}`), privateKey()).toString(
    "base64",
  );
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-collector-timestamp": timestamp,
      "x-collector-signature": signature,
    },
    body,
  });
  if (!response.ok)
    throw new Error(`CRM respondeu ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

async function collect(page, headed) {
  await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(8_000);
  let raw = await extractSnapshot(page);
  if (/um momento|just a moment|cloudflare/i.test(raw.title) && headed) {
    console.log("[downdetector] Conclua a validação do Cloudflare na janela do Chrome.");
    await page.waitForFunction(
      () => !/um momento|just a moment|cloudflare/i.test(document.title),
      undefined,
      { timeout: 5 * 60_000 },
    );
    await page.waitForTimeout(5_000);
    raw = await extractSnapshot(page);
  }
  if (/um momento|just a moment|cloudflare/i.test(raw.title)) {
    throw new Error("O Cloudflare solicitou validação. Execute novamente com --headed.");
  }
  const snapshot = cleanSnapshot(raw);
  if (snapshot.chartPoints.length < 2 || snapshot.reportedFailures.length < 1) {
    if (process.argv.includes("--inspect")) {
      console.log("--- TEXTO ---\n", raw.bodyText);
      console.log("--- GRAFICO ---\n", raw.debugHtml);
      console.log("--- SCRIPTS ---\n", raw.debugScripts);
    }
    throw new Error(
      `Dados incompletos: ${snapshot.chartPoints.length} pontos e ${snapshot.reportedFailures.length} falhas.`,
    );
  }
  await sendSnapshot(snapshot);
  console.log(
    `[downdetector] ${snapshot.chartPoints.length} pontos e ${snapshot.reportedFailures.length} falhas enviados às ${new Date().toLocaleTimeString("pt-BR")}.`,
  );
}

async function main() {
  const watch = process.argv.includes("--watch");
  const headed = process.argv.includes("--headed") || process.env.DOWNDETECTOR_HEADED === "1";
  const intervalMs = Math.max(
    60_000,
    Number(process.env.DOWNDETECTOR_INTERVAL_MINUTES ?? 10) * 60_000,
  );
  const context = await chromium.launchPersistentContext(PROFILE_PATH, {
    executablePath: chromePath(),
    headless: !headed,
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    do {
      try {
        await collect(page, headed);
      } catch (error) {
        if (!watch) throw error;
        console.error(
          `[downdetector] ${error instanceof Error ? error.message : String(error)} Nova tentativa em ${Math.round(intervalMs / 60_000)} minutos.`,
        );
      }
      if (watch) await page.waitForTimeout(intervalMs);
    } while (watch);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(`[downdetector] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

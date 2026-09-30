const SOURCE_URL = "https://downdetector.com.br/fora-do-ar/sefaz/";

function extractSnapshot() {
  const text = (element) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
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
  const failureRoot =
    failureHeading?.parentElement?.querySelector('[aria-label*="reported problems" i]') ??
    failureHeading?.nextElementSibling ??
    failureHeading;
  const lines = (failureRoot?.innerText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const failureStart = lines.findIndex((line) =>
    /falhas mais relatadas|problemas mais relatados/i.test(line),
  );
  const firstFailureLine = failureStart >= 0 ? failureStart + 1 : 0;
  const reportedFailures = [];
  for (let index = firstFailureLine; index < Math.min(lines.length, firstFailureLine + 24); index += 1) {
    const percentage = lines[index]?.match(/^(\d{1,3})%$/);
    const label = lines[index + 1];
    if (!percentage || !label || /^(\d{1,3})%$/.test(label)) continue;
    reportedFailures.push({ label, percent: Number(percentage[1]) });
    index += 1;
  }

  const chart = document.querySelector("svg.recharts-surface");
  const curve = chart?.querySelector(".recharts-area-curve");
  const axisTicks = [...(chart?.querySelectorAll(".recharts-yAxis-tick-labels text") ?? [])]
    .map((tick) => ({
      y: Number(tick.getAttribute("y")),
      value: Number(tick.textContent?.trim()),
    }))
    .filter((tick) => Number.isFinite(tick.y) && Number.isFinite(tick.value));
  const coordinates = [
    ...(curve?.getAttribute("d") ?? "").matchAll(
      /[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
    ),
  ];
  if (axisTicks.length < 2 || coordinates.length < 2 || reportedFailures.length < 1) return null;

  const [firstTick, secondTick] = axisTicks;
  const valuePerPixel =
    (secondTick.value - firstTick.value) / (secondTick.y - firstTick.y);
  const end = new Date(Math.floor(Date.now() / 900_000) * 900_000);
  const chartPoints = coordinates.slice(0, 96).map((coordinate, index) => ({
    time: new Date(
      end.getTime() - (Math.min(coordinates.length, 96) - 1 - index) * 900_000,
    ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }),
    reports: Math.max(
      0,
      Math.round(firstTick.value + (Number(coordinate[2]) - firstTick.y) * valuePerPixel),
    ),
  }));

  return {
    serviceSlug: "sefaz",
    statusText: statusText ?? "Situação informada pelo Downdetector",
    sourceUrl: SOURCE_URL,
    collectedAt: new Date().toISOString(),
    chartPoints,
    reportedFailures: reportedFailures.slice(0, 10),
  };
}

async function collectWhenReady() {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const snapshot = extractSnapshot();
    if (snapshot) {
      await chrome.runtime.sendMessage({ type: "downdetector-snapshot", snapshot });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

void collectWhenReady();

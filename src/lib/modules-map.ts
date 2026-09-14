import { hadronModules } from "@/lib/hadron-modules";

export const modulesMap: Record<string, string[]> = Object.fromEntries(
  hadronModules.map((module) => [module.nome, module.submodules.map((sub) => sub.nome)]),
);

export const moduleOptions = Object.keys(modulesMap);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/** Resolve module/submodule from a "Modulo - Submodulo" string. */
export function splitModule(text: string): { module: string; submodule: string } {
  const [rawMod, ...rest] = (text || "").split(" - ");
  const mod =
    moduleOptions.find((item) => normalize(item) === normalize(rawMod)) ?? moduleOptions[0];
  const subs = modulesMap[mod] ?? [];
  const rawSub = rest.join(" - ").trim();
  const submodule =
    subs.find((item) => normalize(item) === normalize(rawSub)) ?? subs[0] ?? "GERAL";
  return { module: mod, submodule };
}

import modulesExport from "@/data/cvs_modules.json";
import submodulesExport from "@/data/cvs_submodules.json";

export type HadronSubmodule = { id: string; id_modulo: string; nome: string };
export type HadronModule = { id: string; nome: string; submodules: HadronSubmodule[] };
const modules = modulesExport.find((entry) => entry.type === "table")!.data!;
const submodules = submodulesExport.find((entry) => entry.type === "table")!.data!;
export const hadronModules: HadronModule[] = modules
  .map((module) => ({
    ...module,
    submodules: submodules
      .filter((sub) => sub.id_modulo === module.id)
      .sort((a, b) => Number(a.id) - Number(b.id)),
  }))
  .sort((a, b) => Number(a.id) - Number(b.id));

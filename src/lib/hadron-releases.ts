import modulesSource from "@/data/cvs-modules.json";
import releasesSource from "@/data/cvs-releases.json";
import submodulesSource from "@/data/cvs-submodules.json";

type JsonExport<T> = Array<{ type: string; name?: string; data?: T[] }>;

type LegacyRelease = {
  id_release: string;
  opcao: string | null;
  formulario: string | null;
  data_versao: string | null;
  data_release: string;
  tipo_release: string;
  st_teste: string;
  resp_prg: string;
  resp_teste: string;
  descricao: string;
  descricao_opcao: string;
  st_exclusivo: string;
  cvs_options_id: string | null;
  cvs_submodules_id: string | null;
  cvs_modules_id: string | null;
  tags: string;
  permission: string;
  cliques: string;
  created: string;
  modified: string;
};

type LegacyModule = { id: string; nome: string };
type LegacySubmodule = { id: string; id_modulo: string; nome: string };

const tableRows = <T>(source: JsonExport<T>, name: string) =>
  source.find((entry) => entry.type === "table" && entry.name === name)?.data ?? [];

const modules = tableRows(modulesSource as JsonExport<LegacyModule>, "cvs_modules");
const submodules = tableRows(submodulesSource as JsonExport<LegacySubmodule>, "cvs_submodules");

export const hadronModuleNames = new Map(modules.map((module) => [module.id, module.nome]));
export const hadronSubmoduleNames = new Map(
  submodules.map((submodule) => [`${submodule.id_modulo}:${submodule.id}`, submodule.nome]),
);

export const hadronReleases = tableRows(
  releasesSource as JsonExport<LegacyRelease>,
  "cvs_releases",
).map((release) => ({
  id: release.id_release,
  title: release.descricao || "Release sem descrição",
  status: release.st_teste,
  description: release.descricao_opcao || "",
  owner: release.resp_prg || "",
  tester: release.resp_teste || "",
  clicks: Number(release.cliques || 0),
  tags: release.tags || "",
  moduleId: release.cvs_modules_id || "",
  submoduleId: release.cvs_submodules_id || "",
  optionId: release.cvs_options_id || "",
  option: release.opcao || "",
  form: release.formulario || "",
  version: release.data_versao || "",
  releaseType:
    ({ "2": "correcao", "4": "alteracao", "6": "novidade" } as Record<string, string>)[
      release.tipo_release
    ] || "outro",
  permission:
    ({ "0": "publico", "1": "clientes", "2": "empresa" } as Record<string, string>)[
      release.permission
    ] || "clientes",
  exclusive: release.st_exclusivo === "1",
  createdAt: release.data_release || release.created,
  updatedAt: release.modified || release.created,
}));

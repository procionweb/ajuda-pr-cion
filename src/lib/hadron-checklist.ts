import checksSource from "@/data/cvs-checks.json";
import optionChecksSource from "@/data/hadron-option-checks.json";

type JsonExport<T> = Array<{ type: string; name?: string; data?: T[] }>;

type LegacyCheck = {
  id: string;
  caracteristica: string;
  titulo: string;
  descricao: string;
  manter_salvo: string;
  created: string;
  modified: string;
};

type LegacyOptionCheck = [string, string, string, string, string, string];

const tableRows = <T>(source: JsonExport<T>, name: string) =>
  source.find((entry) => entry.type === "table" && entry.name === name)?.data ?? [];

const checks = tableRows(checksSource as JsonExport<LegacyCheck>, "cvs_checks");
const optionChecks = optionChecksSource as LegacyOptionCheck[];
const checksById = new Map(checks.map((check) => [check.id, check]));
const optionChecksByOption = new Map<string, LegacyOptionCheck[]>();
optionChecks.forEach((item) => {
  const related = optionChecksByOption.get(item[1]) || [];
  related.push(item);
  optionChecksByOption.set(item[1], related);
});

export const hadronChecklist = checks.map(
  (check) =>
    [
      check.id,
      check.caracteristica,
      check.titulo,
      check.descricao,
      check.manter_salvo === "1",
      check.created,
      check.modified,
    ] as const,
);

export function getHadronOptionChecklist(optionId: string) {
  return (optionChecksByOption.get(optionId) || []).map((item) => {
    const check = checksById.get(item[2]);
    return {
      id: item[0],
      checkId: item[2],
      characteristic: item[3] || check?.caracteristica || "geral",
      title: check?.titulo || `Check ${item[2]}`,
      description: check?.descricao || "",
      check1: item[4] === "1",
      check2: item[5] === "1",
    };
  });
}

import { cvsOptions } from "@/lib/cvs-catalogs-imported";

export type HadronOption = {
  id: string;
  option: string;
  form: string;
  description: string;
  label: string;
  status: string;
  owner: string;
  priority: string;
  characteristic: string;
  observation: string;
  call: string;
  executable: string;
  tester: string;
  releaseOwner: string;
  approvalOwner: string;
  hadronOwner: string;
  openedAt: string;
  approvedAt: string;
  hadronAt: string;
  tags: string;
  listView: string;
  moduleId: string;
  submoduleId: string;
  updatedAt: string;
};

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

type CvsOption = Omit<HadronOption, "label">;

export const hadronOptions: HadronOption[] = (
  cvsOptions as readonly CvsOption[]
).map((item) => ({
  id: item.id,
  option: item.option,
  form: item.form,
  description: item.description,
  label: `${item.description} (${item.option} - ${item.form || item.option})`,
  status: item.status,
  owner: item.owner,
  priority: item.priority,
  characteristic: item.characteristic,
  observation: item.observation,
  call: item.call,
  executable: item.executable,
  tester: item.tester,
  releaseOwner: item.releaseOwner,
  approvalOwner: item.approvalOwner,
  hadronOwner: item.hadronOwner,
  openedAt: item.openedAt,
  approvedAt: item.approvedAt,
  hadronAt: item.hadronAt,
  tags: item.tags,
  listView: item.listView,
  moduleId: item.moduleId,
  submoduleId: item.submoduleId,
  updatedAt: item.updatedAt,
}));

function search(query: string, formFirst: boolean, limit = 10) {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];
  return hadronOptions
    .filter((item) => {
      const value = formFirst
        ? `${item.form} ${item.description} ${item.option}`
        : `${item.option} ${item.description} ${item.form}`;
      return normalizeSearch(value).includes(normalized);
    })
    .slice(0, limit);
}

export function searchHadronOptions(query: string, limit = 10) {
  return search(query, false, limit);
}

export function searchHadronForms(query: string, limit = 10) {
  return search(query, true, limit);
}

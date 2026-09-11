import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonDirectory = path.join(process.env.USERPROFILE || "", "Downloads", "json");
const articlesPath = process.argv[2] || path.join(jsonDirectory, "cvs_articles (1).json");
const optionsPath = process.argv[3] || path.join(jsonDirectory, "cvs_options (1).json");
const outputPath = path.join(root, "src", "lib", "cvs-catalogs-imported.ts");

function tableRows(file, expectedTable) {
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const table = payload.find((entry) => entry.type === "table" && entry.name === expectedTable);
  if (!table || !Array.isArray(table.data)) {
    throw new Error(`Tabela ${expectedTable} não encontrada em ${file}.`);
  }
  return table.data;
}

const cp1252 = new Map(
  [..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"].map((character, index) => [
    character,
    [
      0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8e, 0x91, 0x92,
      0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9e, 0x9f,
    ][index],
  ]),
);

function decodeMojibake(value) {
  const bytes = [];
  for (const character of value) {
    const code = character.codePointAt(0);
    const byte = cp1252.get(character) ?? code;
    if (byte > 255) return value;
    bytes.push(byte);
  }
  return Buffer.from(bytes).toString("utf8");
}

function repairText(value) {
  let text = String(value ?? "").trim();
  for (let attempt = 0; attempt < 3 && /Ã|Â|â|ï¿½/.test(text); attempt += 1) {
    const decoded = decodeMojibake(text);
    if (decoded === text || decoded.includes("�")) break;
    text = decoded;
  }
  return text;
}

const options = tableRows(optionsPath, "cvs_options")
  .map((row) => ({
    id: String(row.id || ""),
    option: repairText(row.opcao),
    form: repairText(row.formulario),
    description: repairText(row.descricao),
    status: String(row.status || ""),
    owner: repairText(row.responsavel),
    priority: String(row.prioridade || ""),
    characteristic: repairText(row.caracteristica),
    observation: repairText(row.observacao),
    call: repairText(row.chamada),
    executable: repairText(row.dll_exe),
    tester: repairText(row.resp_testes),
    releaseOwner: repairText(row.resp_liberar),
    approvalOwner: repairText(row.resp_aprovar),
    hadronOwner: repairText(row.resp_hadron),
    openedAt: repairText(row.data),
    approvedAt: repairText(row.data_aprovar),
    hadronAt: repairText(row.data_hadron),
    tags: repairText(row.tags),
    listView: String(row.listview || "0"),
    moduleId: String(row.cvs_modules_id || ""),
    submoduleId: String(row.cvs_submodules_id || ""),
    updatedAt: repairText(row.modified || row.data_hadron || row.data),
  }))
  .filter((row) => row.id && row.option && row.description);

const articles = tableRows(articlesPath, "cvs_articles")
  .map((row) => ({
    id: String(row.id || ""),
    title: repairText(row.art_title),
    status: String(row.art_status || ""),
    description: repairText(row.art_description),
    category: repairText(row.art_category),
    owner: repairText(row.art_collaborator),
    permission: String(row.art_permission ?? row.permission ?? "1"),
    clicks: Number(row.art_clicks || 0),
    tags: repairText(row.art_tags),
    relatedReleaseIds: repairText(row.art_id_releases_related),
    moduleId: String(row.cvs_modules_id || ""),
    submoduleId: String(row.cvs_submodules_id || ""),
    createdAt: repairText(row.created),
    updatedAt: repairText(row.modified),
  }))
  .filter((row) => row.id && row.title);

const output = `// Arquivo gerado por scripts/import-cvs-catalogs.mjs.
// Fonte exclusiva: cvs_options.json e cvs_articles.json.

export const cvsOptions = ${JSON.stringify(options, null, 2)} as const;

export const cvsArticles = ${JSON.stringify(articles, null, 2)} as const;
`;

fs.writeFileSync(outputPath, output, "utf8");
console.log(`Catálogos gerados: ${options.length} opções e ${articles.length} artigos.`);

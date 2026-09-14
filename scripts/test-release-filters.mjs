import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
const source = fs.readFileSync("src/routes/iniciar-hadron.tsx", "utf8");
const ast = ts.createSourceFile(
  "route.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let predicate;
function visit(node) {
  if (
    ts.isArrowFunction(node) &&
    ts.isBlock(node.body) &&
    node.body.getText(ast).includes("const selectedDate = dateType")
  )
    predicate = node;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(predicate);
const code = ts.transpile(`const predicate=${predicate.getText(ast)}`, {
  target: ts.ScriptTarget.ES2022,
});
const make = new Function(
  "normalizeOccurrenceText",
  "normalizedQuery",
  "normalizedOptionQuery",
  "releaseType",
  "operator",
  "dateType",
  "dateFrom",
  "dateTo",
  `${code};return predicate;`,
);
const normalize = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const row = {
  release: {
    id: "1",
    title: "1112 - NOVOS CAMPOS",
    owner: "PRCMEK",
    status: "",
    createdAt: "2026-07-30 23:59:59.999",
    version: "2026-07-30",
    updatedAt: "2026-09-10 14:27:00",
  },
  option: { option: "1112", form: "1112", description: "Empresas" },
  type: "novidade",
};
const defaults = ["", "", "todos", "todos", "release", "", ""];
for (const [overrides, expected] of [
  [{}, true],
  [{ 0: "novos" }, true],
  [{ 0: "ausente" }, false],
  [{ 1: "1112" }, true],
  [{ 1: "9999" }, false],
  [{ 2: "novidade" }, true],
  [{ 2: "correcao" }, false],
  [{ 3: "PRCMEK" }, true],
  [{ 3: "OUTRO" }, false],
  [{ 5: "2026-07-30", 6: "2026-07-30" }, true],
  [{ 5: "2026-09-10", 6: "2026-09-10" }, false],
  [{ 4: "versao", 5: "2026-07-30", 6: "2026-07-30" }, true],
]) {
  const args = defaults.slice();
  for (const [index, value] of Object.entries(overrides)) args[index] = value;
  assert.equal(make(normalize, ...args)(row), expected, JSON.stringify(overrides));
}
console.log("12 release filter checks passed.");

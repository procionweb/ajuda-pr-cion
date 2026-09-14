import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
const source = fs.readFileSync("src/routes/iniciar-hadron.tsx", "utf8");
const ast = ts.createSourceFile("route.tsx", source, 99, true, ts.ScriptKind.TSX);
let predicate;
function visit(node) {
  if (
    ts.isArrowFunction(node) &&
    ts.isBlock(node.body) &&
    node.body.getText(ast).includes("const haystack = normalizeOccurrenceText")
  )
    predicate = node;
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpile(`const predicate=${predicate.getText(ast)}`, { target: 99 });
const make = new Function(
  "normalizeOccurrenceText",
  "releaseTimestamp",
  "normalizedQuery",
  "normalizedTitle",
  "category",
  "operator",
  "status",
  "dateFrom",
  "dateTo",
  `${code};return predicate`,
);
const normalize = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const stamp = (v) => Date.parse(v.replace(" ", "T")) || 0;
const article = {
  id: "35",
  title: "Relatórios Estoque",
  owner: "PRCPED",
  category: "guia",
  tags: "ABC",
  status: "2",
  updatedAt: "2026-07-29 09:12:00",
  createdAt: "2020-01-01",
};
for (const [override, expected] of [
  [{}, true],
  [{ 0: "abc", 1: "estoque" }, true],
  [{ 0: "ausente" }, false],
  [{ 1: "prcped" }, false],
  [{ 2: "guia" }, true],
  [{ 2: "outro" }, false],
  [{ 3: "PRCPED" }, true],
  [{ 3: "OUTRO" }, false],
  [{ 4: "2" }, true],
  [{ 4: "1" }, false],
  [{ 5: "2026-07-29", 6: "2026-07-29" }, true],
  [{ 5: "2026-07-30" }, false],
]) {
  const args = ["", "", "todos", "todos", "todos", "", ""];
  for (const [key, value] of Object.entries(override)) args[key] = value;
  assert.equal(make(normalize, stamp, ...args)(article), expected, JSON.stringify(override));
}
console.log("12 article filter checks passed.");
if (process.argv.includes("--images")) {
  const s = fs.readFileSync("src/lib/cvs-catalogs-imported.ts", "utf8");
  const a = ts.createSourceFile("data.ts", s, 99, true);
  const n = a.statements.find(
    (n) =>
      ts.isVariableStatement(n) &&
      n.declarationList.declarations[0].name.getText(a) === "cvsArticles",
  );
  const rows = new Function(
    ts.transpile(n.getText(a).replace("export ", "")) + ";return cvsArticles",
  )();
  for (const m of rows.find((x) => x.id === "35").description.matchAll(/(?<!-)src="([^"]+)/g)) {
    const url = new URL(m[1], "https://crm.procion.com");
    const r = await fetch(url);
    console.log(url.pathname.split("/").pop(), r.status, r.headers.get("content-type"));
  }
}

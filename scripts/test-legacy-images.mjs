import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
const source = fs.readFileSync("src/routes/iniciar-hadron.tsx", "utf8");
const ast = ts.createSourceFile("route.tsx", source, 99, true, ts.ScriptKind.TSX);
const functions = ast.statements.filter(
  (n) =>
    ts.isFunctionDeclaration(n) &&
    ["normalizeLegacyUrl", "normalizeLegacyHtml"].includes(n.name?.text),
);
const normalize = new Function(
  ts.transpile(functions.map((n) => n.getText(ast)).join("\n")) + ";return normalizeLegacyHtml;",
)();
const result = normalize(
  '<img src="/webroot/file_manager/files/photo.png" data-cke-saved-src="/webroot/file_manager/files/photo.png">',
);
assert.match(result, / src="https:\/\/crm\.procion\.com\/file_manager\/files\/photo.png"/);
assert.match(result, /data-cke-saved-src="\/webroot\//);
const data = fs.readFileSync("src/lib/cvs-catalogs-imported.ts", "utf8");
const dataAst = ts.createSourceFile("data.ts", data, 99, true);
const declaration = dataAst.statements.find(
  (n) =>
    ts.isVariableStatement(n) &&
    n.declarationList.declarations[0].name.getText(dataAst) === "cvsArticles",
);
const articles = new Function(
  ts.transpile(declaration.getText(dataAst).replace("export ", "")) + ";return cvsArticles;",
)();
const html = normalize(articles.find((a) => a.id === "35").description);
const images = [...html.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/gi)];
assert.equal(images.length, 17);
for (const [, src] of images)
  assert.ok(src.startsWith("https://crm.procion.com/file_manager/"), src);
console.log("Legacy editor attribute regression and all 17 article 35 images passed.");

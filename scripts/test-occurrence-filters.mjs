import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const source = fs.readFileSync("src/lib/hadron-occurrences.ts", "utf8");
const ast = ts.createSourceFile("api.ts", source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "listHadronOccurrences",
);
const code = ts.transpile(fn.getText(ast).replace(/^export /, ""), {
  target: ts.ScriptTarget.ES2022,
});
const fixture = [
  {
    id: 1,
    option_legacy_id: "1",
    kind: "ocorrencia",
    reporter: "A",
    solver: null,
    occurred_at: "2026-09-14T23:59:59.999-03:00",
    solved_at: null,
    reviewed_at: null,
    occurrence_text: "Falha teste",
    solution_text: "",
  },
  {
    id: 2,
    option_legacy_id: "2",
    kind: "solucao",
    reporter: "B",
    solver: "A",
    occurred_at: "2026-09-15T00:00:00-03:00",
    solved_at: "2026-09-15T12:00:00-03:00",
    reviewed_at: null,
    occurrence_text: "Outro",
    solution_text: "Resolvido",
  },
];
const supabase = {
  from() {
    let rows = fixture.slice();
    const q = {
      select() {
        return q;
      },
      order() {
        return q;
      },
      in(k, v) {
        rows = rows.filter((r) => v.includes(r[k]));
        return q;
      },
      eq(k, v) {
        rows = rows.filter((r) => r[k] === v);
        return q;
      },
      is(k, v) {
        return q.eq(k, v);
      },
      gte(k, v) {
        rows = rows.filter((r) => r[k] && Date.parse(r[k]) >= Date.parse(v));
        return q;
      },
      lt(k, v) {
        rows = rows.filter((r) => r[k] && Date.parse(r[k]) < Date.parse(v));
        return q;
      },
      or(expression) {
        const conditions = expression.split(",");
        rows = rows.filter((r) =>
          conditions.some((condition) => {
            const [field, op, ...rest] = condition.split(".");
            const value = rest.join(".");
            return op === "eq"
              ? r[field] === value
              : String(r[field] || "")
                  .toLowerCase()
                  .includes(value.replaceAll("%", "").toLowerCase());
          }),
        );
        return q;
      },
      async range(a, b) {
        return { data: rows.slice(a, b + 1), count: rows.length, error: null };
      },
    };
    return q;
  },
};
const list = new Function("supabase", "mapOccurrence", `${code}; return listHadronOccurrences;`)(
  supabase,
  (x) => x,
);
for (const [filters, ids] of [
  [{ optionIds: ["1"] }, [1]],
  [{ optionIds: ["__none__"] }, []],
  [{ kind: "solucao" }, [2]],
  [{ unresolved: true }, [1]],
  [{ operator: "A", operatorField: "reporter" }, [1]],
  [{ operator: "A", operatorField: "solver" }, [2]],
  [{ operator: "A" }, [1, 2]],
  [{ query: "Resolvido" }, [2]],
  [{ dateFrom: "2026-09-14", dateTo: "2026-09-14" }, [1]],
  [{ dateField: "solved_at", dateFrom: "2026-09-15", dateTo: "2026-09-15" }, [2]],
  [{ pageSize: 1 }, [1]],
]) {
  const result = await list({ page: 1, ...filters });
  assert.deepEqual(
    result.rows.map((r) => r.id),
    ids,
  );
}
console.log("11 occurrence filter checks passed, including end-of-day boundary and pagination.");

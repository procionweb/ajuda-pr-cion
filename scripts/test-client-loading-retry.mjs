import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
const exports = {};
vm.runInNewContext(
  ts.transpile(fs.readFileSync("src/lib/client-loading.ts", "utf8"), {
    module: ts.ModuleKind.CommonJS,
  }),
  { exports, setTimeout, Promise },
);
const { readClientResource } = exports;
let calls = 0;
let waits = [];
const ok = await readClientResource(
  async () =>
    ++calls < 3
      ? { data: null, error: { code: "57014", message: "timeout" }, status: 500 }
      : { data: { id: "fixture" }, error: null, status: 200 },
  async (ms) => {
    waits.push(ms);
  },
);
assert.equal(calls, 3);
assert.equal(ok.data.id, "fixture");
assert.deepEqual(waits, [300, 900]);
calls = 0;
await readClientResource(
  async () => {
    calls++;
    return { data: null, error: { code: "42501" }, status: 403 };
  },
  async () => {},
);
assert.equal(calls, 1);
calls = 0;
const failed = await readClientResource(
  async () => {
    calls++;
    return { data: null, error: { message: "Failed to fetch" }, status: 0 };
  },
  async () => {},
);
assert.equal(calls, 3);
assert(failed.error);
console.log("Leituras: recupera timeout, limita tentativas e preserva recusas de permissão.");

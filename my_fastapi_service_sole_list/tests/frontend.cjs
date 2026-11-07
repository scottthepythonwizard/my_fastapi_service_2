"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("app.js", "utf8").replace(/loadSneakers\(\);\s*$/, "");

function fixture(status) {
  const calls = [];
  const nodes = new Map();
  function node() {
    return { textContent: "", children: [], value: "", addEventListener() {}, setAttribute() {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; } };
  }
  const context = vm.createContext({
    window: { SOLE_API_URL: "https://example.test/", SOLE_API_KEY: "configured-test-key" },
    document: {
      getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
      createElement: node,
    },
    AbortSignal, console: { error() {} },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: status === 200, status, json: async () => ({ ok: true }) };
    },
  });
  vm.runInContext(source, context);
  return { context, nodes, calls };
}

(async () => {
  const success = fixture(200);
  await success.context.fetchJSON("https://example.test/api/v1/catalog");
  assert.equal(success.calls[0].options.headers["x-api-key"], "configured-test-key");
  assert.equal(success.calls[0].options.cache, "no-store");
  assert.ok(success.calls[0].options.signal instanceof AbortSignal);
  const records = JSON.parse(fs.readFileSync("data/sneakers.json", "utf8"));
  const provenance = JSON.parse(fs.readFileSync("data/provenance.json", "utf8"));
  for (const [id, attributes] of Object.entries(records)) {
    const item = { id: Number(id), image_url: `images/${id}.jpg`, attributes, provenance: provenance[id] };
    success.context.validateItems([item]);
    const reference = success.context.specificationValue(item, "shoe_reference_number");
    assert.equal(reference.textContent, attributes.shoe_reference_number);
    assert.deepEqual(reference.children.map((child) => child.className), ["data-source"]);
    assert.match(reference.children[0].href, /^https:\/\//);
    for (const field of ["closure_type", "cut", "sole_material", "cushioning", "weight_g", "release_month"]) {
      const value = success.context.specificationValue(item, field);
      assert.notEqual(value.textContent, "Not documented");
      assert.equal(value.children.some((child) => child.textContent === "Estimated"), provenance[id][field].status === "estimated");
      if (field === "release_month") assert.match(value.textContent, /^[A-Z][a-z]+(?: \d{4})?$/);
    }
  }
  for (const status of [401]) {
    const denied = fixture(status);
    await denied.context.loadSneakers();
    assert.equal(denied.calls.length, 1, "An authentication error must never fetch snapshot files");
    assert.equal(denied.calls[0].url, "https://example.test/api/v1/catalog");
    assert.equal(denied.calls[0].options.headers["x-api-key"], "configured-test-key");
    assert.equal(denied.nodes.get("resultCount").textContent, "UNAVAILABLE");
    const message = JSON.stringify(denied.nodes.get("sneakerList").children);
    assert.match(message, /API key was rejected/);
    assert.equal(vm.runInContext("state.loaded", denied.context), false);
  }
  console.log("PASS: all 20 specification sheets, estimate labels, reference sources, API-key headers and HTTP 401 handling.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

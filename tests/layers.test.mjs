import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("every model component has an accessible visibility control", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../dist/app.mjs", import.meta.url), "utf8");
  const layers = ["building", "rods", "cables", "anchors"];
  assert.equal((html.match(/data-layer="/g) ?? []).length, 4);
  for (const layer of layers) {
    assert.match(html, new RegExp(`data-layer="${layer}" aria-pressed="true"`));
    assert.match(app, new RegExp(`layerGroup\\("${layer}"`));
  }
  assert.match(app, /setAttribute\("aria-pressed", String\(nextVisible\)\)/);
  assert.match(html, /id="cable-schedule-body"/);
  assert.match(html, /id="download-cables"/);
  assert.match(html, /name="mansardHeight"/);
  assert.match(html, /name="roofEdgeSetback"/);
  assert.match(html, /value="69\.05" readonly/);
  assert.match(app, /pronet-lanove-useky\.csv/);
});

test("catalog routes from protected object to the available solution", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../dist/app.mjs", import.meta.url), "utf8");
  assert.match(html, /id="catalog-view"/);
  assert.match(html, /data-object="building"/);
  assert.match(html, /data-object="road"/);
  assert.match(html, /data-object="bridge"/);
  assert.match(html, /data-building-type="flat"/);
  assert.match(html, /data-building-type="pitched"/);
  assert.match(html, /id="open-prestressed-envelope"/);
  assert.match(html, /id="back-to-catalog"/);
  assert.match(app, /#predepjata-obalka/);
  assert.match(app, /addEventListener\("hashchange", showRoute\)/);
});

test("road catalog exposes a parametric configurator and separate rev03 reference", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../dist/app.mjs", import.meta.url), "utf8");
  const model = await readFile(new URL("../dist/model.mjs", import.meta.url), "utf8");
  assert.match(html, /id="road-solution-card"/);
  assert.match(html, /<h4>Silnice obecná<\/h4>/);
  assert.match(html, /<h2>Silnice obecná<\/h2>/);
  assert.match(app, /ProNet · Silnice obecná/);
  assert.match(html, /id="open-road-mast"/);
  assert.match(html, /id="road-configurator-view"/);
  for (const name of ["length", "width", "module"]) assert.match(html, new RegExp(`id="road-${name}" name="${name}" type="number"`));
  assert.match(html, /id="road-bays"[^>]*readonly/);
  assert.match(html, /data-road-mode="parametric"/);
  assert.match(html, /data-road-mode="reference"/);
  assert.match(app, /buildParametricRoadMastModel/);
  assert.match(app, /roadForm.elements.namedItem\(name\)/);
  assert.doesNotMatch(app, /roadForm.elements\[name\]/);
  assert.match(app, /form.querySelectorAll\("fieldset input"\)/);
  assert.doesNotMatch(app, /document.querySelectorAll\("fieldset input"\)/);
  assert.match(app, /#modularni-stozar-6m/);
  assert.match(app, /buildRoadMastModel/);
  assert.match(model, /MSK-01-REV03/);
  assert.match(model, /NT-S-03, listy 1–9/);
  assert.match(model, /Dovolená rychlost větru ani odolnost celé sestavy při dynamickém zásahu UAV nejsou stanoveny/);
});

test("road guardrail variant is a distinct planned catalog card, not an unverified configurator", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../dist/app.mjs", import.meta.url), "utf8");
  const card = html.match(/<article[^>]*id="road-guardrail-solution-card"[\s\S]*?<\/article>/)?.[0];
  assert.ok(card);
  assert.match(card, /<h4>Silnice se svodidly<\/h4>/);
  assert.match(card, /<em>Připravujeme<\/em>/);
  assert.match(card, /<button[^>]*disabled/);
  assert.match(app, /roadGuardrailSolutionCard.hidden = !hasRoadSolution/);
});

test("corrected material rule is explained in the UI and exported with its limitations", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../dist/app.mjs", import.meta.url), "utf8");
  assert.match(html, /id="download-road-bom"/);
  assert.match(html, /patka se 4 Y kolíky \+ 1 samostatný Y kolík/);
  assert.match(app, /const rows = roadMastBomRows\(model\)/);
  assert.match(app, /\.\.\.roadMastBomRows\(model\).map/);
  assert.match(app, /Potvrzené zadání 08\. 10\. 2026: 4 Y kolíky patky \+ 1 Y kolík lana/);
  assert.match(app, /každý kříž ze 2 průběžných dílů po 2 m/);
  assert.match(app, /Jen hotové Y kolíky; pásovina není samostatnou materiálovou položkou/);
  assert.match(app, /není potvrzením únosnosti, bezpečného provozu ani odolnosti proti UAV/);
});

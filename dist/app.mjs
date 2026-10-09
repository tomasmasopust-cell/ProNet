import { REFERENCE, ROAD_MAST_REFERENCE, buildParametricModel, buildReferenceModel, buildRoadMastModel, buildParametricRoadMastModel, roadMastBomRows, validateModel, validateRoadMastModel } from "./model.mjs";

const form = document.querySelector("#config-form");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const svg = document.querySelector("#model-view");
const bomBody = document.querySelector("#bom-body");
const cableScheduleBody = document.querySelector("#cable-schedule-body");
const cableScheduleNote = document.querySelector("#cable-schedule-note");
const downloadCablesButton = document.querySelector("#download-cables");
const layerButtons = [...document.querySelectorAll("[data-layer]")];
const visibleLayers = new Set(layerButtons.map((button) => button.dataset.layer));
const catalogView = document.querySelector("#catalog-view");
const configuratorView = document.querySelector("#configurator-view");
const roadConfiguratorView = document.querySelector("#road-configurator-view");
const objectButtons = [...document.querySelectorAll("[data-object]")];
const buildingTypeButtons = [...document.querySelectorAll("[data-building-type]")];
const buildingTypes = document.querySelector("#building-types");
const availableSolutions = document.querySelector("#available-solutions");
const catalogEmpty = document.querySelector("#catalog-empty");
const catalogEmptyTitle = document.querySelector("#catalog-empty-title");
const catalogEmptyText = document.querySelector("#catalog-empty-text");
const buildingSolutionCard = document.querySelector("#building-solution-card");
const roadSolutionCard = document.querySelector("#road-solution-card");
const roadGuardrailSolutionCard = document.querySelector("#road-guardrail-solution-card");
const roadForm = document.querySelector("#road-config-form");
const roadSvg = document.querySelector("#road-model-view");
const roadBomBody = document.querySelector("#road-bom-body");
const roadScheduleBody = document.querySelector("#road-cable-schedule-body");
let currentRoadModel = null;
let roadMode = "parametric";
let roadParametricInputs = { length: 30, width: 6, module: 15, netReserve: 0 };
const roadModeButtons = [...document.querySelectorAll("[data-road-mode]")];
let mode = "parametric";
let currentModel = null;
let selectedObject = "building";
let selectedBuildingType = "flat";

const read = () => Object.fromEntries(new FormData(form).entries());
const fmt = (value, unit = "") => value == null ? "—" : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ""}`;
const fmtCable = (value) => new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const cableTypeLabels = {
  "radial-cable": "Paprsek horní sítě",
  "hub-grid-cable": "Spoj vnitřních uzlů",
  "roof-perimeter-cable": "Obvod střechy",
  "support-link-cable": "Svislá–šikmá tyč",
  "outer-pair-cable": "Vnější spoj",
  "side-diagonal-cable": "Boční diagonála",
  "anchor-cable": "Kotevní lano"
};
const roadCableTypeLabels = {
  "road-guy": "G · vlastní kotevní lano",
  "road-side-diagonal": "X · boční diagonála",
  "road-longitudinal": "P · horní podélné lano",
  "road-cross": "T · horní příčné lano"
};

function setFormValues(values) {
  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (field) field.value = value;
  });
}

function project(point, bounds) {
  const angle = Math.PI / 6;
  const px = (point.x - point.y) * Math.cos(angle);
  const py = (point.x + point.y) * Math.sin(angle) - point.z * 1.15;
  return [bounds.cx + px * bounds.scale, bounds.cy + py * bounds.scale];
}

function svgLine(a, b, cls, bounds) {
  const p1 = project(a, bounds); const p2 = project(b, bounds);
  return `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" class="${cls}" />`;
}

function cableClass(item, reference = false) {
  const group = item.kind === "radial-cable" || item.kind === "hub-grid-cable" || item.kind === "roof-perimeter-cable"
    ? "roof-network"
    : item.kind === "support-link-cable"
      ? "support-link"
      : item.kind === "side-diagonal-cable"
        ? "side-diagonal"
        : item.kind === "outer-pair-cable"
        ? "inclined-perimeter"
        : "other-cable";
  return `cable-line ${group}${reference ? " reference" : ""}`;
}

const layerGroup = (name, markup) => visibleLayers.has(name) ? `<g data-model-layer="${name}">${markup}</g>` : "";

function renderModel(model) {
  const i = model.input;
  const g = model.geometry;
  const scale = Math.min(20, 430 / Math.max(g.envelopeLength + g.envelopeWidth, g.topZ * 2));
  const bounds = { cx: 410, cy: 280, scale };
  const box = [
    {x:-i.length/2,y:-i.width/2,z:0},{x:i.length/2,y:-i.width/2,z:0},{x:i.length/2,y:i.width/2,z:0},{x:-i.length/2,y:i.width/2,z:0},
    {x:-i.length/2,y:-i.width/2,z:i.height},{x:i.length/2,y:-i.width/2,z:i.height},{x:i.length/2,y:i.width/2,z:i.height},{x:-i.length/2,y:i.width/2,z:i.height}
  ];
  const boxEdges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  let markup = layerGroup("building", boxEdges.map(([a,b]) => svgLine(box[a], box[b], "building-line", bounds)).join(""));
  const graph = model.graph || buildParametricModel({ ...model.input, length: 20, width: 12, module: 4, hubs: 2, reserve: 0 }).graph;
  const reference = !model.graph;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  markup += layerGroup("cables", graph.cables
    .map((item) => svgLine(byId.get(item.a), byId.get(item.b), cableClass(item, reference), bounds)).join(""));
  markup += layerGroup("rods",
    graph.braces.map((item) => svgLine(byId.get(item.a), byId.get(item.b), "brace-line", bounds)).join("") +
    graph.rods.map((item) => svgLine(byId.get(item.a), byId.get(item.b), "rod-line", bounds)).join("")
  );
  markup += layerGroup("anchors", graph.nodes.filter((node) => node.kind === "anchor").map((node) => { const [x,y]=project(node,bounds); return `<rect x="${x-3}" y="${y-3}" width="6" height="6" class="anchor-node"/>`; }).join(""));
  svg.innerHTML = `<g>${markup}</g>`;
  document.querySelector("#view-caption").textContent = model.mode === "reference" ? "Referenční topologie · množství podle OBJ" : "Parametrický model · společná geometrie pro nákres i kusovník";
}

function renderBom(model) {
  const b = model.bom;
  const cableBreakdown = model.mode === "parametric" ? [
    ["Horní síť na svislých tyčích", b.roofNetworkSegments, "ks", `${fmt(b.roofNetworkLength,"m")} · paprsky + 4 obvodová lana`],
    ["Propojení svislá–šikmá tyč", b.supportLinkSegments, "ks", `${fmt(b.supportLinkLength,"m")} celkem`],
    ["Diagonální lana bočních polí", b.sideDiagonalSegments, "ks", `${fmt(b.sideDiagonalLength,"m")} celkem`],
    ["Spoje mezi konci šikmých tyčí", b.inclinedPerimeterSegments, "ks", `${fmt(b.inclinedPerimeterLength,"m")} · nejde o souvislý obvod`],
    ["Svislá kotevní lana", b.anchorCableSegments, "ks", `${fmt(b.anchorCableLength,"m")} celkem`]
  ] : [
    ["Horní síť na svislých tyčích", b.roofNetworkSegments, "ks", "převzato z OBJ; další členění celku 85 úseků není doloženo"]
  ];
  const rows = [
    ["Svislé tlakové trubky", b.verticalRods, "ks", `${fmt(b.verticalRodLength,"m")} / trubka`],
    ["Střešní uložení", b.roofBases, "soubor", "1 na každou svislou trubku"],
    ["Šikmé trubky", b.braceRods, "ks", `${fmt(b.braceLength,"m")} celkem`],
    ["Ocelové lano", b.cableLengthOrdered, "m", `${fmt(b.cableLengthGeometric,"m")} geometricky`],
    ["Lanové úseky", b.cableSegments, "ks", "samostatně napínané"],
    ...cableBreakdown,
    ["Napínáky", b.tensioners, "ks", "1 na lanový úsek"],
    ["Koncovky lana", b.terminations, "ks", "2 na lanový úsek"],
    ["Zemní kotevní body", b.groundAnchors, "soubor", "typ a únosnost neurčeny"],
    ["Styčníky a koncové body", b.joints, "soubor", "výrobkový detail neurčen"],
    ["Ochranná síť", b.netAreaOrdered, "m²", b.netAreaOrdered == null ? "v OBJ není doložena plocha" : `horní ${fmt(b.netTopArea,"m²")} + boční ${fmt(b.netSideArea,"m²")}`]
  ];
  bomBody.innerHTML = rows.map(([name, qty, unit, note]) => `<tr><td><strong>${name}</strong><span>${note}</span></td><td>${fmt(qty)}</td><td>${qty == null ? "—" : unit}</td></tr>`).join("");
}

function renderCableSchedule(model) {
  const schedule = model.bom.cableSchedule;
  const available = Array.isArray(schedule);
  downloadCablesButton.disabled = !available;
  cableScheduleNote.textContent = available
    ? `${schedule.length} úseků · geometrické délky po 0,01 m · bez přídavků na koncovky, napínání a montáž.`
    : "Referenční OBJ obsahuje pouze souhrnnou délku; jednotlivé délky lan nejsou doložené.";
  cableScheduleBody.innerHTML = available
    ? schedule.map((item) => `<tr><td><strong>${item.code}</strong></td><td>${cableTypeLabels[item.kind] || item.kind}</td><td><span class="connection">${item.from} → ${item.to}</span></td><td>${fmtCable(item.length)} m</td></tr>`).join("")
    : `<tr><td colspan="4">Jednotlivé úseky nejsou v referenčních datech dostupné.</td></tr>`;
}

function downloadCableSchedule() {
  const schedule = currentModel?.bom.cableSchedule;
  if (!Array.isArray(schedule)) return;
  const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ["Kód", "Typ", "Od", "Do", "Geometrická délka [m]"],
    ...schedule.map((item) => [item.code, cableTypeLabels[item.kind] || item.kind, item.from, item.to, item.length.toFixed(2).replace(".", ",")])
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "pronet-lanove-useky.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderRoadModel(model) {
  const g = model.geometry;
  const scale = Math.min(22, 570 / Math.max(g.length + g.installationWidth, g.height * 2));
  const bounds = { cx: 410, cy: 285, scale };
  const centered = (node) => ({ ...node, x: node.x - g.length / 2, y: node.y - g.width / 2 });
  const byId = new Map(model.graph.nodes.map((node) => [node.id, centered(node)]));
  const cableClassName = (cable) => cable.kind === "road-side-diagonal" ? "cable-line side-diagonal"
    : cable.kind === "road-guy" ? "cable-line inclined-perimeter"
      : "cable-line roof-network";
  const cables = model.graph.cables.map((cable) => svgLine(byId.get(cable.a), byId.get(cable.b), cableClassName(cable), bounds)).join("");
  const rods = model.graph.rods.map((rod) => svgLine(byId.get(rod.a), byId.get(rod.b), "rod-line", bounds)).join("");
  const feet = [...model.graph.baseArms, ...model.graph.braces, ...model.graph.groundSpikes].map((part) => svgLine(byId.get(part.a), byId.get(part.b), "rod-line road-foot", bounds)).join("");
  const anchors = model.graph.anchors.map((node) => { const [x, y] = project(centered(node), bounds); return `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" class="anchor-node"/>`; }).join("");
  const road = [
    { x: -g.length / 2, y: -g.width / 2, z: 0 }, { x: g.length / 2, y: -g.width / 2, z: 0 },
    { x: g.length / 2, y: g.width / 2, z: 0 }, { x: -g.length / 2, y: g.width / 2, z: 0 }
  ];
  const roadLines = [[0,1],[1,2],[2,3],[3,0]].map(([a,b]) => svgLine(road[a], road[b], "building-line road-line-base", bounds)).join("");
  roadSvg.innerHTML = `<g>${roadLines}${cables}${rods}${feet}${anchors}</g>`;
}

function renderRoadBom(model) {
  const rows = roadMastBomRows(model);
  roadBomBody.innerHTML = rows.map((item) => `<tr data-bom-code="${item.code}" data-category="${item.category}"><td><strong>${item.name}</strong><span>${item.note}</span><span class="bom-source">${item.source}</span></td><td>${fmt(item.quantity)}</td><td>${item.quantity == null ? "—" : item.unit}</td></tr>`).join("");
  document.querySelector("#road-bom-rule-note").textContent = model.materialRule.correction
    ? `${model.bom.masts} stožárů: ${model.bom.crossArms} dílů křížových patek (2 na patku); ${model.bom.baseYAnchors} + ${model.bom.guyYAnchors} = ${model.bom.yAnchors} hotových Y kolíků. Bez rozpisu pásoviny.`
    : "Historická reference PDF: 4 metrová ramena a 1 Y kolík lana na stožár. Opravené patky obsahuje režim Vlastní rozměry. Bez rozpisu pásoviny.";
}

function renderRoadSchedule(model) {
  const schedule = model.bom.cableSchedule;
  document.querySelector("#road-cable-schedule-note").textContent = `${schedule.length} úseků · přímé osové délky bez koncovek, průvěsu a výrobních přídavků.`;
  roadScheduleBody.innerHTML = schedule.map((item) => `<tr><td><strong>${item.code}</strong></td><td>${roadCableTypeLabels[item.kind]}</td><td><span class="connection">${item.from} → ${item.to}</span></td><td>${fmtCable(item.length)} m</td></tr>`).join("");
}

function renderRoad() {
  const model = roadMode === "reference" ? buildRoadMastModel({ bays: 2, netReserve: 0 })
    : buildParametricRoadMastModel(Object.fromEntries(new FormData(roadForm).entries()));
  currentRoadModel = model;
  const issues = validateRoadMastModel(model);
  const status = document.querySelector("#road-status-label");
  document.querySelector("#download-road-cables").disabled = issues.length > 0;
  document.querySelector("#download-road-bom").disabled = issues.length > 0;
  document.querySelector("#road-mode-detail").textContent = roadMode === "reference" ? "MSK-01-REV03 · pevná reference" : "MSK-01-PARAM · parametrické pravidlo";
  document.querySelector("#road-view-caption").textContent = roadMode === "reference" ? "Silniční koridor · dvě referenční pole 15 × 6 × 6 m" : "Silniční koridor · vlastní rozměry podle topologie revize 03";
  document.querySelector("#road-basis-line").textContent = `${ROAD_MAST_REFERENCE.source} · ${roadMode === "reference" ? ROAD_MAST_REFERENCE.classification : "PRONET-ROAD-MAST-002 · odvozené geometrické pravidlo, nikoli prokázaná únosnost"}`;
  if (!model.bom) {
    roadSvg.innerHTML = "";
    roadBomBody.innerHTML = "";
    document.querySelector("#road-bom-rule-note").textContent = "Kusovník není dostupný pro neplatné zadání.";
    roadScheduleBody.innerHTML = "";
    document.querySelector("#road-bays").value = "—";
    ["envelope", "masts", "segments", "cable"].forEach((key) => { document.querySelector(`#road-metric-${key}`).textContent = "—"; });
    document.querySelector("#road-layout-rule").textContent = "Doplňte platné rozměry. Předchozí výsledek se nepoužívá.";
    document.querySelector("#road-cable-schedule-note").textContent = "Výkaz není dostupný pro neplatné zadání.";
    document.querySelector("#road-checks").innerHTML = issues.map((item) => `<li class="error">${item}</li>`).join("");
    status.textContent = "UPRAVTE ZADÁNÍ";
    status.className = "status status-error";
    return;
  }
  renderRoadModel(model);
  renderRoadBom(model);
  renderRoadSchedule(model);
  document.querySelector("#road-bays").value = model.input.bays;
  document.querySelector("#road-layout-rule").textContent = `${model.input.bays} polí × ${fmtCable(model.geometry.bayLength)} m · 2 řady × ${model.geometry.stations} stožárů · šířka mezi kotvami lan ${fmt(model.geometry.installationWidth, "m")} (bez montážních a bezpečnostních odstupů). Polohy Y kolíků patky zatím nejsou ve schématu určeny.`;
  document.querySelector("#road-metric-envelope").textContent = `${fmt(model.geometry.length)} × ${fmt(model.geometry.width)} × ${fmt(model.geometry.height)} m`;
  document.querySelector("#road-metric-masts").textContent = fmt(model.bom.masts, "ks");
  document.querySelector("#road-metric-segments").textContent = fmt(model.bom.cableSegments, "ks");
  document.querySelector("#road-metric-cable").textContent = fmt(model.bom.cableLengthGeometric, "m");
  document.querySelector("#road-checks").innerHTML = [...issues.map((item) => `<li class="error">${item}</li>`), ...model.warnings.map((item) => `<li>${item}</li>`)].join("");
  status.textContent = issues.length ? "CHYBA MODELU" : "KONCEPČNÍ PODKLAD";
  status.className = issues.length ? "status status-error" : "status";
}

function setRoadMode(next) {
  if (roadMode === "parametric") roadParametricInputs = Object.fromEntries(new FormData(roadForm).entries());
  roadMode = next;
  const values = next === "reference" ? { length: 30, width: 6, module: 15, netReserve: 0 } : roadParametricInputs;
  Object.entries(values).forEach(([name, value]) => {
    const field = roadForm.elements.namedItem(name);
    field.value = value;
    field.disabled = next === "reference";
  });
  roadModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.roadMode === next);
    button.setAttribute("aria-pressed", String(button.dataset.roadMode === next));
  });
  renderRoad();
}

function downloadRoadCableSchedule() {
  const schedule = currentRoadModel?.bom?.cableSchedule;
  if (!Array.isArray(schedule)) return;
  const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [["Kód", "Typ", "Od", "Do", "Geometrická délka [m]"], ...schedule.map((item) => [item.code, roadCableTypeLabels[item.kind], item.from, item.to, item.length.toFixed(4).replace(".", ",")])];
  const url = URL.createObjectURL(new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = roadMode === "reference" ? "pronet-msk-01-rev03-lana.csv" : "pronet-msk-01-param-lana.csv"; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadRoadBom() {
  const model = currentRoadModel;
  if (!model?.bom || validateRoadMastModel(model).length) return;
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const records = [
    ["Pravidlo", `${model.materialRule.id} v${model.materialRule.version}`],
    ["Zdroj", `${ROAD_MAST_REFERENCE.source} · ${ROAD_MAST_REFERENCE.date}`],
    ["Upřesnění", model.materialRule.correction ? "Potvrzené zadání 08. 10. 2026: 4 Y kolíky patky + 1 Y kolík lana na stožár." : "Původní PDF: čtyři Y kolíky patky nejsou vykázány."],
    ["Provedení patky", model.materialRule.crossCorrection ? "Zadání 09. 10. 2026: každý kříž ze 2 průběžných dílů po 2 m." : "Historická reference PDF: 4 ramena po 1 m."],
    ["Rozsah kusovníku", "Jen hotové Y kolíky; pásovina není samostatnou materiálovou položkou."],
    ["Omezení", "Geometrický a materiálový podklad; není potvrzením únosnosti, bezpečného provozu ani odolnosti proti UAV. Úplná hmotnost neurčena."],
    ["Sčítání", "Řádky summary jsou souhrny již vykázaných položek; nepřičítají se znovu."],
    ["Kód", "Položka", "Množství", "Jednotka", "Kategorie", "Poznámka", "Zdroj"],
    ...roadMastBomRows(model).map((item) => [item.code, item.name, item.quantity == null ? "NEURČENO" : String(item.quantity).replace(".", ","), item.unit, item.category, item.note, item.source])
  ];
  const url = URL.createObjectURL(new Blob([`\uFEFF${records.map((record) => record.map(quote).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pronet-silnice-${roadMode === "reference" ? "pdf-reference" : "opravene-pravidlo"}-kusovnik.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function render(model) {
  currentModel = model;
  renderModel(model);
  renderBom(model);
  renderCableSchedule(model);
  const g = model.geometry;
  document.querySelector("#metric-envelope").textContent = `${fmt(g.envelopeLength)} × ${fmt(g.envelopeWidth)} m`;
  document.querySelector("#metric-top").textContent = fmt(g.topZ, "m");
  document.querySelector("#metric-fields").textContent = `${g.baysL} × ${g.baysW}`;
  document.querySelector("#metric-cable").textContent = fmt(model.bom.cableLengthGeometric, "m");
  document.querySelector("#basis-line").textContent = model.mode === "reference" ? REFERENCE.source : `Pole ${fmt(g.actualBayL,"m")} × ${fmt(g.actualBayW,"m")} · síť uzlů ${g.hubColumns} × ${g.hubRows} · šikmá tyč ${fmt(g.braceAngleFromVertical,"°")} od svislice · odsazení ${fmt(model.input.roofEdgeSetback,"m")}`;
  form.elements.hubs.value = model.input.hubs;
  const issues = validateModel(model);
  document.querySelector("#checks").innerHTML = [...issues.map((x) => `<li class="error">${x}</li>`), ...model.warnings.map((x) => `<li>${x}</li>`)].join("");
  document.querySelector("#status-label").textContent = issues.length ? "CHYBA MODELU" : "NÁVRHOVÝ PODKLAD";
  document.querySelector("#status-label").className = issues.length ? "status status-error" : "status";
  document.querySelector("#mode-detail").textContent = model.mode === "reference" ? "PLO-01-REF · pevná výměra" : "PLO-01-PARAM · generovaná topologie";
}

function update() {
  const model = mode === "reference" ? buildReferenceModel() : buildParametricModel(read());
  render(model);
  form.querySelectorAll("fieldset input").forEach((field) => { field.disabled = mode === "reference"; });
}

function renderCatalog() {
  objectButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.object === selectedObject)));
  buildingTypeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.buildingType === selectedBuildingType)));
  const isBuilding = selectedObject === "building";
  const hasBuildingSolution = isBuilding && selectedBuildingType === "flat";
  const hasRoadSolution = selectedObject === "road";
  const hasSolution = hasBuildingSolution || hasRoadSolution;
  buildingTypes.hidden = !isBuilding;
  availableSolutions.hidden = !hasSolution;
  buildingSolutionCard.hidden = !hasBuildingSolution;
  roadSolutionCard.hidden = !hasRoadSolution;
  roadGuardrailSolutionCard.hidden = !hasRoadSolution;
  catalogEmpty.hidden = hasSolution;
  if (hasSolution) return;
  const labels = { road: "Silnice", bridge: "Most", building: "Budova se šikmou střechou" };
  catalogEmptyTitle.textContent = labels[selectedObject];
  catalogEmptyText.textContent = "Pro tuto kategorii zatím není řešení v databázi. Katalog je připravený na postupné doplnění dalších konstrukčních systémů.";
}

function showRoute() {
  const showBuildingConfigurator = window.location.hash === "#predepjata-obalka";
  const showRoadConfigurator = window.location.hash === "#modularni-stozar-6m";
  catalogView.hidden = showBuildingConfigurator || showRoadConfigurator;
  configuratorView.hidden = !showBuildingConfigurator;
  roadConfiguratorView.hidden = !showRoadConfigurator;
  document.title = showBuildingConfigurator ? "ProNet · Předepjatá lanová obálka" : showRoadConfigurator ? "ProNet · Silnice obecná" : "ProNet · Databáze ochranných řešení";
  if (showBuildingConfigurator) update();
  if (showRoadConfigurator) renderRoad();
  window.scrollTo({ top: 0, behavior: "auto" });
}

modeButtons.forEach((button) => button.addEventListener("click", () => {
  mode = button.dataset.mode;
  modeButtons.forEach((item) => item.classList.toggle("active", item === button));
  if (mode === "reference") setFormValues(buildReferenceModel().input);
  update();
}));
layerButtons.forEach((button) => button.addEventListener("click", () => {
  const layer = button.dataset.layer;
  const nextVisible = !visibleLayers.has(layer);
  if (nextVisible) visibleLayers.add(layer); else visibleLayers.delete(layer);
  button.setAttribute("aria-pressed", String(nextVisible));
  if (currentModel) renderModel(currentModel);
}));
form.addEventListener("input", update);
downloadCablesButton.addEventListener("click", downloadCableSchedule);
document.querySelector("#reset-parametric").addEventListener("click", () => {
  mode = "parametric";
  modeButtons.forEach((item) => item.classList.toggle("active", item.dataset.mode === mode));
  setFormValues({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, mansardHeight: 0.5, roofEdgeSetback: 0.5, module: 4, hubs: 2, reserve: 15 });
  update();
});

objectButtons.forEach((button) => button.addEventListener("click", () => {
  selectedObject = button.dataset.object;
  renderCatalog();
}));
buildingTypeButtons.forEach((button) => button.addEventListener("click", () => {
  selectedBuildingType = button.dataset.buildingType;
  renderCatalog();
}));
document.querySelector("#open-prestressed-envelope").addEventListener("click", () => {
  window.location.hash = "predepjata-obalka";
});
document.querySelector("#open-road-mast").addEventListener("click", () => { window.location.hash = "modularni-stozar-6m"; });
document.querySelector("#back-to-catalog").addEventListener("click", () => {
  history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
  showRoute();
});
document.querySelector("#road-back-to-catalog").addEventListener("click", () => {
  history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
  showRoute();
});
roadForm.addEventListener("input", renderRoad);
roadModeButtons.forEach((button) => button.addEventListener("click", () => setRoadMode(button.dataset.roadMode)));
document.querySelector("#reset-road").addEventListener("click", () => {
  Object.entries({ length: 30, width: 6, module: 15, netReserve: 0 }).forEach(([name, value]) => { roadForm.elements.namedItem(name).value = value; });
  roadParametricInputs = { length: 30, width: 6, module: 15, netReserve: 0 };
  setRoadMode("parametric");
});
document.querySelector("#download-road-cables").addEventListener("click", downloadRoadCableSchedule);
document.querySelector("#download-road-bom").addEventListener("click", downloadRoadBom);
window.addEventListener("hashchange", showRoute);

renderCatalog();
showRoute();

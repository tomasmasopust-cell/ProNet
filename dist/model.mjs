const round = (value, digits = 2) => Number(value.toFixed(digits));

export const REFERENCE = Object.freeze({
  id: "PLO-01-REF",
  name: "Předepnutá lanová obálka",
  source: "Referenční topologie tinker.obj převzatá z NEtronu",
  building: { length: 21.1, width: 13.7, height: 4.9 },
  constructionGrid: { length: 20, width: 12, module: 4 },
  offsets: { left: 3, right: 3, front: 3, back: 3, roof: 3 },
  quantities: {
    verticalRods: 18,
    verticalRodLength: 3,
    braceRods: 16,
    braceRodLength: 2,
    tubeLength: 86,
    cableSegments: 85,
    cableLength: 490.1,
    tensioners: 85,
    terminations: 170,
    roofBases: 18,
    groundAnchors: 16,
    joints: 66,
    topCableSegments: 25,
    hubs: 2
  }
});

// Osa červených šikmých tyčí v referenčním tinker.obj má vůči svislici
// úhel 69,05°. Délka 2 m odpovídá referenčnímu kusovníku.
export const BRACE_GEOMETRY = Object.freeze({ length: 2, angleFromVertical: 69.05 });

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));

export function automaticHubCount(length, module) {
  return Math.max(1, Math.ceil((length - module) / (2 * module)));
}

export function normalizeInputs(raw = {}) {
  const length = clamp(raw.length, 4, 120);
  const width = clamp(raw.width, 4, 120);
  const module = clamp(raw.module, 1.5, 12);
  const roofOffset = clamp(raw.roofOffset, 1, 15);
  const mansardHeight = clamp(raw.mansardHeight ?? 0.5, 0.1, 15);
  const maxRoofEdgeSetback = Math.max(0, (Math.min(length, width) - 1) / 2);
  const roofEdgeSetback = clamp(raw.roofEdgeSetback ?? 0, 0, maxRoofEdgeSetback);
  const rodGridLength = length - 2 * roofEdgeSetback;
  const rodGridWidth = width - 2 * roofEdgeSetback;
  const hubColumns = automaticHubCount(rodGridLength, module);
  const hubRows = automaticHubCount(rodGridWidth, module);
  return {
    length,
    width,
    height: clamp(raw.height, 2, 40),
    offsetLeft: clamp(raw.offsetLeft, 0.5, 20),
    offsetRight: clamp(raw.offsetRight, 0.5, 20),
    offsetFront: clamp(raw.offsetFront, 0.5, 20),
    offsetBack: clamp(raw.offsetBack, 0.5, 20),
    roofOffset,
    mansardHeight,
    roofEdgeSetback,
    module,
    hubs: hubColumns * hubRows,
    hubColumns,
    hubRows,
    reserve: clamp(raw.reserve, 0, 40)
  };
}

function perimeterPoints(length, width, baysL, baysW, z, prefix) {
  const points = [];
  const add = (x, y) => points.push({ id: `${prefix}-${points.length + 1}`, x, y, z, kind: prefix });
  for (let i = 0; i < baysL; i += 1) add(-length / 2 + i * length / baysL, -width / 2);
  for (let i = 0; i < baysW; i += 1) add(length / 2, -width / 2 + i * width / baysW);
  for (let i = 0; i < baysL; i += 1) add(length / 2 - i * length / baysL, width / 2);
  for (let i = 0; i < baysW; i += 1) add(-length / 2, width / 2 - i * width / baysW);
  return points;
}

function edge(a, b, kind) {
  const length = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  return { id: `${kind}-${a.id}-${b.id}`, a: a.id, b: b.id, kind, length };
}

function loopEdges(nodes, kind) {
  return nodes.map((node, index) => edge(node, nodes[(index + 1) % nodes.length], kind));
}

function roofPerimeterEdges(nodes, length, width) {
  const corners = [
    [-length / 2, -width / 2],
    [length / 2, -width / 2],
    [length / 2, width / 2],
    [-length / 2, width / 2]
  ].map(([x, y]) => nodes.find((node) => Math.abs(node.x - x) < 1e-9 && Math.abs(node.y - y) < 1e-9));
  return loopEdges(corners, "roof-perimeter-cable");
}

function nearestHub(node, hubs) {
  return hubs.reduce((best, hub) => {
    const distance = Math.hypot(node.x - hub.x, node.y - hub.y);
    return !best || distance < best.distance ? { hub, distance } : best;
  }, null).hub;
}

function perimeterSides(nodes, length, width) {
  const tolerance = 1e-9;
  return [
    nodes.filter((node) => Math.abs(node.y + width / 2) < tolerance).sort((a, b) => a.x - b.x),
    nodes.filter((node) => Math.abs(node.x - length / 2) < tolerance).sort((a, b) => a.y - b.y),
    nodes.filter((node) => Math.abs(node.y - width / 2) < tolerance).sort((a, b) => b.x - a.x),
    nodes.filter((node) => Math.abs(node.x + length / 2) < tolerance).sort((a, b) => b.y - a.y)
  ];
}

function outerBraceNodes(roofPerimeter, input, rodGridLength, rodGridWidth) {
  const angle = BRACE_GEOMETRY.angleFromVertical * Math.PI / 180;
  const bracePlanLength = BRACE_GEOMETRY.length * Math.sin(angle);
  const braceRise = BRACE_GEOMETRY.length * Math.cos(angle);
  const cornerOffset = bracePlanLength / Math.sqrt(2);
  const outerZ = input.height + input.mansardHeight + braceRise;
  return roofPerimeter.map((node, index) => {
    const onX = Math.abs(Math.abs(node.x) - rodGridLength / 2) < 1e-9;
    const onY = Math.abs(Math.abs(node.y) - rodGridWidth / 2) < 1e-9;
    const dx = onX ? Math.sign(node.x) * (onY ? cornerOffset : bracePlanLength) : 0;
    const dy = onY ? Math.sign(node.y) * (onX ? cornerOffset : bracePlanLength) : 0;
    return { id: `net-top-${index + 1}`, x: node.x + dx, y: node.y + dy, z: outerZ, kind: "net-top", roofNodeId: node.id };
  });
}

function sideCableTopology(roofPerimeter, outerNodes, sideNodes, length, width) {
  const outerByRoof = new Map(outerNodes.map((node) => [node.roofNodeId, node]));
  const sideByRoof = new Map(sideNodes.map((node) => [node.roofNodeId, node]));
  const outerPairs = [];
  const diagonals = [];

  perimeterSides(roofPerimeter, length, width).forEach((side, sideIndex) => {
    const startCorner = side[0];
    const endCorner = side.at(-1);
    const inner = side.slice(1, -1);
    if (!inner.length) return;

    for (let index = 0; index + 1 < inner.length; index += 2) {
      outerPairs.push(edge(outerByRoof.get(inner[index].id), outerByRoof.get(inner[index + 1].id), "outer-pair-cable"));
    }

    diagonals.push(
      edge(sideByRoof.get(startCorner.id), outerByRoof.get(inner[0].id), "side-diagonal-cable"),
      edge(outerByRoof.get(startCorner.id), sideByRoof.get(inner[0].id), "side-diagonal-cable"),
      edge(sideByRoof.get(inner.at(-1).id), outerByRoof.get(endCorner.id), "side-diagonal-cable"),
      edge(outerByRoof.get(inner.at(-1).id), sideByRoof.get(endCorner.id), "side-diagonal-cable")
    );

    for (let index = 1; index + 1 < inner.length; index += 2) {
      const first = edge(sideByRoof.get(inner[index].id), outerByRoof.get(inner[index + 1].id), "side-diagonal-cable");
      diagonals.push(first, edge(outerByRoof.get(inner[index].id), sideByRoof.get(inner[index + 1].id), "side-diagonal-cable"));
      if (sideIndex === 0 && index === 1) diagonals.push({ ...first, id: `${first.id}-reference-overlap` });
    }
  });
  return { outerPairs, diagonals };
}

function radialCableEdges(roofPerimeter, hubs, length, width) {
  const edges = new Map();
  const add = (node, hub) => edges.set(`${node.id}:${hub.id}`, edge(node, hub, "radial-cable"));
  roofPerimeter.forEach((node) => add(node, nearestHub(node, hubs)));

  const tolerance = 1e-9;
  const minHubX = Math.min(...hubs.map((hub) => hub.x));
  const maxHubX = Math.max(...hubs.map((hub) => hub.x));
  const minHubY = Math.min(...hubs.map((hub) => hub.y));
  const maxHubY = Math.max(...hubs.map((hub) => hub.y));
  const boundaryFans = [
    {
      nodes: roofPerimeter.filter((node) => Math.abs(node.y + width / 2) < tolerance),
      hubs: hubs.filter((hub) => Math.abs(hub.y - minHubY) < tolerance).sort((a, b) => a.x - b.x),
      coordinate: "x"
    },
    {
      nodes: roofPerimeter.filter((node) => Math.abs(node.x - length / 2) < tolerance),
      hubs: hubs.filter((hub) => Math.abs(hub.x - maxHubX) < tolerance).sort((a, b) => a.y - b.y),
      coordinate: "y"
    },
    {
      nodes: roofPerimeter.filter((node) => Math.abs(node.y - width / 2) < tolerance),
      hubs: hubs.filter((hub) => Math.abs(hub.y - maxHubY) < tolerance).sort((a, b) => a.x - b.x),
      coordinate: "x"
    },
    {
      nodes: roofPerimeter.filter((node) => Math.abs(node.x + length / 2) < tolerance),
      hubs: hubs.filter((hub) => Math.abs(hub.x - minHubX) < tolerance).sort((a, b) => a.y - b.y),
      coordinate: "y"
    }
  ];

  boundaryFans.forEach(({ nodes, hubs: sideHubs, coordinate }) => {
    for (let index = 0; index < sideHubs.length - 1; index += 1) {
      const firstHub = sideHubs[index];
      const secondHub = sideHubs[index + 1];
      const boundary = (firstHub[coordinate] + secondHub[coordinate]) / 2;
      [...nodes]
        .sort((a, b) => Math.abs(a[coordinate] - boundary) - Math.abs(b[coordinate] - boundary))
        .slice(0, 2)
        .forEach((node) => {
          add(node, firstHub);
          add(node, secondHub);
        });
    }
  });
  const result = [...edges.values()];
  const minX = Math.min(...roofPerimeter.map((node) => node.x));
  const overlapNode = roofPerimeter
    .filter((node) => Math.abs(node.x - minX) < 1e-9 && node.y < 0)
    .sort((a, b) => Math.abs(a.y) - Math.abs(b.y))[0];
  if (overlapNode) {
    const overlap = edge(overlapNode, nearestHub(overlapNode, hubs), "radial-cable");
    result.push({ ...overlap, id: `${overlap.id}-reference-overlap` });
  }
  return result;
}

function hubGridCableEdges(hubs, columns, rows) {
  if (columns === 1 || rows === 1) return [];
  const at = (row, column) => hubs[row * columns + column];
  const result = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (column + 1 < columns) result.push(edge(at(row, column), at(row, column + 1), "hub-grid-cable"));
      if (row + 1 < rows) result.push(edge(at(row, column), at(row + 1, column), "hub-grid-cable"));
    }
  }
  return result;
}

export function buildParametricModel(raw) {
  const input = normalizeInputs(raw);
  const envelopeLength = input.length + input.offsetLeft + input.offsetRight;
  const envelopeWidth = input.width + input.offsetFront + input.offsetBack;
  const topZ = input.height + input.roofOffset;
  const rodGridLength = input.length - 2 * input.roofEdgeSetback;
  const rodGridWidth = input.width - 2 * input.roofEdgeSetback;
  const baysL = Math.max(1, Math.ceil(rodGridLength / input.module));
  const baysW = Math.max(1, Math.ceil(rodGridWidth / input.module));
  const roofPerimeter = perimeterPoints(rodGridLength, rodGridWidth, baysL, baysW, topZ, "roof-top");
  const roofBases = roofPerimeter.map((node) => ({ ...node, id: node.id.replace("top", "base"), z: input.height, kind: "roof-base" }));
  const outerNodes = outerBraceNodes(roofPerimeter, input, rodGridLength, rodGridWidth);
  const braceBases = roofPerimeter.map((node, index) => ({ id: `brace-base-${index + 1}`, x: node.x, y: node.y, z: input.height + input.mansardHeight, kind: "brace-base" }));
  const sideNodes = roofPerimeter.map((node, index) => ({ id: `side-node-${index + 1}`, x: node.x, y: node.y, z: input.height + input.mansardHeight, kind: "side-node", roofNodeId: node.id }));
  const anchors = outerNodes.map((node, index) => ({ id: `anchor-${index + 1}`, x: node.x, y: node.y, z: 0, kind: "anchor" }));
  const hubSpacing = 2 * input.module;
  const hubs = Array.from({ length: input.hubRows }, (_, row) =>
    Array.from({ length: input.hubColumns }, (_, column) => ({
      id: `hub-${row + 1}-${column + 1}`,
      x: input.hubColumns === 1 ? 0 : (column - (input.hubColumns - 1) / 2) * hubSpacing,
      y: input.hubRows === 1 ? 0 : (row - (input.hubRows - 1) / 2) * hubSpacing,
      z: topZ,
      kind: "hub"
    }))
  ).flat();
  const hubBases = hubs.map((node) => ({ ...node, id: node.id.replace("hub", "hub-base"), z: input.height, kind: "roof-base" }));

  const rods = [...roofPerimeter.map((node, index) => edge(roofBases[index], node, "vertical-rod")), ...hubs.map((node, index) => edge(hubBases[index], node, "vertical-rod"))];
  const braces = outerNodes.map((node, index) => edge(braceBases[index], node, "brace-rod"));
  const radialCables = radialCableEdges(roofPerimeter, hubs, rodGridLength, rodGridWidth);
  const hubGridCables = hubGridCableEdges(hubs, input.hubColumns, input.hubRows);
  const roofBoundaryCables = roofPerimeterEdges(roofPerimeter, rodGridLength, rodGridWidth);
  const supportLinkCables = roofPerimeter.map((node, index) => edge(node, outerNodes[index], "support-link-cable"));
  const { outerPairs, diagonals } = sideCableTopology(roofPerimeter, outerNodes, sideNodes, rodGridLength, rodGridWidth);
  const anchorCables = outerNodes.map((node, index) => edge(node, anchors[index], "anchor-cable"));
  const repeatedAnchor = { ...anchorCables[0], id: `${anchorCables[0].id}-reference-overlap` };
  const cables = [
    // Radiální lana horní sítě musí končit přesně ve vrcholech svislých
    // střešních trubek. Vnější uzly ochranné obálky stabilizují šikmé pruty,
    // ale nejsou náhradou za horní styčník svislé podpory.
    ...radialCables,
    // U velkých objektů tvoří vnitřní uzly dvourozměrnou síť. Spoje mezi
    // sousedními uzly udržují souvislou horní síť i mimo obvodové vějíře.
    ...hubGridCables,
    // Čtyři samostatná obvodová lana propojují krajní vrcholy svislých
    // střešních trubek. Průběžně míjejí mezilehlé styčníky stejně jako v OBJ.
    ...roofBoundaryCables,
    // Vodorovný přechod mezi vrcholem každé svislé střešní trubky a
    // odpovídajícím vnějším uzlem na vrcholu šikmé trubky. Tento úsek je
    // samostatné lano s vlastním napínákem a dvěma koncovkami.
    ...supportLinkCables,
    // Vnější konce šikmých tyčí netvoří souvislý okruh. OBJ spojuje pouze
    // vybrané dvojice; zbývající pole uzavírají diagonální boční lana.
    ...outerPairs,
    ...diagonals,
    ...anchorCables,
    repeatedAnchor
  ];
  const nodes = [...roofBases, ...roofPerimeter, ...braceBases, ...sideNodes, ...outerNodes, ...anchors, ...hubBases, ...hubs];
  const cableLength = cables.reduce((sum, item) => sum + item.length, 0);
  const codeWidth = Math.max(3, String(cables.length).length);
  const cableSchedule = cables.map((item, index) => ({
    code: `L-${String(index + 1).padStart(codeWidth, "0")}`,
    kind: item.kind,
    from: item.a,
    to: item.b,
    length: round(item.length)
  }));
  const lengthOf = (items) => round(items.reduce((sum, item) => sum + item.length, 0));
  const netTopArea = envelopeLength * envelopeWidth;
  const netSideArea = 2 * (envelopeLength + envelopeWidth) * topZ;
  const reserveFactor = 1 + input.reserve / 100;
  const warnings = [
    "Modul je pracovní geometrický vstup, nikoli potvrzená maximální rozteč.",
    "Délka šikmé tyče 2 m a úhel 69,05° vůči svislici jsou převzaté z referenčního OBJ.",
    "Počet vnitřních uzlů je automatický geometrický návrh v obou osách; vyžaduje prostorové nelineární posouzení.",
    "Hraniční tyče mezi sousedními vějíři jsou připojené k oběma vnitřním uzlům.",
    "Vnější lano není souvislý obvod: spojuje jen vybrané dvojice konců šikmých tyčí a mezery uzavírají diagonální boční vazby.",
    "Souběžné úseky zachované z referenčního OBJ musí před výrobou potvrdit projektant.",
    "Průřezy, předpětí, styčníky, střešní uložení a kotvy nejsou automaticky dimenzovány.",
    "Výpočet neprokazuje odolnost při dynamickém zásahu UAV."
  ];

  return {
    mode: "parametric",
    input,
    geometry: { envelopeLength, envelopeWidth, topZ, rodGridLength, rodGridWidth, braceAngleFromVertical: BRACE_GEOMETRY.angleFromVertical, baysL, baysW, hubColumns: input.hubColumns, hubRows: input.hubRows, actualBayL: rodGridLength / baysL, actualBayW: rodGridWidth / baysW },
    graph: { nodes, rods, braces, cables },
    bom: {
      verticalRods: rods.length,
      verticalRodLength: round(input.roofOffset),
      braceRods: braces.length,
      braceLength: braces.length * 2,
      cableSegments: cables.length,
      cableSchedule,
      cableLengthGeometric: round(cableLength),
      cableLengthOrdered: Math.ceil(cableLength * reserveFactor),
      roofNetworkSegments: radialCables.length + hubGridCables.length + roofBoundaryCables.length,
      roofNetworkLength: lengthOf([...radialCables, ...hubGridCables, ...roofBoundaryCables]),
      supportLinkSegments: supportLinkCables.length,
      supportLinkLength: lengthOf(supportLinkCables),
      sideDiagonalSegments: diagonals.length,
      sideDiagonalLength: lengthOf(diagonals),
      inclinedPerimeterSegments: outerPairs.length,
      inclinedPerimeterLength: lengthOf(outerPairs),
      anchorCableSegments: anchorCables.length + 1,
      anchorCableLength: lengthOf([...anchorCables, repeatedAnchor]),
      tensioners: cables.length,
      terminations: cables.length * 2,
      roofBases: rods.length,
      groundAnchors: anchors.length,
      joints: outerNodes.length + sideNodes.length + roofPerimeter.length + hubs.length,
      netTopArea: round(netTopArea),
      netSideArea: round(netSideArea),
      netAreaOrdered: Math.ceil((netTopArea + netSideArea) * reserveFactor)
    },
    warnings
  };
}

export function buildReferenceModel() {
  const q = REFERENCE.quantities;
  return {
    mode: "reference",
    input: {
      length: REFERENCE.building.length,
      width: REFERENCE.building.width,
      height: REFERENCE.building.height,
      offsetLeft: 3,
      offsetRight: 3,
      offsetFront: 3,
      offsetBack: 3,
      roofOffset: 3,
      mansardHeight: 0.5,
      roofEdgeSetback: 0.7,
      module: 4,
      hubs: q.hubs,
      reserve: 0
    },
    geometry: {
      envelopeLength: round(REFERENCE.building.length + 6),
      envelopeWidth: round(REFERENCE.building.width + 6),
      topZ: round(REFERENCE.building.height + 3),
      baysL: 5,
      baysW: 3,
      actualBayL: 4,
      actualBayW: 4
    },
    graph: null,
    bom: {
      verticalRods: q.verticalRods,
      verticalRodLength: q.verticalRodLength,
      braceRods: q.braceRods,
      braceLength: q.braceRods * q.braceRodLength,
      cableSegments: q.cableSegments,
      cableSchedule: null,
      cableLengthGeometric: q.cableLength,
      cableLengthOrdered: Math.ceil(q.cableLength),
      roofNetworkSegments: q.topCableSegments,
      roofNetworkLength: null,
      supportLinkSegments: null,
      supportLinkLength: null,
      sideDiagonalSegments: null,
      sideDiagonalLength: null,
      inclinedPerimeterSegments: null,
      inclinedPerimeterLength: null,
      anchorCableSegments: null,
      anchorCableLength: null,
      tensioners: q.tensioners,
      terminations: q.terminations,
      roofBases: q.roofBases,
      groundAnchors: q.groundAnchors,
      joints: q.joints,
      netTopArea: null,
      netSideArea: null,
      netAreaOrdered: null
    },
    warnings: [
      "Referenční výměra je převzatá z původního modelu; nejde o výrobní dokumentaci.",
      "Metadata původní budovy a konstrukční souřadnicová síť mají odlišné rozměry a musí být před realizací ověřeny.",
      "Dynamický zásah UAV ani úplná prostorová stabilita nejsou prokázány."
    ]
  };
}

export function validateModel(model) {
  const issues = [];
  if (model.bom.tensioners !== model.bom.cableSegments) issues.push("Počet napínáků neodpovídá počtu lanových úseků.");
  if (model.bom.terminations !== model.bom.cableSegments * 2) issues.push("Počet koncovek neodpovídá dvojnásobku lanových úseků.");
  if (model.bom.roofBases !== model.bom.verticalRods) issues.push("Každá svislá trubka musí mít střešní uložení.");
  if (model.mode === "parametric" && model.graph.cables.length !== model.bom.cableSegments) issues.push("Graf a kusovník mají rozdílný počet lan.");
  return issues;
}

export const ROAD_MAST_REFERENCE = Object.freeze({
  id: "MSK-01-REV03",
  name: "Modulární stožár 6 m",
  revision: "03",
  date: "2026-09-08",
  source: "NEtron · Stožár 6 m – revize 03 · NT-S-03, listy 1–9",
  classification: "Koncepční geometrický a materiálový podklad",
  rule: "PRONET-ROAD-MAST-001",
  bayLength: 15,
  width: 6,
  height: 6,
  rows: 2,
  armLength: 1,
  braceRadius: 0.8,
  braceHeight: 1,
  braceLength: round(Math.hypot(0.8, 1), 4),
  spigotLength: 0.6,
  groundSpikeLength: 1,
  eyeHeight: 4.75,
  anchorOffset: 4,
  guyLength: round(Math.hypot(4.75, 4), 4),
  diagonalLength: round(Math.hypot(15, 6), 4),
  tube: { diameterMm: 48.3, wallMm: 3.2, densityKgM3: 7850, massKg: 21.355 },
  anchor: { strips: 3, widthMm: 40, thicknessMm: 8, lengthMm: 1000, taperMm: 150, finishedMassKg: 6.971 }
});

// PDF quantities are kept separate from the user's correction to the base anchorage.
// Unknown sections, connections and resistance are not inferred from this material rule.
export const ROAD_MAST_ASSEMBLY_RULE = Object.freeze({
  id: "PRONET-ROAD-MAST-003", version: 2, reviewedAt: "2026-10-09",
  source: { id: "NT-S-03", revision: "03", date: "2026-09-08", locator: "listy 1–9; materiál 7/O, 8/P–Q, 9/R–S", classification: "example", file: "NEtron_technicky_navrh_rev03.pdf", sha256: "a879bd82e3b3dd25dfd87c8d4886e2e77a7495ed2b74ca2165d1a1195497233a" },
  correction: { id: "USER-BASE-Y-20261008", date: "2026-10-08", locator: "zadání uživatele a výslovné potvrzení: 4 Y kolíky patky + 1 kolík lana", classification: "requirement", sourceValue: null, value: 4, confirmedTotalPerMast: 5, limitation: "V PDF nejsou čtyři Y kolíky patky vykázány; jejich polohy a připojení nejsou určeny." },
  crossCorrection: { id: "USER-BASE-CROSS-20261009", date: "2026-10-09", locator: "zadání uživatele: každý kříž je ze dvou kusů", classification: "requirement", sourceValue: "4 × 1 m", value: "2 × 2 m", limitation: "Délka průběžného dílu zachovává původní rozměr patky; profil a spojení nejsou určeny." },
  crossArmPieceLength: 2,
  bomScope: "Y kolíky se vykazují jako hotové komplety; pásovina není samostatnou položkou kusovníku ani exportu (zadání 09. 10. 2026).",
  applicability: "Dvě krajní řady 6m stožárů; každý stožár má vlastní patku a samostatné kotevní lano.",
  parts: Object.freeze([
    { key: "tubes", perMast: 1, locator: "7/O; 9/S" },
    { key: "crossArms", perMast: 2, locator: "USER-BASE-CROSS-20261009" },
    { key: "braces", perMast: 4, locator: "1/C; 7/O" },
    { key: "spigots", perMast: 1, locator: "1/C; 7/O" },
    { key: "groundSpikes", perMast: 1, locator: "1/A; 7/O" },
    { key: "baseYAnchors", perMast: 4, locator: "USER-BASE-Y-20261008" },
    { key: "guyYAnchors", perMast: 1, locator: "2/D; 7/O" },
    { key: "guyEyes", perMast: 1, locator: "1/A; 7/O" },
    { key: "jointSets", perMast: 1, locator: "7/O" }
  ]),
  limitation: "Geometrický a materiálový podklad. Únosnost, úplná hmotnost a výrobní detaily nejsou potvrzeny."
});

function roadNode(id, x, y, z, kind, end = false) {
  return { id, x, y, z, kind, end };
}

export function buildRoadMastModel(raw = {}) {
  return buildRoadTopology(raw, false);
}

export function buildParametricRoadMastModel(raw = {}) {
  return buildRoadTopology(raw, true);
}

function buildRoadTopology(raw, parametric) {
  const spec = ROAD_MAST_REFERENCE;
  const numeric = (key, fallback) => raw[key] === undefined ? fallback : Number(raw[key]);
  const requestedLength = numeric("length", 30);
  const requestedWidth = numeric("width", 6);
  const requestedModule = numeric("module", 15);
  const inputIssues = parametric ? [
    ...(!(requestedLength > 0 && requestedLength <= 15000) ? ["Zadejte délku větší než 0 a nejvýše 15 000 m."] : []),
    ...(!(requestedWidth > 0 && requestedWidth <= 120) ? ["Zadejte šířku větší než 0 a nejvýše 120 m."] : []),
    ...(!(requestedModule >= 1 && requestedModule <= 30) ? ["Zadejte návrhový modul od 1 do 30 m."] : []),
    ...(requestedLength > 0 && requestedModule > 0 && Math.ceil(requestedLength / requestedModule) > 1000 ? ["Instalace může obsahovat nejvýše 1 000 polí; upravte délku nebo modul."] : [])
  ] : [];
  if (inputIssues.length) return { mode: "road-parametric", inputIssues, graph: null, bom: null };
  const bays = parametric ? Math.ceil(requestedLength / requestedModule) : Math.min(1000, Math.max(1, Math.round(Number(raw.bays) || 2)));
  const netReserve = Math.min(40, Math.max(0, Number(raw.netReserve) || 0));
  const stations = bays + 1;
  const length = parametric ? requestedLength : bays * spec.bayLength;
  const width = parametric ? requestedWidth : spec.width;
  const actualBayLength = length / bays;
  const nodes = [];
  const mastNodes = [];
  const anchors = [];
  for (let row = 0; row < spec.rows; row += 1) {
    const y = row * width;
    const anchorY = row === 0 ? y - spec.anchorOffset : y + spec.anchorOffset;
    for (let station = 0; station < stations; station += 1) {
      const number = row * stations + station + 1;
      const x = station * actualBayLength;
      const end = station === 0 || station === bays;
      const base = roadNode(`S${number}:0`, x, y, 0, "mast-base", end);
      const eye = roadNode(`S${number}:4.75`, x, y, spec.eyeHeight, "mast-eye", end);
      const top = roadNode(`S${number}:6`, x, y, spec.height, "mast-top", end);
      const anchor = roadNode(`K${number}:0`, x, anchorY, 0, "anchor", end);
      nodes.push(base, eye, top, anchor);
      mastNodes.push({ id: `S${number}`, row, station, end, base, eye, top, anchor });
      anchors.push(anchor);
    }
  }
  const rods = mastNodes.map((mast) => edge(mast.base, mast.top, "road-mast"));
  const baseArms = [], braces = [], groundSpikes = [];
  for (const mast of mastNodes) {
    const braceTop = roadNode(`${mast.id}:brace-top`, mast.base.x, mast.base.y, spec.braceHeight, "brace-top");
    const spikeBottom = roadNode(`${mast.id}:spike-bottom`, mast.base.x, mast.base.y, -spec.groundSpikeLength, "spike-bottom");
    nodes.push(braceTop, spikeBottom);
    groundSpikes.push(edge(mast.base, spikeBottom, "road-ground-spike"));
    const armEnds = [];
    [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dy], i) => {
      const armEnd = roadNode(`${mast.id}:arm-${i + 1}`, mast.base.x + dx * spec.armLength, mast.base.y + dy * spec.armLength, 0, "base-arm-end");
      const braceBase = roadNode(`${mast.id}:brace-base-${i + 1}`, mast.base.x + dx * spec.braceRadius, mast.base.y + dy * spec.braceRadius, 0, "brace-base");
      nodes.push(armEnd, braceBase);
      armEnds.push(armEnd);
      if (!parametric) baseArms.push(edge(mast.base, armEnd, "road-base-arm"));
      braces.push(edge(braceTop, braceBase, "road-brace"));
    });
    if (parametric) {
      baseArms.push(edge(armEnds[0], armEnds[2], "road-base-arm"), edge(armEnds[1], armEnds[3], "road-base-arm"));
    }
  }
  const cables = [];
  const counters = { G: 0, X: 0, P: 0, T: 0 };
  const addCable = (type, a, b, kind) => {
    counters[type] += 1;
    cables.push({ ...edge(a, b, kind), code: `${type}${counters[type]}`, type });
  };
  mastNodes.forEach((mast) => addCable("G", mast.eye, mast.anchor, "road-guy"));
  for (let row = 0; row < spec.rows; row += 1) {
    for (let station = 0; station < bays; station += 1) {
      const left = mastNodes[row * stations + station];
      const right = mastNodes[row * stations + station + 1];
      addCable("X", left.top, right.base, "road-side-diagonal");
      addCable("X", left.base, right.top, "road-side-diagonal");
      addCable("P", left.top, right.top, "road-longitudinal");
    }
  }
  for (let station = 0; station < stations; station += 1) {
    addCable("T", mastNodes[station].top, mastNodes[stations + station].top, "road-cross");
  }
  const cableSchedule = cables.map((cable) => ({ code: cable.code, kind: cable.kind, from: cable.a, to: cable.b, length: round(cable.length, 4) }));
  const lengthByType = (type) => round(cables.filter((cable) => cable.type === type).reduce((sum, cable) => sum + cable.length, 0), 4);
  const mastCount = mastNodes.length;
  const innerMasts = Math.max(0, mastCount - 4);
  const ownParts = Object.fromEntries(ROAD_MAST_ASSEMBLY_RULE.parts.map((part) => [part.key, !parametric && part.key === "baseYAnchors" ? 0 : !parametric && part.key === "crossArms" ? 4 : part.perMast]));
  const crossArmPieceLength = parametric ? ROAD_MAST_ASSEMBLY_RULE.crossArmPieceLength : spec.armLength;
  const assemblies = mastNodes.map((mast) => ({
    id: mast.id, type: mast.end ? "end" : "inner", parts: { ...ownParts },
    baseYPositions: null, // No pin locations were supplied; do not fabricate coordinates.
    topCableEnds: cables.filter((cable) => cable.a === mast.top.id || cable.b === mast.top.id).length,
    baseCableEnds: cables.filter((cable) => cable.a === mast.base.id || cable.b === mast.base.id).length,
    cableShareLength: cables.reduce((sum, cable) => sum + (cable.a.startsWith(`${mast.id}:`) || cable.b.startsWith(`${mast.id}:`) ? cable.length * (cable.type === "G" ? 1 : 0.5) : 0), 0)
  }));
  const partCount = (key) => assemblies.reduce((sum, mast) => sum + mast.parts[key], 0);
  const baseYAnchors = partCount("baseYAnchors"), guyYAnchors = partCount("guyYAnchors");
  const yAnchors = baseYAnchors + guyYAnchors;
  const anchor = spec.anchor;
  const yBlankMass = anchor.strips * anchor.lengthMm / 1000 * anchor.widthMm / 1000 * anchor.thicknessMm / 1000 * spec.tube.densityKgM3;
  const yFinishedMass = yBlankMass * (1 - anchor.taperMm / anchor.lengthMm / 2);
  const tubeArea = Math.PI / 4 * ((spec.tube.diameterMm / 1000) ** 2 - ((spec.tube.diameterMm - 2 * spec.tube.wallMm) / 1000) ** 2);
  const netTopArea = length * width;
  const netSideArea = length * spec.height * 2;
  return {
    solution: parametric ? "MSK-01-PARAM" : spec.id,
    mode: parametric ? "road-parametric" : "road-reference",
    source: { id: spec.id, rule: parametric ? "PRONET-ROAD-MAST-002" : spec.rule, locator: "NT-S-03, listy 1–9", classification: parametric ? "inference" : "example", date: spec.date },
    materialRule: { id: ROAD_MAST_ASSEMBLY_RULE.id, version: ROAD_MAST_ASSEMBLY_RULE.version, source: ROAD_MAST_ASSEMBLY_RULE.source, correction: parametric ? ROAD_MAST_ASSEMBLY_RULE.correction : null, crossCorrection: parametric ? ROAD_MAST_ASSEMBLY_RULE.crossCorrection : null, crossArmsPerMast: ownParts.crossArms, crossArmPieceLength, baseYPerMast: ownParts.baseYAnchors },
    input: { bays, netReserve, length, width, module: parametric ? requestedModule : spec.bayLength },
    geometry: { length, width, height: spec.height, bayLength: actualBayLength, rows: spec.rows, stations, installationWidth: width + 2 * spec.anchorOffset },
    graph: { nodes, rods, baseArms, braces, groundSpikes, cables, anchors, assemblies },
    bom: {
      masts: mastCount,
      tubes: partCount("tubes"),
      tubeLength: partCount("tubes") * spec.height,
      tubeKnownMassKg: round(partCount("tubes") * spec.height * tubeArea * spec.tube.densityKgM3, 3),
      crossArms: partCount("crossArms"),
      crossArmLength: partCount("crossArms") * crossArmPieceLength,
      braces: partCount("braces"),
      braceLength: round(partCount("braces") * Math.hypot(spec.braceRadius, spec.braceHeight), 3),
      spigots: partCount("spigots"),
      spigotLength: partCount("spigots") * spec.spigotLength,
      groundSpikes: partCount("groundSpikes"),
      groundSpikeLength: partCount("groundSpikes") * spec.groundSpikeLength,
      baseYAnchors, guyYAnchors, yAnchors,
      baseYKnownMassKg: round(baseYAnchors * yFinishedMass, 3),
      guyYKnownMassKg: round(guyYAnchors * yFinishedMass, 3),
      yAnchorKnownMassKg: round(yAnchors * yFinishedMass, 3),
      guyEyes: partCount("guyEyes"),
      topEndConnections: 4,
      topInnerConnections: innerMasts,
      baseEndConnections: 4,
      baseInnerConnections: innerMasts,
      topCableEnds: assemblies.reduce((sum, mast) => sum + mast.topCableEnds, 0),
      baseCableEnds: assemblies.reduce((sum, mast) => sum + mast.baseCableEnds, 0),
      braceEndConnections: partCount("braces") * 2,
      jointSets: partCount("jointSets"),
      cableSegments: cables.length,
      cableSchedule,
      guySegments: counters.G,
      guyLength: lengthByType("G"),
      diagonalSegments: counters.X,
      diagonalLength: lengthByType("X"),
      longitudinalSegments: counters.P,
      longitudinalLength: lengthByType("P"),
      crossSegments: counters.T,
      crossLength: lengthByType("T"),
      cableLengthGeometric: round(cables.reduce((sum, cable) => sum + cable.length, 0), 3),
      tensioners: cables.length,
      terminations: cables.length * 2,
      netTopArea,
      netSideArea,
      netTopPanels: bays, netSidePanels: 2 * bays,
      netAttachmentSets: null,
      netAreaGeometric: netTopArea + netSideArea,
      netAreaOrdered: Math.ceil((netTopArea + netSideArea) * (1 + netReserve / 100)),
      fullMassKg: null
    },
    warnings: [
      parametric ? "Parametrická geometrie je odvozená z revize 03. Návrhový modul určuje dělení úseku; jeho únosnost není tímto výpočtem potvrzena."
        : "Revize 03 platí pouze pro celá pole 15 × 6 × 6 m a dvě řady stožárů; jiná geometrie vyžaduje samostatný návrh.",
      ...(parametric ? ["Šířka určuje délku příčných lan a rozpětí horní sítě. Dvě krajní řady stožárů zůstávají zachovány; větší rozpětí vyžaduje ověření průvěsu, předpětí a nosné soustavy."] : []),
      parametric ? "Oprava zadání: 4 Y kolíky u každé patky + 1 samostatný Y kolík pro kotevní lano. Původní PDF vykazuje jen kotevní kolík lana; polohy a připojení čtyř kolíků patky je nutné doplnit."
        : "Původní PDF na listu 7 vykazuje jen 1 Y kolík pro kotevní lano na stožár. Čtyři Y kolíky patky z nového zadání nejsou v této historické referenci započteny.",
      parametric ? "Kříž patky tvoří 2 průběžné díly po 2 m podle zadání 09. 10. 2026; nejde o 4 samostatná metrová ramena. Čtyři vzpěry a čtyři Y kolíky patky zůstávají."
        : "Historická reference zachovává 4 metrová ramena z PDF; opravený návrh používá 2 průběžné díly po 2 m.",
      "Ø 48,3 × 3,2 mm je pracovní předpoklad pro hmotnost trubky, nikoli potvrzený únosný profil.",
      "Geometrické délky lan nezahrnují koncovky, napínáky, průvěs ani montážní přídavky.",
      "Dolní podélná lana, čelní sítě a připevnění sítí nejsou v základním součtu zahrnuty.",
      "Průřezy ramen, vzpěr a trnů, lana, spoje, předpětí, zemina, kotvy, vítr, sníh a námraza musí být doplněny a staticky posouzeny.",
      "Dovolená rychlost větru ani odolnost celé sestavy při dynamickém zásahu UAV nejsou stanoveny."
    ]
  };
}

// UI and CSV use the same rows. Finished Y anchors only; summary rows are non-additive.
export function roadMastBomRows(model) {
  if (!model.bom) return [];
  const b = model.bom;
  const f = (n) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 3 }).format(n);
  const correction = model.materialRule.correction;
  const crossCorrection = model.materialRule.crossCorrection;
  const row = (code, name, quantity, unit, note, locator, category = "material") => ({ code, name, quantity, unit, note, source: locator.startsWith("USER") ? `Upřesnění uživatele · ${locator === "USER-BASE-CROSS-20261009" ? "09" : "08"}. 10. 2026` : `NT-S-03 · rev. 03 · ${locator}`, category });
  return [
    row("M01", "Stožárová trubka 6 m", b.tubes, "ks", `${f(b.tubeLength)} m; pracovní Ø 48,3 × 3,2 mm, ${f(b.tubeKnownMassKg)} kg bez povlaku`, "7/O; 9/S"),
    row("M02", crossCorrection ? "Průběžné díly křížové patky 2 m" : "Ramena křížové patky 1 m · reference PDF", b.crossArms, "ks", `${f(b.crossArmLength)} m; ${model.materialRule.crossArmsPerMast} díly na každou patku, profil a spojení neurčeny.`, crossCorrection ? crossCorrection.id : "1/B; 7/O"),
    row("M03", "Spodní vzpěry ≈ 1,281 m", b.braces, "ks", `${f(b.braceLength)} m mezi osami; 4 na stožár, profil a přířezy neurčeny`, "1/C; 7/O"),
    row("M04", "Nasazovací trn 0,6 m", b.spigots, "ks", `${f(b.spigotLength)} m; profil a zajištění neurčeny`, "1/C; 7/O"),
    row("M05", "Středový zemní trn 1 m", b.groundSpikes, "ks", `${f(b.groundSpikeLength)} m; samostatný díl. Profil Y není potvrzen, nepřičítá se jako Y kolík.`, "1/A; 7/O"),
    row("Y-P", "Y kolíky u křížových patek", b.baseYAnchors, "ks", correction ? `4 na každou patku; ${f(b.baseYKnownMassKg)} kg bez svarů. Polohy a přípoj k patce neurčeny.` : "Původní PDF je nevykazuje; v opraveném návrhu jsou 4 na patku.", correction ? correction.id : "7/O"),
    row("Y-G", "Y kolíky kotevních lan", b.guyYAnchors, "ks", `1 na stožár, mimo patku; ${f(b.guyYKnownMassKg)} kg bez svarů`, "2/D; 7/O"),
    row("Y-S", "Y kolíky celkem · souhrn", b.yAnchors, "ks", `${b.baseYAnchors} u patek + ${b.guyYAnchors} pro lana; ${f(b.yAnchorKnownMassKg)} kg hotových kolíků. Nejde o další díly.`, "3/E–F; 7/O + případné upřesnění uživatele", "summary"),
    row("C01", "Přípoj kotevního lana +4,75 m", b.guyEyes, "sada", "1 konec lana u každého oka; provedení neurčeno", "1/A; 7/O"),
    row("C02", "Horní přípoje krajních stožárů", b.topEndConnections, "sada", "3 konce lan na sestavu; nikoli 3 připojovací sady", "7/O; 9/R"),
    row("C03", "Horní přípoje vnitřních stožárů", b.topInnerConnections, "sada", "5 konců lan na sestavu; nikoli 5 připojovacích sad", "7/O; 9/R"),
    row("C04", "Přípoje X-lan na krajních patkách", b.baseEndConnections, "sada", "1 konec X-lana na sestavu", "7/O; 9/R"),
    row("C05", "Přípoje X-lan na vnitřních patkách", b.baseInnerConnections, "sada", "2 konce X-lan na sestavu", "7/O; 9/R"),
    row("C06", "Spojovací a zajišťovací sady patek", b.jointSets, "sada", `4 vzpěry × 2 konce = ${b.braceEndConnections} přípojů v sérii, již obsažených v sadách; dále spoj ramen, trnů a zajištění trubky. Počty šroubů, svary a povlak neurčeny.`, "7/O"),
    ...[["G", "G · kotevní lana", b.guySegments, b.guyLength], ["X", "X · boční diagonály", b.diagonalSegments, b.diagonalLength], ["P", "P · horní podélná lana", b.longitudinalSegments, b.longitudinalLength], ["T", "T · horní příčná lana", b.crossSegments, b.crossLength]].map(([code, name, count, length]) => row(code, name, count, "ks", `${f(length)} m geometricky; každý úsek pouze jednou, bez montážních přídavků`, "8/P–Q")),
    row("A01", "Napínací komplety", b.tensioners, "ks", "Rozpočtový předpoklad 1 na samostatný úsek", "9/R"),
    row("A02", "Koncové komplety", b.terminations, "ks", "Rozpočtový předpoklad 2 na samostatný úsek; obsah dle vybraného výrobku, ne automaticky 1 svorka či šekl", "9/R"),
    row("N01", "Horní síť", b.netTopArea, "m²", `${b.netTopPanels} panelů ${f(model.geometry.bayLength)} × ${f(model.geometry.width)} m; nominální plocha bez lemů a průvěsu`, "5/I; 9/R"),
    row("N02", "Dvě boční sítě", b.netSideArea, "m²", `${b.netSidePanels} panelů ${f(model.geometry.bayLength)} × 6 m; bez čelních sítí a dolních podélných lan`, "5/I; 9/R"),
    row("N03", "Připevnění sítí", null, "sada", "Nezadáno; bez rozteče a výrobku nelze určit počet ani hmotnost. Není nulové a není v zajišťovací sadě patky.", "9/R"),
    row("N-S", "Síť k objednání · souhrn", b.netAreaOrdered, "m²", `${f(b.netAreaGeometric)} m² + ${f(model.input.netReserve)} % rezerva; není další síť navíc`, "5/I; 9/R + materiálová rezerva projektu", "summary"),
    row("W-S", "Úplná hmotnost sestavy", null, "kg", "Neurčena: chybí profily ramen, vzpěr, trnů, lana, sítě, spoje a povrchová ochrana. Známé dílčí hmotnosti nejsou celková hmotnost.", "7/O; 9/S", "summary")
  ];
}

export function validateRoadMastModel(model) {
  if (model.inputIssues?.length) return model.inputIssues;
  const issues = [];
  const b = model.bom;
  const expectedMasts = 2 * (model.input.bays + 1);
  if (b.masts !== expectedMasts) issues.push("Počet stožárů neodpovídá dvěma řadám a počtu polí.");
  if (b.guySegments !== b.masts || b.guyYAnchors !== b.masts || model.graph.anchors.length !== b.guyYAnchors) issues.push("Každý stožár musí mít vlastní kotevní lano a samostatný kolík Y pro lano.");
  if (b.baseYAnchors !== b.masts * model.materialRule.baseYPerMast || b.yAnchors !== b.baseYAnchors + b.guyYAnchors) issues.push("Y kolíky patky a kotevních lan nemají správný oddělený součet.");
  if (b.crossArmLength !== b.crossArms * model.materialRule.crossArmPieceLength || model.graph.baseArms.some((arm) => Math.abs(arm.length - model.materialRule.crossArmPieceLength) > 1e-8)) issues.push("Délky dílů křížových patek neodpovídají materiálovému pravidlu.");
  if (model.graph.assemblies.length !== b.masts) issues.push("Sestavy patek neodpovídají počtu stožárů.");
  if (model.graph.baseArms.length !== b.crossArms || model.graph.braces.length !== b.braces || model.graph.groundSpikes.length !== b.groundSpikes) issues.push("Geometrie ramen, vzpěr a středových trnů neodpovídá kusovníku.");
  for (const part of ROAD_MAST_ASSEMBLY_RULE.parts) {
    const expected = part.key === "baseYAnchors" ? model.materialRule.baseYPerMast : part.key === "crossArms" ? model.materialRule.crossArmsPerMast : part.perMast;
    if (b[part.key] !== expected * b.masts || model.graph.assemblies.some((mast) => mast.parts[part.key] !== expected)) issues.push(`Počet dílů ${part.key} neodpovídá pravidlu vlastního materiálu stožáru.`);
  }
  if (b.topCableEnds + b.baseCableEnds + 2 * b.guySegments !== b.terminations) issues.push("Konce lan v horních přípojích, u patek, ok a kotev neodpovídají součtu zakončení.");
  if (b.diagonalSegments !== 4 * model.input.bays) issues.push("Počet bočních diagonál X neodpovídá dvěma křížům na pole a řadu.");
  if (b.longitudinalSegments !== 2 * model.input.bays) issues.push("Počet horních podélných lan neodpovídá dvěma řadám.");
  if (b.crossSegments !== model.input.bays + 1) issues.push("Počet horních příčných lan neodpovídá počtu stanic.");
  if (b.tensioners !== b.cableSegments || b.terminations !== 2 * b.cableSegments) issues.push("Příslušenství lan neodpovídá počtu samostatných úseků.");
  if (model.graph.cables.length !== b.cableSegments || model.graph.rods.length !== b.masts) issues.push("Graf a kusovník nemají shodnou topologii.");
  const nodes = new Map(model.graph.nodes.map((node) => [node.id, node]));
  const uniqueEdges = new Set();
  for (const cable of model.graph.cables) {
    const a = nodes.get(cable.a), z = nodes.get(cable.b);
    if (!a || !z) { issues.push("Lanový úsek nemá existující koncové uzly."); continue; }
    if (Math.abs(cable.length - Math.hypot(a.x - z.x, a.y - z.y, a.z - z.z)) > 1e-8) issues.push("Délka lana neodpovídá geometrii uzlů.");
    uniqueEdges.add([cable.a, cable.b].sort().join("|"));
  }
  if (uniqueEdges.size !== b.cableSegments) issues.push("Lanové úseky obsahují duplicitní spojení.");
  return issues;
}

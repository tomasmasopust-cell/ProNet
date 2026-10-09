import test from "node:test";
import assert from "node:assert/strict";
import { BRACE_GEOMETRY, ROAD_MAST_REFERENCE, ROAD_MAST_ASSEMBLY_RULE, automaticHubCount, buildParametricModel, buildReferenceModel, buildRoadMastModel, buildParametricRoadMastModel, roadMastBomRows, validateModel, validateRoadMastModel } from "../dist/model.mjs";

test("reference mode reproduces the NEtron source quantities", () => {
  const model = buildReferenceModel();
  assert.equal(model.bom.verticalRods, 18);
  assert.equal(model.bom.braceRods, 16);
  assert.equal(model.bom.cableSegments, 85);
  assert.equal(model.bom.cableLengthGeometric, 490.1);
  assert.equal(model.bom.tensioners, 85);
  assert.equal(model.bom.terminations, 170);
  assert.equal(model.bom.groundAnchors, 16);
  assert.equal(model.bom.joints, 66);
  assert.equal(model.bom.cableSchedule, null);
  assert.deepEqual(validateModel(model), []);
});

test("road mast rev03 reproduces the two-bay NEtron reference without duplicate cables", () => {
  const model = buildRoadMastModel({ bays: 2, netReserve: 0 });
  assert.equal(model.solution, "MSK-01-REV03");
  assert.equal(model.geometry.length, 30);
  assert.equal(model.geometry.width, 6);
  assert.equal(model.geometry.height, 6);
  assert.equal(model.bom.masts, 6);
  assert.equal(model.bom.netTopArea, 180);
  assert.equal(model.bom.netSideArea, 360);
  assert.equal(model.bom.guySegments, 6);
  assert.equal(model.bom.diagonalSegments, 8);
  assert.equal(model.bom.longitudinalSegments, 4);
  assert.equal(model.bom.crossSegments, 3);
  assert.equal(model.bom.cableSegments, 21);
  assert.equal(model.bom.tensioners, 21);
  assert.equal(model.bom.terminations, 42);
  assert.equal(model.bom.cableLengthGeometric, 244.503);
  assert.equal(new Set(model.bom.cableSchedule.map((item) => item.code)).size, 21);
  assert.equal(model.bom.fullMassKg, null);
  assert.equal(model.bom.baseYAnchors, 0);
  assert.equal(model.bom.guyYAnchors, 6);
  assert.equal(model.bom.yAnchors, 6);
  assert.equal(model.bom.yAnchorKnownMassKg, 41.825);
  assert.equal(model.materialRule.correction, null);
  assert.equal(ROAD_MAST_REFERENCE.classification, "Koncepční geometrický a materiálový podklad");
  assert.deepEqual(validateRoadMastModel(model), []);
});

test("road mast modules scale by exact 15 metre bays and preserve the rev03 topology", () => {
  const one = buildRoadMastModel({ bays: 1, netReserve: 10 });
  const four = buildRoadMastModel({ bays: 4, netReserve: 10 });
  assert.equal(one.geometry.length, 15);
  assert.equal(one.bom.masts, 4);
  assert.equal(one.bom.cableSegments, 12);
  assert.equal(one.bom.netAreaGeometric, 270);
  assert.equal(one.bom.netAreaOrdered, 297);
  assert.equal(four.geometry.length, 60);
  assert.equal(four.bom.masts, 10);
  assert.equal(four.bom.diagonalSegments, 16);
  assert.equal(four.bom.longitudinalSegments, 8);
  assert.equal(four.bom.crossSegments, 5);
  assert.equal(four.bom.cableSegments, 39);
  assert.ok(four.bom.cableLengthGeometric > one.bom.cableLengthGeometric);
  assert.deepEqual(validateRoadMastModel(four), []);
});

test("road rule divides nonmodular length evenly without extending the corridor", () => {
  const model = buildParametricRoadMastModel({ length: 37, width: 9, module: 15 });
  assert.equal(model.source.rule, "PRONET-ROAD-MAST-002");
  assert.equal(model.source.classification, "inference");
  assert.equal(model.input.bays, 3);
  assert.equal(model.geometry.length, 37);
  assert.equal(model.geometry.width, 9);
  assert.equal(model.geometry.height, 6);
  assert.equal(model.geometry.bayLength, 37 / 3);
  assert.equal(model.geometry.installationWidth, 17);
  assert.equal(Math.max(...model.graph.nodes.filter((node) => node.kind === "mast-top").map((node) => node.x)), 37);
  assert.equal(model.bom.masts, 8);
  assert.equal(model.bom.baseYAnchors, 32);
  assert.equal(model.bom.guyYAnchors, 8);
  assert.equal(model.bom.yAnchors, 40);
  assert.equal(model.bom.guySegments, 8);
  assert.equal(model.bom.diagonalSegments, 12);
  assert.equal(model.bom.longitudinalSegments, 6);
  assert.equal(model.bom.crossSegments, 4);
  assert.equal(model.bom.cableSegments, 30);
  assert.equal(model.bom.longitudinalLength, 74);
  assert.equal(model.bom.crossLength, 36);
  assert.equal(model.bom.netTopArea, 333);
  assert.equal(model.bom.netSideArea, 444);
  assert.equal(model.bom.netAreaGeometric, 777);
  assert.equal(model.bom.cableSchedule.length, model.graph.cables.length);
  assert.deepEqual(validateRoadMastModel(model), []);
});

test("road width changes transverse spans and net area, not mast count or side cables", () => {
  const narrow = buildParametricRoadMastModel({ length: 37, width: 9 });
  const wide = buildParametricRoadMastModel({ length: 37, width: 20 });
  assert.equal(wide.bom.masts, narrow.bom.masts);
  assert.equal(wide.bom.diagonalLength, narrow.bom.diagonalLength);
  assert.equal(wide.bom.guyLength, narrow.bom.guyLength);
  assert.equal(wide.bom.crossLength, 80);
  assert.equal(wide.bom.netTopArea, 740);
  assert.equal(wide.bom.netSideArea, narrow.bom.netSideArea);
  assert.equal(Number((wide.bom.cableLengthGeometric - narrow.bom.cableLengthGeometric).toFixed(3)), 44);
  assert.deepEqual(validateRoadMastModel(wide), []);
});

test("road length and module change supports, cables and quantities consistently", () => {
  const model = buildParametricRoadMastModel({ length: 61, width: 8, module: 15, netReserve: 10 });
  assert.equal(model.input.bays, 5);
  assert.equal(model.geometry.bayLength, 12.2);
  assert.equal(model.bom.masts, 12);
  assert.equal(model.graph.rods.length, 12);
  assert.equal(model.bom.cableSegments, 48);
  assert.equal(model.bom.netAreaGeometric, 1220);
  assert.equal(model.bom.netAreaOrdered, 1342);
  const denser = buildParametricRoadMastModel({ length: 61, width: 8, module: 10 });
  assert.equal(denser.input.bays, 7);
  assert.equal(denser.bom.masts, 16);
  assert.deepEqual(validateRoadMastModel(model), []);
  assert.deepEqual(validateRoadMastModel(denser), []);
});

test("parametric default preserves reference cables and separates the confirmed base correction", () => {
  const model = buildParametricRoadMastModel();
  const reference = buildRoadMastModel();
  assert.deepEqual(model.bom.cableSchedule, reference.bom.cableSchedule);
  for (const key of ["masts", "tubes", "crossArmLength", "braces", "spigots", "groundSpikes", "netTopArea", "netSideArea", "terminations", "tensioners"]) assert.equal(model.bom[key], reference.bom[key]);
  assert.equal(model.bom.crossArms, 12);
  assert.equal(reference.bom.crossArms, 24);
  assert.equal(model.materialRule.crossArmPieceLength, 2);
  assert.equal(reference.materialRule.crossArmPieceLength, 1);
  assert.equal(model.bom.baseYAnchors, 24);
  assert.equal(model.bom.guyYAnchors, 6);
  assert.equal(model.bom.yAnchors, 30);
  assert.equal(model.bom.yAnchorStripPieces, undefined);
  assert.equal(model.bom.yAnchorStripLength, undefined);
  assert.equal(model.bom.yAnchorKnownMassKg, 209.124);
  assert.equal(model.materialRule.correction.confirmedTotalPerMast, 5);
  assert.equal(model.solution, "MSK-01-PARAM");
  assert.equal(model.bom.fullMassKg, null);
});

test("each mast owns its full base assembly; footing pins are not shared or confused with guy pins", () => {
  for (const length of [8, 30, 37, 61, 150]) {
    const model = buildParametricRoadMastModel({ length, width: 9 });
    const { bom: b, graph: g } = model;
    assert.equal(b.yAnchors, 5 * b.masts);
    assert.equal(b.baseYAnchors, 4 * b.masts);
    assert.equal(b.guyYAnchors, b.masts);
    assert.equal(b.groundSpikes, b.masts);
    assert.equal(g.baseArms.length, 2 * b.masts);
    assert.equal(b.crossArms, 2 * b.masts);
    assert.equal(b.crossArmLength, 4 * b.masts);
    assert.ok(g.baseArms.every((arm) => Math.abs(arm.length - 2) < 1e-9));
    assert.equal(g.braces.length, 4 * b.masts);
    assert.ok(g.braces.every((brace) => Math.abs(brace.length - Math.hypot(0.8, 1)) < 1e-9));
    for (const mast of g.assemblies) {
      assert.equal(mast.parts.baseYAnchors, 4);
      assert.equal(mast.parts.crossArms, 2);
      assert.equal(mast.parts.guyYAnchors, 1);
      assert.equal(mast.baseYPositions, null);
      assert.equal(mast.topCableEnds, mast.type === "end" ? 3 : 5);
      assert.equal(mast.baseCableEnds, mast.type === "end" ? 1 : 2);
    }
    assert.equal(b.topCableEnds + b.baseCableEnds + 2 * b.guySegments, b.terminations);
    const share = g.assemblies.reduce((sum, mast) => sum + mast.cableShareLength, 0);
    const total = g.cables.reduce((sum, cable) => sum + cable.length, 0);
    assert.ok(Math.abs(share - total) < 1e-8);
    assert.deepEqual(validateRoadMastModel(model), []);
  }
});

test("material rows count two cross pieces and finished Y anchors only with provenance", () => {
  const rows = roadMastBomRows(buildParametricRoadMastModel());
  assert.equal(ROAD_MAST_ASSEMBLY_RULE.source.locator.includes("7/O"), true);
  assert.equal(rows.find((row) => row.code === "Y-P").quantity, 24);
  assert.match(rows.find((row) => row.code === "Y-P").source, /Upřesnění uživatele/);
  assert.equal(rows.find((row) => row.code === "Y-G").quantity, 6);
  assert.equal(rows.find((row) => row.code === "Y-S").category, "summary");
  assert.equal(rows.find((row) => row.code === "Y-R"), undefined);
  assert.ok(rows.every((row) => !/pásovin/i.test(row.name + row.note)));
  assert.equal(rows.find((row) => row.code === "M02").quantity, 12);
  assert.match(rows.find((row) => row.code === "M02").source, /09\. 10\. 2026/);
  assert.match(rows.find((row) => row.code === "M02").name, /2 m/);
  assert.ok(roadMastBomRows(buildRoadMastModel()).every((row) => row.code !== "Y-R"));
  assert.equal(rows.find((row) => row.code === "N03").quantity, null);
  assert.equal(rows.find((row) => row.code === "W-S").quantity, null);
  assert.ok(rows.every((row) => row.source && row.note && row.category));
  assert.equal(new Set(rows.map((row) => row.code)).size, rows.length);
});

test("two continuous cross pieces span opposite ends through the mast centre at every size", () => {
  for (const [length, width] of [[8, 3], [30, 6], [37, 9], [61, 20]]) {
    const model = buildParametricRoadMastModel({ length, width });
    const nodes = new Map(model.graph.nodes.map((node) => [node.id, node]));
    for (const mast of model.graph.assemblies) {
      const centre = nodes.get(`${mast.id}:0`);
      const pieces = model.graph.baseArms.filter((part) => part.a.startsWith(`${mast.id}:`));
      assert.equal(pieces.length, 2);
      for (const piece of pieces) {
        const a = nodes.get(piece.a), b = nodes.get(piece.b);
        assert.equal((a.x + b.x) / 2, centre.x);
        assert.equal((a.y + b.y) / 2, centre.y);
        assert.equal(a.z, 0);
        assert.equal(b.z, 0);
        assert.equal(piece.length, 2);
      }
    }
  }
});

test("material validation rejects incorrect pins, cross piece counts and lengths, and shared ends", () => {
  for (const [key, wrong] of [["baseYAnchors", 6], ["guyYAnchors", 24], ["yAnchors", 6], ["crossArms", 24], ["crossArmLength", 12], ["topCableEnds", 0]]) {
    const model = buildParametricRoadMastModel();
    model.bom[key] = wrong;
    assert.ok(validateRoadMastModel(model).length > 0, key);
  }
});

test("invalid road dimensions do not silently produce default quantities", () => {
  for (const raw of [{ length: "" }, { length: -1 }, { width: 0 }, { width: "invalid" }, { module: 0 }, { length: 15001 }, { length: 1200, module: 1 }]) {
    const model = buildParametricRoadMastModel(raw);
    assert.equal(model.graph, null);
    assert.equal(model.bom, null);
    assert.ok(validateRoadMastModel(model).length > 0);
  }
  const tiny = buildParametricRoadMastModel({ length: 0.5, width: 3 });
  assert.equal(tiny.input.bays, 1);
  assert.equal(tiny.bom.masts, 4);
  assert.deepEqual(validateRoadMastModel(tiny), []);
});

test("parametric graph and bill of materials share the same cable topology", () => {
  const model = buildParametricModel({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 2, reserve: 15 });
  assert.equal(model.geometry.baysL, 5);
  assert.equal(model.geometry.baysW, 3);
  assert.equal(model.bom.verticalRods, 18);
  assert.equal(model.bom.groundAnchors, 16);
  assert.equal(model.graph.cables.length, model.bom.cableSegments);
  assert.equal(model.bom.cableSchedule.length, model.bom.cableSegments);
  assert.equal(model.bom.cableSchedule[0].code, "L-001");
  assert.equal(model.bom.cableSchedule.at(-1).code, "L-085");
  assert.ok(model.bom.cableSchedule.every((item) => item.length > 0 && item.from && item.to));
  assert.equal(model.bom.tensioners, model.bom.cableSegments);
  assert.equal(model.bom.terminations, model.bom.cableSegments * 2);
  assert.deepEqual(validateModel(model), []);
});

test("radial cables from inner hubs terminate at vertical rod tops", () => {
  const model = buildParametricModel({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 2, reserve: 15 });
  const nodes = new Map(model.graph.nodes.map((node) => [node.id, node]));
  const radial = model.graph.cables.filter((cable) => cable.kind === "radial-cable");
  const rodTopIds = new Set(model.graph.rods.map((rod) => rod.b));
  assert.equal(radial.length, 21);
  for (const cable of radial) {
    const endpoints = [nodes.get(cable.a), nodes.get(cable.b)];
    const nonHub = endpoints.find((node) => node.kind !== "hub");
    assert.equal(nonHub.kind, "roof-top");
    assert.ok(rodTopIds.has(nonHub.id));
  }
});

test("four roof perimeter cables connect corner tops of vertical rods", () => {
  const model = buildParametricModel({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 2, reserve: 15 });
  const nodes = new Map(model.graph.nodes.map((node) => [node.id, node]));
  const perimeter = model.graph.cables.filter((cable) => cable.kind === "roof-perimeter-cable");
  assert.equal(perimeter.length, 4);
  assert.equal(perimeter.reduce((sum, cable) => sum + cable.length, 0), 64);
  for (const cable of perimeter) {
    for (const id of [cable.a, cable.b]) {
      const node = nodes.get(id);
      assert.equal(node.kind, "roof-top");
      assert.equal(Math.abs(node.x), 10);
      assert.equal(Math.abs(node.y), 6);
    }
  }
});

test("bill of materials separates the three upper cable groups", () => {
  const model = buildParametricModel({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 2, reserve: 15 });
  assert.equal(model.bom.roofNetworkSegments, 25);
  assert.equal(model.bom.supportLinkSegments, 16);
  assert.equal(model.bom.sideDiagonalSegments, 21);
  assert.equal(model.bom.inclinedPerimeterSegments, 6);
  assert.equal(model.bom.anchorCableSegments, 17);
  assert.equal(model.bom.cableSegments, 85);
  assert.equal(model.bom.inclinedPerimeterLength, 24);
});

test("outer cable joins only selected pairs of inclined rod ends", () => {
  const model = buildParametricModel({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 2, reserve: 15 });
  const nodes = new Map(model.graph.nodes.map((node) => [node.id, node]));
  const outerPairs = model.graph.cables.filter((cable) => cable.kind === "outer-pair-cable");
  assert.equal(outerPairs.length, 6);
  for (const cable of outerPairs) {
    assert.equal(nodes.get(cable.a).kind, "net-top");
    assert.equal(nodes.get(cable.b).kind, "net-top");
  }
  assert.equal(model.graph.cables.some((cable) => cable.kind === "upper-perimeter-cable"), false);
});

test("inner hub count and positions are derived automatically from length and module", () => {
  assert.equal(automaticHubCount(12, 4), 1);
  assert.equal(automaticHubCount(20, 4), 2);
  assert.equal(automaticHubCount(28, 4), 3);
  const model = buildParametricModel({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 9, reserve: 15 });
  const hubs = model.graph.nodes.filter((node) => node.kind === "hub");
  assert.deepEqual(hubs.map((hub) => hub.x), [-4, 4]);
});

test("roof rods on the boundary between hub fields connect to both hubs", () => {
  const model = buildParametricModel({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 2, reserve: 15 });
  const nodes = new Map(model.graph.nodes.map((node) => [node.id, node]));
  const radial = model.graph.cables.filter((cable) => cable.kind === "radial-cable");
  const connections = new Map();
  for (const cable of radial) {
    if (!connections.has(cable.a)) connections.set(cable.a, new Set());
    connections.get(cable.a).add(cable.b);
  }
  const shared = [...connections.entries()]
    .filter(([, hubs]) => hubs.size === 2)
    .map(([id]) => nodes.get(id))
    .map(({ x, y }) => [x, y])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.deepEqual(shared, [[-2, -6], [-2, 6], [2, -6], [2, 6]]);
  assert.equal(model.graph.cables.some((cable) => cable.kind === "hub-link-cable"), false);
});

test("each vertical rod top is cabled to the matching inclined rod top", () => {
  const model = buildParametricModel({ length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 2, reserve: 15 });
  const nodes = new Map(model.graph.nodes.map((node) => [node.id, node]));
  const links = model.graph.cables.filter((cable) => cable.kind === "support-link-cable");
  const perimeterRodTops = new Set(model.graph.rods.map((rod) => rod.b).filter((id) => id.startsWith("roof-top-")));
  assert.equal(links.length, perimeterRodTops.size);
  for (const cable of links) {
    const a = nodes.get(cable.a);
    const b = nodes.get(cable.b);
    assert.equal(a.kind, "roof-top");
    assert.equal(b.kind, "net-top");
    assert.ok(perimeterRodTops.has(a.id));
    assert.equal(b.id, a.id.replace("roof-top", "net-top"));
  }
});

test("changing building size changes the graph and bill of materials together", () => {
  const small = buildParametricModel({ length: 12, width: 8, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 1, reserve: 10 });
  const large = buildParametricModel({ length: 36, width: 24, height: 8, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, hubs: 3, reserve: 10 });
  assert.ok(large.bom.verticalRods > small.bom.verticalRods);
  assert.ok(large.bom.cableLengthGeometric > small.bom.cableLengthGeometric);
  assert.equal(large.graph.rods.length, large.bom.verticalRods);
  assert.equal(small.graph.rods.length, small.bom.verticalRods);
});

test("asymmetric offsets are preserved in envelope dimensions", () => {
  const model = buildParametricModel({ length: 20, width: 10, height: 5, offsetLeft: 2, offsetRight: 5, offsetFront: 3, offsetBack: 4, roofOffset: 3, module: 4, hubs: 2, reserve: 0 });
  assert.equal(model.geometry.envelopeLength, 27);
  assert.equal(model.geometry.envelopeWidth, 17);
});

test("a 100 by 100 metre building creates a two-dimensional hub grid without clamping", () => {
  const model = buildParametricModel({ length: 100, width: 100, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, reserve: 15 });
  const hubs = model.graph.nodes.filter((node) => node.kind === "hub");
  const gridCables = model.graph.cables.filter((cable) => cable.kind === "hub-grid-cable");

  assert.equal(model.input.length, 100);
  assert.equal(model.input.width, 100);
  assert.equal(model.geometry.baysL, 25);
  assert.equal(model.geometry.baysW, 25);
  assert.equal(model.geometry.hubColumns, 12);
  assert.equal(model.geometry.hubRows, 12);
  assert.equal(hubs.length, 144);
  assert.equal(gridCables.length, 264);
  assert.deepEqual(validateModel(model), []);

  const connectedHubIds = new Set(model.graph.cables.flatMap((cable) => [cable.a, cable.b]).filter((id) => id.startsWith("hub-")));
  assert.equal(connectedHubIds.size, hubs.length);
});

test("boundary rods are shared between adjacent hub fans on all four sides", () => {
  const model = buildParametricModel({ length: 100, width: 100, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, reserve: 0 });
  const nodes = new Map(model.graph.nodes.map((node) => [node.id, node]));
  const connections = new Map();
  model.graph.cables.filter((cable) => cable.kind === "radial-cable").forEach((cable) => {
    if (!connections.has(cable.a)) connections.set(cable.a, new Set());
    connections.get(cable.a).add(cable.b);
  });
  const shared = [...connections.entries()].filter(([, hubs]) => hubs.size >= 2).map(([id]) => nodes.get(id));

  assert.ok(shared.some((node) => node.y === -50));
  assert.ok(shared.some((node) => node.x === 50));
  assert.ok(shared.some((node) => node.y === 50));
  assert.ok(shared.some((node) => node.x === -50));
});

test("mansard height sets the inclined rod base while OBJ angle sets its top and cable length", () => {
  const common = { length: 20, width: 12, height: 5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, reserve: 0 };
  const low = buildParametricModel({ ...common, mansardHeight: 0.8 });
  const high = buildParametricModel({ ...common, mansardHeight: 2.2 });
  const lowBraceBases = low.graph.nodes.filter((node) => node.kind === "brace-base");
  const lowOuterNodes = low.graph.nodes.filter((node) => node.kind === "net-top");
  const highOuterNodes = high.graph.nodes.filter((node) => node.kind === "net-top");
  const braces = low.graph.braces;
  const lowSupport = low.bom.cableSchedule.filter((item) => item.kind === "support-link-cable");
  const highSupport = high.bom.cableSchedule.filter((item) => item.kind === "support-link-cable");
  const angle = BRACE_GEOMETRY.angleFromVertical * Math.PI / 180;
  const rise = BRACE_GEOMETRY.length * Math.cos(angle);
  const projection = BRACE_GEOMETRY.length * Math.sin(angle);
  const expectedSupportLength = Math.hypot(projection, common.roofOffset - 0.8 - rise);

  assert.ok(lowBraceBases.every((node) => node.z === 5.8));
  assert.ok(lowOuterNodes.every((node) => Math.abs(node.z - (5.8 + rise)) < 1e-9));
  assert.ok(highOuterNodes.every((node) => Math.abs(node.z - (7.2 + rise)) < 1e-9));
  assert.ok(braces.every((brace) => Math.abs(brace.length - 2) < 1e-9));
  assert.equal(lowSupport.length, 16);
  assert.equal(highSupport.length, 16);
  assert.ok(lowSupport.every((item) => Math.abs(item.length - Number(expectedSupportLength.toFixed(2))) < 1e-9));
  assert.ok(highSupport.every((item) => item.length < lowSupport[0].length));
  assert.ok(high.bom.supportLinkLength < low.bom.supportLinkLength);
  assert.equal(low.bom.cableSegments, high.bom.cableSegments);
});

test("roof edge setback moves the perimeter rods inward without changing the building", () => {
  const model = buildParametricModel({ length: 20, width: 12, height: 5, roofEdgeSetback: 0.5, mansardHeight: 0.5, offsetLeft: 3, offsetRight: 3, offsetFront: 3, offsetBack: 3, roofOffset: 3, module: 4, reserve: 0 });
  const perimeter = model.graph.nodes.filter((node) => node.kind === "roof-top");

  assert.equal(model.geometry.rodGridLength, 19);
  assert.equal(model.geometry.rodGridWidth, 11);
  assert.equal(Math.max(...perimeter.map((node) => Math.abs(node.x))), 9.5);
  assert.equal(Math.max(...perimeter.map((node) => Math.abs(node.y))), 5.5);
  assert.equal(model.geometry.envelopeLength, 26);
  assert.equal(model.geometry.envelopeWidth, 18);
  assert.equal(model.geometry.braceAngleFromVertical, 69.05);
});

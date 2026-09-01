import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourcePath = path.join(repoRoot, "public/geodata/nakhon-ratchasima-subdistricts.geojson");
const outputPath = path.join(repoRoot, "public/geodata/nakhon-ratchasima-boundary.geojson");
const coordinatePrecision = 12;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function roundCoordinate(value) {
  return Number(Number(value).toFixed(coordinatePrecision));
}

function coordinateKey(coordinate) {
  return `${roundCoordinate(coordinate[0]).toFixed(coordinatePrecision)},${roundCoordinate(coordinate[1]).toFixed(coordinatePrecision)}`;
}

function edgeKey(first, second) {
  const firstKey = coordinateKey(first);
  const secondKey = coordinateKey(second);
  return firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
}

function coordinateFromKey(key) {
  return key.split(",").map(Number);
}

function ringsForGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

function signedRingArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orientedRing(ring, clockwise) {
  const area = signedRingArea(ring);
  const isClockwise = area < 0;
  if (isClockwise === clockwise) return ring;
  return [...ring].reverse();
}

function buildBoundaryRings(features) {
  const edgeMap = new Map();
  const coordinateByKey = new Map();

  for (const feature of features) {
    for (const ring of ringsForGeometry(feature.geometry)) {
      if (ring.length < 4) throw new Error(`Feature ${feature.properties?.Admin_code ?? "unknown"} has an invalid ring`);

      for (const coordinate of ring) {
        coordinateByKey.set(coordinateKey(coordinate), [
          roundCoordinate(coordinate[0]),
          roundCoordinate(coordinate[1]),
        ]);
      }

      for (let index = 0; index < ring.length - 1; index += 1) {
        const key = edgeKey(ring[index], ring[index + 1]);
        const edge = edgeMap.get(key) ?? {
          count: 0,
          first: coordinateKey(ring[index]),
          second: coordinateKey(ring[index + 1]),
        };
        edge.count += 1;
        edgeMap.set(key, edge);
      }
    }
  }

  const invalidEdges = [...edgeMap.values()].filter((edge) => edge.count > 2);
  if (invalidEdges.length > 0) {
    throw new Error(`Boundary dissolve found ${invalidEdges.length} edges shared by more than two polygons`);
  }

  const adjacency = new Map();
  for (const edge of edgeMap.values()) {
    if (edge.count !== 1) continue;
    const firstList = adjacency.get(edge.first) ?? [];
    const secondList = adjacency.get(edge.second) ?? [];
    firstList.push(edge.second);
    secondList.push(edge.first);
    adjacency.set(edge.first, firstList);
    adjacency.set(edge.second, secondList);
  }

  for (const [vertex, neighbors] of adjacency) {
    neighbors.sort();
    if (neighbors.length !== 2) {
      throw new Error(`Boundary dissolve produced an open vertex at ${vertex}`);
    }
  }

  const visited = new Set();
  const rings = [];
  for (const start of [...adjacency.keys()].sort()) {
    if (visited.has(start)) continue;

    const ringKeys = [start];
    let previous = null;
    let current = start;

    while (true) {
      visited.add(current);
      const neighbors = adjacency.get(current) ?? [];
      const next = neighbors[0] === previous ? neighbors[1] : neighbors[0];

      if (next === start) {
        ringKeys.push(start);
        break;
      }

      if (!next || visited.has(next)) {
        throw new Error(`Boundary dissolve could not close the ring that starts at ${start}`);
      }

      ringKeys.push(next);
      previous = current;
      current = next;
    }

    rings.push(ringKeys.map((key) => coordinateByKey.get(key) ?? coordinateFromKey(key)));
  }

  if (rings.length === 0) throw new Error("Boundary dissolve did not produce any rings");
  return rings;
}

function classifyRings(rings) {
  const annotated = rings
    .map((ring) => ({
      ring,
      area: Math.abs(signedRingArea(ring)),
      sample: ring[0],
      depth: 0,
    }))
    .sort((first, second) => second.area - first.area);

  for (const candidate of annotated) {
    candidate.depth = annotated.filter((other) => other !== candidate && other.area > candidate.area && pointInRing(candidate.sample, other.ring)).length;
  }

  const exteriors = annotated.filter((item) => item.depth % 2 === 0);
  const holes = annotated.filter((item) => item.depth % 2 === 1);
  if (exteriors.length === 0) throw new Error("Boundary dissolve produced holes without an exterior ring");

  const polygons = exteriors.map((exterior) => ({
    exterior,
    holes: [],
  }));

  for (const hole of holes) {
    const container = polygons
      .filter((polygon) => polygon.exterior.area > hole.area && pointInRing(hole.sample, polygon.exterior.ring))
      .sort((first, second) => first.exterior.area - second.exterior.area)[0];
    if (!container) throw new Error("Boundary dissolve produced a hole that is not inside an exterior ring");
    container.holes.push(hole);
  }

  return polygons.map((polygon) => [
    orientedRing(polygon.exterior.ring, false),
    ...polygon.holes.sort((first, second) => second.area - first.area).map((hole) => orientedRing(hole.ring, true)),
  ]);
}

function bboxForRings(rings) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      bbox[0] = Math.min(bbox[0], longitude);
      bbox[1] = Math.min(bbox[1], latitude);
      bbox[2] = Math.max(bbox[2], longitude);
      bbox[3] = Math.max(bbox[3], latitude);
    }
  }
  return bbox.map(roundCoordinate);
}

const sourceGeoJson = readJson(sourcePath);
if (sourceGeoJson.type !== "FeatureCollection" || !Array.isArray(sourceGeoJson.features)) {
  throw new Error("Expected a FeatureCollection of Nakhon Ratchasima subdistricts");
}

const features = sourceGeoJson.features;
const adminCodes = features.map((feature) => feature.properties?.Admin_code).filter(Boolean).sort();
const uniqueAdminCodes = new Set(adminCodes);

if (features.length !== 289) throw new Error(`Expected 289 subdistrict features, found ${features.length}`);
if (uniqueAdminCodes.size !== features.length) throw new Error("Subdistrict Admin_code values must be unique");
if (!features.every((feature) => feature.properties?.P_code === "30")) {
  throw new Error("All source features must belong to province code 30");
}

const boundaryRings = buildBoundaryRings(features);
const polygons = classifyRings(boundaryRings);
const flattenedRings = polygons.flat();
const geometry =
  polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
const bbox = bboxForRings(flattenedRings);

const boundaryGeoJson = {
  type: "FeatureCollection",
  name: "nakhon-ratchasima-boundary",
  bbox,
  features: [
    {
      type: "Feature",
      properties: {
        provinceCode: "30",
        provinceNameTh: "จังหวัดนครราชสีมา",
        provinceNameEn: "Nakhon Ratchasima",
        derivedFrom: "public/geodata/nakhon-ratchasima-subdistricts.geojson",
        sourceGeometry: "GISTDA subdistrict geometry used by the local map",
        derivationMethod: "deterministic shared-edge dissolve of all subdistrict polygon rings",
        generatedBy: "npm run generate:nr-boundary",
        sourceFeatureCount: features.length,
        sourceAdminCodes: adminCodes,
        boundaryRingCount: flattenedRings.length,
      },
      bbox,
      geometry,
    },
  ],
};

fs.writeFileSync(outputPath, `${JSON.stringify(boundaryGeoJson)}\n`);
console.log(`Generated ${path.relative(repoRoot, outputPath)} from ${features.length} subdistrict features`);

export type LabelProjection = {
  x: (lon: number) => number;
  y: (lat: number) => number;
};

export type LabelGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

export type LabelTransform = {
  x: number;
  y: number;
  k: number;
};

export type MapLabelBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type MapLabelCandidate = {
  id: string;
  text: string;
  x: number;
  y: number;
  bounds: MapLabelBounds;
  minZoom: number;
  className?: string;
  force?: boolean;
  priority?: number;
  maxWidthRatio?: number;
  maxHeightRatio?: number;
  minFeatureArea?: number;
};

export type VisibleMapLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  strokeWidth: number;
  className?: string;
};

type Point = {
  x: number;
  y: number;
};

type ProjectedPolygon = Point[][];

type ScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type MapLabelOptions = {
  baseScreenFontSize?: number;
  minScreenFontSize?: number;
  maxScreenFontSize?: number;
  zoomFontBoost?: number;
  haloStrokeWidth?: number;
  collisionPadding?: number;
  maxWidthRatio?: number;
  maxHeightRatio?: number;
  forceMaxWidthRatio?: number;
  forceMaxHeightRatio?: number;
  minFeatureArea?: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

const emptyBounds: MapLabelBounds = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function projectedPolygonsForGeometry(geometry: LabelGeometry, projection: LabelProjection): ProjectedPolygon[] {
  const polygons = geometry.type === "MultiPolygon"
    ? (geometry.coordinates as number[][][][])
    : ([geometry.coordinates] as number[][][][]);

  return polygons
    .map((polygon) =>
      polygon
        .map((ring) =>
          ring.map(([lon, lat]) => ({
            x: projection.x(lon),
            y: projection.y(lat),
          })),
        )
        .filter((ring) => ring.length > 0),
    )
    .filter((polygon) => polygon.length > 0);
}

function boundsForPoints(points: Point[]): MapLabelBounds {
  if (points.length === 0) return emptyBounds;

  return points.reduce<MapLabelBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    },
  );
}

function boundsForPolygons(polygons: ProjectedPolygon[]): MapLabelBounds {
  return boundsForPoints(polygons.flat(2));
}

function signedRingArea(ring: Point[]) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function ringCentroid(ring: Point[]): Point {
  const area = signedRingArea(ring);

  if (Math.abs(area) < 0.001) {
    const bounds = boundsForPoints(ring);
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }

  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const cross = current.x * next.y - next.x * current.y;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }

  return {
    x: x / (6 * area),
    y: y / (6 * area),
  };
}

function pointInRing(point: Point, ring: Point[]) {
  let inside = false;
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    if (!crossesY) continue;
    const edgeX = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y || Number.EPSILON) + current.x;
    if (point.x < edgeX) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Point, polygon: ProjectedPolygon) {
  const [outerRing, ...holes] = polygon;
  if (!outerRing || !pointInRing(point, outerRing)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

function pointInAnyPolygon(point: Point, polygons: ProjectedPolygon[]) {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

function distanceSquared(first: Point, second: Point) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function distanceToBoundsEdge(point: Point, bounds: MapLabelBounds) {
  return Math.max(
    0,
    Math.min(point.x - bounds.minX, bounds.maxX - point.x, point.y - bounds.minY, bounds.maxY - point.y),
  );
}

function bestInteriorPoint(polygons: ProjectedPolygon[], bounds: MapLabelBounds): Point {
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const candidates: Point[] = [center];
  let weightedX = 0;
  let weightedY = 0;
  let weightTotal = 0;

  polygons.forEach((polygon) => {
    const outerRing = polygon[0];
    if (!outerRing) return;
    const area = Math.abs(signedRingArea(outerRing));
    const centroid = ringCentroid(outerRing);
    candidates.push(centroid);
    if (Number.isFinite(area) && area > 0) {
      weightedX += centroid.x * area;
      weightedY += centroid.y * area;
      weightTotal += area;
    }
  });

  if (weightTotal > 0) {
    candidates.push({
      x: weightedX / weightTotal,
      y: weightedY / weightTotal,
    });
  }

  const stepCount = 8;
  for (let xIndex = 1; xIndex < stepCount; xIndex += 1) {
    for (let yIndex = 1; yIndex < stepCount; yIndex += 1) {
      candidates.push({
        x: bounds.minX + ((bounds.maxX - bounds.minX) * xIndex) / stepCount,
        y: bounds.minY + ((bounds.maxY - bounds.minY) * yIndex) / stepCount,
      });
    }
  }

  const interiorCandidates = candidates.filter((candidate) => pointInAnyPolygon(candidate, polygons));
  if (interiorCandidates.length === 0) return center;

  return interiorCandidates
    .map((candidate) => ({
      candidate,
      score: distanceSquared(candidate, center) - distanceToBoundsEdge(candidate, bounds) * 24,
    }))
    .sort((first, second) => first.score - second.score)[0].candidate;
}

export function projectedBoundsForGeometries(geometries: LabelGeometry[], projection: LabelProjection): MapLabelBounds {
  const polygons = geometries.flatMap((geometry) => projectedPolygonsForGeometry(geometry, projection));
  if (polygons.length === 0) return emptyBounds;
  return boundsForPolygons(polygons);
}

export function projectedLabelPointForGeometries(geometries: LabelGeometry[], projection: LabelProjection): Point {
  const polygons = geometries.flatMap((geometry) => projectedPolygonsForGeometry(geometry, projection));
  if (polygons.length === 0) return { x: 0, y: 0 };
  return bestInteriorPoint(polygons, boundsForPolygons(polygons));
}

export function projectedLabelPointForGeometry(geometry: LabelGeometry, projection: LabelProjection): Point {
  return projectedLabelPointForGeometries([geometry], projection);
}

function estimatedTextWidth(text: string, screenFontSize: number) {
  return Array.from(text).reduce((width, character) => {
    if (/[\u0e00-\u0e7f]/.test(character)) return width + screenFontSize * 0.84;
    if (/[A-Z0-9]/.test(character)) return width + screenFontSize * 0.62;
    if (character === " ") return width + screenFontSize * 0.32;
    return width + screenFontSize * 0.54;
  }, 0);
}

function overlaps(first: ScreenRect, second: ScreenRect, padding: number) {
  return !(
    first.right + padding < second.left ||
    first.left - padding > second.right ||
    first.bottom + padding < second.top ||
    first.top - padding > second.bottom
  );
}

function isOffscreen(rect: ScreenRect, viewportWidth?: number, viewportHeight?: number) {
  if (viewportWidth === undefined || viewportHeight === undefined) return false;
  return rect.right < 0 || rect.left > viewportWidth || rect.bottom < 0 || rect.top > viewportHeight;
}

export function makeVisibleMapLabels(
  candidates: MapLabelCandidate[],
  transform: LabelTransform,
  options: MapLabelOptions = {},
): VisibleMapLabel[] {
  const screenFontSize = clamp(
    (options.baseScreenFontSize ?? 10.5) + Math.max(0, transform.k - 1) * (options.zoomFontBoost ?? 0.9),
    options.minScreenFontSize ?? 9.2,
    options.maxScreenFontSize ?? 13.6,
  );
  const screenLineHeight = screenFontSize * 1.22;
  const collisionPadding = options.collisionPadding ?? 6;
  const acceptedRects: ScreenRect[] = [];

  return candidates
    .filter((candidate) => candidate.text.trim().length > 0)
    .sort((first, second) => {
      const forcePriority = Number(Boolean(second.force)) - Number(Boolean(first.force));
      if (forcePriority !== 0) return forcePriority;
      return (second.priority ?? 0) - (first.priority ?? 0);
    })
    .reduce<VisibleMapLabel[]>((labels, candidate) => {
      const featureScreenWidth = Math.max(0, candidate.bounds.maxX - candidate.bounds.minX) * transform.k;
      const featureScreenHeight = Math.max(0, candidate.bounds.maxY - candidate.bounds.minY) * transform.k;
      const featureScreenArea = featureScreenWidth * featureScreenHeight;
      const textWidth = estimatedTextWidth(candidate.text, screenFontSize);
      const maxWidthRatio = candidate.force
        ? (options.forceMaxWidthRatio ?? 1.04)
        : (candidate.maxWidthRatio ?? options.maxWidthRatio ?? 0.72);
      const maxHeightRatio = candidate.force
        ? (options.forceMaxHeightRatio ?? 0.86)
        : (candidate.maxHeightRatio ?? options.maxHeightRatio ?? 0.66);
      const minFeatureArea = candidate.minFeatureArea ?? options.minFeatureArea ?? 900;

      if (!candidate.force && transform.k < candidate.minZoom) return labels;
      if (!candidate.force && featureScreenArea < minFeatureArea) return labels;
      if (textWidth > featureScreenWidth * maxWidthRatio) return labels;
      if (screenLineHeight > featureScreenHeight * maxHeightRatio) return labels;

      const screenX = candidate.x * transform.k + transform.x;
      const screenY = candidate.y * transform.k + transform.y;
      const rect = {
        left: screenX - textWidth / 2,
        right: screenX + textWidth / 2,
        top: screenY - screenLineHeight / 2,
        bottom: screenY + screenLineHeight / 2,
      };

      if (isOffscreen(rect, options.viewportWidth, options.viewportHeight)) return labels;
      if (!candidate.force && acceptedRects.some((accepted) => overlaps(rect, accepted, collisionPadding))) {
        return labels;
      }

      acceptedRects.push(rect);
      labels.push({
        id: candidate.id,
        text: candidate.text,
        x: candidate.x,
        y: candidate.y,
        className: candidate.className,
        fontSize: Number((screenFontSize / transform.k).toFixed(3)),
        strokeWidth: Number(((options.haloStrokeWidth ?? 3.2) / transform.k).toFixed(3)),
      });
      return labels;
    }, []);
}

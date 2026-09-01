export type MapWheelLike = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type SharedMapWheelAction =
  | { type: "zoom"; k: number }
  | { type: "contain" }
  | { type: "ignore" };

export type SharedMapPoint = {
  x: number;
  y: number;
};

export type SharedMapTransform = SharedMapPoint & {
  k: number;
};

export const sharedMapButtonZoomStep = 0.52;
export const sharedMapWheelSettleRatio = 0.34;

const wheelZoomSensitivity = 0.0022;
const gestureWheelZoomSensitivity = 0.0044;
const wheelZoomMaxExponent = 0.22;
const wheelNoiseFloorPixels = 0.35;
const wheelSettlePixelThreshold = 0.28;
const wheelSettleZoomThreshold = 0.0015;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function wheelDeltaToPixels(delta: number, deltaMode: number) {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * window.innerHeight;
  return delta;
}

export function getSharedMapWheelAction(
  event: MapWheelLike,
  currentZoom: number,
  minZoom: number,
  maxZoom: number,
): SharedMapWheelAction {
  const pixelsX = wheelDeltaToPixels(event.deltaX, event.deltaMode);
  const pixelsY = wheelDeltaToPixels(event.deltaY, event.deltaMode);
  const absoluteX = Math.abs(pixelsX);
  const absoluteY = Math.abs(pixelsY);

  if (absoluteX < wheelNoiseFloorPixels && absoluteY < wheelNoiseFloorPixels) {
    return { type: "ignore" };
  }

  if (absoluteX > absoluteY) {
    return { type: "contain" };
  }

  const sensitivity = event.ctrlKey || event.metaKey ? gestureWheelZoomSensitivity : wheelZoomSensitivity;
  const exponent = clampNumber(-pixelsY * sensitivity, -wheelZoomMaxExponent, wheelZoomMaxExponent);
  const k = clampNumber(Number((currentZoom * Math.exp(exponent)).toFixed(3)), minZoom, maxZoom);

  return { type: "zoom", k };
}

export function getAnchoredZoomTransform<TTransform extends SharedMapTransform>(
  current: TTransform,
  targetZoom: number,
  center: SharedMapPoint,
  minZoom: number,
  maxZoom: number,
): TTransform {
  const k = clampNumber(Number(targetZoom.toFixed(3)), minZoom, maxZoom);
  return {
    ...current,
    x: center.x - ((center.x - current.x) / current.k) * k,
    y: center.y - ((center.y - current.y) / current.k) * k,
    k,
  };
}

export function getSequentialButtonZoomTarget<TTransform extends SharedMapTransform>(
  visibleTransform: TTransform,
  intendedTargetTransform: TTransform | null,
  zoomDelta: number,
  center: SharedMapPoint,
  minZoom: number,
  maxZoom: number,
): TTransform {
  const base = intendedTargetTransform ?? visibleTransform;
  return getAnchoredZoomTransform(base, base.k + zoomDelta, center, minZoom, maxZoom);
}

export function interpolateMapTransform<TTransform extends SharedMapTransform>(
  current: TTransform,
  target: TTransform,
  ratio = sharedMapWheelSettleRatio,
): TTransform {
  return {
    ...current,
    x: current.x + (target.x - current.x) * ratio,
    y: current.y + (target.y - current.y) * ratio,
    k: current.k + (target.k - current.k) * ratio,
  };
}

export function isMapTransformSettled(current: SharedMapTransform, target: SharedMapTransform) {
  return (
    Math.abs(current.x - target.x) < wheelSettlePixelThreshold &&
    Math.abs(current.y - target.y) < wheelSettlePixelThreshold &&
    Math.abs(current.k - target.k) < wheelSettleZoomThreshold
  );
}

export function serializeMapTransform(transform: SharedMapTransform) {
  return `matrix(${transform.k} 0 0 ${transform.k} ${transform.x} ${transform.y})`;
}

export function isMapTransformEffectivelyEqual(
  current: SharedMapTransform,
  target: SharedMapTransform,
  positionThreshold = 0.01,
  zoomThreshold = 0.0005,
) {
  return (
    Math.abs(current.x - target.x) <= positionThreshold &&
    Math.abs(current.y - target.y) <= positionThreshold &&
    Math.abs(current.k - target.k) <= zoomThreshold
  );
}

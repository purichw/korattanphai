export type MapCamera = { scale: number; x: number; y: number };
export type MapPoint = { x: number; y: number };
export const MAP_WIDTH = 360;
export const MAP_HEIGHT = 340;
export const DEFAULT_CAMERA: MapCamera = { scale: 1, x: 0, y: 0 };
const center = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };

export function clampCamera(camera: MapCamera): MapCamera {
  const scale = Math.max(1, Math.min(8, camera.scale));
  return {
    scale,
    x: Math.max(-center.x * (scale - 1), Math.min(center.x * (scale - 1), camera.x)),
    y: Math.max(-center.y * (scale - 1), Math.min(center.y * (scale - 1), camera.y)),
  };
}

export function moveCamera(camera: MapCamera, from: MapPoint, to: MapPoint, scale: number): MapCamera {
  const nextScale = Math.max(1, Math.min(8, scale));
  const ratio = nextScale / camera.scale;
  return clampCamera({
    scale: nextScale,
    x: to.x - center.x - (from.x - center.x - camera.x) * ratio,
    y: to.y - center.y - (from.y - center.y - camera.y) * ratio,
  });
}

export function zoomCamera(camera: MapCamera, factor: number): MapCamera {
  return moveCamera(camera, center, center, camera.scale * factor);
}

export function cameraMatrix(camera: MapCamera): [number, number, number, number, number, number] {
  return [camera.scale, 0, 0, camera.scale, center.x * (1 - camera.scale) + camera.x, center.y * (1 - camera.scale) + camera.y];
}

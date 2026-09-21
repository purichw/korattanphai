import { describe, expect, it } from 'vitest';
import { cameraMatrix, clampCamera, DEFAULT_CAMERA, moveCamera, zoomCamera } from '../src/mapCamera';

describe('native map camera', () => {
  it('keeps the pinch focal point stationary', () => {
    const focal = { x: 240, y: 120 };
    const camera = moveCamera(DEFAULT_CAMERA, focal, focal, 2);
    const [scale, , , , x, y] = cameraMatrix(camera);
    expect(focal.x * scale + x).toBe(focal.x);
    expect(focal.y * scale + y).toBe(focal.y);
  });

  it('combines pinch and two-finger pan without a center jump', () => {
    const camera = moveCamera(DEFAULT_CAMERA, { x: 180, y: 170 }, { x: 200, y: 140 }, 2);
    expect(camera).toEqual({ scale: 2, x: 20, y: -30 });
    expect(moveCamera(camera, { x: 200, y: 140 }, { x: 210, y: 155 }, 2)).toEqual({ scale: 2, x: 30, y: -15 });
  });

  it('button zoom preserves the visible center after a pan', () => {
    const before = { scale: 2, x: 60, y: -40 };
    const after = zoomCamera(before, 1.5);
    expect(after).toEqual({ scale: 3, x: 90, y: -60 });
    expect(zoomCamera(after, 1 / 1.5)).toEqual(before);
  });

  it('limits zoom and pan and returns exactly to the fitted extent', () => {
    expect(clampCamera({ scale: 100, x: 99999, y: -99999 })).toEqual({ scale: 8, x: 1260, y: -1190 });
    let camera = { scale: 8, x: 1200, y: -900 };
    for (let i = 0; i < 20; i++) camera = zoomCamera(camera, 1 / 1.5);
    expect(camera.scale).toBe(1);
    expect(Math.abs(camera.x)).toBe(0);
    expect(Math.abs(camera.y)).toBe(0);
    expect(cameraMatrix(DEFAULT_CAMERA)).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

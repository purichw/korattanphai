import { describe, expect, it } from "vitest";
import {
  getAnchoredZoomTransform,
  getSequentialButtonZoomTarget,
  getSharedMapWheelAction,
  interpolateMapTransform,
  isMapTransformEffectivelyEqual,
  isMapTransformSettled,
  serializeMapTransform,
} from "../src/mapInteraction";

describe("map interaction zoom behavior", () => {
  it("keeps a mouse-wheel notch to a predictable zoom increment", () => {
    const zoomIn = getSharedMapWheelAction(
      { deltaX: 0, deltaY: -100, deltaMode: 0, ctrlKey: false, metaKey: false },
      1,
      0.7,
      4,
    );
    const zoomOut = getSharedMapWheelAction(
      { deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false, metaKey: false },
      1,
      0.7,
      4,
    );

    expect(zoomIn).toEqual({ type: "zoom", k: 1.246 });
    expect(zoomOut).toEqual({ type: "zoom", k: 0.803 });
  });

  it("keeps small trackpad deltas gradual", () => {
    const action = getSharedMapWheelAction(
      { deltaX: 0, deltaY: -8, deltaMode: 0, ctrlKey: false, metaKey: false },
      1.4,
      0.7,
      4,
    );

    expect(action).toEqual({ type: "zoom", k: 1.425 });
  });

  it("contains horizontal wheel gestures instead of jittering the zoom", () => {
    const action = getSharedMapWheelAction(
      { deltaX: 30, deltaY: 5, deltaMode: 0, ctrlKey: false, metaKey: false },
      1,
      0.7,
      4,
    );

    expect(action).toEqual({ type: "contain" });
  });

  it("keeps the zoom anchored around the pointer", () => {
    const next = getAnchoredZoomTransform({ x: 0, y: 0, k: 1 }, 1.5, { x: 260, y: 360 }, 0.7, 4);

    expect(next).toEqual({ x: -130, y: -180, k: 1.5 });
  });

  it("interpolates and settles wheel target transforms smoothly", () => {
    const current = { x: 0, y: 0, k: 1 };
    const target = { x: -100, y: -50, k: 1.5 };
    const next = interpolateMapTransform(current, target);

    expect(next.x).toBeCloseTo(-34);
    expect(next.y).toBeCloseTo(-17);
    expect(next.k).toBeCloseTo(1.17);
    expect(isMapTransformSettled(next, target)).toBe(false);
    expect(isMapTransformSettled({ x: -99.8, y: -49.8, k: 1.499 }, target)).toBe(true);
  });

  it("accumulates rapid button zooms from the intended target", () => {
    const visible = { x: 0, y: 0, k: 1 };
    const center = { x: 260, y: 360 };

    const first = getSequentialButtonZoomTarget(visible, null, 0.52, center, 0.78, 7.2);
    const second = getSequentialButtonZoomTarget(visible, first, 0.52, center, 0.78, 7.2);
    const third = getSequentialButtonZoomTarget(visible, second, 0.52, center, 0.78, 7.2);

    expect(first.k).toBe(1.52);
    expect(second.k).toBe(2.04);
    expect(third.k).toBe(2.56);
    expect(third.x).toBeCloseTo(-405.6);
    expect(third.y).toBeCloseTo(-561.6);
  });

  it("lets a rapid zoom-in then zoom-out return to the prior intended zoom", () => {
    const visible = { x: 7.6, y: 5.2, k: 0.98 };
    const center = { x: 380, y: 260 };
    const zoomedIn = getSequentialButtonZoomTarget(visible, null, 0.52, center, 0.78, 7.2);
    const zoomedBackOut = getSequentialButtonZoomTarget(visible, zoomedIn, -0.52, center, 0.78, 7.2);

    expect(zoomedBackOut.k).toBe(0.98);
    expect(zoomedBackOut.x).toBeCloseTo(7.6);
    expect(zoomedBackOut.y).toBeCloseTo(5.2);
  });

  it("clamps sequential button targets to the configured zoom bounds", () => {
    const center = { x: 380, y: 260 };

    expect(getSequentialButtonZoomTarget({ x: 0, y: 0, k: 7 }, null, 0.52, center, 0.78, 7.2).k).toBe(7.2);
    expect(getSequentialButtonZoomTarget({ x: 0, y: 0, k: 0.9 }, null, -0.52, center, 0.78, 7.2).k).toBe(0.78);
  });

  it("serializes SVG matrix transforms and compares settled values with a tight tolerance", () => {
    const transform = { x: -12.345, y: 67.89, k: 1.234 };

    expect(serializeMapTransform(transform)).toBe("matrix(1.234 0 0 1.234 -12.345 67.89)");
    expect(isMapTransformEffectivelyEqual(transform, { x: -12.34, y: 67.881, k: 1.2337 })).toBe(true);
    expect(isMapTransformEffectivelyEqual(transform, { x: -12.31, y: 67.89, k: 1.234 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  getAnchoredZoomTransform,
  getSharedMapWheelAction,
  interpolateMapTransform,
  isMapTransformSettled,
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
});

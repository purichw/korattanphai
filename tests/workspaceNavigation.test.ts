import { expect, it } from "vitest";
import { getNakhonRatchasimaDistricts, getNakhonRatchasimaPath, parseNakhonRatchasimaRoute } from "../src/domain";
import { routeBackTargetForRoute } from "../src/components/nakhon-ratchasima/workspaceModel";

it("returns all district workspaces to province drought, including legacy aliases", () => {
  for (const district of getNakhonRatchasimaDistricts()) {
    const path = getNakhonRatchasimaPath(district);
    for (const url of [path, `/nakhon-ratchasima${path}`]) {
      const route = parseNakhonRatchasimaRoute(url);
      expect(route?.valid).toBe(true);
      expect(routeBackTargetForRoute(route!)).toEqual({ label: "กลับจังหวัด", path: "/drought" });
    }
  }
});

it.each([
  ["/dan-khun-thot/t-300806", { label: "กลับอำเภอ", path: "/dan-khun-thot" }],
  ["/drought", { label: "ภาพรวมจังหวัด", path: "/" }],
  ["/", null],
])("preserves the existing back target for %s", (path, expected) => {
  const route = parseNakhonRatchasimaRoute(path);
  expect(route?.valid).toBe(true);
  expect(routeBackTargetForRoute(route!)).toEqual(expected);
});

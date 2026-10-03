import hierarchyJson from "./canonical/nakhon_ratchasima/admin_hierarchy.json";
import type { LocationNode, NakhonRatchasimaHierarchy } from "../types";

export const nakhonRatchasimaHierarchy = hierarchyJson as unknown as NakhonRatchasimaHierarchy;

// Geographic identities come from the published hierarchy. Forecast values are
// loaded separately from the published rev03 archive, never from a demo catalogue.
const { districts, ...province } = nakhonRatchasimaHierarchy.province;
export const locations: LocationNode[] = [
  province,
  ...districts.flatMap(({ subdistricts, ...district }) => [district, ...subdistricts]),
];

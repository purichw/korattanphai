export type CmsResource = { key: string; group: string; preload: boolean };
export const CMS_RESOURCES: CmsResource[];
export const CMS_RESOURCE_BY_KEY: Map<string, CmsResource>;
export function resourceSourcePath(resource: CmsResource): string;

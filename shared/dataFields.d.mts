export type DataKind = 'station' | 'satellite' | 'crop' | 'forecast' | 'archive';
export type DataField = { key: string; label: string; type: 'text' | 'number' | 'choice';
  optional?: boolean; nullable?: boolean; options?: string[] };
export const DATA_FIELDS: Record<DataKind, DataField[]>;
export function requiredFields(kind: DataKind): string[];
export function optionalFields(kind: DataKind): string[];

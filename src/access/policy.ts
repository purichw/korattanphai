/** UI access planning only. Server-side authorization must enforce the same limits before rollout. */
export type AreaLevel = 'country' | 'province' | 'district' | 'subdistrict';
export type AccessArea = { level: AreaLevel; code: string };
export type Capability = 'forecast.view' | 'forecast.export' | 'workspace.save';
export type AccessRule = { capability: Capability; levels: readonly AreaLevel[] };
export type RolePolicy = {
  id: string;
  label: { th: string; en: string };
  rules: readonly AccessRule[];
};
export type AccessPolicy = { version: 1; revision: string; roles: readonly RolePolicy[] };
export type AreaGrant = {
  id: string;
  roleId: string;
  area: AccessArea;
  enabled: boolean;
  expiresAt: string | null;
};
export type AccessAssignment = { userId: string; revision: string; grants: readonly AreaGrant[] };
export type AccessRequest = { capability: Capability; area: AccessArea };
export type AccessDecisionReason = 'allowed' | 'invalid_policy' | 'invalid_assignment' | 'invalid_user'
  | 'subject_mismatch' | 'invalid_request' | 'invalid_time' | 'unknown_role' | 'no_matching_grant';
export type AccessDecision = { allowed: boolean; reason: AccessDecisionReason; grantId?: string };
export type EvaluateAccessInput = {
  policy: unknown;
  assignment: unknown;
  userId: string;
  request: unknown;
  /** Epoch milliseconds; injectable for deterministic expiry checks. */
  now?: number;
};

const levels: readonly AreaLevel[] = ['country', 'province', 'district', 'subdistrict'];
const capabilities: readonly Capability[] = ['forecast.view', 'forecast.export', 'workspace.save'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const roleIdentifier = /^[a-z][a-z0-9_]{0,63}$/;
const areaPatterns: Record<AreaLevel, RegExp> = {
  country: /^TH$/, province: /^\d{2}$/, district: /^\d{4}$/, subdistrict: /^\d{6}$/,
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: readonly string[]) {
  return Object.keys(value).length === expected.length && expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
}
function list(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index++) if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  return true;
}
function isLevel(value: unknown): value is AreaLevel {
  return typeof value === 'string' && levels.includes(value as AreaLevel);
}
function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && capabilities.includes(value as Capability);
}
function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && identifier.test(value);
}
function isRoleIdentifier(value: unknown): value is string {
  return typeof value === 'string' && roleIdentifier.test(value);
}
function isLabel(value: unknown): value is string {
  return typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= 160
    && !/[\u0000-\u001f\u007f]/.test(value);
}
function isExpiry(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string'
    || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
    || !Number.isFinite(Date.parse(value))) return false;
  // Date.parse normalizes impossible dates such as February 30; reject those too.
  const date = value.slice(0, 10);
  return new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
}

/** Checks code syntax only. Resolve real resources through the canonical geography catalog. */
export function isAccessArea(value: unknown): value is AccessArea {
  return record(value) && keys(value, ['level', 'code']) && isLevel(value.level)
    && typeof value.code === 'string' && areaPatterns[value.level].test(value.code);
}

export function isAccessPolicy(value: unknown): value is AccessPolicy {
  if (!record(value) || !keys(value, ['version', 'revision', 'roles']) || value.version !== 1
    || !isIdentifier(value.revision) || !list(value.roles) || value.roles.length === 0) return false;
  const roleIds = new Set<string>();
  return value.roles.every((role: unknown) => {
    if (!record(role) || !keys(role, ['id', 'label', 'rules']) || !isRoleIdentifier(role.id)
      || roleIds.has(role.id) || !record(role.label) || !keys(role.label, ['th', 'en'])
      || !isLabel(role.label.th) || !isLabel(role.label.en) || !list(role.rules)) return false;
    roleIds.add(role.id);
    const ruleCapabilities = new Set<Capability>();
    return role.rules.every((rule: unknown) => {
      if (!record(rule) || !keys(rule, ['capability', 'levels']) || !isCapability(rule.capability)
        || ruleCapabilities.has(rule.capability) || !list(rule.levels) || rule.levels.length === 0
        || !rule.levels.every(isLevel) || new Set(rule.levels).size !== rule.levels.length) return false;
      ruleCapabilities.add(rule.capability);
      return true;
    });
  });
}

export function isAccessAssignment(value: unknown): value is AccessAssignment {
  if (!record(value) || !keys(value, ['userId', 'revision', 'grants'])
    || typeof value.userId !== 'string' || !uuid.test(value.userId)
    || !isIdentifier(value.revision) || !list(value.grants)) return false;
  const grantIds = new Set<string>();
  return value.grants.every((grant: unknown) => {
    if (!record(grant) || !keys(grant, ['id', 'roleId', 'area', 'enabled', 'expiresAt'])
      || !isIdentifier(grant.id) || grantIds.has(grant.id) || !isRoleIdentifier(grant.roleId)
      || !isAccessArea(grant.area) || typeof grant.enabled !== 'boolean' || !isExpiry(grant.expiresAt)) return false;
    grantIds.add(grant.id);
    return true;
  });
}

function isAccessRequest(value: unknown): value is AccessRequest {
  return record(value) && keys(value, ['capability', 'area']) && isCapability(value.capability) && isAccessArea(value.area);
}
function containsArea(granted: AccessArea, requested: AccessArea) {
  if (granted.level === 'country') return true;
  return requested.level !== 'country' && requested.code.startsWith(granted.code);
}

/** Every permission and area must match within one grant; grants never form a capability/scope cross-product. */
export function evaluateAccess({ policy, assignment, userId, request, now = Date.now() }: EvaluateAccessInput): AccessDecision {
  const deny = (reason: AccessDecisionReason): AccessDecision => ({ allowed: false, reason });
  if (!isAccessPolicy(policy)) return deny('invalid_policy');
  if (!isAccessAssignment(assignment)) return deny('invalid_assignment');
  if (typeof userId !== 'string' || !uuid.test(userId)) return deny('invalid_user');
  if (assignment.userId.toLowerCase() !== userId.toLowerCase()) return deny('subject_mismatch');
  if (!isAccessRequest(request)) return deny('invalid_request');
  if (!Number.isFinite(now) || Math.abs(now) > 8.64e15) return deny('invalid_time');
  const roles = new Map(policy.roles.map(role => [role.id, role]));
  if (assignment.grants.some(grant => !roles.has(grant.roleId))) return deny('unknown_role');
  for (const grant of assignment.grants) {
    if (!grant.enabled || (grant.expiresAt !== null && Date.parse(grant.expiresAt) <= now)) continue;
    const role = roles.get(grant.roleId)!;
    if (containsArea(grant.area, request.area)
      && role.rules.some(rule => rule.capability === request.capability && rule.levels.includes(request.area.level))) {
      return { allowed: true, reason: 'allowed', grantId: grant.id };
    }
  }
  return deny('no_matching_grant');
}

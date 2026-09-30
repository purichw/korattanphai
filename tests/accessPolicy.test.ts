import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCESS_POLICY } from '../src/access/defaultPolicy';
import { evaluateAccess, isAccessArea, isAccessAssignment, isAccessPolicy,
  type AccessArea, type AccessAssignment, type AccessPolicy, type AreaGrant, type Capability } from '../src/access/policy';

const userId = '38b634b2-e8ac-4a1c-b3aa-728044b14733';
const otherUser = '42b634b2-e8ac-4a1c-b3aa-728044b14733';
const now = Date.parse('2026-09-30T05:00:00Z');
const country: AccessArea = { level: 'country', code: 'TH' };
const province: AccessArea = { level: 'province', code: '30' };
const district: AccessArea = { level: 'district', code: '3001' };
const subdistrict: AccessArea = { level: 'subdistrict', code: '300101' };
const areas = [country, province, district, subdistrict];
const capabilities: Capability[] = ['forecast.view', 'forecast.export', 'workspace.save'];

function grant(roleId: string, area: AccessArea = country, overrides: Partial<AreaGrant> = {}): AreaGrant {
  return { id: `grant-${roleId}`, roleId, area, enabled: true, expiresAt: null, ...overrides };
}
function assignment(...grants: AreaGrant[]): AccessAssignment {
  return { userId, revision: 'assignment-7', grants };
}
function decision(grants: AreaGrant[], area: AccessArea, capability: Capability = 'forecast.view', policy = DEFAULT_ACCESS_POLICY) {
  return evaluateAccess({ policy, assignment: assignment(...grants), userId, request: { capability, area }, now });
}

describe('configurable officer access defaults', () => {
  it('provides five formally named bilingual role policies without assigning any account', () => {
    expect(isAccessPolicy(DEFAULT_ACCESS_POLICY)).toBe(true);
    expect(DEFAULT_ACCESS_POLICY.roles.map(role => [role.id, role.label.th, role.label.en])).toEqual([
      ['national_officer', 'เจ้าหน้าที่ระดับประเทศ', 'National officer'],
      ['provincial_officer', 'เจ้าหน้าที่ระดับจังหวัด', 'Provincial officer'],
      ['district_officer', 'เจ้าหน้าที่ระดับอำเภอ', 'District officer'],
      ['subdistrict_officer', 'เจ้าหน้าที่ระดับตำบล', 'Subdistrict officer'],
      ['registered_user', 'ผู้ใช้งานที่ลงทะเบียน', 'Registered user'],
    ]);
    expect(decision([], province)).toEqual({ allowed: false, reason: 'no_matching_grant' });
  });

  it.each([
    ['national_officer', [true, true, true, true], true],
    ['provincial_officer', [false, true, true, true], true],
    ['district_officer', [false, false, true, true], true],
    ['subdistrict_officer', [false, false, false, true], true],
    ['registered_user', [false, true, true, true], false],
  ] as const)('uses independent view-level and capability settings for %s', (roleId, allowed, exportAllowed) => {
    for (const capability of capabilities) {
      areas.forEach((area, index) => {
        expect(decision([grant(roleId)], area, capability).allowed,
          `${roleId}: ${capability} ${area.level}`).toBe(allowed[index] && (capability !== 'forecast.export' || exportAllowed));
      });
    }
  });

  it('allows an explicit level addition without hardcoded rank or role-name rules', () => {
    const policy: AccessPolicy = { ...DEFAULT_ACCESS_POLICY, revision: 'policy-2', roles: DEFAULT_ACCESS_POLICY.roles.map(role =>
      role.id === 'provincial_officer' ? { ...role, rules: role.rules.map(rule => rule.capability === 'forecast.view'
        ? { ...rule, levels: [...rule.levels, 'country'] } : rule) } : role) };
    expect(decision([grant('provincial_officer')], country, 'forecast.view', policy).allowed).toBe(true);
    expect(decision([grant('provincial_officer')], country, 'forecast.export', policy).allowed).toBe(false);
    expect(decision([grant('provincial_officer', province)], country, 'forecast.view', policy).allowed).toBe(false);
  });

  it('adds a country-summary grant without widening a provincial officer’s underlying geographic access', () => {
    const policy: AccessPolicy = { ...DEFAULT_ACCESS_POLICY, roles: [...DEFAULT_ACCESS_POLICY.roles, {
      id: 'national_summary_reader', label: { th: 'ผู้อ่านสรุประดับประเทศ', en: 'National summary reader' },
      rules: [{ capability: 'forecast.view', levels: ['country'] }],
    }] };
    const grants = [grant('provincial_officer', province), grant('national_summary_reader')];
    expect(decision(grants, country, 'forecast.view', policy).allowed).toBe(true);
    expect(decision(grants, subdistrict, 'forecast.export', policy).allowed).toBe(true);
    expect(decision(grants, { level: 'province', code: '31' }, 'forecast.view', policy).allowed).toBe(false);
    expect(decision(grants, country, 'forecast.export', policy).allowed).toBe(false);
  });
});

describe('geographic and assignment boundaries', () => {
  it('permits its own area and descendants, but denies parents and siblings', () => {
    const grants = [grant('national_officer', district)];
    expect(decision(grants, district).allowed).toBe(true);
    expect(decision(grants, subdistrict).allowed).toBe(true);
    expect(decision(grants, province).allowed).toBe(false);
    expect(decision(grants, country).allowed).toBe(false);
    expect(decision(grants, { level: 'district', code: '3002' }).allowed).toBe(false);
    expect(decision(grants, { level: 'subdistrict', code: '300201' }).allowed).toBe(false);
  });

  it('matches capability, level and area in the same grant instead of merging their cross-product', () => {
    const grants = [grant('registered_user'), grant('district_officer', district)];
    expect(decision(grants, { level: 'subdistrict', code: '300201' }, 'forecast.view').allowed).toBe(true);
    expect(decision(grants, subdistrict, 'forecast.export').allowed).toBe(true);
    expect(decision(grants, { level: 'subdistrict', code: '300201' }, 'forecast.export').allowed).toBe(false);
    expect(decision(grants, province, 'forecast.export').allowed).toBe(false);
  });

  it('supports multiple distinct area grants while leaving intervening areas denied', () => {
    const grants = [grant('district_officer', district, { id: 'district-a' }),
      grant('district_officer', { level: 'district', code: '3101' }, { id: 'district-b' })];
    expect(decision(grants, subdistrict).grantId).toBe('district-a');
    expect(decision(grants, { level: 'subdistrict', code: '310101' }).grantId).toBe('district-b');
    expect(decision(grants, { level: 'district', code: '3002' }).allowed).toBe(false);
  });

  it('rejects a previous account’s assignment, including an otherwise valid national grant', () => {
    expect(evaluateAccess({ policy: DEFAULT_ACCESS_POLICY, assignment: assignment(grant('national_officer')),
      userId: otherUser, request: { capability: 'forecast.view', area: province }, now }))
      .toEqual({ allowed: false, reason: 'subject_mismatch' });
  });

  it('does not authorize disabled grants or expired grants at the expiry boundary', () => {
    const expiring = grant('national_officer', country, { expiresAt: '2026-09-30T12:00:00+07:00' });
    expect(evaluateAccess({ policy: DEFAULT_ACCESS_POLICY, assignment: assignment(expiring), userId,
      request: { capability: 'forecast.view', area: province }, now: now - 1 }).allowed).toBe(true);
    expect(decision([expiring], province).allowed).toBe(false);
    expect(decision([grant('national_officer', country, { expiresAt: '2020-01-01T00:00:00Z' })], province).allowed).toBe(false);
    expect(decision([grant('national_officer', country, { enabled: false })], province).allowed).toBe(false);
    expect(decision([expiring, grant('provincial_officer', province)], province).allowed).toBe(true);
  });

  it('does not imply CMS privileges or honor prototype/persona role names', () => {
    for (const capability of ['cms.publish', 'admin', '*']) {
      expect(evaluateAccess({ policy: DEFAULT_ACCESS_POLICY, assignment: assignment(grant('national_officer')), userId,
        request: { capability, area: country }, now })).toEqual({ allowed: false, reason: 'invalid_request' });
    }
    expect(decision([grant('super_admin')], province)).toEqual({ allowed: false, reason: 'unknown_role' });
    expect(decision([grant('national_officer'), grant('constructor')], province).allowed).toBe(false);
    expect(decision([grant('National Agricultural Officer')], province).reason).toBe('invalid_assignment');
  });
});

describe('untrusted contract validation', () => {
  it.each([
    null, {}, { level: 'country', code: '30' }, { level: 'country', code: 'th' },
    { level: 'district', code: '30' }, { level: 'subdistrict', code: '3001' },
    { level: 'province', code: '30 ' }, { level: 'district', code: '30.*' },
    { level: 'subdistrict', code: 300101 }, { level: 'village', code: '30010101' },
    { level: 'province', code: '30', allowParents: true },
  ])('rejects malformed or ambiguous area %j', area => {
    expect(isAccessArea(area)).toBe(false);
    expect(evaluateAccess({ policy: DEFAULT_ACCESS_POLICY, assignment: assignment(grant('national_officer')), userId,
      request: { capability: 'forecast.view', area }, now }).allowed).toBe(false);
  });

  it('validates code shape without pretending to prove that a geography exists', () => {
    expect(isAccessArea({ level: 'subdistrict', code: '999999' })).toBe(true);
    // Resource adapters must reject this unknown code against their own canonical catalog.
  });

  it('rejects malformed policy entries even when another role would allow the request', () => {
    const valid = DEFAULT_ACCESS_POLICY.roles[0]!;
    const badPolicies: unknown[] = [null, {}, { ...DEFAULT_ACCESS_POLICY, version: 2 },
      { ...DEFAULT_ACCESS_POLICY, revision: '' }, { ...DEFAULT_ACCESS_POLICY, deny: ['province'] },
      { ...DEFAULT_ACCESS_POLICY, roles: [valid, valid] },
      { ...DEFAULT_ACCESS_POLICY, roles: new Array(1) },
      { ...DEFAULT_ACCESS_POLICY, roles: [{ ...valid, rules: new Array(1) }] },
      { ...DEFAULT_ACCESS_POLICY, roles: [{ ...valid, rules: [{ capability: 'cms.publish', levels: ['country'] }] }] },
      { ...DEFAULT_ACCESS_POLICY, roles: [{ ...valid, rules: [{ capability: 'forecast.view', levels: [] }] }] },
      { ...DEFAULT_ACCESS_POLICY, roles: [{ ...valid, rules: [{ capability: 'forecast.view', levels: new Array(1) }] }] },
      { ...DEFAULT_ACCESS_POLICY, roles: [{ ...valid, rules: [{ capability: 'forecast.view', levels: ['country', 'country'] }] }] },
      { ...DEFAULT_ACCESS_POLICY, roles: [{ ...valid, rules: [valid.rules[0], valid.rules[0]] }] },
      { ...DEFAULT_ACCESS_POLICY, roles: [{ ...valid, label: { th: 'เจ้าหน้าที่', en: '' } }] },
    ];
    for (const policy of badPolicies) {
      expect(isAccessPolicy(policy)).toBe(false);
      expect(evaluateAccess({ policy, assignment: assignment(grant('national_officer')), userId,
        request: { capability: 'forecast.view', area: province }, now })).toEqual({ allowed: false, reason: 'invalid_policy' });
    }
  });

  it('rejects malformed assignments including disabled but invalid grants', () => {
    const valid = grant('national_officer');
    const badAssignments: unknown[] = [null, {}, { ...assignment(valid), userId: 'codex@example.com' },
      { ...assignment(valid), revision: '' }, { ...assignment(valid), role: 'admin' },
      { ...assignment(valid), grants: new Array(1) },
      assignment(valid, valid), assignment({ ...valid, enabled: 'true' } as unknown as AreaGrant),
      assignment({ ...valid, expiresAt: '2026-02-30T00:00:00Z' }),
      assignment({ ...valid, expiresAt: '2026-09-30' }),
      assignment({ ...valid, expiresAt: '2026-09-30T12:00:00' }),
      assignment({ ...valid, enabled: false, expiresAt: 'tomorrow' }),
      assignment({ ...valid, roleId: '__proto__' }),
    ];
    for (const value of badAssignments) {
      expect(isAccessAssignment(value)).toBe(false);
      expect(evaluateAccess({ policy: DEFAULT_ACCESS_POLICY, assignment: value, userId,
        request: { capability: 'forecast.view', area: province }, now })).toEqual({ allowed: false, reason: 'invalid_assignment' });
    }
  });

  it('rejects invalid clocks and untrusted identities; revisions are independently versioned', () => {
    for (const clock of [NaN, Infinity, -Infinity, 9e15]) {
      expect(evaluateAccess({ policy: DEFAULT_ACCESS_POLICY, assignment: assignment(grant('national_officer')), userId,
        request: { capability: 'forecast.view', area: province }, now: clock }).reason).toBe('invalid_time');
    }
    expect(evaluateAccess({ policy: DEFAULT_ACCESS_POLICY, assignment: assignment(grant('national_officer')), userId: 'u-national',
      request: { capability: 'forecast.view', area: province }, now }).reason).toBe('invalid_user');
    expect(decision([grant('national_officer')], province).allowed).toBe(true);
  });

  it('permits an explicitly empty rule set to disable a role without changing assignments', () => {
    const policy: AccessPolicy = { ...DEFAULT_ACCESS_POLICY, roles: DEFAULT_ACCESS_POLICY.roles.map(role =>
      role.id === 'national_officer' ? { ...role, rules: [] } : role) };
    expect(isAccessPolicy(policy)).toBe(true);
    expect(decision([grant('national_officer')], province, 'forecast.view', policy).allowed).toBe(false);
  });
});

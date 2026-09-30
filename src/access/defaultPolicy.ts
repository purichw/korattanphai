import type { AccessPolicy, AreaLevel, Capability, RolePolicy } from './policy';

function role(id: string, th: string, en: string, levels: readonly AreaLevel[], capabilities: readonly Capability[]): RolePolicy {
  const allowedLevels = Object.freeze([...levels]);
  return Object.freeze({ id, label: Object.freeze({ th, en }),
    rules: Object.freeze(capabilities.map(capability => Object.freeze({ capability, levels: allowedLevels }))),
  });
}

const officerCapabilities: readonly Capability[] = ['forecast.view', 'forecast.export', 'workspace.save'];

/** Proposed editable defaults. These roles do not enroll accounts or enable production enforcement. */
export const DEFAULT_ACCESS_POLICY: AccessPolicy = Object.freeze({
  version: 1,
  revision: 'officer-foundation-v1',
  roles: Object.freeze([
    role('national_officer', 'เจ้าหน้าที่ระดับประเทศ', 'National officer',
      ['country', 'province', 'district', 'subdistrict'], officerCapabilities),
    role('provincial_officer', 'เจ้าหน้าที่ระดับจังหวัด', 'Provincial officer',
      ['province', 'district', 'subdistrict'], officerCapabilities),
    role('district_officer', 'เจ้าหน้าที่ระดับอำเภอ', 'District officer',
      ['district', 'subdistrict'], officerCapabilities),
    role('subdistrict_officer', 'เจ้าหน้าที่ระดับตำบล', 'Subdistrict officer',
      ['subdistrict'], officerCapabilities),
    role('registered_user', 'ผู้ใช้งานที่ลงทะเบียน', 'Registered user',
      ['province', 'district', 'subdistrict'], ['forecast.view', 'workspace.save']),
  ]),
});

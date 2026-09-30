# บทบาทและสิทธิ์หน้าบ้าน / Workspace access foundation

Status: **local foundation; production authorization is unchanged** (2026-09-30).
No database migration, account assignment, new endpoint, billing change or deploy
is included. Current accounts remain in explicit `compatibility` mode.

## Business model / หลักการใช้งาน

สิทธิ์ประกอบด้วย **บทบาท × ฟังก์ชัน × ระดับที่ดูได้ × พื้นที่ที่ได้รับมอบหมาย**
และต้องตรงกันครบภายในสิทธิ์ที่มอบหมายรายการเดียว ชื่อบทบาทไม่ได้ทำให้ได้รับ
สิทธิ์ของบทบาทอื่นโดยอัตโนมัติ บัญชีหนึ่งมีได้หลายรายการมอบหมาย/หลายพื้นที่

Access is the intersection of a role's rules, the requested capability, the
requested geographic level and that grant's geographic scope. Roles have no
rank or automatic inheritance. Multiple complete grants are combined by union;
capabilities from one grant cannot be combined with the area of another grant.

These are **editable starting policies**, not approved assignments to real users:

| Role ID | ชื่อภาษาไทย / English | ระดับเริ่มต้น / Default view levels | ฟังก์ชันเริ่มต้น / Default capabilities |
| --- | --- | --- | --- |
| `national_officer` | เจ้าหน้าที่ระดับประเทศ / National officer | ประเทศ จังหวัด อำเภอ ตำบล | ดูพยากรณ์ ส่งออก บันทึกพื้นที่ |
| `provincial_officer` | เจ้าหน้าที่ระดับจังหวัด / Provincial officer | จังหวัด อำเภอ ตำบล | ดูพยากรณ์ ส่งออก บันทึกพื้นที่ |
| `district_officer` | เจ้าหน้าที่ระดับอำเภอ / District officer | อำเภอ ตำบล | ดูพยากรณ์ ส่งออก บันทึกพื้นที่ |
| `subdistrict_officer` | เจ้าหน้าที่ระดับตำบล / Subdistrict officer | ตำบล | ดูพยากรณ์ ส่งออก บันทึกพื้นที่ |
| `registered_user` | ผู้ใช้งานที่ลงทะเบียน / Registered user | จังหวัด อำเภอ ตำบล | ดูพยากรณ์ บันทึกพื้นที่; ยังไม่ให้ส่งออก |

ทุกบทบาทต้องได้รับมอบหมายพื้นที่ด้วย ไม่มีการเปิดทั้งประเทศเพียงเพราะมีชื่อ
บทบาท `national_officer` และไม่มีการเพิ่มสิทธิ์ CMS จากบทบาทเจ้าหน้าที่

All roles require explicit area grants. The current application has Korat
forecast data only. Supporting `country` in this contract does **not** create a
national dashboard, another province's data, or an anonymous/public-access mode.

Examples:

- Provincial officer + province `30`: may view province 30 and its districts/
  subdistricts; may not view a national aggregate or province 31.
- District officer + district `3008`: may view district 3008 and its tambons;
  may not view province 30's aggregate or district 3001.
- A second district grant `3001` adds that district without granting all of 30.
- To let selected provincial officers view the national summary, define a
  separate `national_summary_reader` role with only `forecast.view` at `country`,
  and grant `TH` to those accounts. Their existing province permissions stay
  separate. To change every holder's role rules, edit the shared role policy.
- Merely adding `country` to a role's levels is insufficient while its grant
  still covers province 30. Both the requested level and area must be allowed.

## Implemented building blocks

| File | Responsibility |
| --- | --- |
| `src/access/policy.ts` | Shared types, strict runtime validation and pure allow/deny evaluator |
| `src/access/defaultPolicy.ts` | Five configurable starter roles; no account identities |
| `src/access/WorkspaceAccessProvider.tsx` | React eligibility context, hook and boundary; unavailable/loading/error deny; account/policy/assignment replacement remounts child-owned resources |
| `src/access/workspaceAccess.ts` | Current route → canonical administrative code; unsupported routes return `null` |
| `src/AuthenticatedApp.tsx` | Mounts the visitor provider in explicit compatibility mode; Admin stays outside it |
| `tests/accessPolicy.test.ts`, `tests/workspaceAccess.test.tsx` | Role, area, validation, route, expiry and lifecycle checks |

`useWorkspaceAccess().can(request)` is for **UI eligibility**, not proof that a
server has authorized the data. `WorkspaceAccessBoundary` does not mount denied
children. Consumers supply their existing loading/error/denied presentation.
No role chooser or user-editable permission setting is added to the website.

The provider is installed, but production navigation, search, export and data
requests do not yet enforce officer roles. There is intentionally no environment
flag that turns this foundation into a partially protected live system. The
`ready` state is available for local tests and the future trusted adapter.

## Field dictionary / รายละเอียดข้อมูล

Required fields are mandatory even when their value may be `null`.
`AreaLevel` is `country | province | district | subdistrict`.

| Field | Data type | Mandatory | Sample value | คำอธิบายสำหรับผู้ใช้งาน | Business description |
| --- | --- | --- | --- | --- | --- |
| `policy.version` | integer, fixed `1` | Yes | `1` | รุ่นรูปแบบข้อมูลสิทธิ์ | Contract schema version |
| `policy.revision` | string | Yes | `workspace-policy-1` | รุ่นการตั้งค่าสิทธิ์ ต้องเปลี่ยนเมื่อปรับกติกา | Policy revision, changed whenever rules change |
| `policy.roles` | array of objects | Yes | `[ { ... } ]` | รายการบทบาทที่องค์กรกำหนด | Configured role definitions |
| `role.id` | string | Yes | `provincial_officer` | รหัสบทบาทที่ใช้เชื่อมกับบัญชี | Stable role identifier |
| `role.label.th` | string | Yes | `เจ้าหน้าที่ระดับจังหวัด` | ชื่อบทบาทภาษาไทย | Thai display label |
| `role.label.en` | string | Yes | `Provincial officer` | ชื่อบทบาทภาษาอังกฤษ | English display label |
| `role.rules` | array of objects | Yes | `[ { ... } ]` | ฟังก์ชันและระดับพื้นที่ที่บทบาทใช้ได้ | Explicit capability rules for this role |
| `rule.capability` | string enum | Yes | `forecast.export` | การทำงานที่อนุญาต | Allowed operation |
| `rule.levels` | array of AreaLevel | Yes | `["district", "subdistrict"]` | ระดับภาพรวม/รายละเอียดที่อนุญาต | Geographic view levels allowed for this operation |
| `assignment.userId` | string, UUID | Yes | `11111111-1111-4111-8111-111111111111` | รหัสบัญชีจากระบบเข้าสู่ระบบ ไม่ใช่อีเมลหรือชื่อ | Supabase Auth account identity |
| `assignment.revision` | string | Yes | `user-grants-3` | รุ่นสิทธิ์ของบัญชี ต้องเปลี่ยนเมื่อมอบหมายหรือยกเลิก | Assignment revision for this account |
| `assignment.grants` | array of objects | Yes | `[ { ... } ]` | รายการบทบาทและพื้นที่ของบัญชี; ว่างหมายถึงไม่มีสิทธิ์ | Explicit grants; an empty list grants nothing |
| `grant.id` | string | Yes | `korat-district-3008` | รหัสรายการมอบหมาย | Unique grant identifier within the assignment |
| `grant.roleId` | string | Yes | `district_officer` | บทบาทที่ให้กับรายการนี้ | Role referenced by this grant |
| `grant.area` | object | Yes | `{"level":"district","code":"3008"}` | พื้นที่ที่ได้รับมอบหมาย | Jurisdiction covered by this grant |
| `area.level` | AreaLevel | Yes | `district` | ระดับของพื้นที่ที่ระบุ | Geographic level of the area |
| `area.code` | string | Yes | `3008` | รหัสเขตการปกครอง เก็บเป็นข้อความ | Administrative code; never a name or URL slug |
| `grant.enabled` | boolean | Yes | `true` | เปิดใช้สิทธิ์รายการนี้หรือไม่ | Whether this grant is active |
| `grant.expiresAt` | string, UTC timestamp, or null | Yes | `"2027-01-01T00:00:00.000Z"` | วันสิ้นสุดสิทธิ์; null คือไม่กำหนดวันหมดอายุ | Expiry instant; null means no scheduled expiry |
| `request.capability` | string enum | Yes | `forecast.view` | ฟังก์ชันที่กำลังขอใช้งาน | Operation being evaluated |
| `request.area` | object | Yes | `{"level":"subdistrict","code":"300806"}` | พื้นที่จริงของข้อมูล/หน้าจอที่ขอ | Actual resource scope, derived from canonical data |
| `decision.allowed` | boolean | Yes | `false` | ผลการตรวจสิทธิ์ | Whether the UI operation is eligible |
| `decision.reason` | string | Yes | `no_matching_grant` | เหตุผลสำหรับระบบ/การทดสอบ | Stable machine-readable decision reason |
| `decision.grantId` | string | When allowed by a grant | `korat-district-3008` | รายการสิทธิ์ที่ทำให้ใช้งานได้ | Grant responsible for the allow decision |

Capabilities:

| Capability | ไทย | English |
| --- | --- | --- |
| `forecast.view` | ดูผลพยากรณ์ที่เผยแพร่ในพื้นที่ที่อนุญาต | View published forecasts within the authorized area |
| `forecast.export` | ส่งออกผลพยากรณ์ในพื้นที่ที่อนุญาต | Export published forecasts within the authorized area |
| `workspace.save` | บันทึกพื้นที่หรือตัวกรองส่วนตัว | Save personal areas or filters |

Export and save consumers must check `forecast.view` as well as their operation.
An export permission alone does not imply permission to display a page. All
saved workspace operations remain owner-isolated independently of these rules.

Area codes are `TH` (country), two digits (province), four digits (district), or
six digits (tambon). A province includes its descendants, while a district never
includes its parent. The pure evaluator validates code syntax and containment;
the route adapter resolves existing areas from the canonical catalog. Before
persisting real grants, the server must validate area existence against the
authoritative geography registry as well.

## Sample assignment and React use

Synthetic example only; this UUID does not assign a real account:

```json
{
  "userId": "11111111-1111-4111-8111-111111111111",
  "revision": "user-grants-1",
  "grants": [{
    "id": "korat-district-3008",
    "roleId": "district_officer",
    "area": { "level": "district", "code": "3008" },
    "enabled": true,
    "expiresAt": null
  }]
}
```

```tsx
// After a future server adapter has returned validated policy + assignment:
<WorkspaceAccessProvider userId={session.user.id}
  state={{ status: 'ready', policy, assignment }}>
  <WorkspaceAccessBoundary
    request={{ capability: 'forecast.view', area: { level: 'district', code: '3008' } }}
    fallback={<ExistingAccessState />}>
    <DistrictWorkspace />
  </WorkspaceAccessBoundary>
</WorkspaceAccessProvider>
```

For route links, resolve with `workspaceAccessRequest(destination)` and then
check the result. `null` means unavailable/unsupported, **never allow by default**.
Both `/dan-khun-thot/t-300806` and its legacy alias resolve to tambon `300806`.
`/?district=3008` still represents a province page: filters cannot disguise a
broader page as a lower-level page. A district-only account's future landing page
must be its district route, not `/` followed by a broad-data request.

## Trusted source and activation work still required

1. Store role rules and grants in server-managed Supabase tables keyed by Auth
   UUID. End users cannot edit them. Use audited operations for assignment,
   revocation and policy changes; geography foreign keys validate actual areas.
   CMS operator membership remains a separate contract and session.
2. Add an authenticated access-snapshot endpoint/RPC. Derive identity from the
   verified session, not a supplied user ID; return policy and assignment
   revisions. Validate responses before use. No such endpoint is implemented
   in this change. Do not use persona, email patterns, `user_metadata`, URL
   parameters or localStorage as a trusted role source.
3. Enforce permissions in every data path **before** enabling restricted users:
   direct table SELECT/RLS, scoped `ktp_load_forecast_slice`, legacy full archive
   RPC, aggregate/manifest JSON, reference/geometry reads as required by the
   agreed data policy, exports and saved-workspace ownership/jurisdiction.
   Existing published-data RLS and RPC area parameters currently allow all
   authenticated users to request province data. UI gates cannot fix that.
4. Integrate route gates before mounting loaders, allowed landing destinations,
   navigation/search/breadcrumb/map choices, saved-link restoration, filters and
   export options. Do not silently widen a denied request or delete saved records.
   An unavailable national dataset remains unavailable even when a role permits it.
5. Refresh assignments on session changes, focus and a bounded policy freshness
   interval. During unresolved/error state, remove protected data. Revision
   changes must cancel in-flight reads/export workers and invalidate **all**
   caches, including caches outside the React provider. A denied API response
   must never reuse old broader results or a static fallback. Provider remounts
   and expiry timers assist the UI; they do not prove end-to-end revocation.
6. Before rollout, test direct SELECT and both RPCs with scoped test accounts,
   expired/revoked assignments, concurrent responses, account switching, deep
   links, back/forward, multi-tab sessions and export scope. Preserve separate
   visitor/Admin login/logout and independently enforced CMS membership.

The current `ready` provider fails closed for invalid/unassigned accounts;
`compatibility` is only the explicitly selected current application baseline.
Never convert a failed server lookup into compatibility mode. A future rollout
must define the intended grants for existing accounts before enabling enforcement.

## Verification scope

TypeScript and 81 distinct targeted policy/provider/route and existing auth tests
pass. An existing desktop overview browser journey also passes (filter, reload,
back and tambon drilldown; no page errors), using local fake auth/static source
data. Its inspected screenshots are under `artifacts/access-foundation-smoke/`.
No user-visible design or component dimensions change. Mobile and broad release
suites were intentionally skipped for this non-enforcing foundation.
Live backend enforcement, a role-management screen, nationwide data and native
app integration are separate follow-up work, not delivered features here.

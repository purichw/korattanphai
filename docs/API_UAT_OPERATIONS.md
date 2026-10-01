# API UAT — การติดตั้งและสถานะ / Deployment and status

สถานะ 1 ตุลาคม 2026: **ปรับชุดแพ็กเกจและตรวจ local แล้ว; ยังพักเปิด UAT เพื่อไม่เพิ่มค่าใช้จ่าย**
เมื่อ 9 กันยายน Supabase ปฏิเสธการสร้างโครงการฟรีเพิ่ม เพราะบัญชีถึงขีดจำกัด 2 โครงการที่ active
ยังไม่มี Supabase UAT project, migrations บนฐานข้อมูลจริง, deployment URL,
หรือผลทดสอบ hosted API ห้ามใช้เอกสารนี้เป็นหลักฐานว่า UAT พร้อมรับผู้ทดสอบแล้ว

Prepared only. The existing production website and its database remain unchanged.
The owner declined new spending for now and requested retaining the prepared kit.
Activation is deferred; no subscription has been purchased and no API has been deployed.
The empty Vercel project is retained. Local testing remains available through
[the local Postman guide](POSTMAN_LOCAL_TESTING.md).

## เป้าหมายและการแยก environment / Target and isolation

| Item | Selected configuration / ข้อตกลง |
| --- | --- |
| Vercel project | `korattanphai-api-uat` |
| Vercel project ID | `prj_JhnaCnIKrxH4EQ1rCrVXuWPSO1sW` |
| Vercel scope | `purichwc-1517s-projects` |
| Application | API-only package reusing the real V1 handler; no dashboard or forecast archive bundled |
| Node / region | Node 24; target Singapore (`sin1`) |
| Database | Dedicated Supabase UAT project, pending creation; never production `dihchjflzhcekywarhxd` |
| Data source | `korat-uat`, synthetic NDVI batches only |
| Auth | Distinct writer/reader integration identities; two token slots support rotation |
| Initial quota | 60 requests/minute and 10,000/day per identity; durable PostgreSQL quota |
| Public access | HTTPS API with application Bearer auth; configure deployment access so Postman receives JSON rather than a Vercel login page |
| Publication/model | No model execution, provider feed, VHI output or forecast publication |

Using the new project's default deployment target for a stable UAT URL is not a
promotion of the existing `korattanphai` project. Do not change the repository's
existing `.vercel/project.json` link; deploy from a separate generated package.

## การตัดสินใจเรื่องฐานข้อมูลและค่าใช้จ่าย / Database decision

This section records the 9 September decision, not a current pricing or quota check.

หน้า Supabase ของ organization เดิมแจ้งว่า owner ใช้โควตา Free ครบแล้ว
ได้เสนอ organization ใหม่ **Korat API UAT** บน Pro โดยเปิด Spend Cap
เริ่มต้น **US$25/เดือน** สำหรับโครงการ Micro แรกหนึ่งโครงการตามโควตา/เครดิต
ที่ผู้ให้บริการระบุ แยก billing จาก production เดิม ราคาไม่รวมภาษีหรือ
ค่าใช้จ่ายนอกโควตา และ Spend Cap ไม่ได้จำกัดค่าใช้จ่ายทุกประเภท
[Supabase pricing](https://supabase.com/pricing).

ผู้ใช้ตัดสินใจว่า **“ยังไม่เพิ่มค่าใช้จ่าย เก็บชุดพร้อมติดตั้งไว้ก่อน”** จึงหยุดการสร้าง
ฐานข้อมูลและ deployment ไว้ ไม่มีการสมัคร Pro หรือเปลี่ยน billing ของ production

This paid option was declined for now; do not provision it without a new owner instruction.
An existing authorized, isolated test project can be used instead if supplied by the owner. Do not pause
or delete unrelated projects to free quota, or point UAT at the production DB.

## ขั้นตอนหลังมีฐานข้อมูล UAT / Activation steps

1. บันทึก project reference/region ของฐาน UAT และตรวจว่าแยกจาก production
   เก็บ database/service credentials เฉพาะเครื่องผู้ดูแลและ Vercel server env
   Never put Supabase service credentials in Postman or browser variables.
2. Apply only these two reviewed additive migrations to the new UAT database:
   - [batch storage](../supabase/migrations/20260909010000_model_input_batches.sql)
   - [durable API quotas](../supabase/migrations/20260909020000_model_input_api_quota.sql)
   Use a transaction and verify grants/RLS; no forecast tables or production
   data are needed. Do not run the project's full forecast import for API UAT.
3. Set server-only configuration in the new Vercel project:
   `KORAT_API_ENV=uat`, `MODEL_INPUT_SOURCE_ID=korat-uat`,
   `MODEL_INPUT_SUPABASE_URL`, `MODEL_INPUT_SUPABASE_SECRET_KEY`, and
   `MODEL_INPUT_CLIENTS_JSON`. Client objects use `id`, `role`, `sourceId`,
   `tokens`; assign distinct writer/reader tokens. Set the two quota values
   explicitly. Bind both build and runtime settings to this UAT project.
4. Generate and verify a new package using [prepare-api-uat.mjs](../scripts/prepare-api-uat.mjs)
   with the actual UAT project reference and a new output directory under
   the repository. The package refuses the production database and includes
   source hashes and the resolved commit. Default mode requires runtime files
   to match HEAD; `--source-ref COMMIT` reads only committed files from the
   reviewed ref, never dirty or untracked working files. Verify the selected
   commit includes the complete runtime dependency graph. Deploy only that
   package to the selected Vercel project.
5. Verify the returned immutable deployment and its stable alias. Record actual
   URL, deployment ID, package digest, resolved source commit and database reference.
   Confirm health reports UAT and source/private file URLs are not served.
6. Run the [hosted UAT helper](../scripts/test-model-input-uat.mjs) with private
   reader/writer tokens and a new result filename. It creates at most one
   synthetic batch and checks auth, storage, retry, conflict, invalid data and
   shared reading. Do not declare readiness from health 200 alone.
7. Populate the shared [Postman environment template](../examples/postman/model-inputs-uat.postman_environment.json)
   with only the verified URL/source; keep shared token values blank. Supply
   each tester's credential separately, then verify the two-tester flow in
   [the tester guide](API_UAT_TESTING.md).

```bash
node scripts/prepare-api-uat.mjs \
  --supabase-project-ref YOUR_UAT_PROJECT_REF \
  --output artifacts/api-uat-UNIQUE \
  --source-ref REVIEWED_FULL_COMMIT_SHA
```

The optional source ref must resolve locally to a commit. Missing files,
committed symlinks, unknown/duplicate CLI flags, existing output directories
and symlink parents fail closed. The shared `shared/dataFields.mjs` dependency
is included so the API and CMS use the same field validators.
Run `node verify-package.mjs` inside the generated directory with the isolated
UAT build configuration; this verifies hashes and imports the real handler but
does not contact the database. Hosted verification is still a separate step:

```bash
node scripts/test-model-input-uat.mjs \
  --base-url https://YOUR-VERIFIED-UAT-HOST \
  --output artifacts/uat-verification-UNIQUE.json
```

Required private environment variables: `MODEL_INPUT_UAT_WRITER_TOKEN`,
`MODEL_INPUT_UAT_READER_TOKEN`, `MODEL_INPUT_UAT_SOURCE_ID`. The helper refuses
the known production hostname, redirects and overwriting an existing report.
Failed writes may have an uncertain outcome; retain the report and inspect the
same batch ID before deciding recovery. Do not blindly repeat a new run.

## ข้อมูลร่วม การเริ่มรอบใหม่ และการกู้คืน / Shared data and recovery

All current V1 identities share one configured source. Different tokens give
different permissions and quota identities, not private datasets per tester.
Use synthetic data only; unique IDs let testers rerun without overwriting.

ไม่มี public DELETE/reset endpoint. หากต้องการเริ่มรอบข้อมูลว่าง ให้ผู้ดูแล
กำหนด `sourceId` ใหม่สำหรับรอบ UAT แล้วเปลี่ยน source ใน config ของทุก client
และ Postman ให้ตรงกันก่อน deploy รอบใหม่ วิธีนี้เก็บข้อมูลเดิมไว้และย้อนกลับ
ไป source เดิมได้; ไม่ใช่การลบข้อมูลออกจากฐาน การลบถาวรเป็นงานแยกที่ต้องระบุ
ขอบเขตและตรวจ target database ให้แน่นอนก่อนดำเนินการ

For failed UAT releases, redeploy the last verified UAT package/settings only.
For a credential issue, use the second token slot, verify the new token and
retire the old slot. Do not roll back the production website or repoint to its
database. Keep accepted batches immutable across UAT redeployments.

## หลักฐานที่มี / Evidence so far

Local checks refreshed on 1 October 2026 using Node 26.0.0. The generated
hosting package still targets Node 24; hosted Node 24 acceptance is pending.
The initially missing test dependency was installed at its locked PGlite 0.5.8
version under ignored `tests/node_modules`; app manifests/lockfile are unchanged.

- `npm run test:model-inputs`: 112 passed, including the helper tests and
  isolated PostgreSQL tests for both required migrations.
- `npm run test:operations`: 19 passed, including seven isolated package tests.
  Coverage includes production/wrong-database refusal, committed-source
  isolation, dirty runtime refusal, invalid refs, committed symlinks, CLI
  validation and package integrity. The UAT guard retains the V1 unavailable
  envelope/request ID. Package fixtures own their synthetic Git repositories;
  tests no longer depend on the real checkout being clean.
- `artifacts/api-uat-readiness-20261001/`: 19-file local package built from
  production runtime `3b786cd55797eaa5b77e9176744ce2c5c1f06cc5`; verified source hash
  `2dd5506ff4181623afd7b3188507db2e7da1b701651116b3894c44d5d2a7c89f`.
  Verification used only synthetic configuration, without network/database calls.
  Regenerate with the actual UAT reference after database creation; earlier
  synthetic packages are local proof only and must not be deployed.
- Three Postman JSON files parse successfully; 17 request bodies and 30 event
  scripts pass JSON/syntax checks. Shared UAT token/URL fields remain blank until
  activation. This is artifact validation, not Postman desktop runner acceptance.
- Empty Vercel project creation confirmed; activation is deferred by the owner
  after the free-plan quota prevented database creation. Remote migrations,
  deployed API checks and Postman desktop acceptance have not been performed.

Frontend, mobile and whole-site regression are outside this API-only change.
Passing local checks does not satisfy the pending hosted acceptance criteria.

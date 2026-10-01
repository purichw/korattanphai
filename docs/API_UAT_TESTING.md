# ทดสอบ API ร่วมกันบน UAT / Shared API UAT

**สถานะ: เก็บชุดพร้อมติดตั้ง; พักเปิดใช้งานเพื่อไม่เพิ่มค่าใช้จ่าย / Kit prepared; activation deferred by the owner to avoid new costs.**
ชุดเอกสารพร้อมแล้ว
แต่ยังไม่มี deployment, ฐานข้อมูล UAT หรือ live URL ที่ยืนยันการทำงาน.
จึงเว้น `baseUrl` และ token ว่างไว้; ยังส่งทดสอบร่วมกันไม่ได้จนกว่าผู้ดูแลเปิดระบบ.

ชุดนี้เตรียมทดสอบ **V1 `GET/POST /api/model-inputs` บนระบบ UAT ร่วมกัน**
ด้วยข้อมูล NDVI สมมติ เมื่อเปิดระบบแล้วไม่ต้องเปิด server บนเครื่องผู้ทดสอบ.
This collection is prepared to check a hosted V1 API, integration permissions and
shared storage. Hosted verification is pending activation. It does not run a model or publish forecasts.

ระหว่างนี้ทดลองบนเครื่องได้ตาม [คู่มือ Local Postman](POSTMAN_LOCAL_TESTING.md).
For testing now, use the local Postman guide; there is no shared UAT URL yet.

## 1. Import และตั้งค่า / Import and configure

1. Import [UAT collection](../examples/postman/model-inputs-uat.postman_collection.json)
   และ [UAT environment](../examples/postman/model-inputs-uat.postman_environment.json) เข้า Postman.
2. เลือก environment **Korat Tan Phai — Shared UAT (set local secrets)**.
3. รับ HTTPS URL และ token ตามสิทธิ์จากผู้ดูแล UAT แยกจากเอกสารนี้ แล้วใส่
   `baseUrl` และ token ใน **ค่าที่ใช้เฉพาะเครื่อง / local value**
   (Postman บางรุ่นเรียก **Current value**). ไม่ใส่ token ใน shared/initial value.
4. คง `sourceId=korat-uat` เว้นแต่ผู้ดูแลแจ้งค่าอื่น; ล้าง `peerBatchId`
   ก่อนรันครบชุด เพื่อให้อ่าน batch ของรอบนี้.

The supplied URL and token fields are intentionally blank. Select the imported
environment before sending requests. `baseUrl` is an HTTPS origin only, such as
`https://uat.example.org`, without `/api/model-inputs`, a query or embedded credentials.
Use the authorized URL supplied by the UAT owner; the example is not a live endpoint.

Token นี้เป็น **integration Bearer token** ไม่ใช่ username/password ของเว็บ
และไม่ใช่ Supabase anon/service key. Writer อ่านและเขียนได้; Reader อ่านได้อย่างเดียว.
เก็บ token ไว้ในเครื่อง ไม่แชร์ environment ที่กรอกแล้ว ไม่ถ่ายภาพ Authorization
หรือส่ง request headers ทั้งชุด. การตั้งชนิดเป็น `secret` ช่วยซ่อนค่าบนหน้าจอ
แต่ไม่ทำให้การ export/share ค่าลับปลอดภัยโดยอัตโนมัติ.

Use only the credentials issued for your role. Keep token values local and share
only the blank environment template. Both roles access the same configured UAT
source, so accepted synthetic batches are visible to other authorized testers.

## 2. ตัวแปร / Variables

`M` = จำเป็น / Mandatory; `C` = จำเป็นตามสิทธิ์หรือขั้นตอน / Conditional;
`O` = ไม่จำเป็น / Optional. ช่องว่างของ token หมายถึงยังไม่ได้รับหรือตั้งค่าสิทธิ์นั้น.
ตัวอย่างทั้งหมดเป็นข้อมูลสมมติ / All examples are synthetic.

| Variable | Data type | Required | Example / Default | ความหมายทางธุรกิจ / Business meaning |
| --- | --- | --- | --- | --- |
| `baseUrl` | string | M | blank → `https://uat.example.org` | ที่อยู่ระบบ UAT ที่ทีมตกลงใช้ร่วมกัน / Authorized shared UAT origin. |
| `sourceId` | string | M | `korat-uat` | กลุ่มข้อมูลที่ token ได้รับสิทธิ์ ต้องตรงกับการตั้งค่าฝั่ง server / Source scope configured by the UAT owner. |
| `writerToken` | string, secret | C | blank; supplied privately | สิทธิ์ส่งและอ่านข้อมูล สำหรับ 01–05 และ 10 / Write-and-read credential for writer requests. |
| `readerToken` | string, secret | C | blank; supplied privately | สิทธิ์อ่านข้อมูล สำหรับ 07–09; ใช้ 07 เพื่อยืนยันว่าเขียนไม่ได้ / Read-only credential, including the denied-write check. |
| `peerBatchId` | string | O | blank | รหัส batch จากข้อ 01 ของเพื่อน ใช้เฉพาะข้อ 08; ว่างแล้วใช้ batch ของรอบนี้ / Another tester's fixture ID for shared reading. |
| `batchId` | string; generated | C | `uat-ndvi-<UUID>` | รหัสข้อมูลสมมติรอบนี้ Collection สร้างในข้อ 01 ไม่ต้องกรอก / Current run's generated batch identity. |
| `batchHash` | string; generated | C | 64 lowercase hex characters | ลายนิ้วมือข้อมูลที่ server รับแล้ว ใช้ตรวจว่าข้อมูลเดิมไม่ถูกแก้ / Accepted content fingerprint, saved after a successful 01. |
| `lastRequestId` | string; generated | O | UUID | รหัสคำขอ HTTP ล่าสุดที่ server ตอบ ใช้อ้างอิงเมื่อแจ้งปัญหา / Latest server request ID for support. |

ห้าตัวแปรแรกอยู่ใน environment; สามตัวท้ายอยู่ใน collection และสร้างอัตโนมัติ.
อย่าสร้างตัวแปรชื่อซ้ำในที่อื่น เพราะอาจทำให้ Postman ใช้ค่าผิดชุด.
The collection keeps generated IDs separate from the stable environment URL and credentials.

## 3. ลำดับทดสอบ / Test sequence

ถ้ามีทั้งสองสิทธิ์ ให้ Send 01–10 ตามลำดับ หรือใช้ Collection Runner หนึ่งรอบ
โดยรักษาลำดับเดิม. ตรวจทั้ง HTTP status และผล Tests; 400/401/403/409 ในตาราง
เป็นผลที่ต้องได้สำหรับการทดสอบปฏิเสธ ไม่ใช่ข้อผิดพลาดของ UAT.

| Request | Role | Expected | สิ่งที่ยืนยัน / Acceptance meaning |
| --- | --- | --- | --- |
| 01 POST create | Writer | **201**, `created: true` | รับ batch ใหม่ NDVI=0.62 และคืน hash / New synthetic batch accepted. |
| 02 POST retry | Writer | **200**, `created: false` | ส่ง ID และเนื้อหาเดิม ไม่สร้างซ้ำ / Same submission is idempotent. |
| 03 GET batch | Writer | **200** | อ่านข้อมูลที่จัดเก็บแล้ว ได้ NDVI=0.62 / Persisted observation matches the fixture. |
| 04 POST conflict | Writer | **409**, `batch_conflict` | ID เดิมแต่เปลี่ยนค่าเป็น 0.55 ถูกปฏิเสธ / Accepted batch cannot be overwritten. |
| 05 POST invalid | Writer | **400**, `invalid_batch` | NDVI=2 นอกช่วง ถูกปฏิเสธ / Invalid observation rejected. |
| 06 GET no token | None | **401**, `unauthorized` | ไม่มี token อ่านไม่ได้ / Authentication is required. |
| 07 POST reader | Reader | **403**, `forbidden` | Reader ส่งข้อมูลไม่ได้ แม้ body ถูกต้อง / Read-only access cannot write. |
| 08 GET shared batch | Reader | **200** | อ่าน batch สมมติของรอบนี้หรือเพื่อนใน source เดียวกัน / Shared-source reading works. |
| 09 GET list | Reader | **200** | รายการสูงสุด 10 batch ของ source ที่ได้รับสิทธิ์ / List accepted batches in the authorized source. |
| 10 GET unchanged | Writer | **200** | ค่า 0.62 และ hash ตรงกับข้อ 01 หลังคำขอที่ถูกปฏิเสธ / Rejected writes leave accepted content unchanged. |

ทุกครั้งที่กด **01** จะสร้าง UUID ใหม่ จึงรันซ้ำได้โดยไม่ชนกับรอบก่อนหรือเพื่อน.
หากต้องการทดสอบส่งซ้ำ ให้กด **02**; อย่ากด 01 เพื่อ retry รายการเดิม.
หาก 01 timeout และไม่ทราบว่า server รับแล้วหรือไม่ ให้ส่ง 02 ด้วย ID เดิม:
อาจได้ 201 ถ้าครั้งแรกยังไม่ถูกบันทึก หรือ 200 ถ้าบันทึกแล้ว.
กรณีนี้ให้บันทึกผล recovery แยก แล้วเริ่ม 01 ใหม่เพื่อรัน acceptance sequence
ตามตาราง ซึ่งข้อ 02 คาด 200 หลังข้อ 01 สำเร็จแล้วเท่านั้น.

Every successful 01 appends a synthetic batch; this collection has no delete or
cleanup request. Run a small number of iterations agreed with the UAT owner.
The fixed fixture period `2026-08` and `availableAt` are synthetic V1 examples,
not claims about live data freshness.

**ทดสอบกับเพื่อน / Two-tester check:** ผู้มี Writer รัน 01 แล้วส่งเฉพาะ `batchId`
ให้ผู้มี Reader. ผู้มี Reader ใส่รหัสนั้นใน `peerBatchId` และรัน 08–09;
รัน 07 เพื่อยืนยันว่าเขียนไม่ได้. ไม่ต้องส่งต่อ token ให้กัน.
Batch ของเพื่อนต้องสร้างจาก 01 ของ collection นี้ เพราะข้อ 08 ตรวจ fixture 0.62.
รายการข้อ 09 อาจมีข้อมูลของผู้ทดสอบคนอื่นและเรียงใหม่เมื่อมีการส่งข้อมูลเพิ่ม.

A writer-only tester can run 01–06 and 10. A reader-only tester can run 07 and 09
independently, then 08 with a peer's fixture ID. Source sharing is intentional;
this is not a separate private dataset for each tester.

## 4. แจ้งผลและปัญหา / Report results

บันทึกชื่อ request, เวลาและ timezone, method/path, HTTP status, error code,
`batchId` และ **`X-Request-ID` ของ response ที่มีปัญหา**; collection เก็บรหัสล่าสุด
ไว้ที่ `lastRequestId` แต่รหัสจะเปลี่ยนเมื่อส่งคำขอถัดไป.
แนบเฉพาะ response หรือภาพ Tests ที่ไม่เผย token/cookie/Authorization.
Record the failing response's request ID before running another request.

- **401/403 ผิดจากตาราง:** ตรวจ role, token และ environment ที่เลือก / Check issued permissions and selected environment.
- **404 เมื่ออ่าน:** ตรวจ `batchId`, source และว่า 01 สำเร็จ / Verify the accepted batch and source scope.
- **429:** รอตาม `Retry-After` แล้วค่อยส่งใหม่ / Respect the server's retry delay.
- **503:** แจ้งผู้ดูแลพร้อม request ID / Ask the UAT owner to inspect configuration or storage availability.
- **HTML, redirect หรือไม่มี request ID:** ตรวจ URL และ deployment access กับผู้ดูแล / Confirm you reached the API; do not disable TLS verification.

## 5. ขอบเขต / Scope

นี่คือ V1 ที่รับ observation รายเดือนที่เตรียมแล้ว ใช้ `schemaVersion: 1` และ
`kind: satellite`. ยังไม่ใช่ตัวดึง MODIS/ERA5/DOAE ไม่ทดสอบการรันโมเดล,
manifest/job ของ V2, ผลพยากรณ์ VHI หรือการเผยแพร่ T+ บนเว็บ.
Do not add draft V2 fields to these V1 request bodies.
ดู [API contract](API.md#model-inputs-local-system-bridge),
[research/model design](MODEL_PIPELINE_DESIGN.md) และ
[local-only Postman setup](POSTMAN_LOCAL_TESTING.md) สำหรับบริบทแต่ละส่วน.

การตรวจ artifact ชุดนี้ครอบคลุม JSON, syntax ของ Postman scripts และ body
เทียบกับ V1 validator. ผลทดสอบบน hosted UAT และการ import/run ใน Postman
ต้องบันทึกแยกเมื่อผู้ดูแลส่ง URL และสิทธิ์ให้แล้ว.
Artifact validation alone is not evidence of a successful hosted UAT run.

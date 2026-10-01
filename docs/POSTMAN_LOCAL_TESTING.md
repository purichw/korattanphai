# ทดลอง API ด้วย Postman / Local API testing

ใช้ API V1 ที่มีอยู่เพื่อทดสอบการส่งและอ่านข้อมูลจริงผ่าน HTTP โดยใช้ตัวเลขสมมติ
เหมาะสำหรับลอง request, response, validation และการส่งซ้ำก่อนเชื่อมต้นทาง
This exercises the implemented V1 handler and local file store with synthetic
values. It does not run the scientific model or publish forecasts.

## 1. เปิด server บนเครื่อง

ต้องมี Node 24+ และ dependencies ของโปรเจกต์ ใช้ Terminal ที่ repo:

```bash
cd /Users/point/korattanphai
MODEL_INPUT_SOURCE_ID=postman-demo \
MODEL_INPUT_API_TOKEN=postman-local-demo-only-2026-09-09 \
MODEL_INPUT_CLIENTS_JSON='' \
MODEL_INPUT_PORT=8787 \
MODEL_INPUT_DATA_DIR=.local/postman-demo \
node scripts/serve-model-inputs.mjs
```

เปิด Terminal นี้ค้างไว้จนกว่าจะทดลองเสร็จ; กด Ctrl+C เพื่อหยุด server
Server ฟังเฉพาะ `127.0.0.1:8787` บนเครื่องที่รัน เก็บ batch ที่ `.local/postman-demo`
แยกจาก store ปกติและ production; ข้อมูลยังอยู่หลังรีสตาร์ต
คำสั่งนี้ไม่อ่าน `.env.model-inputs.local` และใช้ demo token โดยตรง
The command starts a loopback-only server with a separate local store. The
displayed token is a public demo value for this local setup, not a real secret.
Website email/password and Supabase tokens are not used by this API.

## 2. Import แล้วกด Send

Import [Postman collection](../examples/postman/model-inputs-v1.postman_collection.json)
ใน Postman Desktop บนเครื่องเดียวกับ server แล้วเปิด collection
ตัวแปร `baseUrl`, `token` และ `sourceId` ตั้งให้ตรงคำสั่งข้างต้นแล้ว
ไม่ต้องเลือก Environment เพิ่ม หากมี environment เดิมใช้ชื่อตัวแปรซ้ำ ให้เลือก
No environment เพื่อใช้ค่าของ collection
Postman supports importing a collection file via **Import**. [Official import guide](https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/).

กด Send ตามลำดับ 01–07 หรือใช้ Collection Runner โดยคงลำดับเดิม:

| Request | Expected | สิ่งที่ทดสอบ / Meaning |
| --- | --- | --- |
| 01 POST | 201 | สร้าง batch NDVI สมมติ 0.62 และรหัสใหม่ / Create a synthetic batch. |
| 02 POST | 200 | ส่ง body และ batchId เดิมซ้ำ ไม่สร้างซ้ำ / Retry the same submission. |
| 03 GET | 200 | อ่าน observation ที่เก็บ ต้องได้ 0.62 / Read the persisted value. |
| 04 POST | 409 | แก้ค่าเป็น 0.55 แต่ใช้ ID เดิม ถูกปฏิเสธ / Immutable batch conflict. |
| 05 POST | 400 | ค่า NDVI=2 นอกช่วง ถูกปฏิเสธ / Invalid physical range. |
| 06 GET | 401 | ไม่มี Bearer token ถูกปฏิเสธ / Authentication required. |
| 07 GET | 200 | อ่านรายการ batch ใน demo source / List accepted batches. |

Request 01 สร้าง `batchId` ใหม่ใน collection variable ทุกครั้งที่กด Send
Request 02–05 ใช้ ID นั้น จึงต้องเริ่มที่ 01; ทดสอบ retry ให้กด 02 ซ้ำ
ทุก request มี Postman Tests ตรวจ status และบางรายการตรวจค่าที่ตอบกลับ
หากแก้ข้อมูลเพื่อสร้างฉบับใหม่ ให้ใช้ ID ใหม่ ไม่แก้ทับ batch เดิม

หากทำเอง: URL คือ `http://127.0.0.1:8787/api/model-inputs`, Authorization
เป็น Bearer Token ตามค่าตัวอย่าง; POST ใช้ Body → raw → JSON และ
`Content-Type: application/json`. GET ราย batch เพิ่ม query `batchId`
ดูชนิดฟิลด์และข้อบังคับใน [API contract](API.md#model-inputs-local-system-bridge).

## 3. ขอบเขตของ SPEC ใหม่

ชุดนี้รับ schemaVersion 1 และ NDVI ที่เตรียมเป็นค่ารายเดือนแล้ว ยังไม่ได้เพิ่ม
ฟิลด์ V2.1 ลงใน validator เดิม เช่น `featureId`, ONI, soil depth หรือ `predictedVhi`
เส้น `/api/v2/...` ใน [SPEC](MODEL_PIPELINE_DESIGN.md) เป็นแบบสำหรับพัฒนาต่อ
Schema examples for frozen jobs and result files are not their HTTP creation
or completion request bodies.

หากจะทดลอง flow V2.1 ขั้นถัดไป ให้ทำ sandbox แยกพร้อมข้อมูล/manifest จำลอง:
สร้างงาน → worker รับงาน → อ่าน input snapshot → heartbeat → ส่งสถานะงาน
ต้องกำหนด create/claim request, authentication และ fencing-token wire fields
ก่อนสร้าง collection ของ V2; การรับผล VHI ต้องมี upload/complete contract เพิ่ม
ส่วนการต่อข้อมูลดาวเทียม/DOAE การรันโมเดล และการเผยแพร่เป็นงาน integration ถัดไป

Localhost ใช้ได้จากเครื่องเดียวกันเท่านั้น หากต้องการให้ทีมอื่นยิงจากเครื่องของตน
ต้องมี sandbox URL ที่โฮสต์แยกและ token สำหรับการทดสอบ ซึ่งยังไม่ได้สร้างจากชุดนี้

## หลักฐานตรวจสอบ / Verification

ตรวจวันที่ 9 กันยายน 2026: ส่ง request ทั้ง 7 รายการจาก collection ผ่าน HTTP
ไปยัง V1 local server/store จริง ได้ status ตามตารางครบ และอ่านซ้ำหลังรายการ
ที่ถูกปฏิเสธแล้ว NDVI ยังคง 0.62 ตรวจ syntax ของ scripts ใน collection ผ่าน
แยกทดสอบ demo เดิมยืนยันข้อมูลยังอยู่หลัง server restart ผ่านด้วย
These are HTTP and artifact checks; the Postman desktop import/runner UI was
not exercised. No application runtime, production configuration or live data
was changed. Test servers were stopped after verification; run step 1 to start
your interactive session.

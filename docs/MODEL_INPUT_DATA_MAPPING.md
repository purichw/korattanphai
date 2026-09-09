# Model Input Data Mapping — คู่มือเชื่อมและแปลงข้อมูล

สถานะ / Status: **V1 ตรงกับโค้ดปัจจุบัน; provider adapters ของ V2 ยังเป็นข้อเสนอ** · ตรวจ 9 กันยายน 2026

สำหรับทีมข้อมูล ผู้พัฒนาตัวเชื่อม และทีมโมเดล เอกสารนี้บอกว่าเอาค่าจากไหน ส่งเป็นชนิดใด ต้องมีหรือไม่ และแปลงอย่างไร โดยไม่เปลี่ยนสัญญา API

For data, integration, and model teams: this guide specifies source-to-target mappings, data types, required fields, nullability, and conversion rules. It does not change the API contract.

อ่านคู่กับ [API ปัจจุบัน](API.md), [แบบระบบ V2 และคำอธิบายธุรกิจ TH/EN](MODEL_PIPELINE_DESIGN.md), และ [หลักฐานข้อมูลไทย](THAI_AGRICULTURAL_DATA_RESEARCH.md) รูปแบบตารางใช้แนว Parameter / Data Type / Mandatory / Description เช่น [2C2P request parameters](https://developer.2c2p.com/docs/api-payment-token-request-parameter); ชนิดข้อมูลและเงื่อนไขทั้งหมดด้านล่างเป็นของโครงการนี้

## 1. วิธีอ่านตาราง / Table conventions

| Notation | ความหมาย / Meaning |
| --- | --- |
| `M` — Mandatory | ต้องมี key / The key must be present. |
| `O` — Optional | ละ key ได้ / The key may be omitted. |
| `C` — Conditional | ต้องมีเมื่อเข้าเงื่อนไขที่ระบุ / Required when the stated condition applies. |
| Nullable `Y` / `N` | รับ JSON `null` ได้ / ไม่ได้ แยกจากการละ key / Whether explicit JSON `null` is accepted, independently of omission. |
| `string` | ข้อความใน double quotes เช่น `"300806"`; วันที่และเวลาเป็น string ไม่ใช่ JSON date type / Quoted text; dates and timestamps are strings. |
| `number` | เลข JSON ที่มีทศนิยมได้ เช่น `28.5`; `NaN` และ infinity ใช้ไม่ได้ / A finite JSON number, potentially fractional. |
| `integer` | เลข JSON ที่ไม่มีเศษ เช่น `60`; ส่ง `"60"` เข้า API โดยตรงไม่ได้ / A whole JSON number; a numeric string is not an API integer. |
| `boolean` | `true` หรือ `false` ไม่ใส่ quotes และไม่ใช้ `0`/`1` / Unquoted `true` or `false`, not numeric substitutes. |
| `object` / `array<T>` | กลุ่ม key/value / รายการชนิด T / A key-value object / a list of T values. |
| `A → B` | ค่าหรือชนิดต้นทาง → หลัง collector แปลง / Source value or type → collector output. |
| `const:` | ค่าใน config ไม่ได้อ่านจากคอลัมน์ต้นทาง / A configured constant rather than a source column. |
| `…` / `<...>` | ตัวอย่างย่อหรือ placeholder ไม่ใช่ค่าที่ส่งจริง / An abbreviation or placeholder, not a literal submission value. |

**ตัวอย่างสำคัญ / Important:** `value` ของสถานีเป็น **M, Nullable Y** ดังนั้น `"value": null` ใช้ได้เมื่อ `quality` เป็น `missing` แต่ลบ `value` ออกไม่ได้ ส่วน `sourceRecordId` เป็น **O, Nullable N**: ละ key ได้ แต่ส่ง `null` ไม่ได้

CSV ทุกช่องเริ่มเป็น `string`; JSON รักษาชนิดที่ต้นทางส่ง Collector แปลงเฉพาะฟิลด์ที่กำหนดเป็นตัวเลขหรือรหัส ไม่แปลงทุกข้อความให้เป็นตัวเลข API รับเฉพาะชนิดปลายทางที่ถูกต้อง

Every CSV cell starts as a string; JSON retains its source types. The collector converts only defined numeric/identifier fields. The API requires the final types, not the collector's more permissive source types.

### ขอบเขตที่ทำได้จริง / Implementation boundary

| Layer | Status / สิ่งที่รองรับ |
| --- | --- |
| V1 generic collector | อ่าน HTTP GET หรือไฟล์ JSON/CSV; mapping, explicit missing sentinels, numeric/date validation / Implemented. |
| V1 prepared station/satellite/crop batches | แปลงตารางที่เตรียมความหมายแล้วและส่ง `POST /api/model-inputs` / Implemented and locally verifiable. |
| V2 DOAE raw adapter | แปลง header จริง, comma numbers, พ.ศ., variety/round/period semantics, staging / **Proposed; not implemented.** |
| V2 ThaiWater adapter | แปลงข้อมูลซ้อนชั้นและยืนยันเวลา รหัสสถานี และวิธีจับคู่พื้นที่<br>Flatten nested fields, confirm timezone/window, station identity and geography policy / **Proposed; not a production preset.** |
| V2 GISTDA adapter | ต้องยืนยันสิทธิ์ไฟล์ค่าจริง นิยามผลิตภัณฑ์ และวิธีประมวลผลภาพ<br>Resolve authorized numerical assets, product definitions, QA, raster processing and aggregation / **Proposed; not implemented.** |

## 2. Collector config — V1 implemented

ตัวอย่างที่ใช้จริงอยู่ใน [examples/model-inputs](../examples/model-inputs/) ค่าในไฟล์ตัวอย่างเป็น **synthetic**; HTTP URL เป็น placeholder ที่ตั้งใจให้ใช้ไม่ได้

Examples are synthetic. The HTTP example deliberately points to an unusable placeholder. Config files are limited to 64 KiB; source responses/files and normalized batches to 1 MiB. One batch contains 1–2,000 observations. Unknown config keys are rejected.

### 2.1 Top-level parameters

| Parameter | Type | M/O/C | Nullable | Sample / Default | เงื่อนไขและความหมาย / Conditions and meaning |
| --- | --- | --- | --- | --- | --- |
| `schemaVersion` | integer | M | N | `1` | รุ่น config; รับเฉพาะ 1 / Config version; exactly 1. |
| `kind` | string | C | N | `"satellite"` | ต้องมีสำหรับ `satellite`/`crop`; ละสำหรับสถานี / Required for typed satellite/crop configs; omit for station mode. |
| `sourceId` | string | M | N | `"korat-model-team"` | รหัสแหล่งต้องตรง API; lowercase เริ่มด้วย a–z ตามด้วย a–z, 0–9, `_`, `-`; ยาว 1–64 / Must match API source configuration. |
| `source` | object | M | N | `{"type":"file","path":"local-weather.csv"}` | วิธีรับต้นทาง / Source connection. See 2.2. |
| `format` | object | M | N | `{"type":"csv"}` | วิธีอ่านเนื้อหา / Content parser. See 2.3. |
| `fields` | object | M | N | `{"stationId":"station_code"}` | Target field → exact source column name; ไม่มี nested-row traversal / Exact property names, not JSON paths within a row. |
| `timestamp` | object | C | N | `{"format":"local","timezoneOffset":"+07:00"}` | บังคับเฉพาะสถานี; ห้ามใส่ใน satellite/crop config / Required only in station mode; forbidden in typed configs. |
| `measurements` | array<object> | C | N | `[{"metric":"rainfall",…}]` | สถานีต้องมี 1–20 รายการ; typed configs ห้ามมี / Station mode only, 1–20 measurements. |
| `constants` | object or null | O | Y | `{"agency":"DOAE"}`; default `{}` | เฉพาะ typed configs; key ต้องไม่ซ้ำกับ `fields`; `null` ปัจจุบันเท่ากับ `{}` / Typed mode only; disjoint from mapped fields. |
| `missingValues` | array<string> | O | N | `["","-9999","NULL"]`; default `[""]` | Sentinel สำหรับช่องตัวเลข; สูงสุด 50 strings แต่ละค่าไม่เกิน 100 ตัวอักษร เปรียบเทียบหลัง trim แบบตรงตัว / Exact, case-sensitive numeric sentinels after trimming. |
| `missingValues[]` | string | C | N | `"-9999"` | เมื่อมีสมาชิกต้องเป็น string; JSON `null` ในช่องตัวเลขยังเป็น missing แม้ไม่มี sentinel / Each entry is text; numeric JSON null is always missing. |

`kind` ไม่รับค่า `"station"` ให้ละ key การระบุ `constants: null`, `format.encoding: null` หรือ `format.delimiter: null` ใช้ default ตามโค้ดปัจจุบัน แต่แนะนำให้ละ key เพื่อสื่อเจตนาให้ชัด

Do not send `kind: "station"`; omit it. The three nullable defaulting cases above/below reflect current code behavior; omission is the clearer configuration convention.

### 2.2 Source connection

| Parameter | Type | M/O/C | Nullable | Sample / Default | เงื่อนไขและความหมาย / Conditions and meaning |
| --- | --- | --- | --- | --- | --- |
| `source.type` | string | M | N | `"file"` or `"http"` | ไฟล์ local หรือ HTTP GET / Local file or HTTP GET. |
| `source.path` | string | C | N | `"local-weather.csv"` | บังคับเมื่อ `file`; relative ต่อโฟลเดอร์ config; ห้ามใน `http` / File path relative to config directory; forbidden for HTTP. |
| `source.url` | string | C | N | `"https://source.example/observations"` | บังคับเมื่อ `http`; absolute HTTPS; ไม่มี user/password/fragment; ห้ามใน `file` / Absolute URL without userinfo or fragment; HTTP rules below. |
| `source.allowHttp` | boolean | O | N | `true`; default `false` | ใช้ได้เฉพาะ `http`; ต้องเป็น `true` จึงอ่าน plain HTTP ได้สำหรับเครือข่ายที่ผู้ดูแลเลือก / Explicit opt-in for a trusted legacy HTTP source. |
| `source.timeoutMs` | integer | O | N | `15000` | เฉพาะ `http`; 100–60,000 ms; default 15,000 / HTTP request timeout. |
| `source.headers` | object | O | N | `{"X-API-Key":{"env":"LOCAL_SOURCE_API_KEY"}}` | เฉพาะ `http`; ไม่ใส่ secret เป็น literal / HTTP header references; never literal secrets. |
| `source.headers.<headerName>` | object | C | N | `{"env":"LOCAL_SOURCE_API_KEY"}` | เมื่อเพิ่ม header ต้องมี object นี้; ชื่อใช้ตัวอักษร/ตัวเลข/`-`; ห้าม Host, Content-Length, Connection, Transfer-Encoding / Transport headers are not configurable. |
| `source.headers.<headerName>.env` | string | C | N | `"LOCAL_SOURCE_API_KEY"` | ชื่อ env variable ไม่ใช่ค่า secret; เริ่มด้วยตัวอักษรหรือ `_`, ตามด้วยตัวอักษร/ตัวเลข/`_`; ตอนรันต้องมีค่าไม่ว่างและไม่มี CR/LF / Required environment-variable reference. |

Collector ไม่ตาม redirect และไม่ปิด TLS verification ค่า `source.allowHttp` ใช้กับการอ่านต้นทางเท่านั้น การส่ง batch ต้องเป็น HTTPS ยกเว้น loopback local เช่น `http://127.0.0.1:8787`

Redirects are not followed and TLS verification stays enabled. Source HTTP opt-in does not permit insecure remote submission; uploads require HTTPS except on loopback.

### 2.3 Format, source fields, and station measurements

| Parameter | Type | M/O/C | Nullable | Sample / Default | เงื่อนไขและความหมาย / Conditions and meaning |
| --- | --- | --- | --- | --- | --- |
| `format.type` | string | M | N | `"json"` or `"csv"` | เลือก parser / Select parser. |
| `format.encoding` | string or null | O | Y | `"utf-8"`; alternate `"windows-874"` | Default/null → UTF-8; encoding ผิดทำให้ fail / Invalid encoded content is rejected. |
| `format.delimiter` | string or null | O | Y | `","` | CSV only; 1 character excluding quote, CR, LF, NUL; default/null → comma; JSON ห้ามมี / Forbidden for JSON. |
| `format.dataPath` | string | O | N | `"data.observations"` | JSON only; omit for root array; dot-separated object path, each segment letters/digits/`_`/`-`; ไม่รับ `__proto__`, `prototype`, `constructor` / Safe envelope path only. |
| `fields.stationId` | string | M in station mode | N | `"station_code"` | ชื่อคอลัมน์รหัสสถานี / Station identifier column. |
| `fields.observedAt` | string | M in station mode | N | `"observed_at"` | ชื่อคอลัมน์วันเวลาสถานี / Station timestamp column. |
| `fields.sourceRecordId` | string | O | N | `"record_id"` | ใช้ได้ทั้งสาม kind; ถ้าตั้ง mapping แล้วทุกแถวต้องมีคอลัมน์ / All rows must supply it once mapped. |
| `fields.<typedTargetField>` | string | C | N | `"tambon_code"` | Satellite/crop: target ในตาราง 4/5 ต้องมาจาก field หรือ constant อย่างใดอย่างหนึ่ง; column name ไม่เกิน 128 ตัวอักษรและไม่ว่าง / Required targets need exactly one input route. |
| `constants.<typedTargetField>` | string, number, or null | C | Depends on target | `"DOAE"`, `10`, `null` | Target ต้องอยู่ใน kind นั้นและผ่าน validation หลังแปลง; boolean/object/array ใช้ไม่ได้ / Target-specific conversion and nullability apply. |
| `timestamp.format` | string | M in station mode | N | `"iso"` or `"local"` | `iso` ต้องมี seconds และ offset; `local` ใช้รูปแบบถัดไป / ISO with explicit offset or strict local text. |
| `timestamp.timezoneOffset` | string | C | N | `"+07:00"` | บังคับเมื่อ local; ±HH:MM สูงสุด ±14:00; iso ห้ามมี / Required for local mode, forbidden for ISO mode. |
| `measurements[]` | object | M in station mode | N | `{"metric":"rainfall",…}` | หนึ่งรายการสร้างหนึ่ง observation ต่อแถวต้นทาง / Each measurement creates one observation per source row. |
| `measurements[].metric` | string | M | N | `"rainfall"` | ตัวแปรตามตาราง station metrics / Supported station metric. |
| `measurements[].valueColumn` | string | M | N | `"rain_mm"` | ชื่อคอลัมน์ตัวเลข ไม่เกิน 128 ตัวอักษร; ต้องมีจริงทุกแถว / Exact numeric column, present on every row. |
| `measurements[].unit` | string | M | N | `"mm"` | ต้องตรง metric; collector ไม่แปลงหน่วย / Must match metric; no automatic unit conversion. |
| `measurements[].aggregation` | string | M | N | `"sum"` | `instant`, `sum`, `mean`, `min`, `max`; เงื่อนไขตาม metric / Metric-specific aggregation. |
| `measurements[].periodMinutes` | integer | M | N | `60` | `instant` = 0; อื่น ๆ 1–527,040 / Zero for instantaneous values; positive for aggregates. |
| `measurements[].qualityColumn` | string | O | N | `"qc"` | ถ้ามีต้องเพิ่ม qualityMap; คอลัมน์ต้องมีทุกแถว / Requires a quality map and a code on every row. |
| `measurements[].qualityMap` | object | C | N | `{"1":"reported","9":"missing"}` | บังคับถ้ามี qualityColumn และห้ามมีหากไม่มี; ต้องมีอย่างน้อยหนึ่ง entry / Nonempty mapping, conditional on qualityColumn. |
| `measurements[].qualityMap.<sourceCode>` | string | C | N | `"reported"` | ค่าได้แก่ reported/missing/suspect; source code เป็น string หรือ number แล้ว trim/stringify; unmapped code fail / Every encountered code must map explicitly. |

ตัวอย่าง mapping ไม่ใช่ path traversal: `"fields":{"stationId":"station.id"}` จะหา key ชื่อ `station.id` ตามตัวอักษร ไม่ได้อ่าน object `station` ข้างใน ต้อง flatten ก่อนหากต้นทาง nested

Mapped row names are literal keys: `station.id` does not traverse a nested object. Only `format.dataPath` traverses the JSON envelope.

## 3. Station source → observations[] — V1 implemented

อิง [local-csv.config.json](../examples/model-inputs/local-csv.config.json) และ [local-json.config.json](../examples/model-inputs/local-json.config.json) ทั้งคู่เป็นข้อมูลจำลองและได้ 4 observations เหมือนกัน สอง measurement ต่อหนึ่งแถว

Both synthetic fixtures normalize identically. Target names below are properties of each `observations[]` item; config names do not appear in the output.

| Source → Target | Sample source → normalized | Source type → target type | M/O/C | Nullable target | แปลง/ตรวจ / Conversion and validation |
| --- | --- | --- | --- | --- | --- |
| `station_code` → `stationId` | `"DEMO-001"` → `"DEMO-001"` | string or safe integer → string | M | N | รหัสสถานี; ตัดช่องว่างและแปลงรหัสตัวเลขเป็นข้อความตามรูปแบบที่กำหนด<br>Trim; integer ≥0 → text; 1–64 ASCII chars, start alphanumeric, then alphanumeric/`_`/`.`/`:`/`-`. |
| `observed_at` → `observedAt` | `"2026-09-08 07:00:00"` → `"2026-09-08T00:00:00.000Z"` | string → string(datetime) | M | N | วันเวลาที่วัดหรือสิ้นสุดช่วงรวม; ตัวอย่างใช้ +07:00 และต้องเป็นวันเวลาจริงตามรูปแบบ<br>Local example uses explicit +07:00; Gregorian 1900–2100, valid calendar/time, exact `YYYY-MM-DD HH:mm:ss`. ISO mode requires seconds and offset; milliseconds up to 3 digits. |
| `const: measurements[].metric` → `metric` | `"rainfall"` → `"rainfall"` | string → string | M | N | ไม่เดาจากชื่อคอลัมน์ / Never inferred from column name. |
| `rain_mm` → `value` | CSV `"0"` / JSON `0` → `0` | string or number → number | M | Y | เลขศูนย์ยังเป็นศูนย์ / Zero remains a measurement. |
| `rain_mm` → `value` | CSV `"-9999"` / JSON `null` → `null` | string or null → null | M | Y | รหัสแทนไม่มีข้อมูลต้องตั้งค่าไว้ชัดเจน และสถานะต้องเป็น missing<br>Sentinel configured explicitly; quality must be missing. |
| `temperature_c` → `value` for temperature record | `"28.5"` → `28.5` | string or number → number | M | Y | ใช้ measurement อีกตัว ไม่ทับค่าฝน / A separate temperature observation. |
| `const: measurements[].unit` → `unit` | `"mm"` → `"mm"` | string → string | M | N | หน่วยต้องตรงกับตัวแปรและแปลงหน่วยให้เสร็จก่อนส่ง<br>Metric/unit pair must match; already converted units required. |
| `const: measurements[].aggregation` → `aggregation` | `"sum"` → `"sum"` | string → string | M | N | ความหมายการรวมค่าต้องยืนยันกับต้นทาง / Confirm the aggregation meaning with the source. |
| `const: measurements[].periodMinutes` → `periodMinutes` | `60` → `60` | integer → integer | M | N | ระยะสะสมก่อน observedAt ซึ่งเป็นเวลาสิ้นสุดช่วงสำหรับค่ารวม<br>Window preceding observedAt; observedAt is the end for aggregates. |
| Derived or `qc` via qualityMap → `quality` | `value:0` → `"reported"`; `value:null` → `"missing"` | derived / string or number → string | M | N | ไม่มี qualityColumn ใช้ reported/missing ตามค่า; ถ้ามี mapping ต้องไม่ขัดกับ null / Explicit QC cannot contradict nullness. |
| Optional mapped `record_id` → `sourceRecordId` | `123` → `"123"` | string or safe integer → string | O | N | ไม่อยู่ใน fixture; เมื่อส่งต้องยาว 1–128 ไม่มี control chars / Illustrative optional field, not present in fixture. |
| `note` | Synthetic Thai notice → omitted | string → not emitted | O | — | ไม่มี mapping จึงไม่ส่ง / Unmapped source columns are ignored. |

ตัวเลขยอมรับ sign/decimal/exponent ที่เป็นเลข finite หลัง trim แต่ **ไม่รับ comma หลักพัน**, `NaN`, infinity, boolean, array หรือข้อความพร้อมหน่วย แม้ CSV parser จะอ่าน `"54,000.00"` ได้ถูกช่อง numeric converter ก็จะปฏิเสธ ต้องเตรียมค่าก่อนด้วย adapter ที่มีนิยามชัดเจน

Numeric parsing accepts finite signed decimal/exponent notation, but not thousands separators or unit suffixes. Quoted CSV fields preserve commas; they do not make thousands-formatted numbers supported. Missing columns, invalid numbers, malformed CSV, or invalid dates reject the whole batch; no partial ingestion.

| Station metric | Unit | Aggregation | Value rule / ขอบเขตค่า |
| --- | --- | --- | --- |
| `rainfall` | `mm` | `sum` only | ฝนต้องไม่ติดลบ หรือเป็น null เมื่อไม่มีข้อมูล<br>≥0 or null |
| `air_temperature` | `degC` | instant/mean/min/max | อุณหภูมิเป็นเลขจำกัด รวมค่าติดลบได้ หรือเป็น null<br>Finite, including negative, or null |
| `relative_humidity` | `%` | instant/mean/min/max | ความชื้นสัมพัทธ์อยู่ระหว่าง 0–100 หรือเป็น null<br>0–100 or null |
| `water_level` | `m` | instant/mean/min/max | ระดับน้ำติดลบได้ตามระดับอ้างอิงที่ต้องตกลงกัน หรือเป็น null<br>Finite, including negative, or null; datum still needs agreement |
| `streamflow` | `m3/s` | instant/mean/min/max | อัตราการไหลต้องไม่ติดลบ หรือเป็น null<br>≥0 or null |
| `soil_moisture` | `%` | instant/mean/min/max | ความชื้นดินของสถานีใช้เปอร์เซ็นต์ 0–100 หรือ null ต่างจากหน่วยปริมาตรของดาวเทียม<br>0–100 or null; distinct from satellite volumetric unit |

## 4. Prepared satellite table → observations[] — V1 implemented

อิง [satellite-features.config.json](../examples/model-inputs/satellite-features.config.json) และ [synthetic JSON](../examples/model-inputs/satellite-features.json) เป็นตารางที่สรุปแล้ว **ไม่ใช่ตัวอ่าน GeoTIFF** ค่า sample แถวแรกเป็นข้อมูลจำลอง NDVI ของตำบล 300806

This maps already prepared monthly features, not raw imagery. Each required target must be provided through `fields.<target>` or `constants.<target>`, never both. Optional targets may use either route. Quality is explicit; typed mode does not infer it.

| Source → Target | Sample source → normalized | Source type → target type | M/O/C | Nullable target | แปลง/ตรวจ / Conversion and validation |
| --- | --- | --- | --- | --- | --- |
| `tambon_code` → `subdistrictCode` | `"300806"` → `"300806"` | string or safe integer → string | M | N | ต้องตรงหนึ่งใน 289 รหัสจริง ไม่ใช่แค่ 6 หลัก / Actual canonical Korat code. |
| `month` → `period` | `"2026-08"` → same | string → string(month) | M | N | เดือนที่ข้อมูลครอบคลุม; V1 ใช้เดือนปฏิทิน UTC ที่จบแล้ว<br>`YYYY-MM`, Gregorian 1900–2100; completed UTC calendar month in V1. |
| `available_at` → `availableAt` | `"2026-09-02T09:00:00+07:00"` → `"2026-09-02T02:00:00.000Z"` | string → string(datetime) | M | N | Explicit ISO seconds/offset; ≥ next UTC month start; ไม่สร้างวันเผยแพร่เอง / Do not invent availability. |
| `metric` → `metric` | `"ndvi"` → same | string → string | M | N | ตัวแปรต้องตรงกับหน่วยและวิธีรวมค่าที่รองรับด้านล่าง<br>Supported metric/unit/aggregation table below. |
| `value` → `value` | `0.6` → `0.6`; `"-9999"` → `null` | number/string/null → number/null | M | Y | แปลงเป็นเลขแล้วตรวจขอบเขตของตัวแปร; null ต้องคู่กับ missing<br>Numeric converter + metric range; null iff quality is missing. |
| `unit` → `unit` | `"1"` → `"1"` | string → string | M | N | `"1"` คือ string ไม่ใช่ number 1 / Dimensionless unit is a string. |
| `quality` → `quality` | `"reported"` → same | string → string | M | N | reported/missing/suspect; ต้องระบุเอง / Explicit field or constant. |
| `valid_pixel_fraction` → `validPixelFraction` | `0.95` → `0.95` | number or numeric string → number | M | N | สัดส่วนพิกเซลใช้ได้ 0–1; ถ้ามีค่าจริงสัดส่วนต้องมากกว่า 0<br>0–1; non-null value requires >0. |
| `product` → `product` | `"SYNTHETIC-NDVI"` → same | string → string | M | N | ชื่อผลิตภัณฑ์; ตัดช่องว่างและใช้ข้อความ ASCII ที่ไม่ว่าง<br>Trim; nonempty printable ASCII ≤128 chars. |
| `const: productVersion` → `productVersion` | `"synthetic-demo-v1"` → same | string → string | M | N | รุ่นเผยแพร่ของผลิตภัณฑ์; ข้อความ ASCII ไม่ว่างไม่เกิน 128 ตัวอักษร<br>Product release; printable ASCII ≤128, nonempty. |
| `const: processingVersion` → `processingVersion` | `"synthetic-demo-v1"` → same | string → string | M | N | รุ่นวิธีประมวลผล; ข้อความ ASCII ไม่ว่างไม่เกิน 128 ตัวอักษร<br>Processing method version; printable ASCII ≤128, nonempty. |
| `resolution_m` → `resolutionMeters` | `10` → `10` | number or numeric string → number | M | N | ขนาดกริดเป็นเมตรต้องมากกว่า 0 แต่ไม่ยืนยันรายละเอียดของการวัดต้นฉบับ<br>>0 finite; grid resolution does not prove native measurement detail. |
| `spatial_aggregation` → `spatialAggregation` | `"area_weighted_mean"` → same | string → string | M | N | วิธีรวมเชิงพื้นที่: ค่าเฉลี่ยถ่วงพื้นที่หรือค่าตัวแทนจากกริดหยาบ<br>area_weighted_mean or coarse_grid_proxy. |
| `temporal_aggregation` → `temporalAggregation` | `"mean"` → same | string → string | M | N | ใช้ค่าเฉลี่ย ยกเว้นฝนสะสมที่ต้องใช้ผลรวม<br>mean, except precipitation requires sum. |
| `const: geometryVersion` → `geometryVersion` | `"demo-boundary-v1"` → same | string → string | O | N | รุ่นขอบเขตพื้นที่ที่ใช้คำนวณ; ข้อความ ASCII ไม่ว่าง<br>Boundary version; printable ASCII ≤128, nonempty. |
| `const: maskVersion` → `maskVersion` | `"demo-crop-mask-v1"` → same | string → string | O | N | รุ่นแผนที่เลือกพื้นที่หรือพื้นที่เพาะปลูก; ข้อความ ASCII ไม่ว่าง<br>Selected-area/crop mask version; printable ASCII ≤128, nonempty. |
| `native_support_m` → `nativeSupportMeters` | `10` → `10` | number or numeric string → number | O | N | ขนาดพื้นที่ที่การวัดต้นฉบับสะท้อนจริง ต้องมากกว่า 0 ไม่เดาจากกริดที่ขยายใหม่<br>>0 finite; original measurement support, not resampled grid spacing. |
| Optional source/constant → `sourceArtifactHash` | `"ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB"` → `"abababababababababababababababababababababababababababababababab"` (illustrative) | string → string | O | N | ลายนิ้วมือไฟล์ต้นทางเป็นเลขฐานสิบหก 64 ตัว; ตัวอย่างแสดงรูปแบบเท่านั้น ต้องคำนวณจากไฟล์จริงหรือให้ละ key<br>Exactly 64 hex chars; format illustration only. Compute from the actual artifact or omit the key. |
| Optional mapped/constant → `sourceRecordId` | `"feature-001"` → same | string or safe integer → string | O | N | รหัสแถวต้นทางยาว 1–128 ไม่มีอักขระควบคุม; ไม่มีใน fixture<br>1–128 chars without controls; not present in fixture. |

| Satellite metric | Unit | Temporal aggregation | ขอบเขตค่าที่ยอมรับ<br>Valid value |
| --- | --- | --- | --- |
| `ndvi` | `1` | `mean` | ดัชนีพืชอยู่ระหว่าง −1 ถึง 1 หรือเป็น null<br>−1…1 or null |
| `ndmi` | `1` | `mean` | ดัชนีความชื้นอยู่ระหว่าง −1 ถึง 1 หรือเป็น null<br>−1…1 or null |
| `land_surface_temperature` | `degC` | `mean` | อุณหภูมิพื้นผิวเป็นเลขจำกัดใด ๆ หรือเป็น null<br>Any finite number or null |
| `precipitation` | `mm` | `sum` | ฝนสะสมไม่ติดลบ หรือเป็น null<br>≥0 or null |
| `soil_moisture` | `m3/m3` | `mean` | ความชื้นดินเชิงปริมาตรอยู่ระหว่าง 0 ถึง 1 หรือเป็น null<br>0…1 or null |

NDWI, EVI และ DRI+ **ยังไม่ใช่ค่า metric ที่ V1 รับ** อย่าเปลี่ยนชื่อเพื่อให้ผ่าน validation; ต้องทำ definition/contract ใหม่ก่อน ใช้ identity `(subdistrictCode, period, metric, product, productVersion)` ป้องกันซ้ำภายใน batch

NDWI, EVI, and DRI+ are not accepted V1 metric values. Do not relabel them to bypass validation. Duplicate identities within a batch are rejected, including records that differ only in processingVersion or availability.

## 5. Prepared crop table → observations[] — V1 implemented

อิง [doae-crop-yield.config.json](../examples/model-inputs/doae-crop-yield.config.json) และ [synthetic CSV](../examples/model-inputs/doae-crop-yield.csv) ตัวอย่างนี้เป็นข้อมูลสมมติที่กำหนดความหมายเป็นรายปีแล้ว **ไม่ใช่ mapping ของ CSV DOAE จริง** ในหัวข้อ 7

This synthetic prepared annual example is not a provider-approved DOAE mapping. Required targets must be supplied through one field or constant. CSV source types are strings; the final API requires the target types below.

| Source → Target | Sample source → normalized | Source type → target type | M/O/C | Nullable target | แปลง/ตรวจ / Conversion and validation |
| --- | --- | --- | --- | --- | --- |
| `tambon_code` → `subdistrictCode` | `"300806"` → same | string or safe integer → string | M | N | ต้องเป็นรหัสตำบลจริงในชุดอ้างอิงโคราช<br>Actual canonical Korat code. |
| `crop` → `cropCode` | `"rice"` → same | string → string | M | N | รหัสชนิดพืชใช้ตัวอักษรตามรูปแบบรหัส ยาว 1–64<br>1–64 ASCII identifier chars using station-ID syntax. |
| `series` → `seasonId` | `"2025-annual"` → same | string → string | M | N | รหัสชุดรายงานหรือรอบพืชที่ตกลงกัน; ชื่อรหัสไม่ใช่หลักฐานฤดูปลูก<br>Agreed period/series identity; name alone does not establish a growing season. |
| `period_type` → `periodType` | `"calendar_year"` → same | string → string | M | N | ประเภทช่วงข้อมูลเป็นปีปฏิทินหรือฤดูพืช โดยไม่เดาจากรอบเผยแพร่ไฟล์<br>calendar_year or crop_season; not inferred from source file cadence. |
| `period_start` → `periodStart` | `"2025-01-01"` → same | string → string(date) | M | N | วันเริ่มช่วงข้อมูลตามปฏิทิน ค.ศ.; ต้องไม่อยู่หลังวันสิ้นสุด<br>Valid Gregorian YYYY-MM-DD, 1900–2100; start ≤ end. |
| `period_end` → `periodEnd` | `"2025-12-31"` → same | string → string(date) | M | N | รวมวันสิ้นสุดด้วย; รายปีต้องเริ่ม 1 มกราคมและจบ 31 ธันวาคมปีเดียวกัน<br>Inclusive end; calendar_year must span Jan 1–Dec 31 of the same year. |
| `available_at` → `availableAt` | `"2026-03-01T09:00:00+07:00"` → `"2026-03-01T02:00:00.000Z"` | string → string(datetime) | M | N | เวลาที่ข้อมูลมีให้ใช้; V1 ต้องไม่ก่อนเที่ยงคืน UTC หลังวันสิ้นสุดช่วง<br>ISO seconds/offset; at or after UTC midnight following periodEnd in V1. |
| `const: agency` → `agency` | `"DOAE"` → same | string → string | M | N | หน่วยงานต้องเป็นกรมส่งเสริมการเกษตร รหัส DOAE<br>Exactly DOAE. |
| `const: datasetVersion` → `datasetVersion` | `"synthetic-demo-v1"` → same | string → string | M | N | รุ่นชุดข้อมูล; ตัดช่องว่างและใช้ ASCII ไม่ว่างไม่เกิน 128 ตัวอักษร<br>Trimmed nonempty printable ASCII ≤128 chars. |
| `planted_rai` → `plantedAreaRai` | `"100"` → `100` | string/number/null → number/null | M | Y | พื้นที่ปลูกเป็นเลขจำกัดไม่ติดลบ หรือระบุไม่มีข้อมูล<br>Nonnegative finite number or explicit missing. |
| `harvested_rai` → `harvestedAreaRai` | `"90"` → `90` | string/number/null → number/null | M | Y | ไม่บังคับ ≤ plantedAreaRai / No unsupported planted/harvested inequality. |
| `production_tonnes` → `productionTonnes` | `"45"` → `45` | string/number/null → number/null | M | Y | ผลผลิตต้องอยู่ในหน่วยตันแล้ว; collector ไม่แปลงกิโลกรัมให้เอง<br>Already tonnes; generic collector does not divide kilograms by 1,000. |
| `yield_kg_per_rai` → `yieldKgPerRai` | `"500"` → `500` | string/number/null → number/null | M | Y | ผลผลิตต่อไร่ไม่ติดลบ เก็บตามรายงาน ไม่คำนวณอัตราหรือเฉลี่ยข้ามแถวเอง<br>Nonnegative; retained as reported, no derived ratio or cross-row average. |
| `yield_area_basis` → `yieldAreaBasis` | `"unspecified"` → same | string → string | M | N | ฐานพื้นที่เป็นเก็บเกี่ยว ปลูก หรือไม่ทราบ โดยไม่เดาตัวหาร<br>harvested/planted/unspecified; unknown is explicit, not guessed. |
| `quality` → `quality` | `"reported"` → same | string → string | M | N | ตัวเลขทั้งสี่เป็น null จึงใช้ missing; ถ้าขาดบางค่าใช้ reported หรือ suspect<br>All four numeric measures null iff quality missing; partial nulls use reported/suspect. |
| Optional field/constant → `sourceRecordId` | `"crop-row-001"` → same | string or safe integer → string | O | N | รหัสแถวต้นทางยาว 1–128 ไม่มีอักขระควบคุม; ไม่มีใน fixture<br>1–128 chars without controls; not in fixture. |
| `note` | Synthetic notice → omitted | string → not emitted | O | — | ไม่ส่งคอลัมน์หมายเหตุเพราะไม่มี mapping<br>Not mapped. |

ใช้ identity `(subdistrictCode, cropCode, seasonId, datasetVersion)` ตรวจซ้ำ ภายใน V1 ไม่มี field สำหรับพันธุ์พืช พื้นที่เสียหาย หรือราคา จึงไม่ควรทิ้งรายละเอียด raw เหล่านี้เพื่อฝืนส่งเข้ารูปแบบตัวอย่าง

V1 has no crop-variety, damaged-area, or price field. Do not discard these raw dimensions merely to force an actual source into the prepared example contract.

## 6. Envelope, API receipt, and read results — V1 implemented

POST ไปยัง `POST /api/model-inputs` ใช้ `Authorization: Bearer <integration-token>` และ `Content-Type: application/json` ทั้งคู่เป็น string headers บังคับ; `charset=utf-8` เป็น content-type parameter ที่ยอมรับได้ Writer token ใช้ส่งข้อมูล ส่วน GET ใช้ writer หรือ read-only token ได้

POST requires the writer token. GET accepts the writer or configured read-only token. Header placeholders are not actual credentials. The collector uses HTTPS except loopback and validates the JSON receipt before reporting success.

### 6.1 Request envelope

| Source → Parameter | Target type | M/O/C | Nullable | Sample | เงื่อนไข / Conditions |
| --- | --- | --- | --- | --- | --- |
| Config → `schemaVersion` | integer | M | N | `1` | รุ่น envelope ปัจจุบันต้องเป็น 1<br>Exactly 1 for all current kinds. |
| Config → `sourceId` | string | M | N | `"local-demo"` | รหัสแหล่งตัวพิมพ์เล็ก 1–64 ตัว ต้องตรงกับแหล่งที่มีสิทธิ์ส่ง<br>1–64 lowercase identifier; must match authorized source. |
| Config → `kind` | string | C | N | `"satellite"` | ต้องมีเมื่อเป็นดาวเทียมหรือพืช; ข้อมูลสถานีให้ละฟิลด์<br>Required for satellite/crop; omitted for station observations. |
| Collector → `batchId` | string | M | N | `"sha256-8cb6728effb6be6903794026e2f381919817e97a35b3e33b8c0a726ab7f6a199"` | ตัวอย่างเป็นรหัสจริงของ fixture จำลอง; ระบบส่งอื่นกำหนดรหัสตามรูปแบบได้<br>Actual synthetic station fixture ID. Custom clients may use 1–128 ASCII identifier chars. |
| Transformed rows → `observations` | array<object> | M | N | `[{"stationId":"DEMO-001",…}]` | ชุดข้อมูลมี 1–2,000 แถว และทุกแถวเป็น kind เดียวกัน<br>1–2,000 records; all records use the envelope's kind. |
| Transformed row → `observations[]` | object | M | N | Tables 3–5 | แต่ละแถวต้องมีฟิลด์และ nullability ตาม kind; ไม่รับ key ที่ไม่รู้จัก<br>Required/optional keys and nullability depend on kind; unknown keys rejected. |

Collector สร้าง batchId จาก normalized body ที่ยังไม่ใส่ batchId แล้วเติม prefix `sha256-`; server คำนวณ `contentHash` จาก canonical envelope ที่มี batchId แล้ว **จึงไม่ใช่ hash ค่าเดียวกัน** ลำดับแถวมีผลต่อทั้งสองค่า ข้อมูลเดิมและลำดับเดิมส่งซ้ำได้; ID เดิมแต่เนื้อหาเปลี่ยนได้ HTTP 409

The collector's batch identifier hash and server contentHash cover different canonical objects. They are not interchangeable. Row order matters; reordered or overlapping snapshots may create new batches and need downstream reconciliation.

### 6.2 POST response / metadata

HTTP 201 = accepted new batch, HTTP 200 = identical batch already stored. The response contains metadata, not the full observations. Metadata samples below are illustrative; receipt timestamps are generated by storage.

| Parameter | Type | M/O/C | Nullable | Sample | คำอธิบาย / Description |
| --- | --- | --- | --- | --- | --- |
| `created` | boolean | M | N | `true` | บอกว่าสร้าง batch ใหม่หรือไม่: true เมื่อ 201, false เมื่อซ้ำได้ 200<br>true for HTTP 201; false for duplicate HTTP 200. |
| `batch` | object | M | N | `{"sourceId":"local-demo",…}` | ใบรับข้อมูล / Storage receipt metadata. |
| `batch.sourceId` | string | M | N | `"local-demo"` | รหัสแหล่งในใบรับต้องตรงกับที่ส่ง<br>Must match submitted source. |
| `batch.batchId` | string | M | N | `"rain-demo-001"` | รหัส batch ในใบรับต้องตรงกับที่ส่ง<br>Must match submitted batch. |
| `batch.contentHash` | string | M | N | `"abababababababababababababababababababababababababababababababab"` | hash ของ envelope ที่จัดรูปแบบแล้ว; ตัวอย่างแสดงรูปแบบเท่านั้น collector ตรวจค่าจริงว่าตรงกันก่อนรายงานสำเร็จ<br>SHA-256 of canonical envelope; sample illustrates the format only. Collector checks the actual digest for equality. |
| `batch.receivedAt` | string(datetime) | M | N | `"2026-09-08T00:00:01.123456+00:00"` | เวลารับเข้าคลัง รองรับทศนิยมวินาทีถึง 6 หลัก ต้องเก็บตรงตัวสำหรับแบ่งหน้า<br>Valid ISO seconds/offset, fractions up to 6 digits; preserve exact value for pagination. |
| `batch.observationCount` | integer | M | N | `4` | จำนวนแถว 1–2,000 ต้องตรงกับที่ส่ง<br>1–2,000, matching submitted record count. |

The receipt does not include `batch.kind`. Never treat an HTML login page with HTTP 200 as success. `submitBatch()` returns `{status: 201, duplicate: false}` only after matching the JSON receipt; `status` is an integer and `duplicate` a boolean. These two fields are collector return values, not the HTTP response schema.

### 6.3 GET parameters and response shapes

All URL query values are strings on the wire. No parameter may be repeated; unknown query names are rejected. POST accepts no query parameters.

| Parameter | Wire type | M/O/C | Nullable | Sample / Default | เงื่อนไข / Conditions |
| --- | --- | --- | --- | --- | --- |
| `batchId` | string | C | N | `"rain-demo-001"` | ใช้ขอ batch เดียว ห้ามใช้ร่วมกับ limit หรือ cursor<br>Single-batch mode only; cannot combine with limit/cursor. |
| `limit` | string → parsed integer | O | N | `"25"`; default 25 | จำนวนรายการต่อหน้า 1–100; ใช้เฉพาะหน้ารายการและห้ามส่งค่าว่าง<br>List mode only; 1–100; empty value invalid. |
| `cursor` | string | O | N | `"eyJyZWNlaXZlZEF0IjoiMjAyNi0wOS0wOFQwMDowMDowMS4wMDBaIiwiYmF0Y2hJZCI6InJhaW4tZGVtby0wMDEifQ"` | ตัวอย่างสมมติของตัวชี้หน้าถัดไป; ใช้งานจริงให้นำ nextCursor จาก API มาใช้ตรงตัว ห้ามสร้างหรือตัดความละเอียดเวลาเอง<br>Illustrative list-mode cursor; opaque base64url, 1–512 chars. Use the actual API-returned nextCursor; do not create or truncate timestamps yourself. |

| Response parameter | Type | M/O/C | Nullable | Sample | คำอธิบาย / Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array<object> | M in list mode | N | `[]` | รายการ metadata; ส่งรายการว่างได้เมื่อไม่พบข้อมูล<br>Metadata records; empty list is valid. |
| `items[]` | object | C when nonempty | N | `{"sourceId":"local-demo",…}` | แต่ละรายการมี metadata ห้าฟิลด์แบบ batch.* ไม่มี created หรือ kind<br>Same five metadata fields as `batch.*` above; no created/kind field. |
| `nextCursor` | string or null | M in list mode | Y | `null` | null หมายถึงไม่มีหน้าเก่าต่อ แต่ยังต้องมี key<br>No older page when null; key still present. |
| Single-batch envelope | object | M in single mode | N | Request envelope plus two fields below | คืน envelope เดิม และมี kind เฉพาะชุดดาวเทียมหรือพืช<br>Returns schemaVersion/sourceId/batchId/observations and kind when typed. |
| `contentHash` | string | M in single mode | N | `"abababababababababababababababababababababababababababababababab"` | hash เดียวกับที่ยืนยันในใบรับข้อมูล; ตัวอย่างแสดงรูปแบบเท่านั้น<br>Same canonical content hash as receipt; sample illustrates the format only. |
| `receivedAt` | string(datetime) | M in single mode | N | `"2026-09-08T00:00:01.000Z"` | เวลาที่คลังรับข้อมูล ไม่ใช่เวลาตรวจวัด<br>Storage timestamp; not the observation time. |
| `error` | object | M on failure | N | `{"code":"invalid_batch","message":"…"}` | เมื่อผิดพลาดใช้รูปแบบนี้แทนผลสำเร็จ<br>Error response replaces the success body. |
| `error.code` | string | M on failure | N | `"batch_conflict"` | รหัสประเภทข้อผิดพลาดสำหรับให้ระบบอ่าน<br>Machine-readable error category; see API.md. |
| `error.message` | string | M on failure | N | `"Batch not found."` | ข้อความอธิบายข้อผิดพลาดสำหรับคนอ่าน ไม่ใส่ secret หรือเนื้อหาต้นทาง<br>Human-readable explanation; no source secrets or raw bodies. |

## 7. Actual DOAE CSV → proposed V2 raw staging

**ยังไม่มี adapter นี้ / Not implemented.** ชื่อคอลัมน์และ sample ด้านล่างมาจากแถวสาธารณะจริงที่เก็บไว้ใน [local research sample](../artifacts/thai-source-research/doae-2023-korat-sample.json), แถวคะน้า ตำบลในเมือง; ไม่ใช่รายงานปัจจุบัน และยังไม่ ingest เข้าโมเดล หลักฐานและ URL ต้นทางอยู่ใน [research](THAI_AGRICULTURAL_DATA_RESEARCH.md)

The following 15 exact headers and values come from the previously inspected public sample. `rawValues` is a **proposed staging object**, not a V1 field. Proposed M/N below means preserve every header as a string, including an empty string; it is not a claim that the provider guarantees nonempty values. Missing headers should be quarantined, not silently fabricated.

| Exact source column → proposed staging key | Actual sample → preserved sample | Type source → target | M/O/C | Nullable raw | ความหมาย/ข้อจำกัด / Meaning and conditions |
| --- | --- | --- | --- | --- | --- |
| `ปี` → `rawValues["ปี"]` | `"2566"` → same | string → string | M | N | เก็บปี พ.ศ. เดิม; การแปลงเป็น 2023 ไม่ได้ยืนยันว่าแถวเป็นยอดรายปี<br>Preserve BE year; proposed sourceYearBE alias. Later explicit BE conversion gives 2023, not proof of an annual observation. |
| `เดือน` → `rawValues["เดือน"]` | `"1"` → same | string → string | M | N | เก็บเดือนเดิมไว้ก่อน ยังไม่ทราบว่าเป็นเดือนรายงาน ปลูก หรือเก็บเกี่ยว<br>Preserve sourceMonth; reporting/planting/harvest meaning unresolved. |
| `จังหวัด` → `rawValues["จังหวัด"]` | `"นครราชสีมา"` → same | string → string | M | N | จับคู่พื้นที่ด้วยจังหวัด อำเภอ และตำบลร่วมกัน<br>Match province + district + subdistrict together. |
| `อำเภอ` → `rawValues["อำเภอ"]` | `"เมืองนครราชสีมา"` → same | string → string | M | N | ชื่ออำเภอช่วยแยกตำบลชื่อซ้ำ ห้ามจับคู่ด้วยชื่อตำบลอย่างเดียว<br>Do not join using subdistrict name alone. |
| `ตำบล` → `rawValues["ตำบล"]` | `"ในเมือง"` → same | string → string | M | N | ไฟล์นี้ไม่มีรหัสตำบล ต้องใช้บัญชีจับคู่ที่มีรุ่น<br>No subdistrict code in this file; versioned crosswalk required. |
| `กลุ่มพืช` → `rawValues["กลุ่มพืช"]` | `"พืชผัก"` → same | string → string | M | N | รักษากลุ่มพืชไว้ก่อนรวมข้อมูล<br>Preserve grouping before aggregation. |
| `ชนิดพืช` → `rawValues["ชนิดพืช"]` | `"คะน้า"` → same | string → string | M | N | ต้องจับคู่ชนิดพืชกับบัญชีที่ตกลงกันก่อนให้ cropCode<br>Requires agreed crop mapping before assigning cropCode. |
| `พันธุ์พืช` → `rawValues["พันธุ์พืช"]` | `"คะน้า"` → same | string → string | M | N | เก็บพันธุ์พืชไว้; V1 ยังไม่มีฟิลด์พันธุ์<br>Retain variety; no current V1 crop-variety field. |
| `รอบการปลูก` → `rawValues["รอบการปลูก"]` | `"0"` → same | string → string | M | N | เก็บรอบการปลูกเดิม; 0 เป็นรหัสต้นทาง ไม่ใช่ค่าว่างโดยอัตโนมัติ<br>Preserve sourceRound; 0 is a source code, not assumed missing. |
| `เนื้อที่ปลูก (ไร่)` → `rawValues["เนื้อที่ปลูก (ไร่)"]` | `"81"` → same | string → string | M | N | ค่าหลังตรวจอาจเป็น 81 ไร่ แต่ต้องยืนยันช่วงและระดับของแถวก่อนใช้<br>Proposed reviewed numeric value 81 rai; period/grain must be resolved first. |
| `เนื้อที่เสียหาย (ไร่)` → `rawValues["เนื้อที่เสียหาย (ไร่)"]` | `" -   "` → same, including spaces | string → string | M | N | ยืนยันรหัสแทนไม่รายงานก่อน; พื้นที่เสียหายไม่ได้ระบุสาเหตุว่าเป็นภัยแล้ง<br>Confirm missing marker; damaged area does not identify drought cause. |
| `เนื้อที่เก็บเกี่ยวผลผลิต(ไร่)` → same key under rawValues | `"54"` → same | string → string | M | N | เก็บพื้นที่เก็บเกี่ยวตามที่รายงานแยกจากพื้นที่ปลูก<br>Preserve independent harvested-area report. |
| `ผลผลิตที่เก็บเกี่ยวได้ (กิโลกรัม)` → same key under rawValues | `"54,000.00"` → same | string → string | M | N | ต้องพัฒนาตัวอ่านเลขคั่นหลักพันเพิ่มเติม; ตัวแปลงปัจจุบันไม่รองรับ<br>Requires a new validated thousands parser; not accepted by generic numeric converter. |
| `ผลผลิตเฉลี่ย(กิโลกรัม/ไร่)` → same key under rawValues | `"1,000.00"` → same | string → string | M | N | เก็บผลผลิตต่อไร่ตามรายงาน โดยยังไม่เดาตัวหารพื้นที่<br>Preserve reported rate; denominator remains unresolved. |
| `ราคาที่เกษตรกรขายได้เฉลี่ย (บาท/กิโลกรัม)` → same key under rawValues | `"25"` → same | string → string | M | N | เก็บเป็นบริบทต้นทาง; V1 ยังไม่มีฟิลด์ราคา<br>Source context only; no current V1 crop price field. |

CSV source representation of a thousands value is a quoted cell such as `"54,000.00"`. A future adapter must first validate grouping, then parse `54000` kilograms and, after confirming units, convert to `54` tonnes. This is a **planned transformation**, not a capability of the existing config. Raw `""` or `" -   "` stays preserved; a reviewed numeric interpretation may become null, never automatically 0.

`rawValues` เก็บข้อความต้นฉบับโดยไม่แก้ไข รวมค่าว่างด้วย ส่วน `sourceYearBE`, `sourceMonth`, `sourceRound` เป็นค่าที่แยกมาอ้างอิง: ต้องมี key แต่รับ `null` ได้เมื่อไม่มีค่ารายงาน และพักแถวไว้ตรวจ การให้ alias เป็น null ไม่เปลี่ยนข้อความเดิมใน raw ส่วน `mappingVersion` ให้ละ key จนกว่าจะจับคู่พื้นที่แล้ว จึงต้องมีรุ่นที่ใช้จริง

`rawValues` preserves untouched source text, including empty cells. The separate `sourceYearBE`, `sourceMonth`, and `sourceRound` aliases must be present but may be null when the source provides no value; the record remains on hold. A null alias does not overwrite the original raw text. Omit `mappingVersion` until area mapping has been performed, then supply the actual mapping version.

| Proposed staging parameter | Type | M/O/C | Nullable | Sample | เงื่อนไข / Conditions |
| --- | --- | --- | --- | --- | --- |
| `rawValues` | object<string,string> | M | N | All 15 original cells | สำเนาชื่อคอลัมน์และค่าต้นฉบับที่เสนอ ยังไม่ใช่ฟิลด์ V1<br>Proposed copy of original header/value pairs; no V1 API mapping. |
| `sourceYearBE` | string | M | Y | `"2566"` or `null` | ค่าปีที่แยกมาอ้างอิง; ไม่มีค่ารายงานให้ null และพักแถวตรวจ โดยเก็บ raw เดิมไว้<br>Source-year alias; null when unreported, with the record held and raw text preserved. |
| `sourceMonth` | string | M | Y | `"1"` or `null` | ค่าเดือนที่แยกมาอ้างอิง; รับ null เมื่อไม่มีข้อมูลและไม่สร้างช่วงวันเอง<br>Source-month alias; nullable when unreported, without inventing a calendar window. |
| `sourceRound` | string | M | Y | `"0"` or `null` | รหัสรอบปลูกที่แยกมาอ้างอิง; รับ null เมื่อไม่มีข้อมูล แต่รหัส 0 ไม่ใช่ null โดยอัตโนมัติ<br>Planting-round alias; nullable when unreported, while source code 0 is not automatically missing. |
| `semanticStatus` | string | M | N | `"unresolved"` | สถานะพักข้อมูลที่เสนอ; ต้องกำหนดรายการสถานะ V2 ให้ครบภายหลัง<br>Proposed gate; complete enum still requires V2 design. |
| `blockedReasons` | array<string> | M | N | `["period meaning not confirmed","yield denominator not confirmed"]` | เหตุผลที่ต้องตรวจความหมายเพิ่มเติม ไม่ใช่รหัส error ของ V1<br>Proposed review reasons, not a V1 error-code list. |
| `periodMeaning` | string or null | M | Y | `null` | หากยังไม่ทราบให้คง null; ต้องยืนยันเดือนและยอดต่อช่วงหรือสะสม<br>Unknown remains explicit; confirm month meaning and interval/cumulative totals. |
| `yieldAreaBasis` | string | M | N | `"unspecified"` | ไม่เดาว่าหารด้วยพื้นที่ปลูกหรือเก็บเกี่ยวจากอัตราที่เห็น<br>Do not infer harvested/planted from the reported ratio. |
| `mappingVersion` | string | C | N | `"korat-crosswalk-demo-v1"` | ต้องมีรุ่นที่ใช้จริงเมื่อจับคู่พื้นที่แล้ว; หากยังไม่จับคู่ให้ละ key ไม่ส่ง null<br>Required once area mapping is performed; otherwise omit the key rather than sending null. |

ยังห้ามนำ unresolved rows เข้า feature builder, สร้างวันเก็บเกี่ยวจากเดือนอย่างเดียว, บวกรายเดือน/พันธุ์โดยไม่ตรวจ grain หรือใช้พื้นที่เสียหายทุกสาเหตุเป็น drought label

Unresolved records remain excluded from feature preparation. Do not invent harvest dates, sum months/varieties before grain is understood, or turn all-cause damaged area into a drought label.

## 8. Actual ThaiWater JSON → normalization proposal

**ไม่มี production preset / No production preset.** อิง snapshot ที่บันทึกไว้ก่อนหน้าใน [research response](../artifacts/thai-source-research/thaiwater-jjtjseqj/rain24-korat.response) ของ `rain_24h?province_code=30`; ไม่ได้เรียกต้นทางในงานเอกสารนี้ Sample ต่อไปนี้เป็น excerpt ของแถวจริงเดิม ไม่ใช่สภาพอากาศปัจจุบัน

```json
{
  "result": "OK",
  "data": [{
    "id": 309692938,
    "rain_24h": 49.6,
    "rain_1h": 0,
    "rainfall_datetime": "2026-09-08 21:00",
    "station_type": "rainfall_24h",
    "station": {
      "id": 1109546,
      "tele_station_oldcode": "ONE057",
      "tele_station_lat": 14.635938,
      "tele_station_long": 101.844635
    },
    "geocode": {"province_code": "30"}
  }]
}
```

Data types below are **observed in that snapshot**, not a provider-guaranteed schema. M/O/C describes a proposed adapter's needs. Target types/nullability describe the candidate V1 target where one exists; all mappings remain blocked until source semantics are confirmed.

| Source path → candidate target | Actual source → candidate sample | Type source → target | M/O/C | Nullable target | สิ่งที่ต้องทำก่อนใช้ / Required normalization |
| --- | --- | --- | --- | --- | --- |
| `result` → response validation | `"OK"` → proceed only if recognized | string → gate | M | — | ต้องตรวจ result ด้วย adapter เฉพาะ; generic collector ไม่ตรวจให้อัตโนมัติ<br>Generic collector does not validate result automatically; provider adapter must. |
| `data` → source rows | `[{…}]` → array | array<object> → array<object> | M | N | เลือกได้เฉพาะ array ของแถว ไม่ได้แปลงข้อมูลซ้อนชั้นข้างใน<br>`format.dataPath: "data"` reaches the array only. |
| `data[].id` → `sourceRecordId` | `309692938` → `"309692938"` | integer → string | O | N | เก็บรหัสแถวต้นทาง ไม่ใช้แทนรหัสสถานี<br>Preserve source record identity; do not substitute for station identity. |
| `data[].station.id` → candidate `stationId` | `1109546` → `"1109546"` | integer → string | C | N | ต้องตกลงรหัสสถานีหลักและแปลง object ซ้อนเป็นคอลัมน์ก่อน<br>Agree stable identifier and flatten nested field first. |
| `data[].station.tele_station_oldcode` → alternate station code | `"ONE057"` → `"ONE057"` | string → string | C | N | เป็นรหัสทางเลือก ไม่สลับใช้อัตโนมัติ และต้องเก็บประวัติการจับคู่<br>Alternative to the chosen ID, not an automatic fallback; keep mapping history. |
| `data[].rainfall_datetime` → `observedAt` | `"2026-09-08 21:00"` → blocked pending timezone | string → string(datetime) | M | N | เวลาไม่มีวินาทีและ offset จึงยังอ่านตรงไม่ได้ ต้องยืนยันเขตเวลาและความละเอียดก่อนแปลง<br>No seconds/offset; existing local parser rejects it. A new adapter may normalize only after timezone/precision meaning is confirmed. |
| `data[].rain_24h` → rainfall `value` | `49.6` → `49.6` | number → number | M for 24h feed | Y | ต้องยืนยันหน่วยและช่วงสะสม ห้ามบวก rain_1h เข้าเป็นฝนเพิ่มอีก<br>Confirm mm/window; do not combine with rain_1h as additional rainfall. |
| `data[].rain_1h` → separate rainfall `value` | `0` → `0` | number → number | C if using 1h | Y | ศูนย์เป็นค่าที่รายงานจริง ใช้สร้างแถวของช่วงสะสมที่แยกกัน<br>Zero is a real reported value, not missing; creates a distinct interval observation. |
| No explicit source field → `metric` / `unit` | Proposed `"rainfall"` / `"mm"` | configured strings → strings | M | N | ต้องตกลงนิยามตัวแปรและหน่วย ไม่เดาจากป้ายบนหน้าเว็บอย่างเดียว<br>Must be agreed product definitions, not inferred only from page labels. |
| No explicit source window → `aggregation` / `periodMinutes` | Proposed `"sum"` / `1440` or `60` | string/integer → string/integer | M | N | เป็นเพียงค่าตั้งต้นที่เสนอ ต้องยืนยันช่วงและเวลาสิ้นสุดก่อน<br>Candidate settings only; confirm exact interval and timestamp alignment first. |
| No QA field → `quality` | Reported reading → possible `"reported"` | policy-derived → string | M | N | reported หมายถึงได้รับรายงาน ไม่ใช่ผ่าน QA; ต้องกำหนดวิธีจัดการค่าว่างและคุณภาพ<br>reported means received, not QA-verified. Missing/QC handling must be documented. |
| `data[].station.tele_station_lat` / `tele_station_long` → proposed station metadata | `14.635938` / `101.844635` → preserved | number → number | C for spatial join | N when supplied | V1 ไม่มีช่องพิกัดใน observation ของสถานี ต้องแยกงานจับคู่ภูมิศาสตร์<br>No latitude/longitude fields in V1 station observation; geographic mapping is a separate operation. |
| `data[].geocode.province_code` → proposed source metadata | `"30"` → `"30"` | string → string | M for Korat filter | N | รหัสจังหวัดเพียงอย่างเดียวไม่ใช่รหัสตำบล<br>Province code alone is not a subdistrict code. |
| `data[].station_type` / `station.tele_station_type` → proposed metadata | `"rainfall_24h"` → preserved | string → string | O | N when supplied | เป็นประเภทข้อมูลจากต้นทาง ไม่ใช้แทนนิยามช่วงสะสม<br>Source classification, not a replacement for a confirmed window definition. |
| `data[].station.tele_station_name` → proposed metadata | `{"th":"ทต.ตะขบ","en":"Ta Khop"}` → preserved | object<string,string> → object | O | N when supplied | เก็บชื่อสถานีต้นทางไว้ แต่ไม่ใช้ชื่อแสดงผลอย่างเดียวเป็นตัวระบุสถานี<br>Keep source labels; do not identify stations by display name alone. |
| `data[].agency.agency_name` / `agency_shortname` → proposed metadata | `{"en":"HII",…}` for shortname → preserved | object<string,string> → object | O | N when supplied | ชื่อหน่วยงานหลายภาษาเป็นบริบทข้อมูล ไม่ใช่ตัวกำหนดสิทธิ์<br>Language labels are source context, not an authorization principal. |
| `data[].geocode.*` other than province_code → proposed raw metadata | `amphoe_name.th:"ปักธงชัย"`, `tumbon_name.th:"ตะขบ"` → preserved | nested strings/objects → same | O | Preserve source | สถานีไม่ได้กลายเป็นการวัดตรงของตำบลโดยอัตโนมัติ<br>No automatic station-to-tambon measurement equivalence. |
| `data[].basin` / `station.sub_basin_id` → proposed raw metadata | `basin_code:5`, sub-basin `"0504"` → preserved | object / string → same | O | Preserve source | เก็บบริบทลุ่มน้ำแยก ไม่ส่งเป็นฟิลด์ที่ V1 ไม่รองรับ<br>Ancillary basin context; not submitted as unknown V1 fields. |

หลังยืนยันว่า timezone เป็น +07:00 และการเติมวินาที 00 เหมาะสม ตัวอย่างข้างบนจึงอาจแปลงเป็น `2026-09-08T14:00:00.000Z` ได้ **เงื่อนไขนี้ยังไม่ยืนยัน** ข้อมูลสถานีไม่กลายเป็นการวัดตรงของทุกตำบล ต้องมีวิธี spatial join/coverage และรุ่น mapping แยกต่างหาก

Only if +07:00 and minute precision are confirmed could that timestamp become `2026-09-08T14:00:00.000Z`. This is conditional, not a production assumption. A station reading does not establish direct measurement coverage for every subdistrict.

## 9. GISTDA catalog/assets → required definition before mapping

**V2 proposed only.** พบ catalog ของ `smap`, `lst`, `ndwi`, `dri_plus` ตาม [research](THAI_AGRICULTURAL_DATA_RESEARCH.md) แต่ยังไม่ยืนยัน raw asset schema/rights/processing definition ครบ Source paths ด้านล่างจึงเป็นรายการข้อมูลที่ต้องขอ ไม่ใช่ชื่อ property ของ API ที่ตรวจแล้ว

No numerical GISTDA asset was mapped by the current collector. Proposed M/O/C describes readiness requirements, not the provider's published schema. Samples prefixed **demo** are hypothetical, not observed metadata. This section does not add a V1 raw-raster payload.

| Source information → proposed target | Sample → normalized intent | Type source → proposed target | M/O/C | Nullable target | เงื่อนไข / Conditions |
| --- | --- | --- | --- | --- | --- |
| Collection/product identity → product definition | Observed catalog label `ndwi` → reviewed definition pending | string → string | M | N | ต้องรักษานิยามดัชนีที่ต่างกัน; ตัวแปรที่ V1 ไม่รองรับยังต้องพักไว้<br>NDWI ≠ NDMI; DRI+ ≠ NDVI or web risk code. Unsupported V1 metric must stay blocked. |
| Product release/revision → productVersion | **demo** `"v1"` → same | string → string | M | N | ต้องระบุรุ่นผลิตภัณฑ์ค่าจริง ไม่ใช่แค่ชื่อชั้นแสดงผล<br>Must identify the numerical product version, not only a display layer. |
| Numerical asset reference/type → raw artifact source | **demo** `"https://source.example/data.tif"` → verified asset | string → string | M | N | ยืนยันสิทธิ์ดาวน์โหลดและไฟล์ค่าพิกเซล ภาพสีบนแผนที่ยังไม่ใช่ค่าพร้อมใช้กับโมเดล<br>Confirm download permission and numerical raster; WMS/WMTS/TMS colours are not verified model values. |
| Band + formula → productDefinitionId metadata | **demo** `"ndvi"` + reviewed formula | string/object → reviewed definition | M | N | ยังไม่ทราบชนิดและตำแหน่งฟิลด์จริง ต้องยืนยันความหมาย band ก่อนเลือก metric<br>Exact provider types/paths TBD; validate band meaning before choosing metric. |
| Scale → physical conversion | **demo** `0.0001` with raw `6200` → `0.62` before offset | number → number | C for encoded values | N | ตัวเลขเป็นตัวอย่างสมมติ ไม่ใช่ scale ของ GISTDA และ collector ยังไม่แปลง scale<br>No generic collector scale transform; numerical example only, not GISTDA's scale. |
| Offset → physical conversion | **demo** `0` → add after scaling | number → number | C for encoded values | N | ใช้สูตรค่าจริง = ค่าดิบ × scale + offset หลังยืนยันนิยามแล้วเท่านั้น<br>physical = raw × scale + offset, only with confirmed definition. |
| Nodata/missing definition → null + quality | **demo** `-9999` → `null` | number/string → null | M | Y for value | ห้ามใช้รหัส nodata เป็นค่าตรวจวัด ต้องทราบรหัสแทนไม่มีข้อมูลที่แน่นอน<br>Do not count a nodata marker as measurement; exact sentinel definition required. |
| QA band/flags → quality policy | **demo** cloud flag → excluded pixel | number/object → policy result | M | N for policy | ต้องมีนโยบายคุณภาพ แม้ต้องระบุว่าต้นทางไม่มี QA; ไม่สร้างหลักฐาน QA ขึ้นเอง<br>Required quality policy may explicitly document absence of source QA; do not invent QA evidence. |
| CRS/projection + transform → geospatial alignment | **demo** `"EPSG:4326"` → registered CRS | string/object → metadata | M | N | ใช้จัดภาพให้ตรงขอบเขตตำบล งานนี้ยังไม่อยู่ใน collector CSV/JSON<br>Needed to align pixels with the canonical tambon geometries; not implemented by CSV/JSON collector. |
| Native observation/composite window → normalized window | **demo** 7-day interval → retained interval | string dates/object → interval | M | N | ต้องทราบปฏิทิน เขตเวลา และวิธีจัดการช่วงซ้อน; ยอดเลื่อนหน้าต่างไม่ใช่ยอดรายเดือนอัตโนมัติ<br>Need timezone/calendar and overlap method; a rolling total is not automatically a monthly total. |
| Unit → `unit` | **demo** `"m3/m3"` → same after conversion | string → string | M | N | ตัวแปรและหน่วยความชื้นดินต้องตรงกัน ไม่เปลี่ยนเป็นเปอร์เซ็นต์โดยไม่ระบุ<br>Soil-moisture metric/unit definition must match; not silently percent. |
| Grid spacing → resolution/gridSpacing metadata | **demo** `250` → `250` metres | number → number | M | N | รายละเอียดกริดที่ขยายใหม่ไม่ใช่รายละเอียดของการวัดต้นฉบับ<br>Resampled grid detail is not original measurement support. |
| Native measurement support → nativeSupportMeters | **demo** `1000` → `1000` metres | number → number | C before a support claim | N when supplied | ต้องอ่านขนาดพื้นที่ตรวจวัดจากนิยามผลิตภัณฑ์ ไม่เดาจากกริด; V1 ละฟิลด์นี้ได้<br>Obtain from product definition; do not infer from grid spacing. V1 field is optional. |
| Boundary dataset → geometryVersion | **demo** `"korat-289-demo-v1"` → same | string → string | M for extraction | N | อ้างอิงขอบเขตตำบลมาตรฐานทั้ง 289 ตำบล<br>Canonical 289-tambon geometry reference. |
| Crop mask/year/season → maskVersion and denominator | **demo** `"cropland-demo-2026-v1"` → reviewed mask | string/object → metadata | C when mask used | N when supplied | ต้องระบุพื้นที่ที่เลือกและพื้นที่ฐาน; maskVersion ของ V1 ไม่ได้เก็บนโยบายทั้งหมด<br>Define selected area and denominator; V1 maskVersion alone does not encode the full policy. |
| Valid spatial/temporal coverage → coverage fields | **demo** `0.83` / `0.91` → fractions | number → number | M for feature QA | N | สัดส่วน 0–1 ต้องมีฐานชัดเจน; ความครอบคลุมเวลาเป็นฟิลด์ V2<br>Fractions 0–1 with explicit denominator; temporalCoverageFraction is V2, not a V1 satellite key. |
| Extraction/aggregation method → processingVersion | **demo** `"satellite-monthly-demo-v1"` → same | string → string | M | N | ระบุรุ่นวิธีตรวจคุณภาพ จัดการช่วงซ้อน แปลงหน่วย และรวมเชิงพื้นที่/เวลา<br>Record QA, overlap handling, unit conversion, spatial weighting and temporal aggregation version. |

## 10. ตรวจตัวอย่างและขอบเขต coverage / Verification and coverage

ตรวจจากโค้ด [collector](../server/model-inputs/collector.mjs), [envelope/station contract](../server/model-inputs/contract.mjs), [satellite/crop contract](../server/model-inputs/domain-contract.mjs), และ [HTTP handler](../server/model-inputs/handler.mjs) หากโค้ดกับตัวอย่างขัดกันให้แก้เอกสาร ไม่เปลี่ยน runtime เพื่อให้ตรงตัวอย่าง

Original mapping verification: 2026-09-09. The fixture checks below predate the
NFR controls appended in sections 11–13. Updating this guide alone does not
authorize a provider connection, migration or production operation. NFR runtime
regression evidence is recorded separately in [the NFR register](NON_FUNCTIONAL_REQUIREMENTS.md).

| Config file | Validation performed | ผลการตรวจ<br>Result |
| --- | --- | --- |
| `local-csv.config.json` | Config + actual local fixture through collectBatch | ข้อมูลสถานี 4 แถว<br>4 station observations |
| `local-json.config.json` | Config + actual local fixture through collectBatch | ข้อมูล 4 แถวและ batchId ตรงกับ CSV<br>Same 4 observations and batchId as CSV |
| `satellite-features.config.json` | Config + actual local fixture through collectBatch | ข้อมูลดาวเทียม 3 แถว<br>3 satellite observations |
| `doae-crop-yield.config.json` | Config + actual local fixture through collectBatch | ข้อมูลพืชที่เตรียมแล้วแบบจำลอง 1 แถว<br>1 synthetic prepared crop observation |
| `http-json.config.json` | Config validation only | config ถูกต้อง ไม่ได้เรียก HTTP<br>Valid; no HTTP request made |

Replay an offline example without sending it:

```bash
node scripts/collect-model-inputs.mjs --config examples/model-inputs/local-csv.config.json
node scripts/collect-model-inputs.mjs --config examples/model-inputs/satellite-features.config.json
node scripts/collect-model-inputs.mjs --config examples/model-inputs/doae-crop-yield.config.json
```

`--file PATH` overrides the source file from the current working directory. `--output PATH` creates a new file without overwriting; it does not submit. Only adding `--submit URL` sends a batch, using `MODEL_INPUT_API_TOKEN` or the variable named by `--token-env`. These are CLI arguments, not JSON config keys.

Coverage: section 2 covers every allowed collector config key, including nested header env references, boolean HTTP opt-in, nullable defaults, quality maps, and typed field/constant maps. Sections 3–5 cover every accepted observation key, including optional provenance. Section 6 covers request envelopes, receipts, list/single reads, and error fields. Sections 7–9 isolate provider-specific proposals from implemented mappings.

<a id="nfr-controls"></a>
## 11. NFR Environment and Identity Parameters — Implemented, Activation Required

Environment and CLI values are **strings on input**, even when they represent
booleans or integers. JSON objects/policies use actual JSON types. None of these
settings becomes an observation field. Samples are deliberately fictional;
never put operational secrets or login passwords in this guide or source control.
`C` in this section describes the activation condition, not a claim that the
environment is already configured. All environment variables reject/avoid
explicit JSON null; an omitted/empty optional flag takes its documented default.

| Parameter | Input type → interpreted type | M/C/O | Nullable | Sample / Default | Business meaning / Conditions — TH / EN |
| --- | --- | --- | --- | --- | --- |
| `MODEL_INPUT_SOURCE_ID` | string → string | M for input API | N | `"korat-model-team"` | ขอบเขตแหล่งข้อมูลหนึ่งแหล่งต่อ deployment / One configured source; lowercase ID, 1–64 characters. |
| `MODEL_INPUT_API_TOKEN` | string → secret string | C | N | `"example-ingest-key-0000000000000000"` | บังคับหากไม่ตั้ง clients; คีย์เขียนเดิมชื่อ legacy-writer / Required without explicit clients; legacy writer identity. |
| `MODEL_INPUT_READ_TOKEN` | string → secret string | O | N | `"example-reader-key-1111111111111111"` | คีย์อ่านเดิม legacy-reader ต้องไม่ซ้ำ writer / Optional distinct legacy reader key. |
| `MODEL_INPUT_CLIENTS_JSON` | string(JSON) → array<object> | O | N | `"[{\"id\":\"weather-feed\",\"role\":\"writer\",\"sourceId\":\"korat-model-team\",\"tokens\":[\"example-feed-key-2222222222222222\"]}]"` | คู่เชื่อมต่อแบบมีชื่อ ใช้ร่วมกับหรือแทนคีย์เดิมได้ / Named clients may coexist with or replace legacy variables; max 32 clients / 32 KiB text. |
| `MODEL_INPUT_RATE_LIMIT_PER_MINUTE` | string(integer) → integer | O | N | `"60"` (default) | จำนวนคำขอที่ยืนยันตัวตนแล้วต่อนาที UTC / Per-identity fixed-minute limit, 1–60000. |
| `MODEL_INPUT_DAILY_QUOTA` | string(integer) → integer | O | N | `"10000"` (default) | จำนวนคำขอรวมต่อวัน UTC / Per-identity daily allowance, 1–10000000. |
| `MODEL_INPUT_SUPABASE_URL` | string → HTTPS origin | C for deployed API | N | `"https://example.supabase.co"` | ฐานข้อมูลรับ input และนับ quota / Durable input/quota database; origin only, no path/query/userinfo. |
| `MODEL_INPUT_SUPABASE_SECRET_KEY` | string → secret string | C for deployed API | N | `"example-server-secret-333333333333"` | คีย์ฝั่ง server เท่านั้น ใช้ migrations ที่เตรียมไว้ / Server-only database key; requires prepared migrations. |
| `VITE_OPERATIONAL_TELEMETRY_ENABLED` | string(boolean) → boolean | O | N | `"false"` (default) | เปิดตัวส่งเหตุการณ์ใน build เมื่อเป็นข้อความ true เท่านั้น / Only exact `true` enables browser reporting; not a secret. |
| `OPERATIONAL_TELEMETRY_ENABLED` | string(boolean) → boolean | O | N | `"false"` (default) | เปิด endpoint รับ log เมื่อเป็น true เท่านั้น / Server collection opt-in; disabled POST returns silent 204. |
| `OPERATIONAL_TELEMETRY_ORIGINS` | string(CSV origins) → array<string> | C when telemetry enabled | N | `"https://korattanphai.vercel.app"` | รายการ origin ที่เชื่อถือคั่น comma ไม่มี slashท้าย/path / Exact origins; HTTPS, or loopback HTTP for local checks. |
| `OPERATIONAL_SUPABASE_URL` | string → HTTPS origin | C for readiness/telemetry | N | `"https://example.supabase.co"` | ฐานข้อมูล metadata readiness และ quota / Server database for published metadata and durable telemetry quota. |
| `OPERATIONAL_SUPABASE_SECRET_KEY` | string → secret string | C for readiness/telemetry | N | `"example-operations-secret-4444444444"` | คีย์ server ห้ามใส่ VITE หรือ browser / Server-only key; never expose in Vite/browser variables. |
| `OPERATIONAL_HEALTH_TOKEN` | string → secret string | C for readiness | N | `"example-health-token-5555555555555555"` | คีย์ตรวจ dependency แยกจาก login; อย่างน้อย 32 ตัวอักษร / Separate readiness bearer credential; ≥32 characters, no CR/LF. |
| `OPERATIONAL_MONITOR_URL` | string → URL origin | O | N | `"https://korattanphai.vercel.app"` (default) | รับproductionoriginนี้แบบตรงตัวหรือlocalhost ไม่มีpreviewwildcard / Exact production origin or localhost only; preview wildcard is rejected. |
| `OPERATIONAL_CHECK_READINESS` | string(boolean) → boolean | O | N | `"false"` (default) | เพิ่ม private archive probe เมื่อ true / Enables authenticated archive probe; separate from public web/API checks. |
| Repository variable `OPERATIONAL_MONITOR_ENABLED` | string(boolean) → boolean | O | N | `"false"` (default) | อนุญาต workflow monitor; ตั้ง true หลังผูกผู้รับเหตุแล้ว / Opt-in scheduled monitor; exact workflow conditions apply. |

`MODEL_INPUT_*` quotas count authenticated retries and rejected payloads too.
Read/list/export traffic also consumes quota; budget backup reader traffic and
follow `Retry-After`. Server telemetry uses its own shared constants of
1,000/minute and 50,000/day; there are no editable telemetry limit environment
keys in this implementation. Settings are capacity guardrails, not performance
or cost guarantees. The local development limiter is process-local; deployed
entrypoints always use durable quota storage.

คีย์ Supabase แบบ `sb_secret_...` ใช้ใน header `apikey` เท่านั้น ส่วน legacy
service-role JWT ใช้ทั้ง `apikey` และ `Authorization: Bearer` ตัวเชื่อม storage
และ quota รองรับทั้งสองแบบ ห้ามนำคีย์เหล่านี้ให้ browser หรือคู่เชื่อมต่อภายนอก

Storage and quota adapters support opaque Supabase secret keys via `apikey`
only, and legacy service-role JWTs via both `apikey` and Bearer authorization.
These server keys are separate from client integration tokens and user login.

### 11.1 Parsed client identity object

| JSON field | Type | M/C/O | Nullable | Sample | Business meaning / Validation — TH / EN |
| --- | --- | --- | --- | --- | --- |
| `clients[]` | object | M for each client | N | `{"id":"weather-feed","role":"writer","sourceId":"korat-model-team","tokens":["example-feed-key-2222222222222222"]}` | หนึ่งคู่เชื่อมต่อพร้อมสิทธิ์ / One integration principal; unknown fields rejected. |
| `clients[].id` | string | M | N | `"weather-feed"` | ชื่อคงที่ที่ใช้ log และ quota ห้ามซ้ำ / Stable unique ID; lowercase 1–64 characters; not a person/email. |
| `clients[].role` | string | M | N | `"reader"` | reader อ่านได้; writer อ่านและส่งได้ / Exactly reader or writer. |
| `clients[].sourceId` | string | M | N | `"korat-model-team"` | ต้องตรง source ของ deployment / Must equal MODEL_INPUT_SOURCE_ID; V1 does not enable multi-source listing. |
| `clients[].tokens` | array<string> | M | N | `["example-current-key-66666666666666","example-previous-key-7777777777777"]` | หนึ่งคีย์หรือสองคีย์ระหว่างหมุนเปลี่ยน / One or two keys; both share the same identity/quota. |
| `clients[].tokens[]` | string | M for each slot | N | `"example-current-key-66666666666666"` | คีย์แข็งแรงอย่างน้อย 32 ตัวอักษร ห้ามซ้ำทุก identity / Token regex/length follows API; duplicate keys are rejected globally. |

Rotation changes server configuration: keep client `id`, add the new key, move
the caller, then remove the previous key and deploy. Cached warm configuration
does not change simply because a local file was edited. API response headers,
health and telemetry wire fields are typed in [API.md](API.md#operational-endpoints).

## 12. Freshness Policy and Result Mapping — Local Job Wrapper

These fields are local operational metadata, **not additions to V1 POST bodies**.
The report does not automatically block a submission or update the dashboard.
`fresh` describes time only; it is not a scientific QA pass or hazard rating.

| Policy field | Type | M/C/O | Nullable | Sample / Default | Business meaning / Conditions — TH / EN |
| --- | --- | --- | --- | --- | --- |
| `schemaVersion` | integer | M | N | `1` | รุ่น policy / Exactly 1. |
| `mode` | string | M | N | `"operational"`; alternate `"historical"` | แยกข้อมูลใช้ปัจจุบันจากข้อมูลย้อนหลัง / Operational versus intentionally historical input. |
| `maxObservationAgeSeconds` | integer | O | N | `10800` | อายุสิ้นสุดช่วงตรวจวัดที่ยอมรับได้ ตัวอย่าง 3 ชั่วโมงยังไม่ใช่ SLAต้นทาง / Owner-approved operational threshold; example only, 1–316224000; forbidden in historical mode. |
| `maxFetchAgeSeconds` | integer | O | N | `3600` | อายุรอบดึงข้อมูลที่ยอมรับได้; ละแล้ว unknown / Fetch-age threshold; same integer bounds; omission yields unknown. |

Omitting `--policy` uses `{"schemaVersion":1,"mode":"operational"}` with no
thresholds: timing is `unknown`. Satellite V1 `period` maps to the exclusive
UTC start of the following month; crop `periodEnd` maps to the next UTC day;
station `observedAt` remains the measurement/aggregation end. These boundaries
do not invent provider publication time or turnaround time.

| Source → freshness result field | Type | M/C/O | Nullable | Sample | Business meaning / Conditions — TH / EN |
| --- | --- | --- | --- | --- | --- |
| Job clock → `checkedAt` | string(datetime) | M | N | `"2026-09-09T06:00:00.000Z"` | เวลาที่ประเมิน / Time of this evaluation. |
| Policy → `mode` | string | M | N | `"historical"` | บอกเจตนาการใช้ข้อมูล / Retained policy mode. |
| All observation ends + policy → `observationStatus` | string | M | N | `"partial_stale"` | fresh/stale/partial_stale/unknown/future_timestamp/historical; ไม่ใช่ระดับภัย / Timeliness enum, not hazard severity. |
| Fetch clock + policy → `fetchStatus` | string | M | N | `"unknown"` | fresh/stale/unknown/future_timestamp; แยกจากเวลาที่วัด / Fetch age, independent of observation time. |
| Earliest record end → `oldestObservationEndAt` | string(datetime) | M | N | `"2026-09-09T00:00:00.000Z"` | สิ้นสุดช่วงเก่าสุดใน batch / Oldest interval end in the batch. |
| Latest record end → `latestObservationEndAt` | string(datetime) | M | N | `"2026-09-09T05:00:00.000Z"` | สิ้นสุดช่วงล่าสุด ไม่ได้แทนทุกแถว / Latest interval end; not proof that every row is fresh. |
| Frozen input → `fetchedAt` | string(datetime) | M | N | `"2026-09-09T05:05:00.000Z"` | เวลาดึง batch สำเร็จ / Successful collection time. |
| Trusted receipt → `receivedAt` | string(datetime) or null | M | Y | `"2026-09-09T05:05:01.000Z"`; before receipt `null` | เวลาreceiverรับจริงหลังตรวจreceipt; ก่อนสำเร็จยังnull / Verified receipt time on completed jobs; null before a receipt is available. |
| Latest end → `observationAgeSeconds` | number | M | N | `3600` | อายุจากแถวล่าสุด อาจติดลบเมื่อเวลาอยู่อนาคต / Latest-end age; negative for a future boundary. |
| Fetch time → `fetchAgeSeconds` | number | M | N | `3300` | อายุรอบดึงข้อมูล อาจติดลบ / Fetch age; may be negative for a future timestamp. |
| Per-row threshold → `staleObservationCount` | integer or null | M | Y | `2` | จำนวนแถวเกินอายุ; null เมื่อไม่มีเกณฑ์หรือ historical / Stale rows; null without a live threshold or in historical mode. |
| Per-row clock → `futureObservationCount` | integer | M | N | `0` | จำนวนสิ้นสุดช่วงที่อยู่อนาคต / Records whose end is after the check clock. |
| Input quality → `qualityCounts` | object<string,integer> | M | N | `{"reported":3,"missing":1}` | นับตามคุณภาพเดิม ไม่แปลงreportedเป็นผ่านQA / Counts preserve original quality semantics. |
| Input quality → `qualityCounts.<quality>` | integer | C | N | `3` | มี key เมื่อพบ quality นั้น / Present for each encountered quality value; count ≥1. |
| Kind semantics → `note` | string | M | N | `"observedAt is the station observation/aggregation end; receipt is not observation time."` | คำอธิบายวิธีตีความเวลา / Human-readable timing note, not source-provided metadata. |

## 13. Operational CLI and Recovery Report Mapping

CLI argument types, examples and conditions are maintained in the
[NFR runbook](NFR_OPERATIONS_RUNBOOK.md#typed-cli-parameters). These are separate
from source CSV/JSON configs. A `--resume` flag for jobs is a **run-ID string**;
the restore CLI's `--resume true` is a **string-encoded boolean**. Do not swap them.

| Output field | Type | M/C/O | Nullable | Sample | Business meaning / Conditions — TH / EN |
| --- | --- | --- | --- | --- | --- |
| Job `runId` | string | M | N | `"20260909T060000000Z-e9a2cc02-6f2f-4c57-a97a-9d7a33c5b421"` | รหัสรอบงานไว้ค้นประวัติและresume / Immutable run identity for history/replay. |
| Job `schemaVersion` | integer | C | N | `1` | มีในผลcompletedและmanifest / Present in completed results and the manifest. |
| Job `state` | string | M | N | `"submitted"` | submitted/collection_failed/submission_failed/submission_deferred; submittedต้องมีreceiptที่ตรวจแล้ว / Submitted requires a verified receipt; deferred retains the frozen batch. |
| Job `sourceId` | string | M | N | `"korat-model-team"` | แหล่งข้อมูลของรอบนี้ / Source identity. |
| Job `batchId` | string | C | N | `"batch-demo-01"` | มีหลังดึงและตรึง batch แล้ว / Present after successful collection/freeze. |
| Job `contentHash` | string | C | N | `"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"` | SHA-256ของbatchเมื่อสำเร็จ; ตัวอย่างไม่ใช่hashจริง / Completed input checksum; illustrative digest. |
| Job `observationCount` | integer | C | N | `4` | จำนวนแถวเมื่อสำเร็จ / Observation count on completed submission. |
| Job `completedAt` | string(datetime) | C | N | `"2026-09-09T06:00:02.000Z"` | เวลายืนยันสำเร็จ ไม่ใช่เวลาที่วัด / Job completion time, not observation time. |
| Job `duplicate` | boolean | C | N | `false` | trueเมื่อใช้receiptของbatchเดิม / True when an identical existing batch was acknowledged. |
| Job `attempts` | integer | C | N | `2` | ลำดับattemptสะสมเมื่อสำเร็จ / Cumulative attempt number on completion. |
| Job `alreadyComplete` | boolean | O | N | `true` | มีเมื่อresumeรอบที่เสร็จแล้ว / Present when returning an already completed run. |
| Job `code` | string | C | N | `"submission_http_503"` | รหัสปลอดภัยเมื่อส่งไม่สำเร็จ / Safe submission failure code. |
| Job `retryNotBeforeAt` | string(datetime) | C | N | `"2026-09-09T06:01:00.000Z"` | บังคับผลdeferred ห้ามส่งใหม่ก่อนเวลานี้ / Required on deferred results; resume must not contact the receiver before this time. |
| Job `freshness` | object | C | N | `{"observationStatus":"unknown"}` (excerpt) | รายงานตามตาราง12หลังมีbatch / Full section-12 report after a batch is frozen. |
| Backup/restore `archiveHash` | string | M | N | `"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"` | checksumคลัง export; ตัวอย่างสมมติ / Archive checksum; illustrative digest. |
| Backup/restore `sourceId` | string | M | N | `"korat-model-team"` | ครอบคลุมหนึ่งsource / Single source covered. |
| Backup/restore `batchCount` | integer | M | N | `25` | จำนวนbatchในคลัง ไม่เกิน500 / Number of exported batches, at most 500. |
| Backup `observationCount` | integer | M | N | `100` | จำนวนobservationทั้งหมด / Total observation count. |
| Backup `captureStartedAt` | string(datetime) | M | N | `"2026-09-09T06:00:00.000Z"` | เริ่มอ่านsnapshotผ่านAPI / Start of API export capture. |
| Backup `captureCompletedAt` | string(datetime) | M | N | `"2026-09-09T06:00:30.000Z"` | จบcapture ไม่ใช่เวลาวัดล่าสุด / End of capture, not latest source observation. |
| Backup/restore `coverage` | string | M | N | `"Source-scoped normalized batches only."` (abbreviated) | อธิบายขอบเขตที่กู้ได้ ไม่ใช่ทั้งSupabase / Coverage explanation; not a full Supabase backup. |
| Restore `recoveryPointAt` | string(datetime) | M | N | `"2026-09-09T06:00:30.000Z"` | เวลาจบexportที่ใช้กู้ / Capture completion of the selected archive. |
| Restore `recoveryPointAgeSeconds` | number | M | N | `3600` | อายุexport ไม่ใช่data lossที่วัดแล้ว / Time since export, not measured data loss. |
| Restore `actualProductionDataLossSeconds` | null | M | Y | `null` | เครื่องมือนี้ไม่ทราบdata lossจริง / Actual production loss is not measured by this tool. |
| Restore `state` | string | M | N | `"verified"` or `"restored"` | ตรวจอย่างเดียวหรือกู้localสำเร็จ / Verify-only or completed local restore. |
| Restore `verificationSeconds` | number | C | N | `0.12` | มีเมื่อverify-only / Measured verification duration for verify-only mode. |
| Restore `verifiedBatchCount` | integer | C | N | `25` | จำนวนbatchที่เขียนแล้วตรวจซ้ำสำเร็จ / Batches verified after local restoration. |
| Restore `replayedBatchCount` | integer | C | N | `3` | ไฟล์ที่มีอยู่และตรงกันระหว่างresume / Exact existing batches reused during resume. |
| Restore `completedAt` | string(datetime) | C | N | `"2026-09-09T07:00:31.000Z"` | เวลาจบการกู้local / Local restore completion time. |
| Restore `measuredRestoreSeconds` | number | C | N | `1.24` | เวลาที่วัดในlocaldrill ไม่ใช่RTOproduction / Measured local duration, not a production RTO guarantee. |
| Restore `metricNote` | string | C | N | `"Recovery-point age is time since export, not measured data loss; restore duration is a local drill, not a production RTO guarantee."` | ข้อจำกัดการตีความตัวเลข / Required interpretation note on restore results. |

Internal manifest/pending/attempt files retain the canonical input, endpoint
hash and policy for replay; they are private operator artifacts, not public API
requests. They do not retain raw upstream CSV/raster files. Keep original source
artifacts, provider revision/rights and extraction definitions separately under
the source agreement and proposed V2 artifact contract.

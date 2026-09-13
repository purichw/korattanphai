# เทียบความสามารถ Korat Tan Phai กับ Agri-Map

วันที่ศึกษา: 13 กันยายน 2569 (2026-09-13)

## อัปเดตหลังรับคำสั่งพัฒนา

ตารางเปรียบเทียบด้านล่างเป็นหลักฐานก่อนเริ่มพัฒนาที่ HEAD `8501e40` ไม่ใช่
สถานะล่าสุดของ working tree หลังจากนั้นผู้ใช้อนุมัติงานเฉพาะนครราชสีมา:
ค้นหาอำเภอ/ตำบล, ค้นพิกัด WGS84 พร้อมหมุดชั่วคราว, ส่งออกแผนที่ PNG/PDF,
ตาราง T+1-6 บนเว็บ, กราฟอำเภอ, เปรียบเทียบรอบโดยจับคู่เดือนพยากรณ์เดียวกัน,
ตัวกรองรูปแบบความเสี่ยง และเล่นลำดับ T+1-6 ได้เพิ่มใน shared components แล้ว
ดูขอบเขต ข้อจำกัด และหลักฐานทดสอบที่ [FORECAST_MAP_TOOLS.md](FORECAST_MAP_TOOLS.md)

เผยแพร่ชุดนี้แล้วเมื่อ 14 กันยายน 2569 ที่ [เว็บหลัก](https://korattanphai.vercel.app)
ด้วย runtime `e72fc20` และตรวจหลัง deploy ผ่านทั้ง desktop/mobile ตามหลักฐาน
ในเอกสารข้างต้น ไม่เพิ่มข้อมูลพยากรณ์หรือขยายไปจังหวัดอื่น
ช่องว่างเรื่อง geocoding สถานที่ทั่วไป, UTM, GPS,
layer เกษตรหลายประเภท, หมุดหลายจุด และเกษตรกรรมทดแทนยังคงเดิม

## ขอบเขตและหลักฐานก่อนพัฒนา

- ฝั่ง Korat: อ่านโค้ดปัจจุบันใน branch `fix/nr-map-zoom-performance`, HEAD
  `8501e40` และตรวจว่าฟีเจอร์ถูกเรียกจากเส้นทางใช้งานจริงหรือเป็นโค้ดต้นแบบที่เก็บไว้
- ฝั่ง Agri-Map: ชุด `Agri_Map_Codex_Handoff` ที่ผู้ใช้ให้ ประกอบด้วย README,
  SPEC, FEATURES JSON, HANDOFF QA, START PROMPT, คู่มือ PDF 30 หน้า และภาพอ้างอิง 7 ภาพ
- คู่มือ Agri-Map R2.1.25 ปรับปรุง 19 สิงหาคม 2565 ไม่ใช่หลักฐานสถานะเว็บปัจจุบัน
- เปรียบเทียบความสามารถ ไม่ใช่การตรวจภาพให้เหมือนกัน ไม่ได้ทดสอบ production,
  API ภายนอก หรือรันชุดทดสอบทั้งหมดในรอบนี้
- ข้อเสนอทางวิศวกรรมและประเด็นที่ยังไม่ยืนยันใน handoff ไม่ถูกนับเป็นฟีเจอร์จริง
  และ HANDOFF_QA เป็นการตรวจเอกสาร ไม่ใช่ผลทดสอบแอป

ตำแหน่งชุดอ้างอิงที่อ่าน: `/Users/point/Downloads/Agri_Map_Codex_Handoff/`.
เลขหน้าในตารางเป็น physical PDF page ไม่ใช่เลขหน้าที่พิมพ์ท้ายกระดาษ

## ข้อสรุป

**Korat เน้นพยากรณ์ภัยแล้งตามเวลาและรายงานเจ้าหน้าที่ ส่วน Agri-Map ในคู่มือ
เน้น GIS เกษตรหลายชั้นข้อมูลและการวิเคราะห์ทางเลือกการใช้พื้นที่** จึงไม่ใช่
ระบบทดแทนกันโดยตรง และไม่ควรใช้จำนวนฟีเจอร์เป็นคะแนนความพร้อมใช้งาน

### สิ่งที่ Korat มีเพิ่มจากขอบเขตที่คู่มือกล่าวถึง

| ความสามารถ | สิ่งที่มีใน Korat | หลักฐาน |
| --- | --- | --- |
| คลังพยากรณ์หลายรอบ | เลือกเดือนตั้งต้น T และล่วงหน้า 1-6 เดือน, 127 รอบตั้งแต่ มิ.ย. 2558 ถึง ธ.ค. 2568; แยกเดือนตั้งต้นกับเดือนที่พยากรณ์ | K2, K4 |
| วิเคราะห์ความเสี่ยงตามเวลา | กราฟ 6 เดือนแบบเปอร์เซ็นต์/จำนวนตำบล พร้อมความครอบคลุม; จังหวัดและอำเภอใช้ร่วมกัน ตำบลไม่แสดงกราฟรวมประชากรตำบล | K2 |
| Excel สำหรับทำงานต่อ | ตารางอำเภอ/ตำบล T+1-6, สถิติรายเดือน, dropdown วิเคราะห์, สูตร, native chart และ PivotTable | K5 |
| เทียบพยากรณ์ต่างรอบ | ใน Excel จับคู่ตำบลและเดือนปลายทางเดียวกัน เช่น ธ.ค. T+1 กับ พ.ย. T+2; ไม่เทียบ T+ เท่ากันทั้งที่คนละเดือน | K5 |
| ข้อมูลสำหรับระบบอื่น | ชีตค่าตัวเลขและสถานะแยกกัน, รหัสพื้นที่, เดือนแบบ Gregorian, พจนานุกรมไทย/อังกฤษ, lineage และรุ่นข้อมูล | K5 |
| พื้นที่ติดตามและตัวกรองส่วนตัว | บันทึกในบัญชี Supabase และเปิดคืนพื้นที่/เดือน/T+/ความเสี่ยง/ชลประทาน; ต่างจากการส่งไฟล์ .agm ระหว่างเครื่อง | K6 |
| ตรวจรุ่นข้อมูลก่อนใช้ cache/export | ตรวจ publication จาก Supabase; หน้าเปิดอยู่ revalidate และการส่งออกปฏิเสธข้อมูลที่ตรวจรุ่นไม่สำเร็จ | K4, K5 |
| การใช้งานจอเล็ก | มี responsive layout, เมนูมือถือ, touch map preview, dropdown/dialog และแผนภูมิแบบมือถือในโค้ด | K1, K2, K3, K8 |

คำว่า “มีเพิ่ม” หมายถึงไม่พบความสามารถนั้นในคู่มือที่ให้ ไม่ใช่การยืนยันว่า
Agri-Map รุ่นปัจจุบันไม่มี หรือว่า Korat มีประสิทธิภาพ/ความปลอดภัยเหนือกว่า
คู่มือเดิมระบุคอมพิวเตอร์/แท็บเล็ตขั้นต่ำ 1027x768 จึงยังใช้ตัดสินคุณภาพมือถือ
ของ Agri-Map ปัจจุบันไม่ได้

### สิ่งที่ยังขาดเมื่อเทียบกับงานในคู่มือ

| หมวด | ช่องว่างใน Korat | ลักษณะงานที่ต้องมีเพิ่ม |
| --- | --- | --- |
| ขอบเขตภูมิศาสตร์ | ใช้งานจริงเฉพาะนครราชสีมา ไม่ใช่ทุกจังหวัด/ลุ่มน้ำ | ข้อมูลและขอบเขตพื้นที่ที่อนุมัติ ไม่ใช่เพียงเพิ่ม dropdown |
| ชั้นข้อมูลเกษตรหลายประเภท | ไม่มี active catalog สำหรับดิน/ความเหมาะสม/การใช้ที่ดิน/ป่า/โรงงาน/ผู้รับซื้อ/เกษตรกร ฯลฯ | ข้อมูลจริงพร้อมปีอ้างอิง หน่วยงาน geometry และ legend |
| จัดการ layer | ไม่มี tree หลายชั้นพร้อม checkbox, eye, hidden-but-selected และลำดับเปิดชั้นข้อมูล | ตัวจัดการ selection/visibility/order แยกกัน |
| เกษตรกรรมทดแทน | ไม่มีเลือกพืชปัจจุบันและพืช/กิจกรรมทดแทนหรือผล suitability/พื้นที่/เศรษฐศาสตร์ | สูตรและข้อมูลที่ยืนยันแล้ว; ไม่อนุมานจากสีความเสี่ยงภัยแล้ง |
| ค้นหาตำแหน่ง | ไม่มีค้นหาชื่อสถานที่แบบ geocoding, lat/lon หรือ UTM | บริการค้นหาและ CRS ที่ชัดเจน; dropdown พื้นที่ไม่ใช่ geocoder |
| แผนที่ฐาน/ภาคสนาม | ไม่มีสลับถนน/ภูมิประเทศ/ดาวเทียม, GPS ผู้ใช้ หรือ Street View | map provider/สิทธิ์ใช้ข้อมูล/permission และ failure states |
| หมุดจุดสนใจ | ไม่มีปักหมุดอิสระกดค้าง 2 วินาที, หลายหมุด หรือ identify หลาย layer ณ พิกัด | ข้อมูล ณ จุดและการจัดการหมุด; คลิกตำบลเป็นคนละความสามารถ |
| BI หลายหัวข้อ | มีเฉพาะสรุป forecast; ไม่มี information pane ที่เปลี่ยนกราฟ/ตารางตาม layer เกษตรทั่วไป | statistics และ metadata แยกตามหัวข้อ/พื้นที่/หน่วย |
| ไฟล์ GIS/ภาพแผนที่ | ไม่มี .agm import/export หรือ export แผนที่ PDF/PNG; ไม่มี CSV รายงานสถิติใน UI | บันทึกสถานะ portable และ map export; Excel ไม่แทนรูปแผนที่ |
| Public/help | ต้อง login ไม่มี public start หรือศูนย์ช่วยเหลือ/คู่มือในเว็บแบบตัวอย่าง | เป็นการตัดสินใจขอบเขตผู้ใช้ ไม่ใช่ข้อบกพร่อง auth โดยอัตโนมัติ |

### มีพื้นฐานร่วมกัน แต่ไม่ควรเรียกว่าเท่ากันทั้งหมด

- เลือกอำเภอ/ตำบลและย้อนระดับได้ แต่ไม่มี nationwide/basin scope
- ซูม เลื่อน กลับมุมมองพื้นที่ และเต็มจอได้ แต่ปุ่มรูปเป้าไม่ใช่ GPS
- มี legend และ preview ตำบล แต่ไม่ใช่คำอธิบาย/identify ของทุกชั้นข้อมูล ณ จุดใดก็ได้
- มีกราฟ สรุป ตัวเลขและ Excel แต่ไม่มี general-purpose BI panel หรือ pivot editor บนเว็บ
- บันทึกตัวกรองในบัญชีได้ แต่ไม่ได้อ่าน/เขียน .agm และไม่ได้บันทึกชุด GIS layers
- มีสถานะชลประทานจาก Excel แต่ไม่ใช่แนวคลอง แหล่งน้ำ ปริมาณน้ำ หรือข้อมูลน้ำสด

## ตารางครบ 45 รายการจาก Handoff

สถานะ “มีบางส่วน/วิธีอื่น” ระบุความใกล้เคียงของงาน ไม่ใช่ผ่าน acceptance check
ของ Agri-Map ทุกข้อ รายการ screenshot-only ไม่ถูกยกระดับเป็นข้อกำหนดแน่นอน

| ID | Agri-Map / หน้า PDF | สถานะใน Korat ปัจจุบัน | หลักฐาน |
| --- | --- | --- | --- |
| ACCESS-01 | บุคคลทั่วไปเข้าโดยไม่ลงทะเบียน / 6 | ไม่มี; ต้องผ่าน Supabase login | K1 |
| ACCESS-02 | เจ้าหน้าที่เข้าสู่ระบบ / 6 | มี email/password; ไม่มีการแยกสิทธิ์ตามตำแหน่งเจ้าหน้าที่ และคู่มือเองก็ไม่กำหนดสิทธิ์ละเอียด | K1 |
| ACCESS-03 | ข้อมูลช่วยเหลือหน้าเริ่มต้น / 6 | ไม่มีศูนย์ช่วยเหลือแบบนั้น; มีข้อความอธิบายและข้อควรระวังในงาน forecast | K1, K2 |
| SHELL-01 | พื้นที่ทำงาน 4 ส่วน / 7-8,16-17 | มีบางส่วน: sidebar, controls, map, summaries; ไม่ใช่ GIS shell 4 pane | K1, K2 |
| SHELL-02 | ซ่อน/แสดงเมนูซ้าย / 8 | มีเมนูมือถือ; ไม่มี desktop sidebar toggle แบบคู่มือ | K1 |
| SHELL-03 | ผู้ใช้ปัจจุบัน/ออกจากระบบ / 8,27 | มี | K1 |
| SHELL-04 | รูปแบบสีของแผนที่ / 8,27 | ไม่มีตัวเลือก palette/theme; risk/irrigation เป็นโหมดข้อมูล ไม่ใช่ theme | K3 |
| SEARCH-01 | ชื่อสถานที่พร้อมคำเสนอแนะ / 8,25 | ไม่มี geocoding search | K1, K3 |
| SEARCH-02 | พิกัด latitude/longitude / 25 | ไม่มีช่องค้นหาพิกัด | K3 |
| SEARCH-03 | พิกัด UTM / 26 | ไม่มี; CRS ในคู่มือยังต้องยืนยันก่อนออกแบบ | K3 |
| SEARCH-04 | ประเทศ/จังหวัด/อำเภอ/ตำบล / 8,21-22,26-27 | มีบางส่วน: นครราชสีมา 32 อำเภอ 289 ตำบล | K2, K9 |
| SEARCH-05 | ลุ่มน้ำหลัก/สาขา / 27 | ไม่มี; คู่มือกล่าวถึงแต่ไม่ได้แจกแจง workflow | K2, K3 |
| SEARCH-06 | แสดงทั้งหมด/Crop พื้นที่เลือก / 8 | มี focus/dim ตาม route แต่ไม่มี toggle all/crop GIS แบบคู่มือ | K3 |
| SEARCH-07 | กลับตำแหน่งเริ่มต้น / 8 | มีปุ่มกลับมุมมองพื้นที่ของ route ปัจจุบัน | K3 |
| MENU-01 | ค้นหาชื่อชั้นข้อมูล / 8-9 | ไม่มี searchable layer tree | K1, K3 |
| MENU-02 | เมนูบริหารจัดการเชิงรุกหลายหัวข้อ / 9-11,20-22 | ไม่มีข้อมูล/เมนูชุดนั้นในผลิตภัณฑ์ปัจจุบัน | K1, K2, K10 |
| MENU-03 | คู่พืชปัจจุบัน/กิจกรรมทดแทน / 11,22 | ไม่มี; crop context ปัจจุบันเป็นข้าวแบบ fixed | K2 |
| MENU-04 | ผลวิเคราะห์การปรับเปลี่ยน / 11,22-23 | ไม่มี suitability/convertible area/economic model ที่เปิดใช้งาน | K2, K10 |
| MENU-05 | เมนูเพิ่มเติมใน screenshot / 9 | ไม่มีเมนูเทียบตรง; workflow ฝั่งอ้างอิงไม่ชัด จึงยังไม่กำหนด parity | K1 |
| MENU-06 | ชั้นข้อมูลดิบหลายกลุ่ม/geometry / 12,23-24 | มี polygon forecast/irrigation; ไม่มี active raw-layer catalog แบบคู่มือ | K3, K10 |
| MENU-07 | Eye และสถานะกลุ่ม 4 แบบ / 12-13 | ไม่มี hierarchical visibility แยกจาก selection | K3 |
| MENU-08 | Checkbox layers/ลำดับเปิด / 12 | ไม่มี multi-layer selection/stacking; data-color toggle ไม่ใช่ layer stack | K3 |
| MENU-09 | รีเซ็ต layers ทั้งหมด / 8,12 | มี reset ตัวกรอง แต่ไม่มี GIS layer reset | K3 |
| MENU-10 | ลากเรียงเมนูหลัก / 13 | ไม่มี | K1 |
| MAP-01 | เลื่อนแผนที่ / 13 | มี pointer/touch pan; ไม่ยืนยัน keyboard-arrow pan แบบคู่มือ | K3 |
| MAP-02 | ถนน/ภูมิประเทศ/ดาวเทียม / 13-14 | ไม่มี; ใช้ static geometry/context | K3 |
| MAP-03 | ซูมเข้าออก / 15 | มีปุ่ม/wheel/pinch; ไม่ใช่ double-left/right-click contract ตามคู่มือ | K3 |
| MAP-04 | ตำแหน่งผู้ใช้และ permission / 15 | ไม่มี GPS; locate-style button เพียง fit พื้นที่ | K3 |
| MAP-05 | Google Street View / 15-16 | ไม่มี | K3 |
| MAP-06 | Legend/คำอธิบาย / 17-18,20-24 | มี legend forecast/irrigation และ preview; ไม่ใช่ legend ของทุก layer ในคู่มือ | K3 |
| MAP-07 | Footer/developer/scale/provider terms / 16 | มีมาตราส่วนใน Home; ไม่ครบ provider/footer contract แบบคู่มือ | K3 |
| BI-01 | Information pane ตามข้อมูลเลือก / 16-17,24 | มี summary/preview ตาม forecast scope ไม่ใช่ general layer information pane | K2, K3 |
| BI-02 | ขยาย/เก็บหน้าต่างสถิติ / 16-17 | มี accordion รายละเอียด; ไม่มี resizable BI pane | K2 |
| BI-03 | กราฟแท่งและสรุป / 18-19,23 | มีกราฟ forecast 6 เดือน เปอร์เซ็นต์/จำนวน; คนละหัวข้อกับการใช้ที่ดิน | K2 |
| BI-04 | ตารางและสรุป / 19,23 | มี counts/รายการพื้นที่และตาราง Excel; ไม่มีตาราง layer statistics ทั่วไปบนเว็บ | K2, K5 |
| BI-05 | Drill-down/ย้อนระดับ / 18-19,21-22 | มีผ่านพื้นที่และ route; ไม่มีการ drill จากแท่งกราฟสู่ตาราง GIS แบบทั่วไป | K2, K3, K9 |
| BI-06 | แหล่งข้อมูล/หน่วยงาน/ปี / 19 | มี provenance rev03 และเดือน/รุ่นใน report; ไม่ใช่ agency/year metadata ของทุก layer | K3, K5 |
| BI-07 | CSV สถิติ / 17-18 | ใช้ XLSX แทน; ไม่มี CSV download action ใน UI | K5 |
| MARKER-01 | กดค้าง 2 วินาทีปักหมุด / 24 | ไม่มี arbitrary-coordinate marker | K3 |
| MARKER-02 | ข้อมูล ณ หมุด/ภูมิอากาศ/layers/เขตปกครอง / 24 | มีข้อมูลตำบลเมื่อคลิก polygon แต่ไม่มี point identify/climate panel | K3 |
| MARKER-03 | เลื่อนดู/ซ่อน/ลบหมุด / 25 | ไม่มี marker collection; ความหมายลำดับหมุดในคู่มือยังไม่ชัด | K3 |
| FILE-01 | Save .agm / 8,27-28 | ไม่มี .agm; saved filters ในบัญชีรองรับบางเป้าหมายแทน | K6 |
| FILE-02 | Load .agm / 8,27-28 | ไม่มี import; เปิดคืนได้เฉพาะรายการที่บันทึกในบัญชี | K6 |
| FILE-03 | รูปแผนที่ PDF / 27,29 | ไม่มี map PDF export | K3, K5 |
| FILE-04 | รูปแผนที่ PNG / 27,30 | ไม่มี map PNG export | K3, K5 |

## สิ่งที่ไม่นับว่าเรามีแล้ว

- `RisksSection`, `WorkflowSection`, `AlertsSection`, farmer experience,
  crop/planning/model sections เป็นส่วนต้นแบบที่เก็บใน source ไม่ใช่เมนูหลักปัจจุบัน
- คะแนนเกษตรจำลอง, historical research panels ที่ล้างข้อมูลแล้ว และ rainfall
  coverage fixtures ไม่ใช่ข้อมูลใช้งานจริงบน dashboard
- `api/model-inputs.js` และ collector มี implementation แต่การมี API ไม่ได้แปลว่า
  มี live feed, scheduler หรือโมเดลเผยแพร่ forecast อัตโนมัติแล้ว
- IMERG/CHIRPS/MODIS/ERA5-Land/ONI/Dynamic World/SRTM/DOAE ในเอกสาร research
  เป็นงานออกแบบ/แหล่งที่ศึกษา ไม่ใช่ active layers ที่ตรวจพบใน UI
- คำแนะนำในหน้า forecast เป็นข้อควรระวังทั่วไป ไม่ใช่ระบบสร้างคำแนะนำรายแปลง
  หรือ workflow ส่งเจ้าหน้าที่ไปตรวจภาคสนามจริง

## ข้อจำกัดของการเทียบและแนวทางเลือกงาน

คู่มือมีจำนวนกลุ่ม/ตัวเลือกไม่ตรงกันระหว่างข้อความและรูป (8/7, 14/12,
14/38 กับ 10/11) และไม่ให้สูตรวิเคราะห์/API/.agm codec จึงยังไม่ใช้เป็นสัญญา
implementation ที่สมบูรณ์ ค่า S1/S2/S3/N เป็น suitability ไม่ใช่ risk 0/1/2;
N ไม่ใช่ missing หรือ out-of-scope ในข้อมูลพยากรณ์ของเรา

ถ้าขยาย Korat เพื่อเจ้าหน้าที่ ควรแยกงานใช้ประโยชน์ได้ทันที เช่น ค้นหาพื้นที่,
map PDF/PNG พร้อมวันที่/legend/source และการเปรียบเทียบรอบบนเว็บ ออกจากงาน GIS
หลายข้อมูลหรือเกษตรกรรมทดแทนที่ต้องมีข้อมูลและสูตรใหม่ก่อน ข้อเสนอส่วนที่ได้รับ
อนุมัติภายหลังแสดงไว้ในหัวข้ออัปเดตด้านบน ไม่อนุญาตให้นำ ThaiWater/ข้อมูลจำลอง
มาปนกับ forecast rev03

## แหล่งหลักฐานใน Repository

- **K1**: [App/login](../src/App.tsx), [authenticated shell/navigation](../src/AuthenticatedApp.tsx).
- **K2**: [workspace routes](../src/components/NakhonRatchasimaWorkspace.tsx), [Home](../src/components/nakhon-ratchasima/ProvinceForecastOverview.tsx), [shared forecast](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx), [filters/disclosures](../src/components/nakhon-ratchasima/DroughtOperationalWorkspace.tsx), [graph](../src/components/nakhon-ratchasima/ForecastRiskBarGraph.tsx).
- **K3**: [local map](../src/components/nakhon-ratchasima/NakhonRatchasimaLocalMap.tsx), [map controls](../src/components/nakhon-ratchasima/ForecastControls.tsx), [irrigation](../src/irrigation.ts).
- **K4**: [Supabase loader](../src/data/supabaseForecastArchive.ts), [request lifecycle](../src/useForecastArchive.ts), [origin arithmetic](../src/forecastPeriod.ts), [rev03 normalization](DROUGHT_REV03_NORMALIZATION.md).
- **K5**: [export dialog](../src/components/ForecastExcelExport.tsx), [report model](../src/forecastExportModel.ts), [XLSX writer](../src/forecastExcelWriter.ts), [export contract and platform limits](FORECAST_EXCEL_EXPORT.md).
- **K6**: [bookmark dialog](../src/components/WorkspaceBookmarks.tsx), [owner-scoped persistence](../src/data/savedWorkspaces.ts), [route restoration](../src/savedWorkspaceRoutes.ts).
- **K8**: [mobile/shared CSS](../src/drought-workspace.css), [Home CSS](../src/home-overview.css), [app styles](../src/styles.css).
- **K9**: [routing/domain](../src/domain.ts), [workspace model](../src/components/nakhon-ratchasima/workspaceModel.ts), [administrative hierarchy](../src/data/canonical/nakhon_ratchasima/admin_hierarchy.json).
- **K10**: [province gates](../src/components/nakhon-ratchasima/ProvinceView.tsx), [district gates](../src/components/nakhon-ratchasima/DistrictView.tsx), [tambon gates](../src/components/nakhon-ratchasima/SubdistrictView.tsx), [cleared research metadata](../src/data/canonical/nakhon_ratchasima/normalized_research_panel_summary.json).

การตรวจรอบนี้เป็น source/capability audit ไม่มีการรับรองความเท่าเทียมของภาพ,
ประสิทธิภาพ, browser compatibility หรือผลข้อมูลสดใน production

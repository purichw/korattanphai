import { useSyncExternalStore } from "react";
import { getStorageIssue, subscribeStorageIssue } from "../browserStorage";

export function StorageNotice() {
  const issue = useSyncExternalStore(subscribeStorageIssue, getStorageIssue, () => null);
  if (!issue) return null;
  return (
    <p className="storage-notice" role="status">
      {issue === "unavailable"
        ? "บันทึกข้อมูลในเบราว์เซอร์ไม่ได้ การเปลี่ยนแปลงอาจหายเมื่อปิดหรือโหลดหน้านี้ใหม่"
        : "ข้อมูลที่บันทึกไว้บางส่วนอ่านไม่ได้ ระบบใช้ค่าเริ่มต้นสำหรับส่วนนั้น"}
    </p>
  );
}

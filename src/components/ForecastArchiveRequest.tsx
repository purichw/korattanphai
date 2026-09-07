import { createContext, useContext, type ReactNode } from 'react';
import type { useForecastArchive } from '../useForecastArchive';

const ForecastPeriodRequest = createContext<((period: string) => void) | undefined>(undefined);
export const useForecastPeriodRequest = () => useContext(ForecastPeriodRequest);

export function ForecastArchiveRequest({ request, children }: {
  request: ReturnType<typeof useForecastArchive>; children: ReactNode;
}) {
  return <ForecastPeriodRequest.Provider value={request.requestPeriod}>
    <div aria-busy={request.pending}>
      {request.changingPeriod && <p role="status">กำลังโหลดรอบที่เลือกและตรวจสอบข้อมูลล่าสุด · ขณะนี้ยังแสดงรอบเดิม</p>}
      {request.archive && request.failed && <div role="alert">
        <p>โหลดรอบที่เลือกไม่สำเร็จ · ขณะนี้ยังแสดงรอบเดิม</p>
        <button type="button" className="secondary-button" onClick={request.retry}>ลองใหม่</button>
      </div>}
      {children}
    </div>
  </ForecastPeriodRequest.Provider>;
}

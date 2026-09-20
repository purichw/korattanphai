import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import type { useForecastArchive } from '../useForecastArchive';
import { AppSelect } from './AppSelect';
import { MonthSelect } from './MonthSelect';

const ForecastPeriodRequest = createContext<((period: string) => void) | undefined>(undefined);
const ForecastPeriodChanging = createContext(false);
export const useForecastPeriodRequest = () => useContext(ForecastPeriodRequest);

export function ForecastMonthSelect(props: ComponentProps<typeof AppSelect>) {
  const changing = useContext(ForecastPeriodChanging);
  return <MonthSelect {...props} loadingLabel={changing ? 'กำลังโหลดเดือนที่เลือก · ขณะนี้ยังแสดงรอบเดิม' : undefined} />;
}

export function ForecastArchiveRequest({ request, children }: {
  request: ReturnType<typeof useForecastArchive>; children: ReactNode;
}) {
  return <ForecastPeriodRequest.Provider value={request.requestPeriod}>
    <ForecastPeriodChanging.Provider value={request.changingPeriod}>
      <p className="sr-only" role="status">{request.changingPeriod ? 'กำลังโหลดรอบที่เลือกและตรวจสอบข้อมูลล่าสุด · ขณะนี้ยังแสดงรอบเดิม' : ''}</p>
      <div aria-busy={request.pending}>
        {request.archive && request.failed && <div role="alert">
          <p>โหลดรอบที่เลือกไม่สำเร็จ · ขณะนี้ยังแสดงรอบเดิม</p>
          <button type="button" className="secondary-button" onClick={request.retry}>ลองใหม่</button>
        </div>}
        {children}
      </div>
    </ForecastPeriodChanging.Provider>
  </ForecastPeriodRequest.Provider>;
}

import { useEffect, useRef } from 'react';

export function useUnsavedChanges(dirty: boolean, onBlocked: (message: string) => void) {
  const departureAllowed = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { if (!departureAllowed.current) event.preventDefault(); };
    const navigate = (event: Event) => {
      if (departureAllowed.current) return;
      event.preventDefault();
      onBlocked('ยังมีข้อมูลที่ไม่ได้บันทึก กรุณาบันทึกหรือยกเลิกการแก้ไขก่อนเปลี่ยนหน้า');
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('ktp:before-navigation', navigate);
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener('ktp:before-navigation', navigate); };
  }, [dirty, onBlocked]);
  // Only a durable save or an explicit discard confirmation may bypass cleanup.
  return () => { departureAllowed.current = true; };
}

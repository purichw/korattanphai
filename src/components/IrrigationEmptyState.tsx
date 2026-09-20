import { RotateCcw, SearchX } from "lucide-react";

type IrrigationEmptyStateProps = {
  onReset: () => void;
  className?: string;
};

export function IrrigationEmptyState({ onReset, className = "" }: IrrigationEmptyStateProps) {
  return (
    <div className={`nr-irrigation-empty ${className}`.trim()} role="status">
      <span className="nr-irrigation-empty-icon"><SearchX size={28} strokeWidth={1.6} aria-hidden="true" /></span>
      <hgroup className="nr-irrigation-empty-copy">
        <h3>ไม่พบตำบลตามตัวกรองนี้</h3>
        <p>ไม่พบตำบลที่ตรงกับสถานะชลประทานในพื้นที่นี้</p>
      </hgroup>
      <button type="button" className="secondary-button" onClick={onReset}>
        <RotateCcw size={16} aria-hidden="true" />
        แสดงทุกสถานะชลประทาน
      </button>
    </div>
  );
}

type IrrigationEmptyStateProps = {
  onReset: () => void;
  className?: string;
};

export function IrrigationEmptyState({ onReset, className = "" }: IrrigationEmptyStateProps) {
  return (
    <div className={`nr-irrigation-empty ${className}`.trim()} role="status">
      <p>ไม่พบตำบลที่ตรงกับสถานะชลประทานในพื้นที่นี้</p>
      <button type="button" className="secondary-button" onClick={onReset}>
        แสดงทุกสถานะชลประทาน
      </button>
    </div>
  );
}

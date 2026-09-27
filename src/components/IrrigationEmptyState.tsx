import { RotateCcw } from "lucide-react";
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

type IrrigationEmptyStateProps = {
  onReset: () => void;
  className?: string;
};

export function IrrigationEmptyState({ onReset, className = "" }: IrrigationEmptyStateProps) {
  return (
    <WorkspaceEmptyState className={`nr-irrigation-empty ${className}`.trim()} title="ไม่พบตำบลตามตัวกรองนี้"
      description="ไม่พบตำบลที่ตรงกับสถานะชลประทานในพื้นที่นี้" action={<button type="button" className="secondary-button" onClick={onReset}>
        <RotateCcw size={16} aria-hidden="true" />
        แสดงทุกสถานะชลประทาน
      </button>} />
  );
}

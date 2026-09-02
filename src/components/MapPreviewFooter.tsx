import type { ReactNode } from "react";

export type MapPreviewFooterAction = {
  label: ReactNode;
  onClick: () => void;
};

export function MapPreviewFooter({
  action,
  fallback,
}: {
  action?: MapPreviewFooterAction | null;
  fallback?: ReactNode;
}) {
  if (action) {
    return (
      <button type="button" className="map-preview-action" onClick={action.onClick}>
        {action.label}
      </button>
    );
  }

  return <p className="map-preview-note">{fallback}</p>;
}

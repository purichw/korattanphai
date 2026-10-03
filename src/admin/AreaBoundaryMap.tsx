import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import { createProjection, pathForGeometry, localMapWidth, localMapHeight, type NakhonRatchasimaGeoFeature } from '../components/nakhon-ratchasima/workspaceModel';
import { getAnchoredZoomTransform, serializeMapTransform, sharedMapButtonZoomStep, type SharedMapTransform } from '../mapInteraction';
import { makeVisibleMapLabels, projectedBoundsForGeometries, projectedLabelPointForGeometries, type MapLabelCandidate } from '../mapLabels';
import type { AreaRow } from './areaModel';

// CMS owns these shapes. Do not mount the forecast map's archive/canonical loaders.
export const AreaBoundaryMap = memo(function AreaBoundaryMap({ rows, selectedId, onPick }: {
  rows: AreaRow[]; selectedId?: string; onPick?: (row: AreaRow) => void;
}) {
  const drawing = useMemo(() => {
    const seen = new Set<number>();
    const features = rows.flatMap(row => row.boundaries.flatMap(boundary => {
      if (!boundary.geometry || seen.has(boundary.index)) return [];
      seen.add(boundary.index); return [{ row, boundary }];
    }));
    if (!features.length) return [];
    // Existing projection/path helpers only read geometry, never the properties.
    const projection = createProjection(features.map(item => ({ geometry: item.boundary.geometry })) as NakhonRatchasimaGeoFeature[]);
    return features.map(item => ({ ...item, path: pathForGeometry(item.boundary.geometry!, projection),
      label: { id: String(item.boundary.index), text: item.row.name, ...projectedLabelPointForGeometries([item.boundary.geometry!], projection), bounds: projectedBoundsForGeometries([item.boundary.geometry!], projection), minZoom: 1 } }));
  }, [rows]);
  if (!drawing.length) return <WorkspaceEmptyState className="cms-area-map-empty" title="ไม่มีรูปขอบเขตที่แสดงได้ในรายการนี้" description="ตรวจสอบสถานะขอบเขตในรายชื่อตำบล" />;
  return <BoundaryCanvas key={drawing.map(item => item.boundary.index).join(',')} drawing={drawing} selectedId={selectedId} onPick={onPick} />;
});

type Drawing = { row: AreaRow; boundary: AreaRow['boundaries'][number]; path: string; label: MapLabelCandidate }[];
function BoundaryCanvas({ drawing, selectedId, onPick }: { drawing: Drawing; selectedId?: string; onPick?: (row: AreaRow) => void }) {
  const [transform, setTransform] = useState<SharedMapTransform>({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; start: SharedMapTransform; moved: boolean } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = svg.current; if (!element) return;
    const resize = new ResizeObserver(() => { const box = element.getBoundingClientRect(); setScale(Math.max(0.1, Math.min(box.width / localMapWidth, box.height / localMapHeight))); });
    resize.observe(element); return () => resize.disconnect();
  }, []);
  const labels = useMemo(() => makeVisibleMapLabels(drawing.map(item => ({ ...item.label, force: item.row.id === selectedId })), transform,
    { baseScreenFontSize: 12 / scale, minScreenFontSize: 12 / scale, maxScreenFontSize: 12 / scale, haloStrokeWidth: 3 / scale, collisionPadding: 5 / scale, viewportWidth: localMapWidth, viewportHeight: localMapHeight }), [drawing, transform, selectedId, scale]);
  const clamp = (value: SharedMapTransform) => ({ ...value, x: Math.max(localMapWidth * (1 - value.k), Math.min(0, value.x)), y: Math.max(localMapHeight * (1 - value.k), Math.min(0, value.y)) });
  function zoom(delta: number) { setTransform(current => clamp(getAnchoredZoomTransform(current, current.k + delta, { x: localMapWidth / 2, y: localMapHeight / 2 }, 1, 8))); }
  function pick(row: AreaRow) { if (!drag.current?.moved) onPick?.(row); }
  function point(event: { clientX: number; clientY: number }) {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  }
  return <div className="cms-area-map">
    <div className="cms-area-map-canvas">
      <svg ref={svg} viewBox={`0 0 ${localMapWidth} ${localMapHeight}`} aria-label="แผนที่ขอบเขตตำบล" role="group" style={{ touchAction: transform.k > 1 ? 'none' : 'pan-y' }}
        onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; const at = point(event); drag.current = { ...at, start: transform, moved: false }; }}
        onPointerMove={event => { if (!drag.current || event.buttons !== 1 || transform.k <= 1) return; const at = point(event); const dx = at.x - drag.current.x; const dy = at.y - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) { drag.current.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
          if (drag.current.moved) setTransform(clamp({ ...drag.current.start, x: drag.current.start.x + dx, y: drag.current.start.y + dy })); }}
        onPointerCancel={() => { drag.current = null; }}>
        <g transform={serializeMapTransform(transform)}>{drawing.map(({ row, boundary, path }) => <path key={boundary.index} d={path} fillRule="evenodd" vectorEffect="non-scaling-stroke"
          className={selectedId === row.id ? 'is-selected' : ''} tabIndex={onPick ? 0 : undefined} role={onPick ? 'button' : undefined}
          aria-label={`ตำบล${row.name} · ${row.registered ? row.district : boundary.district} · ${row.code || 'ไม่ระบุรหัส'}`}
          onClick={() => pick(row)} onKeyDown={event => { if (onPick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onPick(row); } }}>
          <title>{row.name} · {row.code}</title></path>)}
          {labels.map(label => <text className="cms-area-map-label" key={label.id} x={label.x} y={label.y} fontSize={label.fontSize} strokeWidth={label.strokeWidth} textAnchor="middle" dominantBaseline="central" aria-hidden="true">{label.text}</text>)}
        </g>
      </svg>
      <div className="cms-area-map-controls" role="group" aria-label="ปรับแผนที่ขอบเขต">
        <button className="icon-button" aria-label="ขยายแผนที่ขอบเขต" title="ขยายแผนที่" disabled={transform.k >= 8} onClick={() => zoom(sharedMapButtonZoomStep)}><Plus size={20} /></button>
        <button className="icon-button" aria-label="ย่อแผนที่ขอบเขต" title="ย่อแผนที่" disabled={transform.k <= 1} onClick={() => zoom(-sharedMapButtonZoomStep)}><Minus size={20} /></button>
        <button className="icon-button" aria-label="แสดงขอบเขตทั้งหมด" title="แสดงขอบเขตทั้งหมด" onClick={() => setTransform({ x: 0, y: 0, k: 1 })}><LocateFixed size={20} /></button>
      </div>
    </div>
    <div className="cms-area-map-legend"><span><i />ขอบเขตตำบล</span>{selectedId && <span><i className="is-selected" />ตำบลที่เลือก</span>}<span>ไม่ใช่ระดับความเสี่ยง</span></div>
  </div>;
}

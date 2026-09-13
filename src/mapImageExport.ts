import { makeVisibleMapLabels, type MapLabelBounds, type MapLabelCandidate } from './mapLabels';
export { createMapReport as createMapImage, mapReportBlob as mapImageBlob } from './mapReport';

type MapReportFrame = { bounds: MapLabelBounds; labels: MapLabelCandidate[] };
export type MapExportContext = {
  title: string; scope: string; origin: string; target: string; horizon: number;
  filters: string; details: string[]; timestamp: string; filename: string;
  source: { workbook: string; sheet: string; version: string; sha: string };
  legend: { label: string; color: string; hatched?: boolean }[];
  scopeFrame: MapReportFrame;
};

/** Freeze the current SVG camera and computed colors; export only the local rendered map. */
export function snapshotMapSvg(svg: SVGSVGElement, frame?: MapReportFrame) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  const properties = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'opacity', 'display', 'visibility', 'font-size', 'font-weight', 'text-anchor', 'paint-order', 'vector-effect'];
  originals.forEach((element, index) => {
    const computed = getComputedStyle(element);
    const copy = copies[index] as SVGElement;
    for (const property of properties) {
      // Computed paint servers can be absolute URLs; make the detached SVG self-contained.
      const value = computed.getPropertyValue(property).replace(/url\(["']?[^)]*#([^"')]+)["']?\)/g, 'url(#$1)');
      copy.style.setProperty(property, value);
    }
    copy.style.fontFamily = 'sans-serif';
  });
  const box = svg.getBoundingClientRect();
  let aspect = box.width / box.height;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', `${box.width}`); clone.setAttribute('height', `${box.height}`);
  if (frame) {
    const width = 760, height = 620, pad = 38;
    const b = frame.bounds;
    const k = Math.min((width - pad * 2) / Math.max(1, b.maxX - b.minX), (height - pad * 2) / Math.max(1, b.maxY - b.minY));
    const transform = { k, x: width / 2 - (b.minX + b.maxX) * k / 2, y: height / 2 - (b.minY + b.maxY) * k / 2 };
    aspect = width / height;
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    clone.setAttribute('width', `${width}`); clone.setAttribute('height', `${height}`);
    clone.querySelector('.nr-map-water')?.setAttribute('height', `${height}`);
    clone.querySelectorAll('.nr-map-label-layer, .nr-map-distance-scale, .nr-map-preview-halo').forEach(element => element.remove());
    const layer = clone.querySelector('.nr-map-transform-layer');
    layer?.setAttribute('transform', `translate(${transform.x},${transform.y}) scale(${k})`);
    const pin = layer?.querySelector('.nr-coordinate-pin');
    if (pin) pin.setAttribute('transform', (pin.getAttribute('transform') ?? '').replace(/scale\([^)]*\)/, `scale(${1 / k})`));
    // Recompute report labels independently of the screen's current zoom and viewport.
    const labels = makeVisibleMapLabels(frame.labels, transform, { viewportWidth: width, viewportHeight: height,
      baseScreenFontSize: 12, minScreenFontSize: 11, maxScreenFontSize: 12, zoomFontBoost: 0, collisionPadding: 5, haloStrokeWidth: 2.8 });
    for (const label of labels) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', `${label.x}`); text.setAttribute('y', `${label.y}`);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('style', `font:600 ${label.fontSize}px sans-serif;fill:#253e34;stroke:white;stroke-width:${label.strokeWidth};paint-order:stroke fill`);
      text.textContent = label.text; layer?.append(text);
    }
  }
  return { xml: new XMLSerializer().serializeToString(clone), aspect };
}

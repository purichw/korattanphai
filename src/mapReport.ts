import { paginateReportItems, wrapReportText, type ReportFlowItem } from './reportLayout';
import type { MapExportContext } from './mapImageExport';

type TextRow = { kind: 'text'; text: string; size: number; bold: boolean; color: string };
type Row = TextRow | { kind: 'rule' } | { kind: 'metrics'; items: { label: string; lines: string[] }[] } | { kind: 'map' };
const pageWidth = 1600, pageHeight = Math.round(pageWidth * Math.SQRT2), pad = 72, innerWidth = pageWidth - pad * 2;

export async function createMapReport(snapshot: { xml: string; aspect: number }, context: MapExportContext, framing: 'scope' | 'camera' = 'scope') {
  await document.fonts.ready;
  const measuring = document.createElement('canvas').getContext('2d');
  if (!measuring) throw new Error('ไม่สามารถสร้างรายงานบนอุปกรณ์นี้');
  const family = getComputedStyle(document.body).fontFamily;
  const font = (size: number, bold = false) => `${bold ? '600 ' : ''}${size}px ${family}`;
  const wrap = (text: string, size: number, bold = false, width = innerWidth) => {
    measuring.font = font(size, bold);
    return wrapReportText(text, value => measuring.measureText(value).width, width);
  };
  const titles = wrap(context.title, 42, true), scopes = wrap(context.scope, 28);
  const contentTop = 118 + titles.length * 63 + scopes.length * 42 + 30;
  const footer = wrap(`จัดทำจากข้อมูลที่แสดง ณ ${context.timestamp}`, 20, false, innerWidth - 240);
  const contentBottom = pageHeight - 74 - footer.length * 30 - 32;
  const rows: ReportFlowItem<Row>[] = [];
  function paragraph(text: string, size = 26, bold = false, heading = false, color = '#52635b') {
    const lines = wrap(text, size, bold);
    lines.forEach((line, index) => rows.push({
      height: size * 1.5 + (index === lines.length - 1 ? 8 : 0),
      keepWithNext: heading || (index === 0 && lines.length > 1) || index === lines.length - 2,
      content: { kind: 'text', text: line, size, bold, color },
    }));
  }
  function heading(text: string) {
    rows.push({ height: 32, keepWithNext: true, content: { kind: 'rule' } });
    paragraph(text, 28, true, true, '#1c2922');
  }
  const metrics = [['เดือนตั้งต้น (T)', context.origin], ['ระยะพยากรณ์', `T+${context.horizon} · ล่วงหน้า ${context.horizon} เดือน`], ['เดือนที่พยากรณ์', context.target]]
    .map(([label, value]) => ({ label, lines: wrap(value, 29, true, innerWidth / 3 - 28) }));
  rows.push({ height: 46 + Math.max(...metrics.map(item => item.lines.length)) * 44 + 22, content: { kind: 'metrics', items: metrics } });
  paragraph(context.filters, 24);

  let legendX = 0, legendY = 0, legendRowHeight = 0;
  const legend = context.legend.map(item => {
    measuring.font = font(22);
    const width = Math.min(innerWidth, measuring.measureText(item.label).width + 64);
    const lines = wrap(item.label, 22, false, width - 48);
    if (legendX && legendX + width > innerWidth) { legendX = 0; legendY += legendRowHeight + 10; legendRowHeight = 0; }
    const result = { ...item, lines, x: legendX, y: legendY };
    legendX += width; legendRowHeight = Math.max(legendRowHeight, lines.length * 33);
    return result;
  });
  const legendHeight = legendY + legendRowHeight + 40;
  const mapRow: ReportFlowItem<Row> = { height: 0, minHeight: 540 + legendHeight, content: { kind: 'map' } };
  rows.push(mapRow);
  heading('ขอบเขตและการอ่านรายงาน');
  paragraph(framing === 'scope' ? 'แผนที่แสดงพื้นที่ทั้งหมดของหน้านี้ สีแสดงตามตัวกรองที่เลือก' : 'แผนที่แสดงมุมมองซูมปัจจุบัน อาจไม่ครอบคลุมทุกตำบลในขอบเขต');
  context.details.forEach(detail => paragraph(detail));
  paragraph('ข้อมูลพยากรณ์ระดับตำบล ไม่ใช่ผลความเสียหายจริงหรือการประเมินความเสี่ยงรายแปลง');
  heading('แหล่งข้อมูลและการตรวจสอบย้อนกลับ');
  paragraph(`${context.source.workbook} · ${context.source.sheet}`, 22);
  paragraph(`รุ่นข้อมูล ${context.source.version}`, 22);
  paragraph(`SHA-256 ${context.source.sha}`, 22);
  const capacity = contentBottom - contentTop;
  const otherHeight = rows.reduce((sum, row) => sum + row.height, 0);
  mapRow.height = Math.min(1240 + legendHeight, Math.max(mapRow.minHeight!, capacity - otherHeight));
  const layout = paginateReportItems(rows, contentTop, contentBottom);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('สร้างภาพแผนที่ใช้เวลานานเกินไป')), 15_000);
    img.onload = () => { clearTimeout(timeout); resolve(); };
    img.onerror = () => { clearTimeout(timeout); reject(new Error('สร้างภาพแผนที่ไม่สำเร็จ')); };
    // Production permits self/data images, not blob images; keep that CSP intact.
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshot.xml)}`;
  });
  const pages = layout.map((placements, pageIndex) => {
    const canvas = document.createElement('canvas'); canvas.width = pageWidth; canvas.height = pageHeight;
    const ctx = canvas.getContext('2d')!;
    const text = (value: string, x: number, top: number, size: number, color = '#52635b', bold = false) => {
      ctx.font = font(size, bold); ctx.fillStyle = color; ctx.fillText(value, x, top + size);
    };
    const rule = (top: number, color = '#d7e2dc') => {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, top); ctx.lineTo(pageWidth - pad, top); ctx.stroke();
    };
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pageWidth, pageHeight);
    ctx.fillStyle = '#215c47'; ctx.fillRect(pad, 54, 48, 5);
    text('โคราชทันภัย', pad + 64, 40, 23, '#215c47', true);
    titles.forEach((line, index) => text(line, pad, 103 + index * 63, 42, '#1c2922', true));
    scopes.forEach((line, index) => text(line, pad, 112 + titles.length * 63 + index * 42, 28, '#465c50'));
    rule(contentTop - 16, '#215c47');
    for (const { top, height, content } of placements) {
      if (content.kind === 'text') text(content.text, pad, top, content.size, content.color, content.bold);
      else if (content.kind === 'rule') rule(top + 12);
      else if (content.kind === 'metrics') content.items.forEach((item, index) => {
        const x = pad + index * innerWidth / 3;
        text(item.label, x, top, 20);
        item.lines.forEach((line, i) => text(line, x, top + 36 + i * 44, 29, '#173e2e', true));
      });
      else {
        const imageBoxHeight = height - legendHeight - 10;
        const imageHeight = Math.min(imageBoxHeight, innerWidth / snapshot.aspect), imageWidth = imageHeight * snapshot.aspect;
        ctx.fillStyle = '#f2f6f4'; ctx.fillRect(pad, top, innerWidth, imageBoxHeight);
        ctx.drawImage(img, (pageWidth - imageWidth) / 2, top + (imageBoxHeight - imageHeight) / 2, imageWidth, imageHeight);
        for (const item of legend) {
          const x = pad + item.x, y = top + imageBoxHeight + 20 + item.y;
          ctx.fillStyle = item.color; ctx.fillRect(x, y + 3, 22, 22);
          if (item.hatched) {
            ctx.save(); ctx.beginPath(); ctx.rect(x, y + 3, 22, 22); ctx.clip(); ctx.strokeStyle = '#8d9d95';
            for (let offset = -22; offset < 44; offset += 8) { ctx.beginPath(); ctx.moveTo(x + offset, y + 25); ctx.lineTo(x + offset + 22, y + 3); ctx.stroke(); }
            ctx.restore();
          }
          item.lines.forEach((line, i) => text(line, x + 32, y + i * 33, 22, '#1c2922'));
        }
      }
    }
    rule(contentBottom + 16);
    footer.forEach((line, index) => text(line, pad, contentBottom + 38 + index * 30, 20));
    ctx.textAlign = 'right'; text(`นครราชสีมา  |  ${pageIndex + 1} / ${layout.length}`, pageWidth - pad, contentBottom + 38, 20); ctx.textAlign = 'left';
    return canvas;
  });
  return { pages, layout, contentTop, contentBottom };
}

export async function mapReportBlob(report: Awaited<ReturnType<typeof createMapReport>>, format: 'png' | 'pdf') {
  const png = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('สร้าง PNG ไม่สำเร็จ')), 'image/png'));
  if (format === 'png') {
    if (report.pages.length === 1) return png(report.pages[0]);
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const [index, canvas] of report.pages.entries()) zip.file(`report-page-${String(index + 1).padStart(2, '0')}.png`, await (await png(canvas)).arrayBuffer());
    return zip.generateAsync({ type: 'blob' });
  }
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4', compress: true });
  for (const [index, canvas] of report.pages.entries()) {
    if (index) doc.addPage('a4', 'portrait');
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
    const scale = Math.min(width / canvas.width, height / canvas.height);
    doc.addImage(canvas, 'PNG', (width - canvas.width * scale) / 2, 0, canvas.width * scale, canvas.height * scale, undefined, 'FAST');
  }
  return doc.output('blob');
}

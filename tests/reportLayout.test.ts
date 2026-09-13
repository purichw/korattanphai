import { describe, expect, it } from 'vitest';
import { paginateReportItems, wrapReportText } from '../src/reportLayout';

describe('dynamic report layout', () => {
  const measure = (text: string) => [...text].length * 10;
  it('wraps Thai, explicit paragraphs and long unbroken IDs without dropping text', () => {
    for (const text of ['นครราชสีมา รายงานพื้นที่ที่มีความเสี่ยงสูงอย่างต่อเนื่อง', 'ข้อมูล\n\nพื้นที่', 'SHA256:' + 'abcdef0123456789'.repeat(20), 'พยากรณ์ เดือนมกราคม 2569 / Source_master_workbook.xlsx']) {
      const lines = wrapReportText(text, measure, 140);
      expect(lines.every(line => measure(line) <= 140)).toBe(true);
      expect(lines.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
      expect(lines.every(line => !/^\p{Mark}/u.test(line))).toBe(true);
    }
  });
  it('keeps a section heading with its first two lines and avoids footer collisions', () => {
    const items = [{ height: 85, content: 'previous' }, { height: 12, content: 'heading', keepWithNext: true },
      { height: 12, content: 'first', keepWithNext: true }, { height: 12, content: 'second' }, { height: 12, content: 'third' }];
    const pages = paginateReportItems(items, 20, 120);
    expect(pages.map(page => page.map(item => item.content))).toEqual([['previous'], ['heading', 'first', 'second', 'third']]);
    expect(pages.flat().every(item => item.top >= 20 && item.top + item.height <= 120)).toBe(true);
  });
  it('keeps map and legend atomic while shrinking their reserved height when needed', () => {
    const pages = paginateReportItems([{ height: 40, content: 'intro' }, { height: 90, minHeight: 50, content: 'map-and-legend' }, { height: 20, content: 'notes' }], 0, 100);
    expect(pages[0][1]).toEqual({ top: 40, height: 60, content: 'map-and-legend' });
    expect(pages[1][0].content).toBe('notes');
  });
  it('handles varied data lengths with no lost, duplicated, overlapping or overflowing rows', () => {
    for (const count of [1, 2, 10, 37, 100, 201]) {
      const items = Array.from({ length: count }, (_, i) => ({ content: i, height: 17 + i % 9 }));
      const pages = paginateReportItems(items, 40, 240);
      expect(pages.flat().map(item => item.content)).toEqual(items.map(item => item.content));
      for (const page of pages) page.forEach((item, i) => {
        expect(item.top + item.height).toBeLessThanOrEqual(240);
        expect(item.top).toBeGreaterThanOrEqual(i ? page[i - 1].top + page[i - 1].height : 40);
      });
    }
  });
});

/// <reference lib="es2022.intl" />

/** Measure Thai words first; split oversized codes/URLs only at grapheme boundaries. */
export function wrapReportText(text: string, measure: (text: string) => number, width: number): string[] {
  if (width <= 0) throw new Error('Report text width must be positive');
  const segment = (value: string, granularity: 'word' | 'grapheme') => typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('th', { granularity }).segment(value)].map(item => item.segment)
    : Array.from(value).reduce<string[]>((parts, char) => {
      if (/\p{Mark}/u.test(char) && parts.length) parts[parts.length - 1] += char;
      else parts.push(char);
      return parts;
    }, []);
  return text.split(/\r?\n/).flatMap(paragraph => {
    const lines: string[] = [];
    let line = '';
    const push = () => { if (line.trim()) lines.push(line.trim()); line = ''; };
    for (const word of segment(paragraph, 'word')) {
      if (measure(word) > width) {
        for (const grapheme of segment(word, 'grapheme')) {
          if (line && measure(line + grapheme) > width) push();
          line += grapheme;
        }
      } else {
        if (line && measure(line + word) > width) push();
        line += word;
      }
    }
    push();
    return lines.length ? lines : [''];
  });
}

export type ReportFlowItem<T> = { height: number; minHeight?: number; keepWithNext?: boolean; content: T };
export type ReportPlacement<T> = { top: number; height: number; content: T };

/** Paginate measured blocks without splitting figures or orphaning attached headings. */
export function paginateReportItems<T>(items: ReportFlowItem<T>[], top: number, bottom: number): ReportPlacement<T>[][] {
  const capacity = bottom - top;
  if (capacity <= 0) throw new Error('Report page has no content area');
  const pages: ReportPlacement<T>[][] = [[]];
  let cursor = top;
  items.forEach((item, index) => {
    let minimum = item.minHeight ?? item.height;
    let next = index;
    while (items[next].keepWithNext && next + 1 < items.length) {
      next++;
      minimum += items[next].minHeight ?? items[next].height;
    }
    if (minimum > capacity) throw new Error('Report block exceeds a page');
    if (cursor + minimum > bottom && pages[pages.length - 1].length) { pages.push([]); cursor = top; }
    const followingMinimum = minimum - (item.minHeight ?? item.height);
    const height = item.minHeight === undefined ? item.height : Math.max(item.minHeight, Math.min(item.height, bottom - cursor - followingMinimum));
    pages[pages.length - 1].push({ top: cursor, height, content: item.content });
    cursor += height;
  });
  return pages;
}

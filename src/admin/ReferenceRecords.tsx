import { useMemo, useRef, useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Download, Filter, RotateCcw, Search, X } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import type { ReferenceRow } from './resourcePresentation';
import { referenceCsv } from './referenceExport';

/** Read-only tools for the existing resource projection. Row identity is its original payload index. */
export function ReferenceRecords({ columns, rows, title, areas, busy, revision, actionLabel, onOpen }: {
  columns: string[]; rows: ReferenceRow[]; title: string; areas: boolean; busy: boolean;
  revision: number; actionLabel: string; onOpen: (row: ReferenceRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('all');
  const [sort, setSort] = useState('original');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const districts = useMemo(() => [...new Set(rows.map(row => row.cells[0]))].sort((a, b) => a.localeCompare(b, 'th')), [rows]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th');
    const found = rows.filter(row => (!areas || district === 'all' || row.cells[0] === district)
      && row.cells.join(' ').toLocaleLowerCase('th').includes(needle));
    if (sort === 'original') return found;
    const column = sort.startsWith('code') ? 2 : areas ? 1 : 0;
    return found.sort((a, b) => (a.cells[column].localeCompare(b.cells[column], 'th', { numeric: true }) || a.index - b.index) * (sort === 'code-desc' ? -1 : 1));
  }, [rows, query, district, sort, areas]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const pageSelected = visible.filter(row => selected.has(row.index)).length;
  const clearSelection = () => { setSelected(new Set()); setNotice(''); };
  function reset() { setQuery(''); setDistrict('all'); setSort('original'); setPage(0); clearSelection(); }
  function toggle(index: number, checked: boolean) {
    setNotice(''); setSelected(previous => { const next = new Set(previous); if (checked) next.add(index); else next.delete(index); return next; });
  }
  function togglePage(checked: boolean) {
    setNotice(''); setSelected(previous => { const next = new Set(previous); visible.forEach(row => checked ? next.add(row.index) : next.delete(row.index)); return next; });
  }
  const pageCheckbox = () => <input type="checkbox" aria-label="เลือกทุกรายการในหน้านี้" checked={visible.length > 0 && pageSelected === visible.length}
    ref={element => { if (element) element.indeterminate = pageSelected > 0 && pageSelected < visible.length; }} disabled={busy || !visible.length} onChange={event => togglePage(event.target.checked)} />;
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [currentPage, pageSize, query, district, sort]);
  useEffect(() => { setSelected(new Set()); setNotice(''); }, [revision]);
  function download() {
    const chosen = filtered.filter(row => selected.has(row.index));
    if (!chosen.length) return;
    const url = URL.createObjectURL(new Blob([referenceCsv(columns, chosen)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${title}_รายการที่เลือก.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`ดาวน์โหลด ${chosen.length.toLocaleString('th-TH')} รายการแล้ว`);
  }
  return <section className="cms-records-panel" aria-label="รายการข้อมูล" data-view={areas ? 'areas' : 'other'} data-has-selection={selected.size > 0}>
    <div className="cms-record-filters">
      <label className="cms-search"><Search size={18} aria-hidden="true" /><input aria-label="ค้นหาในข้อมูลชุดนี้" value={query}
        placeholder={areas ? 'ค้นหาอำเภอ ตำบล หรือรหัสตำบล' : 'ค้นหาชื่อพื้นที่ หน่วยงาน หรือรหัส'}
        onChange={event => { setQuery(event.target.value); setPage(0); clearSelection(); }} /></label>
      <button className="secondary-button cms-record-filter-toggle" aria-expanded={filtersOpen} aria-controls="cms-record-filter-options" onClick={() => setFiltersOpen(value => !value)}><Filter size={16} />ตัวกรอง{district !== 'all' || sort !== 'original' ? ' •' : ''}</button>
      <div className={`cms-record-filter-options${filtersOpen ? ' is-open' : ''}`} id="cms-record-filter-options">
      {areas && <AppSelect label="อำเภอ" value={district} onChange={value => { setDistrict(value); setPage(0); clearSelection(); }}
        options={[{ value: 'all', label: 'ทุกอำเภอ' }, ...districts.map(value => ({ value, label: value }))]} />}
      <AppSelect label="เรียงลำดับ" value={sort} onChange={value => { setSort(value); setPage(0); }} options={[
        { value: 'original', label: 'ตามข้อมูลต้นฉบับ' }, { value: 'name', label: areas ? 'ชื่อตำบล (ก–ฮ)' : 'ชื่อ (ก–ฮ)' },
        ...(areas ? [{ value: 'code-asc', label: 'รหัสตำบล (น้อย→มาก)' }, { value: 'code-desc', label: 'รหัสตำบล (มาก→น้อย)' }] : []),
      ]} />
      {(query || district !== 'all' || sort !== 'original') && <button className="secondary-button cms-record-reset" onClick={reset}><RotateCcw size={16} />ล้างตัวกรอง</button>}</div>
    </div>
    <div className="cms-record-count"><span role="status">พบ <strong>{filtered.length.toLocaleString('th-TH')}</strong> จาก {rows.length.toLocaleString('th-TH')} รายการ</span>
      <span className="cms-record-selection-hint">เลือกหลายรายการเพื่อดาวน์โหลดไปใช้ใน Excel</span><label className="cms-record-checkbox cms-mobile-select-page">{pageCheckbox()}<span>เลือกหน้านี้เพื่อดาวน์โหลด</span></label></div>
    {filtered.length ? <>
      <div className="cms-table-scroll is-records cms-records-scroll" ref={scroll} tabIndex={0} role="region" aria-label="ตารางรายการข้อมูล เลื่อนเพื่อดูรายการในหน้านี้">
        <table className="cms-table cms-reference-table" role="table"><caption className="sr-only">{title}</caption>
          <thead><tr role="row"><th scope="col" className="cms-record-check"><label className="cms-record-checkbox">{pageCheckbox()}</label></th>
            {columns.map(column => <th scope="col" key={column}>{column}</th>)}<th scope="col">รายละเอียด</th></tr></thead>
          <tbody>{visible.map(row => <tr key={row.index} role="row" className={selected.has(row.index) ? 'is-selected' : ''}>
            <td role="cell" className="cms-record-check"><label className="cms-record-checkbox"><input type="checkbox" aria-label={`เลือก ${row.cells.join(' · ')}`} checked={selected.has(row.index)} disabled={busy} onChange={event => toggle(row.index, event.target.checked)} /></label></td>
            {row.cells.map((cell, index) => <td role="cell" className={`cms-record-cell cms-record-cell-${index}`} key={index}><span className="cms-record-mobile-label" aria-hidden="true">{columns[index]} · </span>{cell}</td>)}
            <td role="cell" className="cms-record-action"><button className="secondary-button" disabled={busy} onClick={() => onOpen(row)}>{actionLabel}<ArrowRight size={15} /></button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="cms-record-footer"><div className="cms-record-selection"><span>เลือก {selected.size.toLocaleString('th-TH')} รายการ{selected.size > 0 && ' (รวมทุกหน้า)'}</span>
        <button className="secondary-button" onClick={download} disabled={!selected.size || busy}><Download size={16} />ดาวน์โหลดที่เลือก (CSV)</button>
        {selected.size > 0 && <button className="icon-button" aria-label="ล้างรายการที่เลือก" title="ล้างรายการที่เลือก" onClick={clearSelection}><X size={16} /></button>}</div>
        <div className="cms-record-pagination"><AppSelect ariaLabel="จำนวนรายการต่อหน้า" value={String(pageSize)} onChange={value => { setPageSize(Number(value)); setPage(0); }}
          options={[10, 20, 50].map(value => ({ value: String(value), label: `${value} ต่อหน้า` }))} />
          <button className="icon-button" aria-label="ข้อมูลหน้าก่อน" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={16} /></button>
          <span>หน้า {currentPage + 1} / {pageCount}</span><button className="icon-button" aria-label="ข้อมูลหน้าถัดไป" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ArrowRight size={16} /></button></div></footer>
      {notice && <p className="cms-export-notice" role="status">{notice}</p>}
      <p className="cms-selection-help">เลือกได้ข้ามหน้า · เปลี่ยนคำค้นหาหรืออำเภอจะล้างรายการที่เลือก · CSV เป็นตารางสำหรับตรวจสอบ</p>
    </> : <WorkspaceEmptyState className="cms-record-empty" title={query || district !== 'all' ? 'ไม่พบรายการตามคำค้น' : 'ยังไม่มีรายการที่มีข้อมูลอ้างอิงในชุดนี้'}
      action={query || district !== 'all' ? <button className="secondary-button" onClick={reset}>ล้างตัวกรอง</button> : undefined} />}
  </section>;
}

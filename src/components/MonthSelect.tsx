import { useMemo, type ComponentProps } from 'react';
import { AppSelect } from './AppSelect';

const fullThaiMonth = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' });
const fullEnglishMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const shortEnglishMonth = new Intl.DateTimeFormat('en-GB', { month: 'short' });

/** Month aliases affect search only; source periods and displayed labels stay unchanged. */
export function MonthSelect({ options, ...props }: ComponentProps<typeof AppSelect>) {
  const searchableOptions = useMemo(() => options.map(option => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(option.value)) return option;
    const [year, month] = option.value.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return { ...option, searchText: [option.searchText, fullThaiMonth.format(date),
      fullEnglishMonth.format(date), shortEnglishMonth.format(date)].filter(Boolean).join(' ') };
  }), [options]);
  return <AppSelect searchable {...props} options={searchableOptions} />;
}

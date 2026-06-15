export function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

export function parseMonth(monthInput: string | Date): Date {
  if (monthInput instanceof Date) {
    return new Date(monthInput.getFullYear(), monthInput.getMonth(), 1);
  }
  const re = /^(\d{4})-(\d{2})-(\d{2})/;
  const match = re.exec(monthInput);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(monthInput);
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

export function parseMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

const MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export function formatMonthLabel(monthInput: string | Date): string {
  const parsed = monthInput instanceof Date ? monthInput : new Date(monthInput);
  return `${MONTH_NAMES[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

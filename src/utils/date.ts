export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getMonthDays(year: number, month: number): Date[] {
  const result: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Add dates from previous month to fill the first week
  const daysFromPrevMonth = firstDay.getDay();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonthLastDay = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
  
  for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
    result.push(new Date(prevMonthYear, prevMonth, prevMonthLastDay - i));
  }
  
  // Add all days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    result.push(new Date(year, month, i));
  }
  
  // Add dates from next month to complete the grid (to make 6 rows x 7 columns)
  const daysToAdd = 42 - result.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;
  
  for (let i = 1; i <= daysToAdd; i++) {
    result.push(new Date(nextMonthYear, nextMonth, i));
  }
  
  return result;
}

export function getWeekDays(date: Date): Date[] {
  const result: Date[] = [];
  const day = date.getDay();
  const diff = date.getDate() - day;
  
  for (let i = 0; i < 7; i++) {
    const newDate = new Date(date);
    newDate.setDate(diff + i);
    result.push(newDate);
  }
  
  return result;
}

export function getDayHours(): string[] {
  const hours: string[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`;
    hours.push(hour);
  }
  return hours;
}

export function formatDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}
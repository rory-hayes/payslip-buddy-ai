/**
 * Centralized formatting utilities for currency and dates
 */

export function formatMoney(
  value: number | null | undefined,
  currency: string = 'GBP',
  locale: string = 'en-GB'
): string {
  if (value === null || value === undefined) {
    return '—';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(
  date: string | Date | null | undefined,
  locale: string = 'en-GB',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) {
    return '—';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, options || {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

export function formatNumber(
  value: number | null | undefined,
  locale: string = 'en-GB',
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined) {
    return '—';
  }

  return new Intl.NumberFormat(locale, options).format(value);
}

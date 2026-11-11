const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  // Date-only values are calendar dates; parsing them as-is would mean UTC midnight.
  const date = DATE_ONLY.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatSignedNumber(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('en-US', { signDisplay: 'exceptZero' })
}

export function formatMoney(amount: number, currency?: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount)
}

/**
 * Formats a number or string as European currency format
 * @param amount - The amount to format (can be a number or string)
 * @returns Formatted string in format: "100.500,22 €"
 * @example
 * formatCurrency(100500.22) // "100.500,22 €"
 * formatCurrency("100500.22") // "100.500,22 €"
 * formatCurrency("0") // "0,00 €"
 * formatCurrency("") // "-"
 */
export const parseEuropeanNumber = (value: string | number | undefined | null): number => {
  if (value === null || value === undefined) return Number.NaN
  if (typeof value === 'number') return value
  const cleaned = String(value).trim()
  if (!cleaned) return Number.NaN
  const sanitized = cleaned.replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  let normalized = sanitized
  if (sanitized.includes(',')) {
    normalized = sanitized.replace(/\./g, '').replace(/,/g, '.')
  } else if (sanitized.includes('.')) {
    const parts = sanitized.split('.')
    if (parts.length > 2) {
      const decimal = parts.pop() || '0'
      normalized = `${parts.join('')}.${decimal}`
    }
  }
  const num = Number(normalized)
  return Number.isFinite(num) ? num : Number.NaN
}

export const formatNumber = (
  amount: string | number | undefined | null,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string => {
  const numValue = parseEuropeanNumber(amount)
  if (!Number.isFinite(numValue)) return '-'
  return numValue.toLocaleString('de-DE', {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2
  })
}

export const formatCurrency = (amount: string | number | undefined | null): string => {
  if (!amount && amount !== 0) return '-'
  if (amount === '' || amount === '-') return '-'

  const numValue = parseEuropeanNumber(amount)
  if (!Number.isFinite(numValue)) return '-'
  if (numValue === 0) return '0,00 €'

  const formatted = numValue.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return `${formatted} €`
}

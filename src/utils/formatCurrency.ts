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
export const formatCurrency = (amount: string | number | undefined | null): string => {
  if (!amount && amount !== 0) return '-'
  if (amount === '' || amount === '-') return '-'
  
  // Convert to number
  const numValue = typeof amount === 'string' 
    ? parseFloat(amount.replace(/[^\d.,-]/g, '').replace(',', '.')) 
    : amount
  
  if (isNaN(numValue) || numValue === 0) return '0,00 €'
  
  // Format with European locale (dot for thousands, comma for decimals)
  const formatted = numValue.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  
  return `${formatted} €`
}

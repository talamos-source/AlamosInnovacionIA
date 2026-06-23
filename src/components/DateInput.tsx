import { useMemo } from 'react'
import { toCallDateFormat, toIsoDateFormat } from '../utils/callMapping'

/* ============================================================
   DateInput — wrapper sobre <input type="date">
   ============================================================
   Componente reutilizable que ofrece el calendario nativo del
   navegador pero mantiene la convención del sistema de guardar
   las fechas como strings en formato dd/mm/yyyy.

   Conversiones automáticas:
     - value externo  (dd/mm/yyyy) → input HTML (yyyy-mm-dd)
     - input HTML     (yyyy-mm-dd) → onChange (dd/mm/yyyy)

   API compatible drop-in con un <input type="text"> existente:
     <DateInput
       id="deadline"
       value={formData.deadline}                    // "13/07/2026"
       onChange={(v) => handleChange('deadline', v)} // recibe "13/07/2026"
       className={errors.deadline ? 'error' : ''}
       required
     />
   ============================================================ */

interface DateInputProps {
  id?: string
  name?: string
  value: string
  /** Recibe el valor en formato dd/mm/yyyy (o '' si está vacío). */
  onChange: (value: string) => void
  onBlur?: () => void
  required?: boolean
  disabled?: boolean
  className?: string
  /** Mínimo (yyyy-mm-dd o dd/mm/yyyy, lo normalizamos) */
  min?: string
  /** Máximo (yyyy-mm-dd o dd/mm/yyyy, lo normalizamos) */
  max?: string
  placeholder?: string
  /** Aria label opcional */
  'aria-label'?: string
}

const DateInput = ({
  id,
  name,
  value,
  onChange,
  onBlur,
  required,
  disabled,
  className,
  min,
  max,
  placeholder,
  'aria-label': ariaLabel,
}: DateInputProps) => {
  // El valor externo puede venir en dd/mm/yyyy (datos del state/storage),
  // en yyyy-mm-dd (datos legacy importados), o vacío. Normalizamos a ISO
  // para el input HTML.
  const isoValue = useMemo(() => toIsoDateFormat(value), [value])
  const isoMin = useMemo(() => (min ? toIsoDateFormat(min) : undefined), [min])
  const isoMax = useMemo(() => (max ? toIsoDateFormat(max) : undefined), [max])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // El input siempre devuelve yyyy-mm-dd. Convertimos a dd/mm/yyyy
    // para mantener la convención del sistema.
    const iso = e.target.value
    if (!iso) {
      onChange('')
      return
    }
    onChange(toCallDateFormat(iso))
  }

  return (
    <input
      type="date"
      id={id}
      name={name}
      value={isoValue}
      onChange={handleChange}
      onBlur={onBlur}
      required={required}
      disabled={disabled}
      className={className}
      min={isoMin}
      max={isoMax}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  )
}

export default DateInput

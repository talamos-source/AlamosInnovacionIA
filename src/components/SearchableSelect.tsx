import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, Search, Check, X } from 'lucide-react'
import './SearchableSelect.css'

/* ============================================================
   SearchableSelect — desplegable con búsqueda integrada
   ============================================================
   Drop-in replacement para <select> nativo, con buscador
   automático cuando la lista es larga. Si options.length es
   menor o igual a `searchThreshold` (por defecto 6), no muestra
   el input de búsqueda — se comporta como un dropdown clásico.

   Modo single-select:
     <SearchableSelect
       value={formData.country}                  // string
       onChange={(v) => setForm({ ...form, country: v })}
       options={countries}                        // string[] | Option[]
       placeholder="Selecciona país"
     />

   Modo multi-select:
     <SearchableSelect
       multi
       value={formData.regions}                   // string[]
       onChange={(values) => setForm({ ...form, regions: values })}
       options={spanishRegions}
       placeholder="Selecciona regiones"
     />
   ============================================================ */

export interface SelectOption {
  value: string
  label: string
  /** Texto extra que también se considera al filtrar (alias, descripción) */
  searchTerms?: string
  disabled?: boolean
}

type OptionsInput = string[] | SelectOption[]

interface BaseProps {
  options: OptionsInput
  placeholder?: string
  searchPlaceholder?: string
  /** Si options.length <= este número, no se muestra el buscador. Default 6. */
  searchThreshold?: number
  disabled?: boolean
  className?: string
  id?: string
  /** Permite limpiar la selección con un botón ✕ */
  clearable?: boolean
}

interface SingleProps extends BaseProps {
  multi?: false
  value: string
  onChange: (value: string) => void
}

interface MultiProps extends BaseProps {
  multi: true
  value: string[]
  onChange: (value: string[]) => void
}

type Props = SingleProps | MultiProps

const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const toOptions = (input: OptionsInput): SelectOption[] => {
  return input.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
}

const SearchableSelect = (props: Props) => {
  const {
    options,
    placeholder = 'Selecciona…',
    searchPlaceholder = 'Buscar…',
    searchThreshold = 6,
    disabled,
    className,
    id,
    clearable,
  } = props

  const normalizedOptions = useMemo(() => toOptions(options), [options])
  const showSearch = normalizedOptions.length > searchThreshold

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  /* Filtrado */
  const filtered = useMemo(() => {
    if (!search.trim()) return normalizedOptions
    const q = normalize(search)
    return normalizedOptions.filter(o => {
      const hay = normalize(o.label) + ' ' + normalize(o.searchTerms || '')
      return hay.includes(q)
    })
  }, [normalizedOptions, search])

  /* Selección actual */
  const isSelected = (val: string): boolean => {
    if (props.multi) return props.value.includes(val)
    return props.value === val
  }

  const handleSelect = (val: string) => {
    if (props.multi) {
      const next = props.value.includes(val)
        ? props.value.filter(v => v !== val)
        : [...props.value, val]
      props.onChange(next)
      // No cerramos en multi — la usuaria puede seguir seleccionando
    } else {
      props.onChange(val)
      setOpen(false)
      setSearch('')
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (props.multi) {
      props.onChange([])
    } else {
      props.onChange('')
    }
  }

  /* Click fuera cierra */
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  /* Focus buscador al abrir */
  useEffect(() => {
    if (open && showSearch) {
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open, showSearch])

  /* Keyboard nav */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
      setActiveIndex(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[activeIndex]
      if (opt && !opt.disabled) handleSelect(opt.value)
    }
  }, [open, filtered, activeIndex, props.multi])

  /* Label en el trigger */
  const triggerLabel: string = useMemo(() => {
    if (props.multi) {
      if (props.value.length === 0) return ''
      if (props.value.length === 1) {
        const o = normalizedOptions.find(o => o.value === props.value[0])
        return o?.label || props.value[0]
      }
      return `${props.value.length} seleccionados`
    } else {
      if (!props.value) return ''
      const o = normalizedOptions.find(o => o.value === props.value)
      return o?.label || props.value
    }
  }, [props.value, normalizedOptions, props.multi])

  const hasValue = props.multi ? props.value.length > 0 : !!props.value

  return (
    <div
      ref={wrapperRef}
      className={`ss-wrap ${open ? 'ss-wrap--open' : ''} ${disabled ? 'ss-wrap--disabled' : ''} ${className || ''}`}
    >
      <button
        type="button"
        id={id}
        className="ss-trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`ss-trigger-label ${!hasValue ? 'ss-trigger-label--placeholder' : ''}`}>
          {hasValue ? triggerLabel : placeholder}
        </span>
        <span className="ss-trigger-icons">
          {clearable && hasValue && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpiar"
              className="ss-clear"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClear(e as unknown as React.MouseEvent)
                }
              }}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={14} className="ss-chev" />
        </span>
      </button>

      {open && (
        <div className="ss-dropdown" role="listbox">
          {showSearch && (
            <div className="ss-search">
              <Search size={14} />
              <input
                ref={inputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setActiveIndex(0) }}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}
          <ul ref={listRef} className="ss-list">
            {filtered.length === 0 ? (
              <li className="ss-empty">Sin resultados</li>
            ) : (
              filtered.map((opt, i) => {
                const selected = isSelected(opt.value)
                const active = i === activeIndex
                return (
                  <li
                    key={opt.value}
                    className={`ss-option ${selected ? 'ss-option--selected' : ''} ${active ? 'ss-option--active' : ''} ${opt.disabled ? 'ss-option--disabled' : ''}`}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    onMouseEnter={() => setActiveIndex(i)}
                    role="option"
                    aria-selected={selected}
                  >
                    <span className="ss-option-check">
                      {selected && <Check size={14} />}
                    </span>
                    <span className="ss-option-label">{opt.label}</span>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SearchableSelect

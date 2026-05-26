import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Loader2 } from 'lucide-react'
import styles from './SalesforceLookupInput.module.css'

type LookupRecord = Record<string, unknown>

function getField(rec: LookupRecord, path: string): string {
  const parts = path.split('.')
  let cur: unknown = rec
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return ''
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur != null ? String(cur) : ''
}

interface MetaField {
  label: string
  field: string
}

interface SalesforceLookupInputProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (record: LookupRecord) => void
  sObject: string
  queryFields: string[]
  searchFields: string[]
  valueField: string
  displayField: string
  subLabelField?: string
  orderBy?: string
  extraWhere?: string
  placeholder?: string
  apiVersion: string
  metaFields?: MetaField[]
  metaValues?: Record<string, string>
}

export function SalesforceLookupInput({
  value,
  onChange,
  onSelect,
  sObject,
  queryFields,
  searchFields,
  valueField,
  displayField,
  subLabelField,
  orderBy,
  extraWhere,
  placeholder,
  apiVersion,
  metaFields,
  metaValues,
}: SalesforceLookupInputProps) {
  const [open, setOpen] = useState(false)
  // Text shown in the main input; doubles as the live search query when open
  const [inputText, setInputText] = useState(value)
  // The friendly display name of the last confirmed selection
  const [selectedDisplay, setSelectedDisplay] = useState('')
  const [records, setRecords] = useState<LookupRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputRowRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // When value changes externally and we are not in an open search session,
  // reset the display back to the raw value (e.g. on form load / clear)
  useEffect(() => {
    if (!open) {
      setInputText(value)
      if (!value) setSelectedDisplay('')
    }
  }, [value, open])

  function buildSoql(term: string): string {
    const cols = queryFields.join(', ')
    const termParts = term.trim()
      ? searchFields.map(f => `${f} LIKE '%${term.replace(/'/g, "\\'")}%'`)
      : []
    const conditions = [...termParts, ...(extraWhere ? [extraWhere] : [])]
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const order = orderBy ? `ORDER BY ${orderBy}` : ''
    return [`SELECT ${cols}`, `FROM ${sObject}`, where, order, 'LIMIT 20']
      .filter(Boolean)
      .join(' ')
  }

  // Fetch records when open or inputText changes
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    let cancelled = false
    const delay = inputText === '' ? 0 : 300
    const timer = setTimeout(async () => {
      try {
        const soql = buildSoql(inputText)
        const res = await fetch(
          `/api/salesforce/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`
        )
        if (cancelled) return
        if (!res.ok) {
          const body = await res.json() as { message?: string }[]
          const msg = Array.isArray(body) && body[0]?.message ? body[0].message : `HTTP ${res.status}`
          setError(msg)
          setLoading(false)
          return
        }
        const data = await res.json() as { records: LookupRecord[] }
        if (!cancelled) {
          setRecords(data.records ?? [])
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Fetch failed')
          setLoading(false)
        }
      }
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, open, apiVersion, sObject])

  // Position the dropdown below the input row
  useLayoutEffect(() => {
    if (!open || !inputRowRef.current) return
    const rect = inputRowRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
  }, [open])

  // Close on scroll outside the dropdown
  useEffect(() => {
    if (!open) return
    function handleScroll(e: Event) {
      if (dropdownRef.current?.contains(e.target as Node)) return
      closeDropdown()
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [open])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      closeDropdown()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function closeDropdown() {
    setOpen(false)
    // Revert the input to the last good display/value
    setInputText(selectedDisplay || value)
  }

  function handleInputFocus() {
    // Clear the input so the user can type a fresh search query;
    // empty search loads all records immediately
    setInputText('')
    setRecords([])
    setError(null)
    setOpen(true)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputText(e.target.value)
    if (!open) setOpen(true)
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeDropdown()
      inputRef.current?.blur()
    }
  }

  function selectRecord(record: LookupRecord) {
    const val = getField(record, valueField)
    const display = getField(record, displayField)
    onChange(val)
    onSelect?.(record)
    setSelectedDisplay(display || val)
    setInputText(display || val)
    setOpen(false)
  }

  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      className={styles.dropdown}
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
      role="listbox"
    >
      <div className={styles.results}>
        {loading && (
          <div className={styles.statusRow}>
            <Loader2 size={14} className={styles.spinner} />
            <span>Loading…</span>
          </div>
        )}
        {!loading && error && (
          <div className={styles.errorRow}>{error}</div>
        )}
        {!loading && !error && records.length === 0 && (
          <div className={styles.emptyRow}>No results</div>
        )}
        {!loading && !error && records.map((rec, i) => (
          <button
            key={i}
            type="button"
            className={styles.resultItem}
            onPointerDown={e => { e.preventDefault(); selectRecord(rec) }}
          >
            <span className={styles.resultDisplay}>{getField(rec, displayField)}</span>
            {subLabelField && getField(rec, subLabelField) !== getField(rec, displayField) && (
              <span className={styles.resultSub}>{getField(rec, subLabelField)}</span>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className={styles.root} ref={containerRef}>
      <div className={styles.inputRow} ref={inputRowRef}>
        <input
          ref={inputRef}
          className={styles.textInput}
          value={inputText}
          onFocus={handleInputFocus}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder={open ? `Search ${sObject}…` : (placeholder ?? '')}
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <button
          type="button"
          className={styles.searchBtn}
          onClick={() => inputRef.current?.focus()}
          tabIndex={-1}
          aria-label={`Browse ${sObject}`}
        >
          <Search size={14} />
        </button>
      </div>
      {metaValues && metaFields && metaFields.length > 0 && (
        <div className={styles.metaFields}>
          {metaFields.map(({ label, field }) => {
            const val = metaValues[field]
            if (!val) return null
            return (
              <div key={field} className={styles.metaRow}>
                <span className={styles.metaLabel}>{label}</span>
                <code className={styles.metaValue}>{val}</code>
              </div>
            )
          })}
        </div>
      )}
      {dropdown}
    </div>
  )
}

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
  field: string  // dot-notation path into the selected record
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
  metaFields?: MetaField[]        // which fields to display below the input
  metaValues?: Record<string, string>  // controlled: persisted values from parent
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
  const [searchTerm, setSearchTerm] = useState('')
  const [records, setRecords] = useState<LookupRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRowRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // Fetch records when open or searchTerm changes
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    let cancelled = false
    const delay = searchTerm === '' ? 0 : 300
    const timer = setTimeout(async () => {
      try {
        const soql = buildSoql(searchTerm)
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
  }, [searchTerm, open, apiVersion, sObject])

  // Calculate dropdown position anchored to the input row
  useLayoutEffect(() => {
    if (!open || !inputRowRef.current) return
    const rect = inputRowRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
  }, [open])

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (open) searchInputRef.current?.focus()
  }, [open])

  // Close on scroll outside the dropdown
  useEffect(() => {
    if (!open) return
    function handleScroll(e: Event) {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
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
      setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function openDropdown() {
    setSearchTerm('')
    setRecords([])
    setError(null)
    setOpen(true)
  }

  function selectRecord(record: LookupRecord) {
    onChange(getField(record, valueField))
    onSelect?.(record)
    setOpen(false)
    setSearchTerm('')
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
  }

  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      className={styles.dropdown}
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
      role="listbox"
    >
      <div className={styles.dropdownSearch}>
        <Search size={12} className={styles.dropdownSearchIcon} />
        <input
          ref={searchInputRef}
          className={styles.dropdownSearchInput}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={`Search ${sObject}…`}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

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
          className={styles.textInput}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className={styles.searchBtn}
          onClick={openDropdown}
          aria-label={`Browse ${sObject}`}
          aria-expanded={open}
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

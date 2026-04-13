import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useSiteBranding } from '../branding/SiteBrandingContext'
import { hexToRgb } from '../branding/colorUtils'
import { DEFAULT_BRANDING, type SiteBranding, type SiteBrandingColors } from '../branding/types'
import styles from './AdminGeneralPage.module.css'

const MAX_LOGO_BYTES = 1024 * 1024

function brandingSignature(b: SiteBranding): string {
  return JSON.stringify(b)
}

function normalizeHex(raw: string): string | null {
  const s = raw.replace(/^#/, '').trim()
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(s)) return null
  const full =
    s.length === 3
      ? s
          .split('')
          .map((c) => c + c)
          .join('')
      : s
  return '#' + full.toLowerCase()
}

const COLOR_FIELDS: {
  key: keyof SiteBrandingColors
  label: string
  hint: string
}[] = [
  {
    key: 'main',
    label: 'Main',
    hint: 'Primary accent (buttons, links, focus)',
  },
  {
    key: 'highlight',
    label: 'Highlight',
    hint: 'Top bar, sidebar, and card surfaces',
  },
  {
    key: 'background',
    label: 'Background',
    hint: 'Page background behind content',
  },
  {
    key: 'text',
    label: 'Text',
    hint: 'Body text; muted shades are derived',
  },
]

export function AdminGeneralPage() {
  const { branding, setBranding } = useSiteBranding()
  const [draft, setDraft] = useState<SiteBranding>(() => structuredClone(branding))
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const idPrefix = useId()

  useEffect(() => {
    setDraft(structuredClone(branding))
  }, [branding])

  const isDirty = useMemo(
    () => brandingSignature(draft) !== brandingSignature(branding),
    [draft, branding],
  )

  const uploadLocksUrl = draft.logoMode === 'upload' && Boolean(draft.logoDataUrl)

  const onSiteNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDraft((prev) => ({ ...prev, siteName: e.target.value }))
  }, [])

  const onLogoUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDraft((prev) => ({
      ...prev,
      logoMode: 'url',
      logoUrl: e.target.value,
      logoDataUrl: '',
    }))
    setFileKey((k) => k + 1)
  }, [])

  const onFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      setFileError('File must be 1 MB or smaller.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') return
      setDraft((prev) => ({
        ...prev,
        logoMode: 'upload',
        logoDataUrl: result,
      }))
    }
    reader.onerror = () => setFileError('Could not read that file.')
    reader.readAsDataURL(file)
  }, [])

  const clearLogo = useCallback(() => {
    setFileError(null)
    setFileKey((k) => k + 1)
    setDraft((prev) => {
      const url = prev.logoUrl.trim()
      if (url.startsWith('https://')) {
        return { ...prev, logoMode: 'url', logoDataUrl: '' }
      }
      return { ...prev, logoMode: 'default', logoUrl: '', logoDataUrl: '' }
    })
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const setColor = useCallback((key: keyof SiteBrandingColors, hex: string) => {
    setDraft((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: hex },
    }))
  }, [])

  const onHexBlur = useCallback(
    (key: keyof SiteBrandingColors, raw: string) => {
      const n = normalizeHex(raw)
      if (n && hexToRgb(n)) {
        setColor(key, n)
        return
      }
      setColor(key, DEFAULT_BRANDING.colors[key])
    },
    [setColor],
  )

  const onSave = useCallback(() => {
    setBranding(structuredClone(draft))
  }, [draft, setBranding])

  const onRevertToDefaults = useCallback(() => {
    setFileError(null)
    setFileKey((k) => k + 1)
    if (fileRef.current) fileRef.current.value = ''
    setBranding(structuredClone(DEFAULT_BRANDING))
  }, [setBranding])

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>General</h1>
      <p className={styles.lead}>
        Site-wide branding is saved in this browser when you click Save. The top navigation and tab
        title update after you save (or after Revert to defaults).
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={!isDirty}
          onClick={onSave}
        >
          Save
        </button>
        <button type="button" className={styles.btn} onClick={onRevertToDefaults}>
          Revert to Defaults
        </button>
      </div>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Site name</legend>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-site-name`}>
            Display name
          </label>
          <input
            id={`${idPrefix}-site-name`}
            className={styles.input}
            type="text"
            autoComplete="off"
            value={draft.siteName}
            onChange={onSiteNameChange}
          />
          <p className={styles.hint}>Shown in the header and as the browser tab title.</p>
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Logo</legend>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-logo-url`}>
            Image URL
          </label>
          <input
            id={`${idPrefix}-logo-url`}
            className={styles.input}
            type="url"
            inputMode="url"
            placeholder="https://example.com/logo.svg"
            autoComplete="off"
            disabled={uploadLocksUrl}
            value={draft.logoUrl}
            onChange={onLogoUrlChange}
          />
          <p className={styles.hint}>
            Use a direct HTTPS link to your logo. Disabled while a file upload is active (clear below
            to use a URL).
          </p>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Upload file</span>
          <div className={styles.row}>
            <input
              key={fileKey}
              ref={fileRef}
              className={styles.fileInput}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={onFile}
            />
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={clearLogo}>
              Clear logo
            </button>
          </div>
          <p className={styles.hint}>PNG, SVG, or JPG up to 1 MB. Stored locally in this browser as a data URL.</p>
          {fileError ? <p className={styles.err}>{fileError}</p> : null}
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Styling</legend>
        {COLOR_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className={styles.colorRow}>
            <input
              className={styles.colorPicker}
              type="color"
              aria-label={`${label} color`}
              value={
                hexToRgb(draft.colors[key])
                  ? draft.colors[key]
                  : DEFAULT_BRANDING.colors[key]
              }
              onChange={(e) => setColor(key, e.target.value)}
            />
            <input
              className={styles.hexInput}
              type="text"
              spellCheck={false}
              aria-label={`${label} hex`}
              value={draft.colors[key]}
              onChange={(e) => setColor(key, e.target.value)}
              onBlur={(e) => onHexBlur(key, e.target.value)}
            />
            <div className={styles.colorMeta}>
              <span className={styles.colorLabel}>{label}</span>
              <p className={styles.hint}>{hint}</p>
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  )
}

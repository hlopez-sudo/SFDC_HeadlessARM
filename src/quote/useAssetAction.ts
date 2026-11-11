import { useCallback, useRef, useState } from 'react'
import { useSalesforceConfig } from '../salesforce/SalesforceConfigContext'
import type { AssetRecord } from '../hooks/useAccountAssets'
import {
  buildAssetActionRequests,
  parseAssetActionResponse,
  parseReadBack,
  readBackUrl,
  type AssetActionDef,
  type AssetActionForm,
  type ResultLine,
} from '../salesforce/assetActions'
import { activateOrder } from './orderActivation'
import type { LifecycleStep } from './useBuyNow'

const READ_BACK_ATTEMPTS = 3

export type AssetActionState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  loadingStep: string | null
  /** Created Quote or Order; kept on error when a later step (e.g. activation) failed. */
  recordId: string | null
  error: string | null
  requestUrl: string | null
  requestBody: unknown | null
  apiResponse: unknown | null
  lifecycleSteps: LifecycleStep[]
  resultLines: ResultLine[]
}

const IDLE: AssetActionState = {
  status: 'idle',
  loadingStep: null,
  recordId: null,
  error: null,
  requestUrl: null,
  requestBody: null,
  apiResponse: null,
  lifecycleSteps: [],
  resultLines: [],
}

export function useAssetAction() {
  const { orgInfo } = useSalesforceConfig()
  const [state, setState] = useState<AssetActionState>(IDLE)
  const stepsRef = useRef<LifecycleStep[]>([])

  const submit = useCallback(
    async (action: AssetActionDef, assets: AssetRecord[], form: AssetActionForm, activate: boolean) => {
      const apiVersion = orgInfo.apiVersion
      const { url, bodies } = buildAssetActionRequests(action, assets, form, apiVersion)
      const isChained = bodies.length > 1

      function addStep(step: LifecycleStep): number {
        stepsRef.current = [...stepsRef.current, step]
        setState((prev) => ({ ...prev, lifecycleSteps: [...stepsRef.current] }))
        return stepsRef.current.length - 1
      }
      function patchStep(index: number, patch: Partial<LifecycleStep>) {
        stepsRef.current = stepsRef.current.map((s, i) => (i === index ? { ...s, ...patch } : s))
        setState((prev) => ({ ...prev, lifecycleSteps: [...stepsRef.current] }))
      }
      function setLoadingStep(label: string) {
        setState((prev) => ({ ...prev, loadingStep: label }))
      }

      stepsRef.current = []
      setState({
        ...IDLE,
        status: 'loading',
        loadingStep: `Submitting ${action.label.toLowerCase()} request…`,
        requestUrl: url,
        requestBody: isChained ? bodies : bodies[0],
      })

      try {
        let recordId: string | null = null
        const sent: Record<string, unknown>[] = []
        const responses: unknown[] = []
        for (const [i, template] of bodies.entries()) {
          const body =
            recordId && action.outputRecordIdField ? { ...template, [action.outputRecordIdField]: recordId } : template
          if (isChained) setLoadingStep(`Submitting request ${i + 1} of ${bodies.length}…`)
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = (await res.json().catch(() => null)) as unknown
          sent.push(body)
          responses.push(data)
          const requestBody = isChained ? [...sent] : body
          const apiResponse = isChained ? [...responses] : data
          setState((prev) => ({ ...prev, requestBody, apiResponse }))

          const parsed = parseAssetActionResponse(action, res.ok, res.status, data)
          if (!parsed.recordId) {
            const prefix = isChained ? `Request ${i + 1} of ${bodies.length} failed: ` : ''
            throw new Error(prefix + (parsed.error ?? 'Request failed.'))
          }
          if (!recordId) {
            const createdId = parsed.recordId
            recordId = createdId
            setState((prev) => ({ ...prev, recordId: createdId }))
          }
        }
        if (!recordId) throw new Error('Request failed.')

        const linesUrl = readBackUrl(form.outputRecordType, recordId, apiVersion)
        const readIdx = addStep({ name: `Read ${form.outputRecordType} lines`, status: 'running', method: 'GET', url: linesUrl })
        setLoadingStep(`Reading ${form.outputRecordType.toLowerCase()} lines…`)
        let lines: ResultLine[] = []
        let readData: unknown = null
        let readOk = false
        for (let attempt = 1; attempt <= READ_BACK_ATTEMPTS; attempt++) {
          if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
          const readRes = await fetch(linesUrl)
          readData = (await readRes.json().catch(() => null)) as unknown
          readOk = readRes.ok
          if (!readOk) break
          const records = (readData as { records?: Record<string, unknown>[] }).records ?? []
          lines = parseReadBack(form.outputRecordType, records)
          if (lines.length) break
        }
        // The record exists either way, so a failed read-back is reported but not fatal.
        patchStep(readIdx, readOk
          ? { status: 'done', response: readData }
          : { status: 'error', response: readData, error: 'Could not read the created lines.' })
        setState((prev) => ({ ...prev, resultLines: lines }))

        if (activate && form.outputRecordType === 'Order') {
          await activateOrder(apiVersion, recordId, { addStep, patchStep, setLoadingStep })
        }

        setState((prev) => ({ ...prev, status: 'success', loadingStep: null }))
      } catch (e: unknown) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          loadingStep: null,
          error: e instanceof Error ? e.message : 'An unexpected error occurred.',
          lifecycleSteps: [...stepsRef.current],
        }))
      }
    },
    [orgInfo.apiVersion],
  )

  const reset = useCallback(() => {
    stepsRef.current = []
    setState(IDLE)
  }, [])

  return { submit, state, reset }
}

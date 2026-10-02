// ---------------------------------------------------------------------------
// extractPstErrorMessage — pulls a readable message out of a failed Place Sales
// Transaction response.
//
// PST reports per-record failures in its own envelope rather than the usual REST
// error array:
//   { "errorResponse": [{ "errorCode": "...", "message": "...", "referenceId": "refQuoteLine1" }],
//     "isSuccess": false, "salesTransactionId": "" }
// ---------------------------------------------------------------------------

type PstErrorEntry = {
  errorCode?: string
  message?: string
  referenceId?: string
}

export function extractPstErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const envelope = data as { errorResponse?: unknown }
    if (Array.isArray(envelope.errorResponse)) {
      const messages = (envelope.errorResponse as PstErrorEntry[])
        .map((e) => (e.referenceId ? `${e.referenceId}: ${e.message ?? e.errorCode}` : e.message ?? e.errorCode))
        .filter((m): m is string => !!m)
      if (messages.length) return messages.join(' | ')
    }
  }

  // Standard REST error array, then a plain { message } body
  if (Array.isArray(data) && (data[0] as { message?: string })?.message) {
    return (data[0] as { message: string }).message
  }
  if (data && typeof data === 'object' && (data as { message?: string }).message) {
    return (data as { message: string }).message
  }

  return `Request failed: HTTP ${status}`
}

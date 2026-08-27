// Téléchargements côté client (CSV, JSON) — génère un Blob et déclenche
// l'enregistrement via un lien temporaire.

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function escapeCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')
  // BOM pour qu'Excel lise l'UTF-8 (accents) correctement.
  triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename)
}

export function downloadJson(filename: string, data: unknown) {
  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename)
}

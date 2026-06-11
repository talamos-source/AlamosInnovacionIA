/**
 * Extrae texto plano de un archivo subido por el usuario.
 * Soporta PDF, DOCX, TXT, MD. El texto extraído se envía al backend
 * para que Claude pueda analizar el contenido.
 */

// @ts-ignore — pdfjs-dist se instala en build (deps en package.json)
import * as pdfjsLib from 'pdfjs-dist'
// @ts-ignore — Vite resuelve ?url para dar la ruta absoluta al worker
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

;(pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string

/** Tamaño máximo de texto extraído por documento (caracteres). Evita pasarse de tokens. */
const MAX_TEXT_CHARS = 30000

export interface ExtractionResult {
  text: string
  ok: boolean
  error?: string
}

const truncate = (text: string): string => {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  return trimmed.length > MAX_TEXT_CHARS
    ? trimmed.slice(0, MAX_TEXT_CHARS) + '\n…[truncated]'
    : trimmed
}

async function extractFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = textContent.items.map((item: any) => item.str).join(' ')
    pages.push(pageText)
  }
  return pages.join('\n\n')
}

async function extractFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  // Import dinámico para que mammoth no bloquee el bundle inicial
  // @ts-ignore — mammoth se instala en build (deps en package.json)
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function extractFromTXT(file: File): Promise<string> {
  return await file.text()
}

async function extractFromExcel(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  // @ts-ignore — xlsx se instala en build (deps en package.json)
  const XLSX = await import('xlsx')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workbook = (XLSX as any).read(arrayBuffer, { type: 'array' })
  const sheetNames: string[] = workbook.SheetNames || []

  const sheets: string[] = []
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    // CSV-like es el formato más legible para que Claude entienda la tabla
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csv: string = (XLSX as any).utils.sheet_to_csv(sheet, { strip: true })
    if (csv && csv.trim().length > 0) {
      sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`)
    }
  }
  return sheets.join('\n\n')
}

async function extractFromCSV(file: File): Promise<string> {
  // CSV es texto plano — basta con leerlo
  return await file.text()
}

const isExcel = (file: File, name: string): boolean => {
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) return true
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  ) return true
  return false
}

const isCSV = (file: File, name: string): boolean => {
  if (name.endsWith('.csv') || name.endsWith('.tsv')) return true
  if (file.type === 'text/csv' || file.type === 'text/tab-separated-values') return true
  return false
}

export async function extractDocumentText(file: File): Promise<ExtractionResult> {
  const name = file.name.toLowerCase()
  try {
    let raw = ''
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      raw = await extractFromPDF(file)
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx') ||
      name.endsWith('.doc')
    ) {
      raw = await extractFromDOCX(file)
    } else if (isExcel(file, name)) {
      raw = await extractFromExcel(file)
    } else if (isCSV(file, name)) {
      raw = await extractFromCSV(file)
    } else if (
      file.type === 'text/plain' ||
      file.type === 'text/markdown' ||
      name.endsWith('.txt') ||
      name.endsWith('.md')
    ) {
      raw = await extractFromTXT(file)
    } else {
      return {
        text: '',
        ok: false,
        error: `Unsupported file type (${file.type || 'unknown'}). Supported: PDF, DOCX, XLSX, XLS, CSV, TXT, MD.`,
      }
    }

    const cleaned = truncate(raw)
    if (!cleaned) {
      return { text: '', ok: false, error: 'Empty document or no text extracted.' }
    }
    return { text: cleaned, ok: true }
  } catch (err) {
    return {
      text: '',
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to extract text',
    }
  }
}

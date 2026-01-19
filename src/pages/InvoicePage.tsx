import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formatCurrency } from '../utils/formatCurrency'
import './Page.css'

const formatDate = (iso: string) => {
  if (!iso) return ''
  const date = new Date(iso)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const InvoicePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vatOption, setVatOption] = useState<'21' | 'exempt'>('21')

  useEffect(() => {
    const previousTitle = document.title
    document.title = ''
    return () => {
      document.title = previousTitle
    }
  }, [])

  const invoice = useMemo(() => {
    const saved = localStorage.getItem('invoices')
    const invoices = saved ? JSON.parse(saved) : []
    return invoices.find((inv: { id: string }) => inv.id === id)
  }, [id])

  const company = useMemo(() => {
    const stored = localStorage.getItem('companySettings')
    return stored ? JSON.parse(stored) : {}
  }, [])

  const customer = useMemo(() => {
    if (!invoice?.clientName) return null
    const stored = localStorage.getItem('customers')
    const customers = stored ? JSON.parse(stored) : []
    return customers.find((c: { name: string }) => c.name === invoice.clientName)
  }, [invoice])

  if (!invoice) {
    return (
      <div className="page">
        <div className="empty-state">Invoice not found.</div>
      </div>
    )
  }

  const taxableBase = parseFloat(invoice.amount || '0')
  const vatAmount = vatOption === '21' ? taxableBase * 0.21 : 0
  const total = vatOption === '21' ? taxableBase + vatAmount : taxableBase

  const ensureInvoiceNumber = (invoices: any[]) => {
    const now = new Date()
    const year = now.getFullYear()
    const sameYear = invoices.filter((inv: { number?: string; status?: string }) =>
      inv.status === 'sent' &&
      typeof inv.number === 'string' &&
      inv.number.startsWith(`${year}/`)
    )
    const maxSeq = sameYear.reduce((max: number, inv: { number?: string }) => {
      const parts = inv.number?.split('/') || []
      const seq = parts[1] ? parseInt(parts[1], 10) : 0
      return Number.isFinite(seq) ? Math.max(max, seq) : max
    }, 0)
    const nextSeq = (maxSeq + 1).toString().padStart(3, '0')
    return `${year}/${nextSeq}`
  }

  const handleSave = () => {
    const saved = localStorage.getItem('invoices')
    const invoices = saved ? JSON.parse(saved) : []
    const index = invoices.findIndex((inv: { id: string }) => inv.id === invoice.id)
    if (index >= 0) {
      invoices[index] = {
        ...invoices[index],
        vatOption,
        vatAmount,
        total
      }
    } else {
      invoices.push({
        ...invoice,
        vatOption,
        vatAmount,
        total
      })
    }
    localStorage.setItem('invoices', JSON.stringify(invoices))
  }

  const updateBillingStatus = (status: string) => {
    const savedProjects = localStorage.getItem('projects')
    if (!savedProjects) return
    const projects = JSON.parse(savedProjects)
    const updatedProjects = projects.map((proj: any) => {
      if (proj.id !== invoice.projectId) return proj
      if (!proj.billingSchedule) return proj
      const updatedSchedule = proj.billingSchedule.map((b: any) =>
        b.id === invoice.billingId ? { ...b, invoiceStatus: status } : b
      )
      return { ...proj, billingSchedule: updatedSchedule }
    })
    localStorage.setItem('projects', JSON.stringify(updatedProjects))
  }

  const handleSend = () => {
    const saved = localStorage.getItem('invoices')
    const invoices = saved ? JSON.parse(saved) : []
    const number = ensureInvoiceNumber(invoices)
    const sentAt = new Date().toISOString()
    const index = invoices.findIndex((inv: { id: string }) => inv.id === invoice.id)
    if (index >= 0) {
      invoices[index] = {
        ...invoices[index],
        number,
        date: sentAt,
        status: 'sent',
        vatOption,
        vatAmount,
        total
      }
    } else {
      invoices.push({
        ...invoice,
        number,
        date: sentAt,
        status: 'sent',
        vatOption,
        vatAmount,
        total
      })
    }
    localStorage.setItem('invoices', JSON.stringify(invoices))
    updateBillingStatus('Invoice_sent')
    // Trigger print dialog for PDF saving
    window.print()
    // Open Gmail compose in a new tab (attachments must be added manually)
    const subject = encodeURIComponent(`Invoice ${number}`)
    const body = encodeURIComponent('Please find the invoice attached.\n\nNOTE: Attach the PDF you saved from the print dialog.')
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank', 'noopener,noreferrer')
  }

  const handleCancel = () => {
    navigate('/billing')
  }


  return (
    <div className="page invoice-page">
      <div className="invoice-document">
        <div className="invoice-header">
          <div className="invoice-left">
            <img src="/logo.png?v=2" alt="Alamos IA" className="invoice-logo" />
            <div className="invoice-company">
              <div className="invoice-company-name">{company.legalName || '-'}</div>
              <div className="invoice-company-line">TAX ID: {company.taxId || '-'}</div>
              <div className="invoice-company-line">{company.address || '-'}</div>
            </div>
            <div className="invoice-meta">
              <div><strong>Date:</strong> {formatDate(invoice.date)}</div>
              <div><strong>Invoice Number:</strong> {invoice.number || '-'}</div>
            </div>
          </div>

          <div className="invoice-right">
            <div className="invoice-customer-title">CUSTOMER</div>
            <div className="invoice-customer">
              <div className="invoice-company-name">{customer?.company || '-'}</div>
              <div className="invoice-company-line">TAX ID: {customer?.taxId || '-'}</div>
              <div className="invoice-company-line">{customer?.address || '-'}</div>
            </div>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Description</th>
              <th>Quantity €</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{invoice.projectName}</td>
              <td>{invoice.description || '-'}</td>
              <td>{formatCurrency(taxableBase)}</td>
            </tr>
          </tbody>
        </table>

        <div className="invoice-summary">
          <table className="invoice-summary-table">
            <tbody>
              <tr>
                <td>Taxable Base €</td>
                <td>{formatCurrency(taxableBase)}</td>
              </tr>
              <tr>
                <td>VAT</td>
                <td>
                  <select
                    value={vatOption}
                    onChange={(e) => setVatOption(e.target.value as '21' | 'exempt')}
                    className="invoice-vat-select"
                  >
                    <option value="21">21%</option>
                    <option value="exempt">Transaction not subject to VAT due to location rules</option>
                  </select>
                  <div className="invoice-vat-amount">
                    {vatOption === '21' ? formatCurrency(vatAmount) : formatCurrency(0)}
                  </div>
                </td>
              </tr>
              <tr className="invoice-total-row">
                <td>Total €</td>
                <td>{formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="invoice-notes">
          <strong>NOTES:</strong> Payment by bank transfer to the current account of ALAMOS INNOVACIÓN S.L at BBVA with number ES53 0182 1940 20 0201590924
        </div>
      </div>

      <div className="invoice-actions">
        <button type="button" className="btn-secondary" onClick={handleCancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={handleSave}>
          Save
        </button>
        <button type="button" className="btn-primary" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  )
}

export default InvoicePage

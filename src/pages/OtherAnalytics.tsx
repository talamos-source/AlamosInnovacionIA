import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatCurrency, formatNumber, parseEuropeanNumber } from '../utils/formatCurrency'
import './Page.css'

interface Service {
  id: string
  primaryClient: string
  secondaryClient?: string
  fee: string
  status: string
  createdAt?: string
}

interface Customer {
  id: string
  name: string
  category: string
}

interface ClientSummary {
  primaryClientId: string
  primaryClientName: string
  secondaryClientNames: string
  inProgress: number
  sent: number
  granted: number
  dismissed: number
  totalFee: number
  achieved: number
}

const OtherAnalytics = () => {
  const [services, setServices] = useState<Service[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [yearFilter, setYearFilter] = useState('All')
  const [clientFilter, setClientFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    const loadServices = () => {
      try {
        const saved = localStorage.getItem('otherServices')
        return saved ? JSON.parse(saved) : []
      } catch (error) {
        console.error('Error loading other services:', error)
        return []
      }
    }

    const loadCustomers = () => {
      try {
        const saved = localStorage.getItem('customers')
        return saved ? JSON.parse(saved) : []
      } catch (error) {
        console.error('Error loading customers:', error)
        return []
      }
    }

    const refresh = () => {
      setServices(loadServices())
      setCustomers(loadCustomers())
    }

    refresh()
    const handleStorageChange = () => refresh()
    window.addEventListener('storage', handleStorageChange)
    const interval = setInterval(refresh, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const getClientName = (clientId: string) => {
    const client = customers.find(c => c.id === clientId)
    return client ? client.name : clientId
  }

  const getServiceYear = (service: Service) => {
    if (service.createdAt) {
      const created = new Date(service.createdAt)
      if (!Number.isNaN(created.getTime())) return String(created.getFullYear())
    }
    const idParts = service.id?.split('-')
    const timestamp = idParts?.[idParts.length - 1]
    if (timestamp) {
      const created = new Date(Number(timestamp))
      if (!Number.isNaN(created.getTime())) return String(created.getFullYear())
    }
    return 'Unknown'
  }

  const parseFee = (fee: string) => parseEuropeanNumber(fee) || 0

  const normalizeStatus = (status: string) => status.trim().toLowerCase()

  const uniqueYears = useMemo(() => {
    const years = new Set<string>()
    services.forEach(service => years.add(getServiceYear(service)))
    return Array.from(years)
      .filter(year => year !== 'Unknown')
      .sort((a, b) => b.localeCompare(a))
  }, [services])

  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesYear = yearFilter === 'All' || getServiceYear(service) === yearFilter
      const matchesClient = clientFilter === 'All' || service.primaryClient === clientFilter
      const matchesStatus =
        statusFilter === 'All' || normalizeStatus(service.status) === normalizeStatus(statusFilter)
      return matchesYear && matchesClient && matchesStatus
    })
  }, [services, yearFilter, clientFilter, statusFilter])

  const countByStatus = (list: Service[], status: string) =>
    list.filter(service => normalizeStatus(service.status) === normalizeStatus(status)).length

  const sumFees = (list: Service[]) =>
    list.reduce((sum, service) => sum + parseFee(service.fee), 0)

  const totalGrantedFees = (list: Service[]) =>
    list
      .filter(service => normalizeStatus(service.status) === 'granted')
      .reduce((sum, service) => sum + parseFee(service.fee), 0)

  const overview = useMemo(() => {
    const total = filteredServices.length
    const inProgress = countByStatus(filteredServices, 'In progress')
    const sent = countByStatus(filteredServices, 'Offer sent')
    const granted = countByStatus(filteredServices, 'Granted')
    const dismissed = countByStatus(filteredServices, 'Dismissed')
    const conversion = total > 0 ? (granted / total) * 100 : null
    const totalFees = totalGrantedFees(filteredServices)

    let growth: number | null = null
    const years = uniqueYears
    if (years.length > 0) {
      const currentYear =
        yearFilter !== 'All' ? yearFilter : years[0]
      const previousYear = String(Number(currentYear) - 1)
      const currentTotal = totalGrantedFees(
        services.filter(service => getServiceYear(service) === currentYear)
      )
      const previousTotal = totalGrantedFees(
        services.filter(service => getServiceYear(service) === previousYear)
      )
      if (previousTotal > 0) {
        growth = ((currentTotal - previousTotal) / previousTotal) * 100
      } else if (currentTotal > 0) {
        growth = 100
      }
    }

    return {
      total,
      inProgress,
      sent,
      granted,
      dismissed,
      conversion,
      totalFees,
      growth
    }
  }, [filteredServices, services, uniqueYears, yearFilter])

  const tableRows = useMemo(() => {
    const grouped = new Map<string, Service[]>()
    filteredServices.forEach(service => {
      const key = service.primaryClient
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(service)
    })

    const rows: ClientSummary[] = []
    grouped.forEach((clientServices, clientId) => {
      const secondaryClients = Array.from(
        new Set(
          clientServices
            .map(service => service.secondaryClient)
            .filter(Boolean) as string[]
        )
      )
      rows.push({
        primaryClientId: clientId,
        primaryClientName: getClientName(clientId),
        secondaryClientNames: secondaryClients.length > 0 ? secondaryClients.map(getClientName).join(', ') : '-',
        inProgress: countByStatus(clientServices, 'In progress'),
        sent: countByStatus(clientServices, 'Offer sent'),
        granted: countByStatus(clientServices, 'Granted'),
        dismissed: countByStatus(clientServices, 'Dismissed'),
        totalFee: sumFees(clientServices),
        achieved: totalGrantedFees(clientServices)
      })
    })

    return rows.sort((a, b) => a.primaryClientName.localeCompare(b.primaryClientName))
  }, [filteredServices, customers])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Other Analytics</h1>
          <p className="page-subtitle">Analytics and performance for other services</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: '500', color: '#2C3E50' }}>Filters:</span>
        <div className="select-wrapper" style={{ position: 'relative' }}>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{
              padding: '0.5rem 2.5rem 0.5rem 1rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              background: 'white',
              color: '#2C3E50',
              fontSize: '0.875rem',
              cursor: 'pointer',
              appearance: 'none'
            }}
          >
            <option value="All">All Years</option>
            {uniqueYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
        <div className="select-wrapper" style={{ position: 'relative' }}>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{
              padding: '0.5rem 2.5rem 0.5rem 1rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              background: 'white',
              color: '#2C3E50',
              fontSize: '0.875rem',
              cursor: 'pointer',
              appearance: 'none'
            }}
          >
            <option value="All">All Clients</option>
            {customers
              .filter(client => client.category === 'Contractor')
              .map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
          </select>
          <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2C3E50', marginBottom: '1rem' }}>Overview</h2>
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          paddingBottom: '0.5rem'
        }}>
          {[
            { label: 'Total', value: overview.total, color: '#2C3E50', status: 'All', border: '#8E44AD' },
            { label: 'In progress', value: overview.inProgress, color: '#64B5F6', status: 'In progress', border: '#64B5F6' },
            { label: 'Sent', value: overview.sent, color: '#FFD54F', status: 'Offer sent', border: '#FFD54F' },
            { label: 'Granted', value: overview.granted, color: '#81C784', status: 'Granted', border: '#81C784' },
            { label: 'Dismissed', value: overview.dismissed, color: '#E57373', status: 'Dismissed', border: '#E57373' },
            { label: 'Conversion', value: overview.conversion !== null ? `${formatNumber(overview.conversion, { maximumFractionDigits: 1 })}%` : '-', color: '#8E44AD', status: 'All', border: '#e2e8f0' },
            { label: 'Total fees €', value: formatCurrency(overview.totalFees), color: '#BA68C8', status: 'All', border: '#e2e8f0' },
            { label: 'Growth vs previous year', value: overview.growth !== null ? `${formatNumber(overview.growth, { maximumFractionDigits: 1 })}%` : '-', color: '#4CAF50', status: 'All', border: '#e2e8f0' }
          ].map((item) => {
            const isActive = item.status !== 'All' && statusFilter === item.status
            const isAllActive = item.status === 'All' && statusFilter === 'All' && item.label === 'Total'
            const highlight = isActive || isAllActive
            return (
              <div
                key={item.label}
                onClick={() => setStatusFilter(item.status)}
                style={{
                  background: 'white',
                  border: highlight ? `2px solid ${item.border}` : '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1.25rem 1rem',
                  textAlign: 'center',
                  minWidth: '170px',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  fontSize: item.label === 'Total fees €' ? '1.5rem' : '2rem',
                  fontWeight: '700',
                  color: item.color,
                  marginBottom: '0.5rem',
                  lineHeight: '1.1'
                }}>
                  {item.value}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {item.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="content-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2C3E50', margin: 0 }}>Performance by Client</h2>
          <span style={{
            padding: '0.25rem 0.75rem',
            background: '#f8fafc',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: '#64748b',
            fontWeight: '500'
          }}>
            {tableRows.length} clients
          </span>
        </div>

        {tableRows.length === 0 ? (
          <div className="empty-row" style={{ padding: '3rem', textAlign: 'center' }}>
            No data available for the selected filters
          </div>
        ) : (
          <table className="data-table title-case">
            <thead>
              <tr>
                <th>Primary client</th>
                <th>Secondary client</th>
                <th>In progress</th>
                <th>Sent</th>
                <th>Granted</th>
                <th>Dismissed</th>
                <th>Total fee</th>
                <th>Achieved</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(row => (
                <tr key={row.primaryClientId}>
                  <td>
                    <div style={{ fontWeight: '500', color: '#2C3E50' }}>
                      {row.primaryClientName}
                    </div>
                  </td>
                  <td>{row.secondaryClientNames}</td>
                  <td>{row.inProgress}</td>
                  <td>{row.sent}</td>
                  <td>{row.granted}</td>
                  <td>{row.dismissed}</td>
                  <td>{formatCurrency(row.totalFee)}</td>
                  <td>
                    {row.achieved > 0 ? (
                      <span style={{ color: '#4CAF50', fontWeight: '500' }}>
                        {formatCurrency(row.achieved)}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>{formatCurrency(0)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default OtherAnalytics

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatCurrency } from '../utils/formatCurrency'
import './Page.css'

interface Proposal {
  id: string
  proposal: string
  call: string
  callId: string
  fee: string
  status: string
}

interface Call {
  id: string
  name: string
  year?: string
  status: string
}

interface CallPerformance {
  callId: string
  callName: string
  year: string
  total: number
  inProgress: number
  pending: number
  funded: number
  dismissed: number
  successRate: number | null
  totalFee: number
  achieved: number
}

const CallAnalytics = () => {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [yearFilter, setYearFilter] = useState('All')
  const [callFilter, setCallFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')

  // Load data from localStorage
  useEffect(() => {
    const loadProposals = () => {
      try {
        const saved = localStorage.getItem('proposals')
        return saved ? JSON.parse(saved) : []
      } catch (error) {
        console.error('Error loading proposals:', error)
        return []
      }
    }

    const loadCalls = () => {
      try {
        const saved = localStorage.getItem('calls')
        return saved ? JSON.parse(saved) : []
      } catch (error) {
        console.error('Error loading calls:', error)
        return []
      }
    }

    setProposals(loadProposals())
    setCalls(loadCalls())

    // Listen for storage changes
    const handleStorageChange = () => {
      setProposals(loadProposals())
      setCalls(loadCalls())
    }
    window.addEventListener('storage', handleStorageChange)
    const interval = setInterval(() => {
      setProposals(loadProposals())
      setCalls(loadCalls())
    }, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // Get unique years from calls
  const getUniqueYears = () => {
    const years = new Set<string>()
    calls.forEach(call => {
      if (call.year) {
        years.add(call.year)
      }
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }

  // Calculate overview statistics
  const calculateOverview = () => {
    let filteredProposals = proposals

    // Apply year filter
    if (yearFilter !== 'All') {
      const callIdsForYear = calls
        .filter(c => c.year === yearFilter)
        .map(c => c.id)
      filteredProposals = filteredProposals.filter(p => 
        callIdsForYear.includes(p.callId)
      )
    }

    // Apply call filter
    if (callFilter !== 'All') {
      filteredProposals = filteredProposals.filter(p => 
        p.callId === callFilter
      )
    }

    const total = filteredProposals.length
    const inProgress = filteredProposals.filter(p => p.status === 'in progress').length
    const pending = filteredProposals.filter(p => p.status === 'Pending').length
    const funded = filteredProposals.filter(p => p.status === 'Granted').length
    const dismissed = filteredProposals.filter(p => p.status === 'Dismissed').length
    
    const successRate = funded + dismissed > 0 
      ? ((funded / (funded + dismissed)) * 100).toFixed(1) 
      : null

    const totalFees = filteredProposals.reduce((sum, p) => {
      const fee = parseFloat(p.fee?.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
      return sum + fee
    }, 0)

    const achieved = filteredProposals
      .filter(p => p.status === 'Granted')
      .reduce((sum, p) => {
        const fee = parseFloat(p.fee?.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
        return sum + fee
      }, 0)

    return {
      total,
      inProgress,
      pending,
      funded,
      dismissed,
      successRate,
      totalFees,
      achieved
    }
  }

  // Calculate performance by call
  const calculatePerformanceByCall = (): CallPerformance[] => {
    let filteredProposals = proposals

    // Apply year filter
    if (yearFilter !== 'All') {
      const callIdsForYear = calls
        .filter(c => c.year === yearFilter)
        .map(c => c.id)
      filteredProposals = filteredProposals.filter(p => 
        callIdsForYear.includes(p.callId)
      )
    }

    // Apply call filter
    if (callFilter !== 'All') {
      filteredProposals = filteredProposals.filter(p => 
        p.callId === callFilter
      )
    }

    // Apply status filter from panel click
    // If status filter is set, only show calls that have proposals with that status
    if (statusFilter !== 'All') {
      // First, get all proposals with the selected status
      const proposalsWithStatus = filteredProposals.filter(p => p.status === statusFilter)
      // Get unique call IDs from these proposals
      const callIdsWithStatus = new Set(proposalsWithStatus.map(p => p.callId))
      // Filter proposals to only include those from calls that have the selected status
      filteredProposals = filteredProposals.filter(p => callIdsWithStatus.has(p.callId))
    }

    // Group proposals by call
    const callGroups = new Map<string, Proposal[]>()
    filteredProposals.forEach(proposal => {
      const callId = proposal.callId
      if (!callGroups.has(callId)) {
        callGroups.set(callId, [])
      }
      callGroups.get(callId)!.push(proposal)
    })

    // Calculate metrics for each call
    const performance: CallPerformance[] = []
    callGroups.forEach((callProposals, callId) => {
      const call = calls.find(c => c.id === callId)
      if (!call) return

      const total = callProposals.length
      const inProgress = callProposals.filter(p => p.status === 'in progress').length
      const pending = callProposals.filter(p => p.status === 'Pending').length
      const funded = callProposals.filter(p => p.status === 'Granted').length
      const dismissed = callProposals.filter(p => p.status === 'Dismissed').length

      const successRate = funded + dismissed > 0
        ? ((funded / (funded + dismissed)) * 100)
        : null

      const totalFee = callProposals.reduce((sum, p) => {
        const fee = parseFloat(p.fee?.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
        return sum + fee
      }, 0)

      const achieved = callProposals
        .filter(p => p.status === 'Granted')
        .reduce((sum, p) => {
          const fee = parseFloat(p.fee?.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
          return sum + fee
        }, 0)

      performance.push({
        callId: call.id,
        callName: call.name,
        year: call.year || '-',
        total,
        inProgress,
        pending,
        funded,
        dismissed,
        successRate,
        totalFee,
        achieved
      })
    })

    // Sort by year (descending) then by call name
    return performance.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year.localeCompare(a.year)
      }
      return a.callName.localeCompare(b.callName)
    })
  }

  const overview = calculateOverview()
  const performanceByCall = calculatePerformanceByCall()
  const uniqueYears = getUniqueYears()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Calls Analytics</h1>
          <p className="page-subtitle">Analytics and performance by call</p>
        </div>
      </div>

      {/* Filters */}
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
            value={callFilter}
            onChange={(e) => setCallFilter(e.target.value)}
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
            <option value="All">All Calls</option>
            {calls.map(call => (
              <option key={call.id} value={call.id}>{call.name}</option>
            ))}
          </select>
          <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2C3E50', marginBottom: '1rem' }}>Overview</h2>
        <div style={{ 
          display: 'flex', 
          gap: '1rem',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          paddingBottom: '0.5rem'
        }}>
          <div 
            style={{ 
              background: 'white', 
              border: statusFilter === 'All' ? '2px solid #8E44AD' : '1px solid #e2e8f0', 
              borderRadius: '0.5rem', 
              padding: '1.25rem 1rem', 
              textAlign: 'center',
              minWidth: '130px',
              flexShrink: 0,
              boxSizing: 'border-box',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setStatusFilter('All')}
            onMouseEnter={(e) => {
              if (statusFilter !== 'All') {
                e.currentTarget.style.borderColor = '#8E44AD'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(142, 68, 173, 0.15)'
              }
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== 'All') {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <div style={{ 
              fontSize: '2.25rem', 
              fontWeight: '700', 
              color: '#2C3E50', 
              marginBottom: '0.5rem',
              lineHeight: '1.1'
            }}>
              {overview.total}
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: '600', 
              color: '#64748b', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              TOTAL
            </div>
          </div>

          <div 
            style={{ 
              background: 'white', 
              border: statusFilter === 'in progress' ? '2px solid #64B5F6' : '1px solid #e2e8f0', 
              borderRadius: '0.5rem', 
              padding: '1.25rem 1rem', 
              textAlign: 'center',
              minWidth: '130px',
              flexShrink: 0,
              boxSizing: 'border-box',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setStatusFilter('in progress')}
            onMouseEnter={(e) => {
              if (statusFilter !== 'in progress') {
                e.currentTarget.style.borderColor = '#64B5F6'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(100, 181, 246, 0.15)'
              }
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== 'in progress') {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <div style={{ 
              fontSize: '2.25rem', 
              fontWeight: '700', 
              color: '#64B5F6', 
              marginBottom: '0.5rem',
              lineHeight: '1.1'
            }}>
              {overview.inProgress}
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: '600', 
              color: '#64748b', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              IN PROGRESS
            </div>
          </div>

          <div 
            style={{ 
              background: 'white', 
              border: statusFilter === 'Pending' ? '2px solid #FFD54F' : '1px solid #e2e8f0', 
              borderRadius: '0.5rem', 
              padding: '1.25rem 1rem', 
              textAlign: 'center',
              minWidth: '130px',
              flexShrink: 0,
              boxSizing: 'border-box',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setStatusFilter('Pending')}
            onMouseEnter={(e) => {
              if (statusFilter !== 'Pending') {
                e.currentTarget.style.borderColor = '#FFD54F'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 213, 79, 0.15)'
              }
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== 'Pending') {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <div style={{ 
              fontSize: '2.25rem', 
              fontWeight: '700', 
              color: '#FFD54F', 
              marginBottom: '0.5rem',
              lineHeight: '1.1'
            }}>
              {overview.pending}
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: '600', 
              color: '#64748b', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              PENDING
            </div>
          </div>

          <div 
            style={{ 
              background: 'white', 
              border: statusFilter === 'Granted' ? '2px solid #81C784' : '1px solid #e2e8f0', 
              borderRadius: '0.5rem', 
              padding: '1.25rem 1rem', 
              textAlign: 'center',
              minWidth: '130px',
              flexShrink: 0,
              boxSizing: 'border-box',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setStatusFilter('Granted')}
            onMouseEnter={(e) => {
              if (statusFilter !== 'Granted') {
                e.currentTarget.style.borderColor = '#81C784'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(129, 199, 132, 0.15)'
              }
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== 'Granted') {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <div style={{ 
              fontSize: '2.25rem', 
              fontWeight: '700', 
              color: '#81C784', 
              marginBottom: '0.5rem',
              lineHeight: '1.1'
            }}>
              {overview.funded}
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: '600', 
              color: '#64748b', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              GRANTED
            </div>
          </div>

          <div 
            style={{ 
              background: 'white', 
              border: statusFilter === 'Dismissed' ? '2px solid #E57373' : '1px solid #e2e8f0', 
              borderRadius: '0.5rem', 
              padding: '1.25rem 1rem', 
              textAlign: 'center',
              minWidth: '130px',
              flexShrink: 0,
              boxSizing: 'border-box',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setStatusFilter('Dismissed')}
            onMouseEnter={(e) => {
              if (statusFilter !== 'Dismissed') {
                e.currentTarget.style.borderColor = '#E57373'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(229, 115, 115, 0.15)'
              }
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== 'Dismissed') {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <div style={{ 
              fontSize: '2.25rem', 
              fontWeight: '700', 
              color: '#E57373', 
              marginBottom: '0.5rem',
              lineHeight: '1.1'
            }}>
              {overview.dismissed}
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: '600', 
              color: '#64748b', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              DISMISSED
            </div>
          </div>

          <div style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '0.5rem', 
            padding: '1.25rem 1rem', 
            textAlign: 'center',
            minWidth: '130px',
            flexShrink: 0,
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              fontSize: '2.25rem', 
              fontWeight: '700', 
              color: '#FFD54F', 
              marginBottom: '0.5rem',
              lineHeight: '1.1'
            }}>
              {overview.successRate !== null ? `${overview.successRate}%` : '-'}
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: '600', 
              color: '#64748b', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              SUCCESS RATE
            </div>
          </div>

          <div style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '0.5rem', 
            padding: '1.25rem 1rem', 
            textAlign: 'center',
            minWidth: '130px',
            flexShrink: 0,
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: '#BA68C8', 
              marginBottom: '0.5rem',
              lineHeight: '1.2'
            }}>
              {formatCurrency(overview.totalFees)}
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: '600', 
              color: '#64748b', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              TOTAL FEES
            </div>
          </div>

          <div style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '0.5rem', 
            padding: '1.25rem 1rem', 
            textAlign: 'center',
            minWidth: '130px',
            flexShrink: 0,
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: '#81C784', 
              marginBottom: '0.5rem',
              lineHeight: '1.2'
            }}>
              {formatCurrency(overview.achieved)}
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: '600', 
              color: '#64748b', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              ACHIEVED
            </div>
          </div>
        </div>
      </div>

      {/* Performance by Call Table */}
      <div className="content-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2C3E50', margin: 0 }}>Performance by Call</h2>
          <span style={{ 
            padding: '0.25rem 0.75rem', 
            background: '#f8fafc', 
            borderRadius: '0.5rem', 
            fontSize: '0.875rem', 
            color: '#64748b',
            fontWeight: '500'
          }}>
            {performanceByCall.length} calls
          </span>
        </div>

        {performanceByCall.length === 0 ? (
          <div className="empty-row" style={{ padding: '3rem', textAlign: 'center' }}>
            No data available for the selected filters
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>CALL</th>
                <th>YEAR</th>
                <th>TOTAL</th>
                <th>IN PROGRESS</th>
                <th>PENDING</th>
                <th>GRANTED</th>
                <th>DISMISSED</th>
                <th>SUCCESS %</th>
                <th>TOTAL FEE</th>
                <th>PROBABILITY</th>
                <th>ACHIEVED</th>
              </tr>
            </thead>
            <tbody>
              {performanceByCall.map((perf) => (
                <tr key={perf.callId}>
                  <td>
                    <div style={{ fontWeight: '500', color: '#2C3E50' }}>
                      {perf.callName}
                    </div>
                  </td>
                  <td>{perf.year}</td>
                  <td>{perf.total}</td>
                  <td>
                    {perf.inProgress > 0 ? (
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.375rem 0.75rem',
                        background: '#E3F2FD',
                        color: '#1976D2',
                        borderRadius: '0.375rem',
                        fontWeight: '700',
                        fontSize: '0.875rem'
                      }}>
                        {perf.inProgress}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>0</span>
                    )}
                  </td>
                  <td>
                    {perf.pending > 0 ? (
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.375rem 0.75rem',
                        background: '#FFF9C4',
                        color: '#F57F17',
                        borderRadius: '0.375rem',
                        fontWeight: '700',
                        fontSize: '0.875rem'
                      }}>
                        {perf.pending}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>0</span>
                    )}
                  </td>
                  <td>
                    {perf.funded > 0 ? (
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.375rem 0.75rem',
                        background: '#E8F5E9',
                        color: '#2E7D32',
                        borderRadius: '0.375rem',
                        fontWeight: '700',
                        fontSize: '0.875rem'
                      }}>
                        {perf.funded}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>0</span>
                    )}
                  </td>
                  <td>
                    {perf.dismissed > 0 ? (
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.375rem 0.75rem',
                        background: '#FFEBEE',
                        color: '#C62828',
                        borderRadius: '0.375rem',
                        fontWeight: '700',
                        fontSize: '0.875rem'
                      }}>
                        {perf.dismissed}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>0</span>
                    )}
                  </td>
                  <td>
                    {perf.successRate !== null ? (
                      <span style={{ color: perf.successRate === 100 ? '#4CAF50' : '#64748b', fontWeight: '500' }}>
                        {perf.successRate.toFixed(1)}%
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>-</span>
                    )}
                  </td>
                  <td>{formatCurrency(perf.totalFee)}</td>
                  <td>
                    <span style={{ color: '#64748b' }}>-</span>
                  </td>
                  <td>
                    {perf.achieved > 0 ? (
                      <span style={{ color: '#4CAF50', fontWeight: '500' }}>
                        {formatCurrency(perf.achieved)}
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

export default CallAnalytics

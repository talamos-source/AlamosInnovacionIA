import { Users, Phone, FileText, DollarSign, TrendingUp, Activity } from 'lucide-react'
import './Page.css'

const Dashboard = () => {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Vista general de tu CRM</p>
        </div>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper">
            <Users className="stat-icon" size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Customers</h3>
            <p className="stat-value">0</p>
            <span className="stat-change positive">+0% este mes</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon-wrapper">
            <Phone className="stat-icon" size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Calls</h3>
            <p className="stat-value">0</p>
            <span className="stat-change">0 este mes</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon-wrapper">
            <FileText className="stat-icon" size={24} />
          </div>
          <div className="stat-content">
            <h3>Active Proposals</h3>
            <p className="stat-value">0</p>
            <span className="stat-change">0 pendientes</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon-wrapper">
            <DollarSign className="stat-icon" size={24} />
          </div>
          <div className="stat-content">
            <h3>Revenue</h3>
            <p className="stat-value">$0</p>
            <span className="stat-change positive">+0% este mes</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card chart-card">
          <div className="card-header">
            <h2>Overview</h2>
            <select className="period-select">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <div className="chart-placeholder">
            <div className="chart-bars">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="chart-bar" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h2>Recent Activity</h2>
            <Activity size={20} className="header-icon" />
          </div>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-dot"></div>
              <div className="activity-content">
                <p className="activity-text">No hay actividad reciente</p>
                <span className="activity-time">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <button className="quick-action-btn">
              <Users size={18} />
              <span>New Customer</span>
            </button>
            <button className="quick-action-btn">
              <Phone size={18} />
              <span>Log Call</span>
            </button>
            <button className="quick-action-btn">
              <FileText size={18} />
              <span>New Proposal</span>
            </button>
            <button className="quick-action-btn">
              <DollarSign size={18} />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h2>Performance</h2>
            <TrendingUp size={20} className="header-icon" />
          </div>
          <div className="performance-metrics">
            <div className="metric-item">
              <span className="metric-label">Conversion Rate</span>
              <span className="metric-value">0%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Avg. Call Duration</span>
              <span className="metric-value">0 min</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Response Time</span>
              <span className="metric-value">0 hrs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

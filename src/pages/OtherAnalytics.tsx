import './Page.css'

const OtherAnalytics = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Other Analytics</h1>
        <p className="page-subtitle">Análisis adicionales</p>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Conversión</h3>
            <p className="stat-value">0%</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Crecimiento</h3>
            <p className="stat-value">0%</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <h3>Objetivos</h3>
            <p className="stat-value">0/0</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <h3>Satisfacción</h3>
            <p className="stat-value">0/5</p>
          </div>
        </div>
      </div>

      <div className="content-section">
        <h2>Métricas Adicionales</h2>
        <div className="empty-state">
          <p>Las métricas adicionales se mostrarán aquí cuando haya datos disponibles</p>
        </div>
      </div>
    </div>
  )
}

export default OtherAnalytics

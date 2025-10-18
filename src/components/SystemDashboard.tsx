import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import './SystemDashboard.css';

interface SystemHealth {
  status: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
}

interface PerformanceMetrics {
  avg_response_time: number;
  total_requests: number;
  slow_requests: number;
  high_query_requests: number;
  trends: {
    response_times: number[];
    query_counts: number[];
    memory_usage: number[];
  };
}

interface BusinessMetrics {
  total_users: number;
  total_employment: number;
  total_tracker_data: number;
  job_alignment: {
    total: number;
    aligned: number;
    not_aligned: number;
    pending: number;
    alignment_rate: number;
  };
  program_distribution: Array<{
    academic_info__program: string;
    count: number;
  }>;
  recent_activity: {
    new_users: number;
    updated_employment: number;
    new_tracker_data: number;
  };
}

interface DashboardData {
  system_health: SystemHealth;
  performance: PerformanceMetrics;
  business_metrics: BusinessMetrics;
  timestamp: number;
}

const SystemDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shared/system-dashboard/');
      
      if (response.data.success) {
        setDashboardData(response.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError('Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Error connecting to dashboard API');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#28a745';
      case 'warning': return '#ffc107';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  if (loading && !dashboardData) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-icon">⚠️</div>
        <h3>Dashboard Error</h3>
        <p>{error}</p>
        <button onClick={fetchDashboardData} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="dashboard-error">
        <p>No dashboard data available</p>
      </div>
    );
  }

  return (
    <div className="system-dashboard">
      <div className="dashboard-header">
        <h1>System Dashboard</h1>
        {lastUpdated && (
          <div className="last-updated">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* System Health Card */}
        <div className="dashboard-card health-card">
          <div className="card-header">
            <h2>System Health</h2>
            <div 
              className="status-indicator"
              style={{ backgroundColor: getStatusColor(dashboardData.system_health.status) }}
            >
              {dashboardData.system_health.status.toUpperCase()}
            </div>
          </div>
          <div className="health-metrics">
            <div className="metric">
              <span className="metric-label">CPU Usage</span>
              <div className="metric-bar">
                <div 
                  className="metric-fill"
                  style={{ 
                    width: `${dashboardData.system_health.cpu_percent}%`,
                    backgroundColor: dashboardData.system_health.cpu_percent > 80 ? '#dc3545' : '#28a745'
                  }}
                ></div>
              </div>
              <span className="metric-value">{formatPercentage(dashboardData.system_health.cpu_percent)}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Memory Usage</span>
              <div className="metric-bar">
                <div 
                  className="metric-fill"
                  style={{ 
                    width: `${dashboardData.system_health.memory_percent}%`,
                    backgroundColor: dashboardData.system_health.memory_percent > 85 ? '#dc3545' : '#28a745'
                  }}
                ></div>
              </div>
              <span className="metric-value">{formatPercentage(dashboardData.system_health.memory_percent)}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Disk Usage</span>
              <div className="metric-bar">
                <div 
                  className="metric-fill"
                  style={{ 
                    width: `${dashboardData.system_health.disk_percent}%`,
                    backgroundColor: dashboardData.system_health.disk_percent > 90 ? '#dc3545' : '#28a745'
                  }}
                ></div>
              </div>
              <span className="metric-value">{formatPercentage(dashboardData.system_health.disk_percent)}</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics Card */}
        <div className="dashboard-card performance-card">
          <div className="card-header">
            <h2>Performance Metrics</h2>
          </div>
          <div className="performance-metrics">
            <div className="metric-row">
              <div className="metric-item">
                <span className="metric-label">Avg Response Time</span>
                <span className="metric-value">{dashboardData.performance.avg_response_time.toFixed(3)}s</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Total Requests</span>
                <span className="metric-value">{formatNumber(dashboardData.performance.total_requests)}</span>
              </div>
            </div>
            <div className="metric-row">
              <div className="metric-item">
                <span className="metric-label">Slow Requests</span>
                <span className="metric-value warning">{formatNumber(dashboardData.performance.slow_requests)}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">High Query Requests</span>
                <span className="metric-value warning">{formatNumber(dashboardData.performance.high_query_requests)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Business Metrics Card */}
        <div className="dashboard-card business-card">
          <div className="card-header">
            <h2>Business Metrics</h2>
          </div>
          <div className="business-metrics">
            <div className="metric-row">
              <div className="metric-item">
                <span className="metric-label">Total Users</span>
                <span className="metric-value">{formatNumber(dashboardData.business_metrics.total_users)}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Employment Records</span>
                <span className="metric-value">{formatNumber(dashboardData.business_metrics.total_employment)}</span>
              </div>
            </div>
            <div className="metric-row">
              <div className="metric-item">
                <span className="metric-label">Tracker Data</span>
                <span className="metric-value">{formatNumber(dashboardData.business_metrics.total_tracker_data)}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Alignment Rate</span>
                <span className="metric-value">{formatPercentage(dashboardData.business_metrics.job_alignment.alignment_rate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Job Alignment Card */}
        <div className="dashboard-card alignment-card">
          <div className="card-header">
            <h2>Job Alignment Status</h2>
          </div>
          <div className="alignment-metrics">
            <div className="alignment-item">
              <span className="alignment-label">Aligned</span>
              <span className="alignment-value success">{formatNumber(dashboardData.business_metrics.job_alignment.aligned)}</span>
            </div>
            <div className="alignment-item">
              <span className="alignment-label">Not Aligned</span>
              <span className="alignment-value error">{formatNumber(dashboardData.business_metrics.job_alignment.not_aligned)}</span>
            </div>
            <div className="alignment-item">
              <span className="alignment-label">Pending</span>
              <span className="alignment-value warning">{formatNumber(dashboardData.business_metrics.job_alignment.pending)}</span>
            </div>
          </div>
        </div>

        {/* Program Distribution Card */}
        <div className="dashboard-card program-card">
          <div className="card-header">
            <h2>Program Distribution</h2>
          </div>
          <div className="program-distribution">
            {dashboardData.business_metrics.program_distribution.map((program, index) => (
              <div key={index} className="program-item">
                <span className="program-name">{program.academic_info__program || 'Unknown'}</span>
                <span className="program-count">{formatNumber(program.count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="dashboard-card activity-card">
          <div className="card-header">
            <h2>Recent Activity (24h)</h2>
          </div>
          <div className="activity-metrics">
            <div className="activity-item">
              <span className="activity-label">New Users</span>
              <span className="activity-value">{formatNumber(dashboardData.business_metrics.recent_activity.new_users)}</span>
            </div>
            <div className="activity-item">
              <span className="activity-label">Updated Employment</span>
              <span className="activity-value">{formatNumber(dashboardData.business_metrics.recent_activity.updated_employment)}</span>
            </div>
            <div className="activity-item">
              <span className="activity-label">New Tracker Data</span>
              <span className="activity-value">{formatNumber(dashboardData.business_metrics.recent_activity.new_tracker_data)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemDashboard;



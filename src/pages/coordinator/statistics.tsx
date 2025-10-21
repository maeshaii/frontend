import React, { useState, useEffect, useCallback } from 'react';
import './statistics.css';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { FaUsers } from 'react-icons/fa';
import { fetchAlumniEmploymentStats } from '../../services/api';

export default function Statistics() {
  const [data, setData] = useState([
    { name: 'Pending', value: 0, fill: '#DEC0F1' },
    { name: 'Employed', value: 0, fill: '#B79CED', absorbedCount: 0 },
    { name: 'Unemployed', value: 0, fill: '#957FEF' },
    // Removed 'Absorb' as separate category - now combined with 'Employed'
  ]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  // Dynamic data loading
  const loadStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAlumniEmploymentStats('ALL', 'ALL');
      if (response.success && response.status_counts) {
        const chartData = [
          { name: 'Pending', value: response.status_counts.Pending || 0, fill: '#DEC0F1' },
          { name: 'Employed', value: response.status_counts.Employed || 0, fill: '#B79CED', absorbedCount: response.status_counts.Absorbed_Count || 0 },
          { name: 'Unemployed', value: response.status_counts.Unemployed || 0, fill: '#957FEF' },
          // Removed 'Absorb' as separate category - now combined with 'Employed'
        ];
        console.log('🔍 DEBUG Coordinator: Raw response:', response);
        console.log('🔍 DEBUG Coordinator: Absorbed_Count:', response.status_counts.Absorbed_Count);
        setData(chartData);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);


  const handleBarClick = useCallback((data: any) => {
    setSelectedBar(selectedBar === data.name ? null : data.name);
  }, [selectedBar]);

  if (loading) {
    return (
      <div className="chart-container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '500px',
          }}
        >
          Loading statistics...
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 className="chart-title">📊 Alumni Employment Statistics</h3>
            <p className="chart-subtitle">Employment status distribution by category</p>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </div>
      
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" strokeOpacity={0.6} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 14, fill: '#666', fontWeight: '500' }}
              tickLine={{ stroke: '#ccc' }}
              axisLine={{ stroke: '#ddd' }}
              height={50}
            />
            <YAxis 
              tick={{ fontSize: 14, fill: '#666', fontWeight: '500' }}
              tickLine={{ stroke: '#ccc' }}
              axisLine={{ stroke: '#ddd' }}
              width={50}
            />
            <Tooltip 
              contentStyle={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                padding: '12px',
              }}
              labelStyle={{
                fontWeight: '600',
                color: '#374151',
                marginBottom: '4px',
              }}
              formatter={(value: any, name: any) => [
                <span style={{ fontWeight: '700', color: '#1f2937' }}>{value.toLocaleString()} alumni</span>,
                name
              ]}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '16px' }}
              iconType="rect"
            />
            <Bar 
              dataKey="value" 
              name="Alumni Count"
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
              onClick={handleBarClick}
            >
              {data.map((entry, index) => {
                // Special handling for Employed bar with absorbed indicator
                if (entry.name === 'Employed' && (entry.absorbedCount || 0) > 0) {
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.fill}
                      stroke={selectedBar === entry.name ? '#374151' : 'none'}
                      strokeWidth={selectedBar === entry.name ? 2 : 0}
                      style={{ 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        transform: selectedBar === entry.name ? 'scale(1.05)' : 'scale(1)',
                        background: `linear-gradient(to right, ${entry.fill} 0%, ${entry.fill} 70%, #7161EF 70%, #7161EF 100%)`,
                      }}
                    />
                  );
                }
                
                // Regular bars
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.fill}
                    stroke={selectedBar === entry.name ? '#374151' : 'none'}
                    strokeWidth={selectedBar === entry.name ? 2 : 0}
                    style={{ 
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: selectedBar === entry.name ? 'scale(1.05)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="summary-cards">
        {data.map((entry, index) => (
          <div 
            key={entry.name} 
            className="summary-card"
            style={{
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              ...(selectedBar === entry.name ? {
                backgroundColor: '#f3f4f6',
                borderColor: '#3b82f6',
                borderWidth: '2px',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 20px rgba(59, 130, 246, 0.15)',
              } : {}),
            }}
            onClick={() => handleBarClick({ name: entry.name })}
            onMouseEnter={(e) => {
              if (selectedBar !== entry.name) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedBar !== entry.name) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
              }
            }}
          >
            <div 
              className="summary-indicator"
              style={{ 
                backgroundColor: entry.fill,
                transform: selectedBar === entry.name ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.2s ease',
              }}
            />
            <div className="summary-content">
              <div className="summary-number">{entry.value.toLocaleString()}</div>
              <div 
                className="summary-label"
                style={{ fontWeight: selectedBar === entry.name ? '600' : '400' }}
              >
                {entry.name}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

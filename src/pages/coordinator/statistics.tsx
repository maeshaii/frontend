import React, { useState, useEffect } from 'react';
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
} from 'recharts';
import { fetchAlumniEmploymentStats } from '../../services/api';

export default function Statistics() {
  const [data, setData] = useState([
    { name: 'Employed', value: 0, fill: '#7D8B92' },
    { name: 'Unemployed', value: 0, fill: '#1B4F72' },
    { name: 'Absorb', value: 0, fill: '#a2d5db' },
    { name: 'High Position', value: 0, fill: '#0093D9' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        const response = await fetchAlumniEmploymentStats('ALL', 'ALL');
        if (response.success && response.status_counts) {
          const chartData = [
            { name: 'Employed', value: response.status_counts.Employed || 0, fill: '#7D8B92' },
            { name: 'Unemployed', value: response.status_counts.Unemployed || 0, fill: '#1B4F72' },
            { name: 'Absorb', value: response.status_counts.Absorb || 0, fill: '#a2d5db' },
            { name: 'High Position', value: response.status_counts['High Position'] || 0, fill: '#0093D9' },
          ];
          setData(chartData);
        }
      } catch (error) {
        console.error('Error loading statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, []);

  if (loading) {
    return (
      <div className="chart-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '500px' }}>
          Loading statistics...
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={500}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 50, left: 50, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

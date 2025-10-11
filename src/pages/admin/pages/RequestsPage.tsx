import React, { useEffect, useState } from 'react';
import Sidebar from '../global/sidebar';
import { fetchCoordinatorRequestsList } from '../../../services/api';
import { useNavigate } from 'react-router-dom';

const RequestsPage: React.FC = () => {
  const [items, setItems] = useState<{ batch_year: number; course: string; count: number }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchCoordinatorRequestsList();
        console.log('🔍 RequestsPage - API Response:', res);
        const rows: any[] = Array.isArray(res?.items) ? res.items : [];
        console.log('🔍 RequestsPage - Raw rows:', rows);
        // Process items with course information
        const processedItems = rows
          .map(row => ({
            batch_year: Number(row?.batch_year) || 0,
            course: row?.course || '',
            count: Number(row?.count) || 0
          }))
          .filter(item => Number.isFinite(item.batch_year))
          .sort((a, b) => b.batch_year - a.batch_year);
        console.log('🔍 RequestsPage - Processed items:', processedItems);
        setItems(processedItems);
      } catch (e) {
        console.error('🔍 RequestsPage - Error:', e);
        setItems([]);
      }
    };
    load();
  }, []);


  const openDetails = (year: number, course: string) => {
    const courseParam = selectedCourse !== 'ALL' ? `?course=${selectedCourse}` : '';
    navigate(`/admin/requests/${year}${courseParam}`);
  };

  // Always show common courses in dropdown, plus any additional courses from data
  const coursesFromData = Array.from(new Set(items.map(item => item.course).filter(course => course))).sort();
  const commonCourses = ['BSIT', 'BSIS', 'BIT-CT'];
  const allCourses = Array.from(new Set([...commonCourses, ...coursesFromData])).sort();
  const availableCourses = allCourses;
  
  // Get available batch years from data
  const availableBatches = Array.from(new Set(items.map(item => item.batch_year))).sort((a, b) => b - a);
  
  // Filter items based on selected course and batch
  const filteredItems = items.filter(item => {
    const courseMatch = selectedCourse === 'ALL' || item.course === selectedCourse;
    const batchMatch = selectedBatch === 'ALL' || item.batch_year.toString() === selectedBatch;
    return courseMatch && batchMatch;
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', backgroundColor: '#f5f6fa', marginLeft: 240 }}>
        <h2 style={{ margin: 0, color: '#0b2a55', marginBottom: '16px' }}>Coordinator Requests</h2>
        
        {/* Filters */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontWeight: 600, color: '#0b2a55' }}>Filter by Course:</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, minWidth: 120 }}
            >
              <option value="ALL">All Courses</option>
              {availableCourses.map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontWeight: 600, color: '#0b2a55' }}>Filter by Batch:</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, minWidth: 120 }}
            >
              <option value="ALL">All Batches</option>
              {availableBatches.map(batch => (
                <option key={batch} value={batch.toString()}>{batch}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Cards */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filteredItems.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
              {selectedCourse === 'ALL' && selectedBatch === 'ALL' 
                ? 'No requests yet.' 
                : `No requests found for ${selectedCourse !== 'ALL' ? selectedCourse : 'all courses'}${selectedBatch !== 'ALL' ? ` in batch ${selectedBatch}` : ''}.`
              }
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={`${item.batch_year}-${item.course}`}
                onClick={() => openDetails(item.batch_year, item.course)}
                style={{ 
                  background: '#5A6DFE', 
                  color: 'white', 
                  borderRadius: 20, 
                  padding: 20, 
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ background: 'white', height: 120, borderRadius: 0, marginBottom: 12 }} />
                <p style={{ fontSize: 12, margin: 0, fontWeight: 600 }}>CLASS OF {item.batch_year}</p>
                <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.9 }}>Course: {item.course || 'N/A'}</p>
                <p style={{ fontSize: 12, margin: 0 }}>OJT: {item.count}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestsPage;



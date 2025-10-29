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
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      <div className="admin-content-page" style={{ flex: 1, padding: '32px 40px' }}>
        {/* Header Section */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            margin: 0, 
            color: '#1e293b', 
            fontSize: '32px',
            fontWeight: '800',
            letterSpacing: '-0.025em'
          }}>
            OJT Submissions
          </h1>
          <p style={{ 
            margin: '8px 0 0 0', 
            color: '#64748b',
            fontSize: '15px'
          }}>
            Review and manage coordinator OJT student submissions
          </p>
        </div>
        
        {/* Filters Section */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '28px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ 
                fontWeight: '600', 
                color: '#475569',
                fontSize: '14px',
                minWidth: '110px'
              }}>
                Filter by Course:
              </label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                style={{ 
                  padding: '10px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  minWidth: '160px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#1e293b',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="ALL">All Courses</option>
                {availableCourses.map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ 
                fontWeight: '600', 
                color: '#475569',
                fontSize: '14px',
                minWidth: '105px'
              }}>
                Filter by Batch:
              </label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                style={{ 
                  padding: '10px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  minWidth: '160px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#1e293b',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="ALL">All Batches</option>
                {availableBatches.map(batch => (
                  <option key={batch} value={batch.toString()}>{batch}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Results Summary */}
        {filteredItems.length > 0 && (
          <div style={{ 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ 
              color: '#64748b',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Showing {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
            </span>
            {(selectedCourse !== 'ALL' || selectedBatch !== 'ALL') && (
              <button
                onClick={() => {
                  setSelectedCourse('ALL');
                  setSelectedBatch('ALL');
                }}
                style={{
                  padding: '4px 12px',
                  fontSize: '13px',
                  color: '#3b82f6',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #dbeafe',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dbeafe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        
        {/* Cards Grid */}
        {filteredItems.length === 0 ? (
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '48px 32px',
            textAlign: 'center',
            border: '2px dashed #e2e8f0'
          }}>
            <div style={{ 
              fontSize: '48px',
              marginBottom: '16px'
            }}>
              📭
            </div>
            <h3 style={{ 
              margin: '0 0 8px 0',
              color: '#1e293b',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              {selectedCourse === 'ALL' && selectedBatch === 'ALL' 
                ? 'No OJT Submissions Yet' 
                : 'No Results Found'}
            </h3>
            <p style={{ 
              margin: 0,
              color: '#64748b',
              fontSize: '14px'
            }}>
              {selectedCourse === 'ALL' && selectedBatch === 'ALL'
                ? 'Coordinator submissions will appear here once they send completed OJT students.'
                : `No submissions found for ${selectedCourse !== 'ALL' ? selectedCourse : 'all courses'}${selectedBatch !== 'ALL' ? ` in batch ${selectedBatch}` : ''}.`
              }
            </p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {filteredItems.map((item) => (
              <div
                key={`${item.batch_year}-${item.course}`}
                onClick={() => openDetails(item.batch_year, item.course)}
                style={{ 
                  backgroundColor: 'white',
                  borderRadius: '20px',
                  padding: '0',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                }}
              >
                {/* Gradient Header */}
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  height: '120px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '100px',
                    height: '100px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-30px',
                    left: '-30px',
                    width: '120px',
                    height: '120px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%'
                  }}></div>
                </div>
                
                {/* Card Content */}
                <div style={{ padding: '24px' }}>
                  <h3 style={{ 
                    margin: '0 0 8px 0',
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1e293b',
                    letterSpacing: '-0.025em'
                  }}>
                    CLASS OF {item.batch_year}
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                  }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      📚 Course:
                    </span>
                    <span style={{
                      fontSize: '14px',
                      color: '#1e293b',
                      fontWeight: '600'
                    }}>
                      {item.course || 'N/A'}
                    </span>
                  </div>
                  
                  {/* OJT Count Badge */}
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '2px solid #bae6fd',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#0369a1',
                      fontWeight: '600'
                    }}>
                      OJT Students
                    </span>
                    <span style={{
                      fontSize: '24px',
                      fontWeight: '800',
                      color: '#0284c7'
                    }}>
                      {item.count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestsPage;



import React, { useEffect, useState } from 'react';
import Sidebar from '../global/sidebar';
import { fetchCoordinatorRequestsList } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import { FaGraduationCap, FaUsers } from 'react-icons/fa';

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
      <div className="admin-content-page" style={{ flex: 1, padding: '32px 40px', marginLeft: 'var(--sidebar-width, 220px)' }}>
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
            {filteredItems.map((item) => {
              const studentLabel = `${item.count} Student${item.count === 1 ? '' : 's'}`;
              return (
                <div
                  key={`${item.batch_year}-${item.course}`}
                  onClick={() => openDetails(item.batch_year, item.course)}
                  style={{ 
                    backgroundColor: 'white',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLDivElement;
                    target.style.transform = 'translateY(-4px)';
                    target.style.boxShadow = '0 16px 24px rgba(15, 23, 42, 0.18)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLDivElement;
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.12)';
                  }}
                >
                  <div style={{
                    background: 'linear-gradient(140deg, #1C4E80 0%, #205B98 100%)',
                    padding: '20px 22px',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px'
                    }}>
                      <FaGraduationCap />
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.015em' }}>
                        CLASS OF {item.batch_year}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 500, opacity: 0.9, marginTop: '4px' }}>
                        Course : {item.course || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: '#ffffff',
                    padding: '20px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#1D4ED8' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '12px',
                        backgroundColor: '#E0EAFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px'
                      }}>
                        <FaUsers />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '20px', fontWeight: 700, color: '#1E3A8A' }}>
                          {studentLabel}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                          OJT Submissions
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#1e3a8a', fontWeight: 600, fontSize: '13px' }}>
                      <span>Open details</span>
                      <span style={{ marginLeft: 8, fontSize: '16px', transition: 'transform .2s ease' }}>→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestsPage;



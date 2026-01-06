import React, { useEffect, useState } from 'react';
import Sidebar from '../global/sidebar';
import { fetchNewUsersList } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import { FaGraduationCap, FaUsers } from 'react-icons/fa';
import { broadcastCoordinatorRequestCount } from '../utils/requestBadge';
import { toast } from '../../../utils/toast';

const RequestsPage: React.FC = () => {
  const [items, setItems] = useState<{ batch_year: number; count: number }[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchNewUsersList();
        console.log('🔍 RequestsPage - API Response:', res);
        const rows: any[] = Array.isArray(res?.items) ? res.items : [];
        console.log('🔍 RequestsPage - Raw rows:', rows);
        // Process items - now grouped by year only (no course separation)
        const processedItems = rows
          .map(row => ({
            batch_year: Number(row?.batch_year) || 0,
            count: Number(row?.count) || 0
          }))
          .filter(item => Number.isFinite(item.batch_year))
          .sort((a, b) => b.batch_year - a.batch_year);
        console.log('🔍 RequestsPage - Processed items:', processedItems);

        // If user already acknowledged up to total, hide cards
        let ack = 0;
        try {
          ack = Number(localStorage.getItem('ackNewUsersCount')) || 0;
        } catch {
          ack = 0;
        }
        const total = processedItems.reduce((sum, item) => sum + (item.count || 0), 0);
        if (total <= ack) {
          setItems([]);
        } else {
          setItems(processedItems);
        }
      } catch (e) {
        console.error('🔍 RequestsPage - Error:', e);
        setItems([]);
      }
    };
    load();
  }, []);

  // Manual acknowledge button (e.g., if user wants to clear badge)
  const acknowledgeAll = () => {
    const total = items.reduce((sum, item) => sum + (item.count || 0), 0);
    try {
      localStorage.setItem('ackNewUsersCount', String(total));
    } catch {}
    broadcastCoordinatorRequestCount(0);
    // Hide cards after marking all as seen
    setItems([]);
    // Show success message
    toast.success(`All ${total} new user${total === 1 ? '' : 's'} marked as seen!`);
  };


  const openDetails = (year: number) => {
    navigate(`/admin/requests/${year}`);
  };
  
  // Get available batch years from data
  const availableBatches = Array.from(new Set(items.map(item => item.batch_year))).sort((a, b) => b - a);
  
  // Filter items based on selected batch
  const filteredItems = items.filter(item => {
    const batchMatch = selectedBatch === 'ALL' || item.batch_year.toString() === selectedBatch;
    return batchMatch;
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
            New Users
          </h1>
          <p style={{ 
            margin: '8px 0 0 0', 
            color: '#64748b',
            fontSize: '15px'
          }}>
            View recently converted alumni from coordinator submissions
          </p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={acknowledgeAll}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #dbeafe',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
            >
              Mark All as Seen
            </button>
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
            {selectedBatch !== 'ALL' && (
              <button
                onClick={() => {
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
              {selectedBatch === 'ALL' 
                ? 'No New Users Yet' 
                : 'No Results Found'}
            </h3>
            <p style={{ 
              margin: 0,
              color: '#64748b',
              fontSize: '14px'
            }}>
              {selectedBatch === 'ALL'
                ? 'New users converted from OJT will appear here once coordinators send completed students.'
                : `No new users found for batch ${selectedBatch}.`
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
              return (
                <div
                  key={`${item.batch_year}`}
                  onClick={() => openDetails(item.batch_year)}
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
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.015em' }}>
                        CLASS OF {item.batch_year}
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
                          {item.count} Student{item.count === 1 ? '' : 's'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                          New Users
                        </span>
                      </div>
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



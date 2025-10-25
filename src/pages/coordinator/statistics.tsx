import React, { useState, useEffect } from 'react';
import './statistics.css';
import { fetchOJTCompanyStatistics } from '../../services/api';

interface CompanyData {
  company_name: string;
  count: number;
}

export default function Statistics() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');

  useEffect(() => {
    // Get coordinator username from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setCoordinatorUsername(userData.name || '');
    }
  }, []);

  useEffect(() => {
    const loadCompanyStatistics = async () => {
      if (!coordinatorUsername) return;
      
    setLoading(true);
    try {
        const response = await fetchOJTCompanyStatistics(coordinatorUsername);
        if (response.success) {
          setCompanies(response.companies || []);
          setTotalCompanies(response.total_companies || 0);
          setTotalStudents(response.total_students || 0);
      }
    } catch (error) {
        console.error('Error loading company statistics:', error);
    } finally {
      setLoading(false);
    }
    };

    if (coordinatorUsername) {
      loadCompanyStatistics();
    }
  }, [coordinatorUsername]);

  if (loading) {
    return (
      <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#dbeafe',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}></div>
          <p style={{
            fontSize: '16px',
            color: '#64748b',
            margin: '0',
            fontWeight: '500'
          }}>
            Loading company statistics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '32px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* Summary Cards Grid - matching CLASS OF cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Total Companies Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 16px 32px -8px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0, 0, 0, 0.1)';
        }}>
          {/* Decorative gradient circle */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '50%',
            opacity: '0.1'
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#dbeafe',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                🏢
              </div>
            </div>
            <p style={{
              margin: '0 0 4px 0',
              fontSize: '14px',
              color: '#64748b',
              fontWeight: '500'
            }}>
              Total Companies
            </p>
            <p style={{
              margin: '0',
              fontSize: '48px',
              fontWeight: '800',
              color: '#3b82f6'
            }}>
              {totalCompanies}
            </p>
          </div>
        </div>

        {/* Total Students Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 16px 32px -8px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0, 0, 0, 0.1)';
        }}>
          {/* Decorative gradient circle */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '50%',
            opacity: '0.1'
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#dbeafe',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                👥
              </div>
            </div>
            <p style={{
              margin: '0 0 4px 0',
              fontSize: '14px',
              color: '#64748b',
              fontWeight: '500'
            }}>
              Total OJT Students
            </p>
            <p style={{
              margin: '0',
              fontSize: '48px',
              fontWeight: '800',
              color: '#3b82f6'
            }}>
              {totalStudents}
            </p>
          </div>
        </div>

        {/* Average Per Company Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 16px 32px -8px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0, 0, 0, 0.1)';
        }}>
          {/* Decorative gradient circle */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '50%',
            opacity: '0.1'
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#dbeafe',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                📈
              </div>
          </div>
            <p style={{
              margin: '0 0 4px 0',
              fontSize: '14px',
              color: '#64748b',
              fontWeight: '500'
            }}>
              Average Per Company
            </p>
            <p style={{
              margin: '0',
              fontSize: '48px',
              fontWeight: '800',
              color: '#3b82f6'
            }}>
              {totalCompanies > 0 ? Math.round(totalStudents / totalCompanies * 10) / 10 : 0}
            </p>
          </div>
        </div>
      </div>
      
      {/* Company Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h3 style={{
            margin: '0',
            fontSize: '20px',
            fontWeight: '700',
            color: '#1e293b'
          }}>
            Companies Directory
          </h3>
          <div style={{
            padding: '6px 16px',
            backgroundColor: '#f0f9ff',
            borderRadius: '20px',
            fontSize: '14px',
                fontWeight: '600',
            color: '#0369a1'
          }}>
            {companies.length} {companies.length === 1 ? 'Company' : 'Companies'}
          </div>
      </div>

        {companies.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#f8fafc',
            borderRadius: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#fef3c7',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <span style={{ fontSize: '24px' }}>🔍</span>
            </div>
            <p style={{
              fontSize: '16px',
              color: '#64748b',
              margin: '0',
              fontWeight: '500'
            }}>
              No company data found.
            </p>
          </div>
        ) : (
          <div style={{
            maxHeight: '500px',
            overflowY: 'auto',
            overflowX: 'auto',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <style>{`
              div::-webkit-scrollbar {
                width: 8px;
                height: 8px;
              }
              div::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 10px;
              }
              div::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 10px;
              }
              div::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
              }
            `}</style>
            <table style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '0'
            }}>
              <thead style={{
                position: 'sticky',
                top: '0',
                zIndex: 10,
                backgroundColor: 'white'
              }}>
                <tr style={{
                  backgroundColor: '#f8fafc',
                  borderBottom: '2px solid #e2e8f0'
                }}>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b',
                    width: '100px'
                  }}>
                    #
                  </th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b'
                  }}>
                    Company Name
                  </th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b',
                    width: '180px'
                  }}>
                    OJT Students
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company, index) => (
                  <tr
                    key={index}
            style={{
                      borderBottom: index < companies.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'background-color 0.2s ease'
                    }}
            onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <td style={{
                      padding: '20px',
                      fontSize: '14px',
                      color: '#64748b',
                      fontWeight: '600'
                    }}>
                      {index + 1}
                    </td>
                    <td style={{
                      padding: '20px',
                      fontSize: '15px',
                      color: '#1e293b',
                      fontWeight: '600'
                    }}>
                      {company.company_name}
                    </td>
                    <td style={{
                      padding: '20px',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '6px 16px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '700'
                      }}>
                        {company.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import './statistics.css';
import { fetchOJTCompanyStatistics, fetchStudentsByCompany } from '../../services/api';

interface CompanyData {
  company_name: string;
  count: number;
}

interface StudentData {
  ctu_id: string;
  first_name: string;
  last_name: string;
  company: string;
  company_address?: string;
  company_email?: string;
  company_contact?: string;
  contact_person?: string;
  position?: string;
  status: string;
}

export default function Statistics() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);
  const [companyStudents, setCompanyStudents] = useState<StudentData[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Get coordinator username from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      // Use username instead of full name for coordinator
      setCoordinatorUsername(userData.username || userData.name || '');
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

  const handleCompanyClick = async (company: CompanyData) => {
    setSelectedCompany(company);
    setShowModal(true);
    setLoadingStudents(true);
    
    try {
      const response = await fetchStudentsByCompany(company.company_name, coordinatorUsername);
      if (response.success) {
        setCompanyStudents(response.students || []);
      }
    } catch (error) {
      console.error('Error loading company students:', error);
      setCompanyStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCompany(null);
    setCompanyStudents([]);
  };

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
      {/* Company Table with Summary */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          paddingBottom: '24px',
          borderBottom: '2px solid #f1f5f9'
        }}>
          <h3 style={{
            margin: '0',
            fontSize: '24px',
            fontWeight: '700',
            color: '#1e293b',
            letterSpacing: '-0.025em'
          }}>
            Companies Directory
          </h3>
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#eff6ff',
              borderRadius: '10px',
              border: '1px solid #dbeafe'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Total Companies
                </span>
                <span style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#3b82f6'
                }}>
                  {totalCompanies}
                </span>
              </div>
            </div>
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#eff6ff',
              borderRadius: '10px',
              border: '1px solid #dbeafe'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Total OJT Students
                </span>
                <span style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#3b82f6'
                }}>
                  {totalStudents}
                </span>
              </div>
            </div>
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
                    No.
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
                      transition: 'background-color 0.2s ease',
                      cursor: 'pointer'
                    }}
            onClick={() => handleCompanyClick(company)}
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

      {/* Company Details Modal */}
      {showModal && selectedCompany && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h2 style={{
                  margin: '0 0 8px 0',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1e293b'
                }}>
                  {selectedCompany.company_name}
                </h2>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#64748b'
                }}>
                  Company Profile & OJT Students
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                  e.currentTarget.style.color = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                ✕
              </button>
            </div>

            {/* Company Info Summary */}
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              display: 'flex',
              gap: '32px'
            }}>
              <div>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Total Students</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>{selectedCompany.count}</div>
              </div>
              {companyStudents.length > 0 && companyStudents[0].company_address && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Address</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{companyStudents[0].company_address}</div>
                </div>
              )}
            </div>

            {/* Company Contact Info */}
            {companyStudents.length > 0 && (companyStudents[0].company_email || companyStudents[0].company_contact || companyStudents[0].contact_person) && (
              <div style={{
                backgroundColor: '#eff6ff',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                  Contact Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {companyStudents[0].company_email && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Email</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{companyStudents[0].company_email}</div>
                    </div>
                  )}
                  {companyStudents[0].company_contact && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Phone</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{companyStudents[0].company_contact}</div>
                    </div>
                  )}
                  {companyStudents[0].contact_person && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Contact Person</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                        {companyStudents[0].contact_person}
                        {companyStudents[0].position && ` (${companyStudents[0].position})`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Students List */}
            <div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                OJT Students ({companyStudents.length})
              </h3>
              {loadingStudents ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <p style={{ color: '#64748b', fontSize: '14px' }}>Loading students...</p>
                </div>
              ) : companyStudents.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px'
                }}>
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No students found</p>
                </div>
              ) : (
                <div style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#f8fafc',
                      zIndex: 1
                    }}>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: '#1e293b',
                          width: '50px'
                        }}>No.</th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: '#1e293b'
                        }}>CTU ID</th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: '#1e293b'
                        }}>Name</th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'center',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: '#1e293b',
                          width: '120px'
                        }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyStudents.map((student, index) => (
                        <tr key={index} style={{
                          borderBottom: index < companyStudents.length - 1 ? '1px solid #f1f5f9' : 'none',
                          backgroundColor: index % 2 === 0 ? 'white' : '#fafbfc'
                        }}>
                          <td style={{
                            padding: '14px 16px',
                            fontSize: '13px',
                            color: '#64748b',
                            fontWeight: '500'
                          }}>{index + 1}</td>
                          <td style={{
                            padding: '14px 16px',
                            fontSize: '13px',
                            color: '#1e293b',
                            fontWeight: '600'
                          }}>{student.ctu_id}</td>
                          <td style={{
                            padding: '14px 16px',
                            fontSize: '13px',
                            color: '#1e293b',
                            fontWeight: '500'
                          }}>{student.first_name} {student.last_name}</td>
                          <td style={{
                            padding: '14px 16px',
                            textAlign: 'center'
                          }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: student.status === 'Completed' ? '#dcfce7' : '#fef3c7',
                              color: student.status === 'Completed' ? '#166534' : '#92400e'
                            }}>
                              {student.status}
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
        </div>
      )}
    </div>
  );
}

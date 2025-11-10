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

interface CompanyProfile {
  company_name: string;
  company_address?: string;
  company_email?: string;
  company_contact?: string;
  contact_person?: string;
  position?: string;
}

export default function Statistics() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);
  const [companyStudents, setCompanyStudents] = useState<StudentData[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      console.log('🔍 Full Company data response:', JSON.stringify(response, null, 2)); // Debug log
      console.log('🔍 Response keys:', Object.keys(response || {})); // Debug: show what keys exist
      console.log('🔍 company_profile exists?', 'company_profile' in (response || {})); // Debug: check if key exists
      console.log('🔍 company_profile value:', response?.company_profile); // Debug: show value
      
      if (response.success) {
        setCompanyStudents(response.students || []);
        
        // Always try to use company_profile from API first
        let profileToUse = null;
        
        if (response.company_profile && response.company_profile !== null) {
          console.log('✅ Found company_profile in response:', response.company_profile);
          profileToUse = response.company_profile;
          // Ensure all fields are strings, not None
          profileToUse = {
            company_name: profileToUse.company_name || company.company_name,
            company_address: profileToUse.company_address || '',
            company_email: profileToUse.company_email || '',
            company_contact: profileToUse.company_contact || '',
            contact_person: profileToUse.contact_person || '',
            position: profileToUse.position || ''
          };
        } else if (response.students && response.students.length > 0) {
          // Fallback: use first student's company info if available
          console.log('⚠️ No company_profile in response, using first student info');
          profileToUse = {
            company_name: response.students[0].company || company.company_name,
            company_address: response.students[0].company_address || '',
            company_email: response.students[0].company_email || '',
            company_contact: response.students[0].company_contact || '',
            contact_person: response.students[0].contact_person || '',
            position: response.students[0].position || ''
          };
        } else {
          // Empty profile as last resort
          console.log('❌ No company profile or students, using empty profile');
          profileToUse = {
            company_name: company.company_name,
            company_address: '',
            company_email: '',
            company_contact: '',
            contact_person: '',
            position: ''
          };
        }
        
        console.log('📝 Final profile being set:', profileToUse);
        setCompanyProfile(profileToUse);
      }
    } catch (error) {
      console.error('Error loading company students:', error);
      setCompanyStudents([]);
      setCompanyProfile({
        company_name: company.company_name,
        company_address: '',
        company_email: '',
        company_contact: '',
        contact_person: '',
        position: ''
      });
    } finally {
      setLoadingStudents(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCompany(null);
    setCompanyStudents([]);
    setCompanyProfile(null);
  };

  const exportAllCompanyDetails = async () => {
    if (companies.length === 0) {
      alert('No companies to export');
      return;
    }

    setExporting(true);
    try {
      // Import ExcelJS dynamically
      const ExcelJS = (await import('exceljs')).default;
      const FileSaver = (await import('file-saver')).default;

      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Company Details');

      // Define headers (only company details)
      const headers = [
        'Company Name',
        'Company Address',
        'Company Email',
        'Company Contact',
        'Contact Person',
        'Position'
      ];

      // Add headers
      worksheet.addRow(headers);

      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, size: 12 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;

      // Set column widths
      worksheet.columns = [
        { width: 30 }, // Company Name
        { width: 40 }, // Company Address
        { width: 25 }, // Company Email
        { width: 20 }, // Company Contact
        { width: 25 }, // Contact Person
        { width: 20 }  // Position
      ];

      // Iterate through all companies and fetch their details
      let totalRows = 0;
      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        
        try {
          // Fetch students and company profile for this company
          const response = await fetchStudentsByCompany(company.company_name, coordinatorUsername);
          
          if (response.success) {
            const students = response.students || [];
            const profile = response.company_profile || {
              company_name: company.company_name,
              company_address: '',
              company_email: '',
              company_contact: '',
              contact_person: '',
              position: ''
            };

            // Add company row (one row per company)
            worksheet.addRow([
              profile.company_name || company.company_name,
              profile.company_address || '',
              profile.company_email || '',
              profile.company_contact || '',
              profile.contact_person || '',
              profile.position || ''
            ]);
            totalRows++;
          }
        } catch (error) {
          console.error(`Error fetching details for company ${company.company_name}:`, error);
          // Still add the company name even if details fetch fails
          worksheet.addRow([
            company.company_name,
            '',
            '',
            '',
            '',
            ''
          ]);
          totalRows++;
        }

        // Add small delay to avoid overwhelming the API
        if (i < companies.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Style all data rows
      for (let i = 2; i <= totalRows + 1; i++) {
        const row = worksheet.getRow(i);
        row.alignment = { vertical: 'middle', horizontal: 'left' };
        row.height = 20;
        
        // Alternate row colors for better readability
        if (i % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        }
      }

      // Add borders to all cells
      for (let i = 1; i <= totalRows + 1; i++) {
        const row = worksheet.getRow(i);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
      const filename = `Company_Details_Export_${timestamp}.xlsx`;

      // Generate Excel file buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Create blob and download
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      FileSaver.saveAs(blob, filename);
      
      alert(`Successfully exported ${totalRows} rows of company details!`);
    } catch (error) {
      console.error('Error exporting company details:', error);
      alert('Failed to export company details. Please try again.');
    } finally {
      setExporting(false);
    }
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
      {/* Header Section */}
      <div style={{
        marginBottom: '32px'
      }}>
        <h1 style={{
          margin: '0 0 8px 0',
          fontSize: '32px',
          fontWeight: '800',
          color: '#0f172a',
          letterSpacing: '-0.025em'
        }}>
          Companies Directory
        </h1>
        <p style={{
          margin: 0,
          fontSize: '16px',
          color: '#64748b',
          fontWeight: '400'
        }}>
          Manage and view company information and OJT student assignments
        </p>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Companies Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e2e8f0',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '120px',
            height: '120px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
            borderRadius: '50%'
          }}></div>
          <div>
            <div style={{
              fontSize: '13px',
              color: '#64748b',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px'
            }}>
              Total Companies
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '800',
              color: '#1e293b',
              lineHeight: '1'
            }}>
              {totalCompanies}
            </div>
          </div>
        </div>

        {/* Students Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e2e8f0',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '120px',
            height: '120px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
            borderRadius: '50%'
          }}></div>
          <div>
            <div style={{
              fontSize: '13px',
              color: '#64748b',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px'
            }}>
              Total Students
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '800',
              color: '#1e293b',
              lineHeight: '1'
            }}>
              {totalStudents}
            </div>
          </div>
        </div>

        {/* Export Button Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <button
            onClick={exportAllCompanyDetails}
            disabled={exporting || companies.length === 0}
            style={{
              padding: '14px 28px',
              background: exporting || companies.length === 0 
                ? 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)'
                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: exporting || companies.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: exporting || companies.length === 0 
                ? 'none' 
                : '0 4px 6px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(59, 130, 246, 0.2)',
              opacity: exporting || companies.length === 0 ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              if (!exporting && companies.length > 0) {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.transform = 'translateY(-2px)';
                target.style.boxShadow = '0 8px 12px rgba(59, 130, 246, 0.4), 0 4px 6px rgba(59, 130, 246, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!exporting && companies.length > 0) {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.transform = 'translateY(0)';
                target.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(59, 130, 246, 0.2)';
              }
            }}
          >
            {exporting ? (
              <span>Exporting...</span>
            ) : (
              <span>Export Company Details</span>
            )}
          </button>
        </div>
      </div>
      
      {/* Companies Table Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '0',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Table Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '2px solid #f1f5f9',
          backgroundColor: '#fafbfc'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '700',
            color: '#1e293b'
          }}>
            Company List
          </h3>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '14px',
            color: '#64748b'
          }}>
            Click on a company to view details
          </p>
        </div>

        <div style={{
          padding: '28px'
        }}>

        {companies.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
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
              <thead>
                <tr style={{
                  backgroundColor: '#f8fafc'
                }}>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    width: '80px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>
                    No.
                  </th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>
                    Company Name
                  </th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    width: '180px',
                    borderBottom: '2px solid #e2e8f0'
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
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      backgroundColor: index % 2 === 0 ? 'white' : '#fafbfc'
                    }}
                    onClick={() => handleCompanyClick(company)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.transform = 'scale(1.01)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#fafbfc';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <td style={{
                      padding: '18px 20px',
                      fontSize: '14px',
                      color: '#64748b',
                      fontWeight: '600'
                    }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        fontWeight: '700'
                      }}>
                        {index + 1}
                      </div>
                    </td>
                    <td style={{
                      padding: '18px 20px',
                      fontSize: '15px',
                      color: '#1e293b',
                      fontWeight: '600'
                    }}>
                      {company.company_name}
                    </td>
                    <td style={{
                      padding: '18px 20px',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 18px',
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        color: '#1e40af',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '700',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                        minWidth: '60px'
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
              {companyProfile && companyProfile.company_address && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Address</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{companyProfile.company_address}</div>
                </div>
              )}
            </div>

            {/* Company Contact Info - Always display if profile exists with any info, even if no students */}
            {companyProfile && (
              <div style={{
                backgroundColor: '#eff6ff',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                  Contact Information
                  {(!companyProfile.company_address && !companyProfile.company_email && !companyProfile.company_contact && !companyProfile.contact_person) && (
                    <span style={{ fontSize: '12px', color: '#ef4444', marginLeft: '10px' }}>
                      (No contact info available)
                    </span>
                  )}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {companyProfile.company_address && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Address</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{companyProfile.company_address}</div>
                    </div>
                  )}
                  {companyProfile.company_email && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Email</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{companyProfile.company_email}</div>
                    </div>
                  )}
                  {companyProfile.company_contact && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Phone</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{companyProfile.company_contact}</div>
                    </div>
                  )}
                  {companyProfile.contact_person && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Contact Person</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                        {companyProfile.contact_person}
                        {companyProfile.position && ` (${companyProfile.position})`}
                      </div>
                    </div>
                  )}
                  {/* Show message if no contact info */}
                  {!companyProfile.company_address && !companyProfile.company_email && !companyProfile.company_contact && !companyProfile.contact_person && (
                    <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '20px', color: '#64748b' }}>
                      No contact information available for this company
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

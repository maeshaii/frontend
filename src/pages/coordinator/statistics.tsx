import React, { useState, useEffect, useRef } from 'react';
import './statistics.css';
import { fetchOJTStatistics, fetchOJTByYear } from '../../services/api';
import { FaUsers, FaDownload, FaArrowLeft } from 'react-icons/fa';

interface YearData {
  year: number;
  section?: string;
  count: number;
  status_breakdown?: {
    completed: number;
    ongoing: number;
    incomplete: number;
    not_started: number;
  };
}

interface BatchData {
  year: number;
  sectionCount: number;
  totalStudents: number;
  totalIncomplete: number;
  totalCompleted: number;
  totalOngoing: number;
  totalNotStarted: number;
  companyCount: number;
}

interface CompanyData {
  company_name: string;
  count: number;
  company_address?: string;
  company_email?: string;
  company_contact?: string;
  contact_person?: string;
  position?: string;
}

export default function Statistics() {
  const [ojtYears, setOjtYears] = useState<YearData[]>([]);
  const [loading, setLoading] = useState(true);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [batchCompanies, setBatchCompanies] = useState<CompanyData[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportBatch, setSelectedExportBatch] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);
  const excelJSRef = useRef<any>(null);

  const getExcelJS = async () => {
    if (!excelJSRef.current) {
      const module = await import('exceljs');
      excelJSRef.current = module.default || module;
    }
    return excelJSRef.current;
  };

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
    const loadBatchStatistics = async () => {
      if (!coordinatorUsername) return;
      
      setLoading(true);
      try {
        const response = await fetchOJTStatistics(coordinatorUsername);
        if (response.success) {
          const yearsData = response.years || [];
          setOjtYears(yearsData);
          
          // Group data by batch (year)
          const batchGroups = yearsData.reduce((acc: Record<number, YearData[]>, yearData: YearData) => {
            const batchYear = yearData.year;
            if (!acc[batchYear]) {
              acc[batchYear] = [];
            }
            acc[batchYear].push(yearData);
            return acc;
          }, {});

          // Calculate batch-level statistics
          const batchStatsPromises = Object.entries(batchGroups).map(async ([year, sections]) => {
            const sectionsArray = sections as YearData[];
            const batchYear = parseInt(year);
            const uniqueSections = new Set(sectionsArray.map((s: YearData) => s.section).filter(Boolean));
            const sectionCount = uniqueSections.size;
            
            const totalStudents = sectionsArray.reduce((sum: number, section: YearData) => sum + (section.count || 0), 0);
            const totalIncomplete = sectionsArray.reduce((sum: number, section: YearData) => {
              return sum + (section.status_breakdown?.incomplete || 0);
            }, 0);
            const totalCompleted = sectionsArray.reduce((sum: number, section: YearData) => {
              return sum + (section.status_breakdown?.completed || 0);
            }, 0);
            const totalOngoing = sectionsArray.reduce((sum: number, section: YearData) => {
              return sum + (section.status_breakdown?.ongoing || 0);
            }, 0);
            const totalNotStarted = sectionsArray.reduce((sum: number, section: YearData) => {
              return sum + (section.status_breakdown?.not_started || 0);
            }, 0);

            // Fetch students to count companies
            let companyCount = 0;
            try {
              const companyResponse = await fetchOJTByYear(batchYear.toString(), coordinatorUsername);
              console.log(`🔍 Batch ${batchYear} API Response:`, companyResponse);
              
              // Handle both response structures: ojt_data (from API) or students (legacy)
              const studentsData = companyResponse.ojt_data || companyResponse.students || [];
              
              if (companyResponse.success && studentsData.length > 0) {
                const companySet = new Set<string>();
                studentsData.forEach((student: any) => {
                  // Check various possible field names for company
                  const companyName = student.company || student.company_name || student.companyName || '';
                  if (companyName && companyName.trim() !== '' && companyName.trim().toLowerCase() !== 'null') {
                    companySet.add(companyName.trim());
                  }
                });
                companyCount = companySet.size;
                console.log(`✅ Batch ${batchYear} - Found ${companyCount} companies from ${studentsData.length} students`);
              } else {
                console.log(`⚠️ Batch ${batchYear} - No students data found or empty response`);
              }
            } catch (error) {
              console.error(`❌ Error fetching companies for batch ${batchYear}:`, error);
            }

            return {
              year: batchYear,
              sectionCount,
              totalStudents,
              totalIncomplete,
              totalCompleted,
              totalOngoing,
              totalNotStarted,
              companyCount
            };
          });

          const batchStats = await Promise.all(batchStatsPromises);

          setBatches(batchStats);
          setTotalBatches(batchStats.length);
          setTotalStudents(batchStats.reduce((sum, batch) => sum + batch.totalStudents, 0));
        }
      } catch (error) {
        console.error('Error loading batch statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    if (coordinatorUsername) {
      loadBatchStatistics();
    }
  }, [coordinatorUsername]);

  const handleBatchClick = async (batchYear: number) => {
    setSelectedBatch(batchYear);
    setLoadingCompanies(true);
    
    try {
      const response = await fetchOJTByYear(batchYear.toString(), coordinatorUsername);
      console.log(`🔍 Loading companies for batch ${batchYear}:`, response);
      
      // Handle both response structures: ojt_data (from API) or students (legacy)
      const studentsData = response.ojt_data || response.students || [];
      
      if (response.success && studentsData.length > 0) {
        // Group students by company and store full company details
        const companyMap = new Map<string, CompanyData>();
        
        studentsData.forEach((student: any) => {
          // Check various possible field names for company
          const companyName = student.company || student.company_name || student.companyName || '';
          if (companyName && companyName.trim() !== '' && companyName.trim().toLowerCase() !== 'null') {
            const trimmedName = companyName.trim();
            
            if (!companyMap.has(trimmedName)) {
              // First occurrence - store full details
              companyMap.set(trimmedName, {
                company_name: trimmedName,
                count: 1,
                company_address: student.company_address || '',
                company_email: student.company_email || '',
                company_contact: student.company_contact || '',
                contact_person: student.contact_person || '',
                position: student.position || ''
              });
            } else {
              // Increment count
              const existing = companyMap.get(trimmedName)!;
              existing.count += 1;
            }
          }
        });
        
        console.log(`✅ Found ${companyMap.size} unique companies from ${studentsData.length} students`);
        console.log(`📊 Company breakdown:`, Array.from(companyMap.entries()));
        
        // Convert to array and sort (only include companies with names)
        const companies: CompanyData[] = Array.from(companyMap.values())
          .sort((a, b) => a.company_name.localeCompare(b.company_name));
        
        setBatchCompanies(companies);
      } else {
        console.log(`⚠️ No students data found for batch ${batchYear}`);
        setBatchCompanies([]);
      }
    } catch (error) {
      console.error('❌ Error loading batch companies:', error);
      setBatchCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExport = async () => {
    if (!selectedExportBatch) {
      alert('Please select a batch to export.');
      return;
    }

    setExporting(true);
    setShowExportModal(false);
    
    try {
      // Fetch full company data for the selected batch
      const response = await fetchOJTByYear(selectedExportBatch.toString(), coordinatorUsername);
      const studentsData = response.ojt_data || response.students || [];
      
      if (!response.success || studentsData.length === 0) {
        alert('No data found for the selected batch.');
        setExporting(false);
        return;
      }

      // Group companies and collect full details (unique companies)
      const companyMap = new Map<string, CompanyData>();
      
      studentsData.forEach((student: any) => {
        const companyName = student.company || student.company_name || student.companyName || '';
        if (companyName && companyName.trim() !== '' && companyName.trim().toLowerCase() !== 'null') {
          const trimmedName = companyName.trim();
          
          if (!companyMap.has(trimmedName)) {
            // Store first occurrence with full details
            companyMap.set(trimmedName, {
              company_name: trimmedName,
              count: 1,
              company_address: student.company_address || '',
              company_email: student.company_email || '',
              company_contact: student.company_contact || '',
              contact_person: student.contact_person || '',
              position: student.position || ''
            });
          } else {
            // Increment count
            const existing = companyMap.get(trimmedName)!;
            existing.count += 1;
          }
        }
      });

      const companies: CompanyData[] = Array.from(companyMap.values())
        .sort((a, b) => a.company_name.localeCompare(b.company_name));

      // Create Excel file
      const ExcelJS = await getExcelJS();
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Companies');
      
      // Add headers
      worksheet.addRow([
        'Company Name',
        'Company Address',
        'Company Email',
        'Company Contact',
        'Contact Person',
        'Position'
      ]);
      
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF174F84' }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Add data rows
      companies.forEach((company) => {
        worksheet.addRow([
          company.company_name || '',
          company.company_address || '',
          company.company_email || '',
          company.company_contact || '',
          company.contact_person || '',
          company.position || ''
        ]);
      });

      // Auto-size columns
      worksheet.columns.forEach((column: any) => {
        if (column.number === 1) column.width = 30; // Company Name
        else if (column.number === 2) column.width = 40; // Company Address
        else if (column.number === 3) column.width = 30; // Company Email
        else if (column.number === 4) column.width = 20; // Company Contact
        else if (column.number === 5) column.width = 25; // Contact Person
        else if (column.number === 6) column.width = 25; // Position
      });

      // Set header row height
      headerRow.height = 30;

      // Download the file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Batch_${selectedExportBatch - 1}-${selectedExportBatch}_Companies.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      setSelectedExportBatch(null);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
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
            Loading batch statistics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '32px',
      backgroundColor: '#f8fafc',
      width: '100%',
      boxSizing: 'border-box',
      height: '100%'
    }}>
      <style>{`
        /* Hide scrollbars like the import side (dashboard) */
        div::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        div {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
      `}</style>
      {/* Header Section */}
      {!selectedBatch && (
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '32px',
              fontWeight: '800',
              color: '#0f172a',
              letterSpacing: '-0.025em'
            }}>
              Batch Statistics
            </h1>
            <p style={{
              margin: 0,
              fontSize: '16px',
              color: '#64748b',
              fontWeight: '400'
            }}>
              View OJT statistics grouped by batch
            </p>
          </div>
          <button
            onClick={handleExportClick}
            disabled={exporting || batches.length === 0}
            style={{
              backgroundColor: exporting ? '#94a3b8' : '#174f84',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: exporting || batches.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: exporting || batches.length === 0 ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
              opacity: exporting || batches.length === 0 ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!exporting && batches.length > 0) {
                e.currentTarget.style.backgroundColor = '#0f3d6b';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!exporting && batches.length > 0) {
                e.currentTarget.style.backgroundColor = '#174f84';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <FaDownload style={{ fontSize: '16px' }} />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      )}

      {/* Batch Cards or Company List */}
      {selectedBatch ? (
        <div>
          {/* Back Button */}
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={() => {
                setSelectedBatch(null);
                setBatchCompanies([]);
              }}
              style={{
                backgroundColor: 'transparent',
                color: '#1e293b',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <FaArrowLeft />
              Back
            </button>
          </div>
          
          {/* Company List */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '0',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
            border: '1px solid #e2e8f0',
            overflow: 'visible'
          }}>
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
                Company List - CLASS OF {selectedBatch - 1}-{selectedBatch}
              </h3>
              <p style={{
                margin: '4px 0 0 0',
                fontSize: '14px',
                color: '#64748b'
              }}>
                Companies in this batch
              </p>
            </div>

            <div style={{
              padding: '28px'
            }}>
              {loadingCompanies ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px'
                }}>
                  <p style={{
                    fontSize: '16px',
                    color: '#64748b',
                    margin: '0',
                    fontWeight: '500'
                  }}>
                    Loading companies...
                  </p>
                </div>
              ) : batchCompanies.length === 0 ? (
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
                    No companies found for this batch.
                  </p>
                </div>
              ) : (
                <div style={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  width: '100%',
                  overflow: 'visible',
                  display: 'block'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'separate',
                    borderSpacing: '0',
                    display: 'table'
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
                      {batchCompanies.map((company, index) => (
                        <tr
                          key={index}
                          style={{
                            borderBottom: index < batchCompanies.length - 1 ? '1px solid #f1f5f9' : 'none',
                            transition: 'all 0.2s ease',
                            backgroundColor: index % 2 === 0 ? 'white' : '#fafbfc',
                            cursor: 'pointer'
                          }}
                          onClick={() => setSelectedCompany(company)}
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
          {selectedCompany && (
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
              onClick={() => setSelectedCompany(null)}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '0',
                  maxWidth: '600px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{
                  padding: '24px 28px',
                  borderBottom: '2px solid #f1f5f9',
                  backgroundColor: '#fafbfc',
                  borderRadius: '16px 16px 0 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#1e293b'
                    }}>
                      Company Details
                    </h3>
                    <p style={{
                      margin: '4px 0 0 0',
                      fontSize: '14px',
                      color: '#64748b'
                    }}>
                      {selectedCompany.company_name}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCompany(null)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      background: '#f3f4f6',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#475569',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e5e7eb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                  >
                    Close
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{
                  padding: '28px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr',
                    rowGap: '16px',
                    columnGap: '20px',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}>
                    <div style={{ color: '#6b7280', fontWeight: '600' }}>Company Name:</div>
                    <div style={{ color: '#111827', fontWeight: '500' }}>{selectedCompany.company_name || 'N/A'}</div>

                    {selectedCompany.company_address && (
                      <>
                        <div style={{ color: '#6b7280', fontWeight: '600' }}>Address:</div>
                        <div style={{ color: '#111827', fontWeight: '500' }}>{selectedCompany.company_address}</div>
                      </>
                    )}

                    {selectedCompany.company_email && (
                      <>
                        <div style={{ color: '#6b7280', fontWeight: '600' }}>Email:</div>
                        <div style={{ color: '#111827', fontWeight: '500' }}>
                          <a
                            href={`mailto:${selectedCompany.company_email}`}
                            style={{
                              color: '#3b82f6',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {selectedCompany.company_email}
                          </a>
                        </div>
                      </>
                    )}

                    {selectedCompany.company_contact && (
                      <>
                        <div style={{ color: '#6b7280', fontWeight: '600' }}>Contact:</div>
                        <div style={{ color: '#111827', fontWeight: '500' }}>
                          <a
                            href={`tel:${selectedCompany.company_contact}`}
                            style={{
                              color: '#3b82f6',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {selectedCompany.company_contact}
                          </a>
                        </div>
                      </>
                    )}

                    {selectedCompany.contact_person && (
                      <>
                        <div style={{ color: '#6b7280', fontWeight: '600' }}>Contact Person:</div>
                        <div style={{ color: '#111827', fontWeight: '500' }}>{selectedCompany.contact_person}</div>
                      </>
                    )}

                    {selectedCompany.position && (
                      <>
                        <div style={{ color: '#6b7280', fontWeight: '600' }}>Position:</div>
                        <div style={{ color: '#111827', fontWeight: '500' }}>{selectedCompany.position}</div>
                      </>
                    )}

                    <div style={{ color: '#6b7280', fontWeight: '600' }}>OJT Students:</div>
                    <div style={{ color: '#111827', fontWeight: '500' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 14px',
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        color: '#1e40af',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '700',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                      }}>
                        {selectedCompany.count} {selectedCompany.count === 1 ? 'Student' : 'Students'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {batches.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                margin: '0',
                fontWeight: '500'
              }}>
                No batch data found.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '28px',
              marginBottom: '32px',
              overflow: 'visible',
              maxHeight: 'none',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {batches.map((batch) => {
                const batchLabel = `CLASS OF ${batch.year}-${batch.year + 1}`;
                
                return (
                  <div
                    key={`batch-${batch.year}`}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '20px',
                      padding: '28px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      border: '1px solid rgba(226, 232, 240, 0.8)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      position: 'relative',
                      overflow: 'visible',
                      cursor: 'pointer',
                      minHeight: '180px'
                    }}
                    onClick={() => handleBatchClick(batch.year)}
                    onMouseEnter={(e) => {
                      const target = e.currentTarget as HTMLDivElement;
                      target.style.transform = 'translateY(-6px) scale(1.02)';
                      target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                      target.style.borderColor = 'rgba(29, 78, 216, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      const target = e.currentTarget as HTMLDivElement;
                      target.style.transform = 'translateY(0) scale(1)';
                      target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                      target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                    }}
                  >
                    {/* Header Section with Icon and Title */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '18px'
                    }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '28px',
                        boxShadow: '0 10px 15px -3px rgba(102, 126, 234, 0.3), 0 4px 6px -2px rgba(102, 126, 234, 0.2)',
                        flexShrink: 0
                      }}>
                        <FaUsers />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ 
                          margin: 0, 
                          fontSize: '22px', 
                          fontWeight: 800, 
                          color: '#1e293b',
                          letterSpacing: '-0.025em',
                          lineHeight: '1.2',
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                          marginBottom: '4px'
                        }}>
                          {batchLabel}
                        </h3>
                        <p style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#94a3b8',
                          fontWeight: 500,
                          letterSpacing: '0.01em'
                        }}>
                          Batch Year {batch.year}
                        </p>
                      </div>
                    </div>

                    {/* Stats Section */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid #f1f5f9'
                    }}>
                      {/* Students Count */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          color: '#475569',
                          fontWeight: 600
                        }}>
                          Students
                        </span>
                        <span style={{
                          fontSize: '18px',
                          color: '#1e293b',
                          fontWeight: 700,
                          fontFamily: "'Inter', sans-serif"
                        }}>
                          {batch.totalStudents}
                        </span>
                      </div>

                      {/* Companies Count */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          color: '#475569',
                          fontWeight: 600
                        }}>
                          Companies
                        </span>
                        <span style={{
                          fontSize: '18px',
                          color: '#1e293b',
                          fontWeight: 700,
                          fontFamily: "'Inter', sans-serif"
                        }}>
                          {batch.companyCount}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              margin: '0 0 24px 0',
              fontSize: '24px',
              fontWeight: 700,
              color: '#1e293b'
            }}>
              Export Company Data
            </h2>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#475569'
              }}>
                Select Batch
              </label>
              <select
                value={selectedExportBatch || ''}
                onChange={(e) => setSelectedExportBatch(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#1e293b',
                  cursor: 'pointer',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#174f84'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              >
                <option value="">-- Select a batch --</option>
                {batches.map((batch) => {
                  const batchLabel = `CLASS OF ${batch.year}-${batch.year + 1}`;
                  return (
                    <option key={batch.year} value={batch.year}>
                      {batchLabel} ({batch.totalStudents} Students, {batch.companyCount} Companies)
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setSelectedExportBatch(null);
                }}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={!selectedExportBatch || exporting}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: selectedExportBatch && !exporting ? '#174f84' : '#94a3b8',
                  color: 'white',
                  cursor: selectedExportBatch && !exporting ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  opacity: selectedExportBatch && !exporting ? 1 : 0.6
                }}
                onMouseEnter={(e) => {
                  if (selectedExportBatch && !exporting) {
                    e.currentTarget.style.backgroundColor = '#0f3d6b';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedExportBatch && !exporting) {
                    e.currentTarget.style.backgroundColor = '#174f84';
                  }
                }}
              >
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// index.tsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../global/sidebar';
import { fetchAlumniStatistics, fetchAlumniByYear, importAlumni } from '../../../services/api';
import ExcelJS from 'exceljs';
import { FaUpload, FaDownload } from 'react-icons/fa';

const UsersIndex: React.FC = () => {
  const [batchList, setBatchList] = useState<{ year: number; count: number }[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [alumni, setAlumni] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('All');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchYear, setBatchYear] = useState('');
  const [selectedProgramImport, setSelectedProgramImport] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showImportErrorModal, setShowImportErrorModal] = useState(false);
  const [importError, setImportError] = useState<{ title?: string; message: string; hint?: string; details?: string[] } | null>(null);

  useEffect(() => {
    const loadBatches = async () => {
      setLoading(true);
      try {
        const data = await fetchAlumniStatistics();
        setBatchList(data.years || []);
      } catch (e) {
        setBatchList([]);
      } finally {
        setLoading(false);
      }
    };
    loadBatches();
  }, []);

  const handleBatchClick = async (year: number) => {
    setLoading(true);
    setSelectedBatch(year);
    setSearchTerm('');
    setSelectedProgram('All');
    try {
      const data = await fetchAlumniByYear(year.toString());
      setAlumni(data.alumni || []);
    } catch (e) {
      setAlumni([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedBatch(null);
    setAlumni([]);
    setSearchTerm('');
    setSelectedProgram('All');
  };

  // Get unique programs for dropdown
  const programOptions = Array.from(new Set(alumni.map((a) => a.program).filter(Boolean)));

  // Filtered alumni
  const filteredAlumni = alumni.filter((user) => {
    const matchProgram = selectedProgram === 'All' || user.program === selectedProgram;
    const matchSearch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchProgram && matchSearch;
  });

  const calculateAge = (birthDateStr?: string) => {
    if (!birthDateStr) return 'N/A';
    const date = new Date(birthDateStr);
    if (isNaN(date.getTime())) return 'N/A';
    const diff = Date.now() - date.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  // Generate Excel template with all required and optional columns (including tracker questions)
  // Based on backend import_alumni_view function analysis - NO PASSWORD COLUMN (auto-generated)
  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Alumni Import Template');

    // REQUIRED COLUMNS (based on backend lines 1075-1076)
    // Password column is NOT included - passwords are auto-generated after import
    
    // BASIC INFORMATION (Required)
    const basicHeaders = [
      { header: 'CTU_ID', key: 'ctu_id', width: 15 },
      { header: 'First_Name', key: 'first_name', width: 20 },
      { header: 'Last_Name', key: 'last_name', width: 20 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Year_Graduated', key: 'year_graduated', width: 18 },
      { header: 'Program', key: 'program', width: 15 },
    ];

    // BASIC INFORMATION (Optional)
    const optionalBasicHeaders = [
      { header: 'Middle_Name', key: 'middle_name', width: 20 },
      { header: 'Birthdate', key: 'birthdate', width: 15 },
      { header: 'Phone_Number', key: 'phone_number', width: 18 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Civil Status', key: 'civil_status', width: 15 },
      { header: 'Social Media', key: 'social_media', width: 25 },
      { header: 'Section', key: 'section', width: 15 },
    ];

    // TRACKER QUESTION COLUMNS (for alumni who already answered tracker questions)
    // Based on backend lines 1246, 1262, 1274, 1280, 1286, 1299 - EXACT column names
    const trackerHeaders = [
      { header: 'Are you PRESENTLY employed?', key: 'are_you_presently_employed', width: 30 },
      { header: 'Current Company Name', key: 'current_company_name', width: 30 },
      { header: 'Current Position', key: 'current_position', width: 30 },
      { header: 'Current Sector of your Job', key: 'current_sector_of_your_job', width: 30 },
      { header: 'Current Salary Range', key: 'current_salary_range', width: 25 },
      { header: 'Please specify post graduate/degree.', key: 'please_specify_post_graduate_degree', width: 35 },
    ];

    // Combine all headers
    const headers = [...basicHeaders, ...optionalBasicHeaders, ...trackerHeaders];
    worksheet.columns = headers;

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1C4E80' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Sample data rows - Example 1: Basic info only (no tracker data)
    const sampleDataBasic = {
      ctu_id: '1337580',
      first_name: 'John',
      last_name: 'Doe',
      middle_name: 'Michael',
      gender: 'M',
      year_graduated: '2024',
      program: 'BSIT',
      birthdate: '2003-04-12',
      phone_number: '09123456789',
      address: '123 Main Street, Cebu City, Cebu',
      civil_status: 'Single',
      social_media: '@johndoe',
      section: '',
      are_you_presently_employed: '',
      current_company_name: '',
      current_position: '',
      current_sector_of_your_job: '',
      current_salary_range: '',
      please_specify_post_graduate_degree: '',
    };

    // Example 2: With tracker data (employed)
    const sampleDataWithTracker = {
      ctu_id: '1337581',
      first_name: 'Jane',
      last_name: 'Smith',
      middle_name: 'Marie',
      gender: 'F',
      year_graduated: '2024',
      program: 'BSIS',
      birthdate: '2002-05-15',
      phone_number: '09187654321',
      address: '456 Oak Avenue, Mandaue City, Cebu',
      civil_status: 'Single',
      social_media: '@janesmith',
      section: '',
      are_you_presently_employed: 'Yes',
      current_company_name: 'ABC Technology Solutions Inc.',
      current_position: 'Software Developer',
      current_sector_of_your_job: 'Private',
      current_salary_range: '20,000 - 30,000',
      please_specify_post_graduate_degree: '',
    };

    // Example 3: With tracker data (unemployed, pursuing further study)
    const sampleDataUnemployed = {
      ctu_id: '1337582',
      first_name: 'Mark',
      last_name: 'Johnson',
      middle_name: 'Paul',
      gender: 'M',
      year_graduated: '2024',
      program: 'BIT-CT',
      birthdate: '2003-08-20',
      phone_number: '09234567890',
      address: '789 Pine Road, Lapu-Lapu City, Cebu',
      civil_status: 'Married',
      social_media: '@markjohnson',
      section: '',
      are_you_presently_employed: 'No',
      current_company_name: '',
      current_position: '',
      current_sector_of_your_job: '',
      current_salary_range: '',
      please_specify_post_graduate_degree: 'Master of Science in Information Technology',
    };

    // Add sample data rows
    worksheet.addRow(sampleDataBasic);
    worksheet.addRow(sampleDataWithTracker);
    worksheet.addRow(sampleDataUnemployed);

    // Add instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [{ header: 'Instructions', key: 'instructions', width: 100 }];
    
    const instructionData = [
      { instructions: 'ALUMNI IMPORT TEMPLATE - INSTRUCTIONS' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'REQUIRED COLUMNS (Must be filled for all alumni):' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  • CTU_ID: Unique identifier for the alumni (e.g., 1337580)' },
      { instructions: '  • First_Name: First name of the alumni' },
      { instructions: '  • Last_Name: Last name of the alumni' },
      { instructions: '  • Gender: Must be exactly "M" for Male or "F" for Female (case-sensitive)' },
      { instructions: '  • Year_Graduated: Graduation year (e.g., 2024)' },
      { instructions: '  • Program: Must be exactly one of: BSIT, BSIS, or BIT-CT' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'OPTIONAL BASIC COLUMNS (Can be left empty):' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  • Middle_Name: Middle name of the alumni' },
      { instructions: '  • Birthdate: Date of birth (Format: YYYY-MM-DD or MM/DD/YYYY)' },
      { instructions: '    Examples: 2003-04-12 or 04/12/2003' },
      { instructions: '  • Phone_Number: Contact number (e.g., 09123456789)' },
      { instructions: '  • Address: Complete address' },
      { instructions: '  • Civil Status: Marital status (e.g., Single, Married, etc.)' },
      { instructions: '  • Social Media: Social media handle (e.g., @username)' },
      { instructions: '  • Section: Class section (if applicable)' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'TRACKER QUESTION COLUMNS (For alumni who answered tracker questions):' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  These columns are for importing alumni who have already answered tracker questions.' },
      { instructions: '  Leave these empty if the alumni has not answered the tracker yet.' },
      { instructions: '' },
      { instructions: '  • Are you PRESENTLY employed?: Must be "Yes" or "No" (or "Y"/"N")' },
      { instructions: '  • Current Company Name: Name of current employer' },
      { instructions: '  • Current Position: Job title/position (e.g., Software Developer)' },
      { instructions: '  • Current Sector of your Job: Must be "Private", "Government", or "Public"' },
      { instructions: '  • Current Salary Range: Salary range (e.g., 20,000 - 30,000)' },
      { instructions: '  • Please specify post graduate/degree.: Post-graduate degree if pursuing further study' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'IMPORTANT NOTES:' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  ⚠️  Password column is NOT included - passwords are AUTO-GENERATED' },
      { instructions: '      After import, you will receive a separate Excel file with auto-generated passwords' },
      { instructions: '' },
      { instructions: '  • Gender must be exactly "M" or "F" (case-sensitive, uppercase)' },
      { instructions: '  • Program must be exactly: BSIT, BSIS, or BIT-CT' },
      { instructions: '  • CTU_ID must be unique - duplicates will be skipped during import' },
      { instructions: '  • Date format: Use YYYY-MM-DD (e.g., 2003-04-12) or MM/DD/YYYY (e.g., 04/12/2003)' },
      { instructions: '  • Tracker columns use exact question text as column headers (case-sensitive)' },
      { instructions: '  • You can provide Year_Graduated and Program via form fields during import' },
      { instructions: '    instead of including them in each row of the Excel file' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'EXAMPLE SCENARIOS:' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  1. Basic Import (No tracker data):' },
      { instructions: '     - Fill required columns: CTU_ID, First_Name, Last_Name, Gender, Year_Graduated, Program' },
      { instructions: '     - Leave tracker columns empty' },
      { instructions: '' },
      { instructions: '  2. Import with Tracker Data (Alumni already answered tracker):' },
      { instructions: '     - Fill all required columns' },
      { instructions: '     - Fill tracker columns if alumni answered them' },
      { instructions: '     - "Are you PRESENTLY employed?" must be "Yes" or "No"' },
      { instructions: '     - If "Yes", fill employment-related tracker columns' },
      { instructions: '     - If "No" and pursuing further study, fill post-graduate degree column' },
    ];

    instructionData.forEach((row, index) => {
      const instructionRow = instructionsSheet.addRow(row);
      const text = row.instructions;
      if (text.includes('══════') || text.startsWith('ALUMNI IMPORT') || 
          text.includes('REQUIRED COLUMNS') || text.includes('OPTIONAL') || 
          text.includes('TRACKER QUESTION') || text.includes('IMPORTANT NOTES') ||
          text.includes('EXAMPLE SCENARIOS') || text.startsWith('  ⚠️')) {
        instructionRow.font = { bold: true };
        instructionRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      }
    });

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'middle', horizontal: 'left' };
        row.height = 20;
        // Alternate row colors for better readability
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        }
      }
    });

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Generate Excel file and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'alumni_import_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
        setImportMessage(null);
      } else {
        setImportMessage({ type: 'error', text: 'Please select an Excel file (.xlsx or .xls)' });
        setSelectedFile(null);
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !batchYear || !selectedProgramImport) {
      setImportMessage({ type: 'error', text: 'Please fill in all fields and select a file' });
      return;
    }

    setImportLoading(true);
    setImportMessage(null);

    try {
      const result = await importAlumni(selectedFile, batchYear, selectedProgramImport);
      
      if (result.success) {
        setImportMessage({
          type: 'success',
          text: `Import successful! ${result.created_count || 0} alumni created. ${result.skipped_count || 0} duplicates skipped.`,
        });
        // Reload batch list
        const data = await fetchAlumniStatistics();
        setBatchList(data.years || []);
        // Reset form
        setSelectedFile(null);
        setBatchYear('');
        setSelectedProgramImport('');
        setTimeout(() => {
          setShowImportModal(false);
          setImportMessage(null);
        }, 3000);
      } else {
        // Check if this is a duplicate file (all records already exist)
        if (result.is_duplicate_file) {
          setImportError({
            title: 'Duplicate File Detected',
            message: result.message || 'All records in this file already exist in the system.',
            hint: 'This file appears to have been imported before. Each file can only be imported once to prevent duplicate records.',
            details: [
              `Found ${result.duplicate_count || 0} records that already exist in the system.`,
              'If you need to update existing records, please use the edit functionality instead.',
              'If this is a new file with different data, please verify the CTU IDs are unique.'
            ],
          });
          setShowImportErrorModal(true);
          // Clear selected file
          setSelectedFile(null);
          return;
        }
        
        // Check for CTU ID validation errors
        const serverMessage = result.message || 'Import failed. Please review your template and try again.';
        const normalizedMessage = serverMessage.toLowerCase();
        
        if (normalizedMessage.includes('invalid ctu_id format') || 
            normalizedMessage.includes('ctu_id must be exactly 7') ||
            (normalizedMessage.includes('ctu_id') && (normalizedMessage.includes('7') || normalizedMessage.includes('digit') || normalizedMessage.includes('numeric') || normalizedMessage.includes('exactly')))) {
          // Show error modal for CTU ID validation errors
          let hint: string | undefined = 'All CTU IDs must be exactly 7 numeric digits (e.g., 1234567).';
          let details: string[] | undefined;
          
          // Parse the error message to extract row details
          const lines = serverMessage.split('\n');
          const errorLines = lines.filter((line: string) => line.trim().startsWith('Row'));
          
          // Also check for single error messages that mention specific CTU IDs
          const hasSpecificError = serverMessage.includes("but got") || serverMessage.includes("character(s)");
          
          if (errorLines.length > 0) {
            details = [
              'The following rows have invalid CTU IDs:',
              ...errorLines.slice(0, 15).map((line: string) => `• ${line.trim()}`),
              ...(errorLines.length > 15 ? [`... and ${errorLines.length - 15} more error(s)`] : [])
            ];
          } else if (hasSpecificError) {
            // Extract the specific error from the message
            const errorMatch = serverMessage.match(/but got \d+ character\(s\): '([^']+)'/);
            if (errorMatch) {
              details = [
                `Found invalid CTU ID: ${errorMatch[1]}`,
                'Please check all CTU IDs in your file.',
                'Each CTU ID must be exactly 7 numbers (no letters, no spaces).',
                'Example: 1234567 ✅',
                'Invalid: 123456 ❌ (too short)',
                'Invalid: 12345678 ❌ (too long)',
                'Invalid: 123456a ❌ (contains letter)'
              ];
            } else {
              details = [
                serverMessage.split('\n')[0] || 'Invalid CTU ID format detected.',
                'Please check all CTU IDs in your file.',
                'Each CTU ID must be exactly 7 numbers (no letters, no spaces).',
                'Example: 1234567 ✅',
                'Invalid: 123456 ❌ (too short)',
                'Invalid: 12345678 ❌ (too long)',
                'Invalid: 123456a ❌ (contains letter)'
              ];
            }
          } else {
            details = [
              'Please check all CTU IDs in your file.',
              'Each CTU ID must be exactly 7 numbers (no letters, no spaces).',
              'Example: 1234567 ✅',
              'Invalid: 123456 ❌ (too short)',
              'Invalid: 12345678 ❌ (too long)',
              'Invalid: 123456a ❌ (contains letter)'
            ];
          }
          
          setImportError({
            title: 'Invalid CTU ID Format',
            message: serverMessage,
            hint,
            details,
          });
          setShowImportErrorModal(true);
          // Clear selected file since validation failed
          setSelectedFile(null);
        } else {
          setImportMessage({ type: 'error', text: serverMessage });
        }
      }
    } catch (error: any) {
      setImportMessage({ type: 'error', text: error.message || 'An unexpected error occurred' });
    } finally {
      setImportLoading(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setSelectedFile(null);
    setBatchYear('');
    setSelectedProgramImport('');
    setImportMessage(null);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div className="admin-content-page" style={{ flexGrow: 1, padding: '20px 48px 40px 48px', backgroundColor: '#f5f7fa', overflowY: 'auto', overflowX: 'hidden', marginLeft: 'var(--sidebar-width, 220px)', height: '100vh' }}>
        {/* Header: Only show in batch card view */}
        {!selectedBatch && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', marginTop: 0, paddingTop: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>👥</span>
              <span style={{ fontWeight: 'bold', fontSize: '22px', color: '#2c5282' }}>Alumni Users</span>
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#1D4E89',
                color: '#fff',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#163b66';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1D4E89';
              }}
            >
              <FaUpload style={{ fontSize: '14px' }} />
              Import/Export
            </button>
          </div>
        )}

        {/* Batch Cards View */}
        {!selectedBatch && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {batchList.length === 0 && !loading && <div>No alumni batches found.</div>}
            {loading && <div>Loading...</div>}
            {batchList.map((batch) => (
              <div
                key={batch.year}
                onClick={() => handleBatchClick(batch.year)}
                style={{
                  width: '220px',
                  borderRadius: '20px',
                  backgroundColor: 'white',
                  overflow: 'hidden',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08)',
                  transition: 'transform 0.2s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    height: '80px',
                    backgroundColor: '#e3e9f7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    color: '#174f84',
                  }}
                >
                  <span role="img" aria-label="batch">
                    🎓
                  </span>
                </div>
                <div style={{ backgroundColor: '#174f84', color: 'white', padding: '15px' }}>
                  <strong style={{ fontSize: '15px', display: 'block', marginBottom: '5px' }}>
                    CLASS OF {batch.year}
                  </strong>
                  <div style={{ fontSize: '13px' }}>Alumni: {batch.count}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alumni Table View */}
        {selectedBatch && (
          <div>
            <button
              onClick={handleBack}
              style={{
                border: 'none',
                background: '#174f84',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '18px',
                cursor: 'pointer',
                marginBottom: 20,
              }}
            >
              &lsaquo;
            </button>
            {/* Batch title and search/filter row in one flex container */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 18,
              }}
            >
              <h2 style={{ margin: 0 }}>BATCH {selectedBatch}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <input
                  type="text"
                  placeholder="🔍 Search...."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '24px',
                    border: '2px solid #222',
                    fontSize: '16px',
                    outline: 'none',
                    width: 240,
                    marginRight: 8,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    background: '#fff',
                    transition: 'border 0.2s',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ marginRight: 8, fontWeight: 500, color: '#222', fontSize: 15 }}>
                    PROGRAM:
                  </label>
                  <select
                    value={selectedProgram}
                    onChange={(e) => setSelectedProgram(e.target.value)}
                    style={{
                      padding: '8px 28px 8px 18px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '15px',
                      background: '#3b5bfe',
                      color: 'white',
                      fontWeight: 600,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      appearance: 'none',
                      outline: 'none',
                    }}
                  >
                    <option value="All">All</option>
                    {programOptions.map((program) => (
                      <option key={program} value={program}>
                        {program}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: 'white',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              }}
            >
              <thead>
                <tr style={{ background: '#174f84', color: 'white' }}>
                  <th style={{ padding: '12px' }}>Name</th>
                  <th style={{ padding: '12px' }}>ID Number</th>
                  <th style={{ padding: '12px' }}>Program</th>
                  <th style={{ padding: '12px' }}>Batch Graduated</th>
                  <th style={{ padding: '12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                      Loading...
                    </td>
                  </tr>
                ) : filteredAlumni.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                      No alumni found for this batch.
                    </td>
                  </tr>
                ) : (
                  filteredAlumni.map((user, index) => (
                    <tr
                      key={user.id}
                      style={{
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onClick={() => setSelectedUser(user)}
                      onMouseOver={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = '#f0f8ff';
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = '';
                      }}
                    >
                      <td>{user.name}</td>
                      <td>{user.ctu_id}</td>
                      <td>{user.program}</td>
                      <td>{user.batch}</td>
                      <td
                        style={{
                          color:
                            user.status === 'Employed'
                              ? 'teal'
                              : user.status === 'High Position'
                                ? '#e6b800'
                                : user.status === 'Absorb'
                                  ? '#0093D9'
                                  : 'orangered',
                        }}
                      >
                        {user.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add modal after the table */}
        {selectedUser && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: 'white',
                padding: '40px',
                borderRadius: '16px',
                minWidth: '340px',
                textAlign: 'center',
              }}
            >
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: 24 }}>
                User Profile
              </h2>
              <div style={{ textAlign: 'left', marginBottom: 18 }}>
                <p>
                  <b>Name:</b> {selectedUser.name}
                </p>
                <p>
                  <b>ID Number:</b> {selectedUser.ctu_id}
                </p>
                <p>
                  <b>Course:</b> {selectedUser.course}
                </p>
                <p>
                  <b>Batch:</b> {selectedUser.batch}
                </p>
                <p>
                  <b>Status:</b> {selectedUser.status}
                </p>
                <p>
                  <b>Gender:</b> {selectedUser.gender || 'N/A'}
                </p>
                <p>
                  <b>Birthdate:</b> {selectedUser.birthdate || 'N/A'}
                </p>
                <p>
                  <b>Age:</b>{' '}
                  {selectedUser.birthdate ? calculateAge(selectedUser.birthdate) : 'N/A'}
                </p>
                <p>
                  <b>Civil Status:</b> {selectedUser.civilStatus || 'N/A'}
                </p>
                <p>
                  <b>Phone Number:</b> {selectedUser.phone || 'N/A'}
                </p>
                <p>
                  <b>Address:</b> {selectedUser.address || 'N/A'}
                </p>
                <p>
                  <b>Social Media:</b> {selectedUser.socialMedia || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  marginTop: '20px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#f26c4f',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
              }}
              onClick={closeImportModal}
            />
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'white',
                padding: '32px',
                borderRadius: '10px',
                zIndex: 1001,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                width: '500px',
                maxWidth: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#2c5282' }}>Import Alumni Data</h2>

              {importMessage && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '14px',
                    backgroundColor: importMessage.type === 'success' ? '#d4edda' : '#f8d7da',
                    color: importMessage.type === 'success' ? '#155724' : '#721c24',
                    border: `1px solid ${importMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                  }}
                >
                  {importMessage.text}
                </div>
              )}

              {/* Download Template Section */}
              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>
                  📥 Download Template
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>
                  Download an Excel template with all required columns and sample data to help you format your import file correctly.
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#10b981';
                  }}
                >
                  <FaDownload style={{ fontSize: '14px' }} />
                  Download Excel Template
                </button>
              </div>

              <div style={{ height: '1px', background: '#e5e7eb', margin: '20px 0' }} />

              {/* Import Section */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                  }}
                >
                  Batch Graduated:
                </label>
                <select
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  disabled={importLoading}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '15px',
                    color: '#374151',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="">Select graduation year</option>
                  {batchList.map((batch) => (
                    <option key={batch.year} value={String(batch.year)}>
                      {batch.year}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                  }}
                >
                  Program:
                </label>
                <select
                  value={selectedProgramImport}
                  onChange={(e) => setSelectedProgramImport(e.target.value)}
                  disabled={importLoading}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '15px',
                    color: '#374151',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="">Select course</option>
                  <option value="BSIT">BSIT</option>
                  <option value="BSIS">BSIS</option>
                  <option value="BIT-CT">BIT-CT</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                  }}
                >
                  Upload Excel File:
                </label>
                <div
                  style={{
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={importLoading}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ fontSize: '48px', color: '#6b7280', marginBottom: '12px' }}>📄</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    {selectedFile ? selectedFile.name : 'Choose Excel File'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    {selectedFile ? 'File selected - Click to change' : 'Click to browse or drag and drop'}
                  </div>
                </div>
                <small
                  style={{
                    color: '#6b7280',
                    marginTop: '8px',
                    display: 'block',
                    fontSize: '12px',
                    lineHeight: '1.4',
                  }}
                >
                  <strong>Required columns:</strong> CTU_ID, First_Name, Last_Name, Gender<br />
                  <strong>Optional:</strong> Middle_Name, Birthdate, Phone_Number, Address, Civil Status, Social Media, Password<br />
                  <strong>Date format:</strong> YYYY-MM-DD or MM/DD/YYYY
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={closeImportModal}
                  disabled={importLoading}
                  style={{
                    padding: '10px 18px',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    backgroundColor: '#ccc',
                    color: '#000',
                  }}
                >
                  Cancel
                </button>
                <button
                  style={{
                    backgroundColor: '#1D4E89',
                    color: '#fff',
                    padding: '10px 18px',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: importLoading ? 'not-allowed' : 'pointer',
                    opacity: importLoading ? 0.6 : 1,
                  }}
                  onClick={handleImport}
                  disabled={importLoading}
                >
                  {importLoading ? 'Importing...' : 'Import Alumni'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Import Error Modal */}
        {showImportErrorModal && importError && (
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
              zIndex: 1100,
            }}
            onClick={() => {
              setShowImportErrorModal(false);
              setImportError(null);
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '28px',
                maxWidth: importError.title === 'Invalid CTU ID Format' ? '600px' : '420px',
                maxHeight: '90vh',
                width: '92%',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
                border: '1px solid #fecaca',
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '28px' }}>⚠️</span>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#b91c1c',
                  }}
                >
                  {importError.title || 'Import blocked'}
                </h2>
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {importError.title !== 'Invalid CTU ID Format' && (
                  <p
                    style={{
                      margin: '0 0 12px',
                      color: '#1f2937',
                      lineHeight: 1.5,
                      fontSize: '14px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {importError.message}
                  </p>
                )}
                {importError.title === 'Invalid CTU ID Format' && (
                  <p
                    style={{
                      margin: '0 0 12px',
                      color: '#dc2626',
                      lineHeight: 1.5,
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    The file cannot be imported because it contains invalid CTU IDs. Please fix all errors and try again.
                  </p>
                )}

                {importError.hint && (
                  <div
                    style={{
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#92400e',
                      fontSize: '13px',
                      lineHeight: 1.45,
                      marginBottom: '12px',
                    }}
                  >
                    {importError.hint}
                  </div>
                )}
                {importError.details && importError.details.length > 0 && (
                  <div
                    style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '12px',
                      maxHeight: importError.title === 'Invalid CTU ID Format' ? '300px' : 'auto',
                      overflowY: importError.title === 'Invalid CTU ID Format' ? 'auto' : 'visible',
                    }}
                  >
                    <ul
                      style={{
                        margin: 0,
                        padding: 0,
                        color: '#374151',
                        fontSize: '13px',
                        lineHeight: 1.6,
                        listStyle: 'none',
                      }}
                    >
                      {importError.details.map((detail, idx) => (
                        <li key={idx} style={{ marginBottom: '8px', paddingLeft: '8px' }}>
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowImportErrorModal(false);
                    setImportError(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ef4444';
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersIndex;

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import GenerateStatsModal from '../../../components/GenerateStatsModal';
import { fetchAlumniStatistics, importAlumni } from '../../../services/api';
import { FaChartBar, FaUpload, FaGraduationCap, FaUsers, FaCalendarAlt, FaFilter, FaCog, FaArrowLeft, FaDownload } from 'react-icons/fa';
import ExcelJS from 'exceljs';

const ViewStats: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [selectedBatchYear, setSelectedBatchYear] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [showCtuIdErrorModal, setShowCtuIdErrorModal] = useState(false);
  const [ctuIdErrorMessage, setCtuIdErrorMessage] = useState('');
  const [ctuIdErrorDetails, setCtuIdErrorDetails] = useState<string[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const data = await fetchAlumniStatistics();
        setYears(data.years || []);
      } catch (e) {
        setYears([]);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  // If navigated from Dashboard with a request to open the modal, honor it once.
  useEffect(() => {
    if (location?.state?.openGenerate) {
      setShowModal(true);
      // Clear the state so refreshing/back won't re-open unintentionally
      try {
        window.history.replaceState({}, document.title, '/ViewStats');
      } catch {}
    }
  }, [location?.state]);

  const handleGenerateClick = () => setShowModal(true);
  const handleCloseModal = () => setShowModal(false);
  const handleGenerateStats = (statsData: any) => {
    // Only the modal should show the alert for single-type generation
    // You can add additional logic here to handle the generated statistics
    // For example, update the current view or navigate to a detailed statistics page
    console.log('Generated statistics:', statsData);
  };
  const handleCardClick = (year: number) => navigate(`/AlumniData/${year}`);

  const handleExport = async () => {
    if (!selectedBatchYear) { alert('Please select a batch year to export.'); return; }
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(`http://localhost:8000/api/export-alumni/?batch_year=${selectedBatchYear}`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) { alert('Failed to export data'); return; }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alumni_export_batch_${selectedBatchYear}.xlsx`;
      document.body.appendChild(a);
      a.click(); a.remove(); window.URL.revokeObjectURL(url);
      alert('Export successful!');
    } catch { alert('Export failed!'); }
  };

  const handleExportedImport = async () => {
    if (!importFile) { alert('Please select a file to import.'); return; }
    const formData = new FormData();
    formData.append('file', importFile);
    // Batch year optional: backend will read Year_Graduated/Batch Year per row; include only if selected
    if (selectedBatchYear) formData.append('batch_year', selectedBatchYear);
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch('http://localhost:8000/api/import-alumni/', {
        method: 'POST',
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'alumni_passwords.xlsx';
        document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        alert('Import successful! Passwords downloaded.');
        setImportFile(null);
      } else {
        const result = await response.json();
        // Check if this is a duplicate file (all records already exist)
        if (result.is_duplicate_file) {
          setDuplicateMessage(result.message || 'All records in this file already exist in the system.');
          setShowDuplicateModal(true);
          setImportFile(null);
        } else {
          // Check for CTU ID validation errors
          const serverMessage = result.message || 'Import failed. Please review your template and try again.';
          const normalizedMessage = serverMessage.toLowerCase();
          
          if (normalizedMessage.includes('invalid ctu_id format') || 
              normalizedMessage.includes('ctu_id must be exactly 7') ||
              (normalizedMessage.includes('ctu_id') && (normalizedMessage.includes('7') || normalizedMessage.includes('digit') || normalizedMessage.includes('numeric') || normalizedMessage.includes('exactly')))) {
            // Show error modal for CTU ID validation errors
            setCtuIdErrorMessage(serverMessage);
            
            // Parse the error message to extract row details
            const lines = serverMessage.split('\n');
            const errorLines = lines.filter((line: string) => line.trim().startsWith('Row'));
            
            // Also check for single error messages that mention specific CTU IDs
            const hasSpecificError = serverMessage.includes("but got") || serverMessage.includes("character(s)");
            
            let details: string[] = [];
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
            
            setCtuIdErrorDetails(details);
            setShowCtuIdErrorModal(true);
            setImportFile(null);
          } else {
            alert(result.message || 'Import completed.');
          }
        }
      }
    } catch { alert('Import failed!'); }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setImportFile(file);
    } else {
      alert('Please drop an Excel file (.xlsx or .xls).');
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Generate Excel template with all required and optional columns (including tracker questions)
  // Based on backend import_alumni_view function analysis
  const handleTemplateDownload = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Alumni Import Template');

    // REQUIRED COLUMNS (based on backend lines 1075-1076)
    // Optional columns: Password is NOT included - passwords are auto-generated after import
    
    // BASIC INFORMATION (Required)
    const basicHeaders = [
      { header: 'CTU_ID', key: 'ctu_id', width: 15 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Year_Graduated', key: 'year_graduated', width: 18 },
      { header: 'Program', key: 'program', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Last_Name', key: 'last_name', width: 20 },
      { header: 'First_Name', key: 'first_name', width: 20 },
      { header: 'Middle_Name', key: 'middle_name', width: 20 },
      { header: 'Birthdate', key: 'birthdate', width: 15 },
      { header: 'Phone_Number', key: 'phone_number', width: 18 },
      { header: 'Social Media', key: 'social_media', width: 25 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Complete Home Address', key: 'complete_home_address', width: 30 },
      { header: 'Civil Status', key: 'civil_status', width: 15 },
    ];

    // FIRST EMPLOYER AFTER GRADUATION
    const firstEmployerHeaders = [
      { header: 'Name of your organization/employer (1st employer right after graduation)', key: 'first_employer_name', width: 40 },
      { header: 'Date Hired (1st employer right after graduation)', key: 'first_employer_date_hired', width: 30 },
      { header: 'Position (1st employer right after graduation) N/A if not applicable', key: 'first_employer_position', width: 40 },
      { header: 'Status of your employment (1st employer right after graduation)', key: 'first_employer_status', width: 40 },
      { header: 'Company Address (1st employer right after graduation)', key: 'first_employer_company_address', width: 40 },
      { header: 'Sector (1st employer right after graduation)', key: 'first_employer_sector', width: 30 },
    ];

    // CURRENT EMPLOYMENT STATUS
    const currentEmploymentHeaders = [
      { header: 'Are you PRESENTLY employed?', key: 'are_you_presently_employed', width: 30 },
      { header: 'Did you pursue futher study?', key: 'did_you_pursue_further_study', width: 30 },
      { header: 'Are you employed by a company/organization or are you self employed ?', key: 'employment_type', width: 50 },
      { header: 'Status of your current employment', key: 'status_of_current_employment', width: 35 },
      { header: 'Current Company Name', key: 'current_company_name', width: 30 },
      { header: 'Current Position', key: 'current_position', width: 30 },
      { header: 'Current Sector of your Job', key: 'current_sector_of_your_job', width: 30 },
      { header: 'How long have you been employed?', key: 'how_long_employed', width: 30 },
      { header: 'Current Salary range', key: 'current_salary_range', width: 25 },
      { header: 'Have you received any awards or recognition during your employment?', key: 'awards_recognition', width: 50 },
      { header: 'Employment Scope', key: 'employment_scope', width: 25 },
      { header: 'Reason for unemployment', key: 'reason_for_unemployment', width: 30 },
    ];

    // FURTHER STUDY INFORMATION
    const furtherStudyHeaders = [
      { header: 'Date Started', key: 'date_started', width: 20 },
      { header: 'Please specify post graduate/degree', key: 'post_graduate_degree', width: 40 },
      { header: 'Name of Institution/University', key: 'institution_name', width: 40 },
      { header: 'Total number of units obtain', key: 'units_obtained', width: 30 },
    ];

    // Combine all headers
    const headers = [
      ...basicHeaders,
      ...firstEmployerHeaders,
      ...currentEmploymentHeaders,
      ...furtherStudyHeaders
    ];
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
      gender: 'M',
      year_graduated: '2024',
      program: 'BSIT',
      email: 'john.doe@example.com',
      last_name: 'Doe',
      first_name: 'John',
      middle_name: 'Michael',
      birthdate: '2003-04-12',
      phone_number: '09123456789',
      social_media: '@johndoe',
      address: '123 Main Street, Cebu City, Cebu',
      complete_home_address: '123 Main Street, Cebu City, Cebu',
      civil_status: 'Single',
      first_employer_name: '',
      first_employer_date_hired: '',
      first_employer_position: '',
      first_employer_status: '',
      first_employer_company_address: '',
      first_employer_sector: '',
      are_you_presently_employed: '',
      did_you_pursue_further_study: '',
      employment_type: '',
      status_of_current_employment: '',
      current_company_name: '',
      current_position: '',
      current_sector_of_your_job: '',
      how_long_employed: '',
      current_salary_range: '',
      awards_recognition: '',
      employment_scope: '',
      reason_for_unemployment: '',
      date_started: '',
      post_graduate_degree: '',
      institution_name: '',
      units_obtained: '',
    };

    // Example 2: With tracker data (employed)
    const sampleDataWithTracker = {
      ctu_id: '1337581',
      gender: 'F',
      year_graduated: '2024',
      program: 'BSIS',
      email: 'jane.smith@example.com',
      last_name: 'Smith',
      first_name: 'Jane',
      middle_name: 'Marie',
      birthdate: '2002-05-15',
      phone_number: '09187654321',
      social_media: '@janesmith',
      address: '456 Oak Avenue, Mandaue City, Cebu',
      complete_home_address: '456 Oak Avenue, Mandaue City, Cebu',
      civil_status: 'Single',
      first_employer_name: 'ABC Technology Solutions Inc.',
      first_employer_date_hired: '2024-06-01',
      first_employer_position: 'Junior Software Developer',
      first_employer_status: 'Permanent',
      first_employer_company_address: '123 Tech Street, Cebu City',
      first_employer_sector: 'Private',
      are_you_presently_employed: 'Yes',
      did_you_pursue_further_study: 'No',
      employment_type: 'Employed by company/organization',
      status_of_current_employment: 'Permanent',
      current_company_name: 'ABC Technology Solutions Inc.',
      current_position: 'Software Developer',
      current_sector_of_your_job: 'Private',
      how_long_employed: '1-2 years',
      current_salary_range: '20,000 - 30,000',
      awards_recognition: 'Yes',
      employment_scope: 'Local',
      reason_for_unemployment: '',
      date_started: '',
      post_graduate_degree: '',
      institution_name: '',
      units_obtained: '',
    };

    // Example 3: With tracker data (unemployed, pursuing further study)
    const sampleDataUnemployed = {
      ctu_id: '1337582',
      gender: 'M',
      year_graduated: '2024',
      program: 'BIT-CT',
      email: 'mark.johnson@example.com',
      last_name: 'Johnson',
      first_name: 'Mark',
      middle_name: 'Paul',
      birthdate: '2003-08-20',
      phone_number: '09234567890',
      social_media: '@markjohnson',
      address: '789 Pine Road, Lapu-Lapu City, Cebu',
      complete_home_address: '789 Pine Road, Lapu-Lapu City, Cebu',
      civil_status: 'Married',
      first_employer_name: '',
      first_employer_date_hired: '',
      first_employer_position: '',
      first_employer_status: '',
      first_employer_company_address: '',
      first_employer_sector: '',
      are_you_presently_employed: 'No',
      did_you_pursue_further_study: 'Yes',
      employment_type: '',
      status_of_current_employment: '',
      current_company_name: '',
      current_position: '',
      current_sector_of_your_job: '',
      how_long_employed: '',
      current_salary_range: '',
      awards_recognition: '',
      employment_scope: '',
      reason_for_unemployment: 'Pursuing further studies',
      date_started: '2024-09-01',
      post_graduate_degree: 'Master of Science in Information Technology',
      institution_name: 'Cebu Technological University',
      units_obtained: '12',
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
      { instructions: '  • Gender: Must be exactly "M" for Male or "F" for Female (case-sensitive)' },
      { instructions: '  • Year_Graduated: Graduation year (e.g., 2024)' },
      { instructions: '  • Program: Must be exactly one of: BSIT, BSIS, or BIT-CT' },
      { instructions: '  • Email: Email address of the alumni' },
      { instructions: '  • Last_Name: Last name of the alumni' },
      { instructions: '  • First_Name: First name of the alumni' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'OPTIONAL BASIC COLUMNS (Can be left empty):' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  • Middle_Name: Middle name of the alumni' },
      { instructions: '  • Birthdate: Date of birth (Format: YYYY-MM-DD or MM/DD/YYYY)' },
      { instructions: '    Examples: 2003-04-12 or 04/12/2003' },
      { instructions: '  • Phone_Number: Contact number (e.g., 09123456789)' },
      { instructions: '  • Social Media: Social media handle (e.g., @username)' },
      { instructions: '  • Address: Complete current address' },
      { instructions: '  • Complete Home Address: Complete home address' },
      { instructions: '  • Civil Status: Marital status (e.g., Single, Married, etc.)' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'FIRST EMPLOYER AFTER GRADUATION (Optional):' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  • Name of your organization/employer (1st employer right after graduation)' },
      { instructions: '  • Date Hired (1st employer right after graduation): Format YYYY-MM-DD' },
      { instructions: '  • Position (1st employer right after graduation): N/A if not applicable' },
      { instructions: '  • Status of your employment (1st employer right after graduation): e.g., Permanent, Contract' },
      { instructions: '  • Company Address (1st employer right after graduation)' },
      { instructions: '  • Sector (1st employer right after graduation): Private, Government, or Public' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'CURRENT EMPLOYMENT STATUS (For alumni who answered tracker questions):' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  These columns are for importing alumni who have already answered tracker questions.' },
      { instructions: '  Leave these empty if the alumni has not answered the tracker yet.' },
      { instructions: '' },
      { instructions: '  • Are you PRESENTLY employed?: Must be "Yes" or "No" (or "Y"/"N")' },
      { instructions: '  • Did you pursue futher study?: Must be "Yes" or "No" (or "Y"/"N")' },
      { instructions: '  • Are you employed by a company/organization or are you self employed?:' },
      { instructions: '    Options: "Employed by company/organization" or "Self employed"' },
      { instructions: '  • Status of your current employment: e.g., Permanent, Contract, Probationary' },
      { instructions: '  • Current Company Name: Name of current employer' },
      { instructions: '  • Current Position: Job title/position (e.g., Software Developer)' },
      { instructions: '  • Current Sector of your Job: Must be "Private", "Government", or "Public"' },
      { instructions: '  • How long have you been employed?: e.g., "1-2 years", "6 months"' },
      { instructions: '  • Current Salary range: Salary range (e.g., 20,000 - 30,000)' },
      { instructions: '  • Have you received any awards or recognition during your employment?: Yes/No' },
      { instructions: '  • Employment Scope: Local or International' },
      { instructions: '  • Reason for unemployment: Required if not presently employed' },
      { instructions: '' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: 'FURTHER STUDY INFORMATION (If pursuing further study):' },
      { instructions: '═══════════════════════════════════════════════════════════════' },
      { instructions: '  • Date Started: Start date of further study (Format: YYYY-MM-DD)' },
      { instructions: '  • Please specify post graduate/degree: e.g., Master of Science in IT' },
      { instructions: '  • Name of Institution/University: Name of the educational institution' },
      { instructions: '  • Total number of units obtain: Number of units obtained' },
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

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', overflowX: 'hidden' }}>
      <Sidebar />
      
      <div className="admin-content-page" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', backgroundColor: '#f8fafc', marginLeft: 'var(--sidebar-width, 220px)', transition: 'margin-left 0.3s ease' }}>
        {/* Slim toolbar (no heavy header) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 48px 4px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2c5282' }}>Alumni Users</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
          <button style={styles.actionButton} onClick={() => setShowExportModal(true)}>
            <FaUpload style={{ marginRight: '8px', color: 'white' }} />
            Import/Export
          </button>
          <button style={styles.generateButton} onClick={handleGenerateClick}>
            <FaCog style={{ marginRight: '8px', color: 'white' }} />
            Generate Statistics
          </button>
          </div>
        </div>

        {/* Overview removed per request */}

        {/* Alumni Cards Grid */}
        <div style={styles.cardsContainer}>

          {loading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>Loading alumni statistics...</p>
            </div>
          ) : years.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <FaGraduationCap />
              </div>
              <h3 style={styles.emptyTitle}>No Alumni Data Found</h3>
              <p style={styles.emptyText}>
                No alumni data is available. Try importing data or generating statistics.
              </p>
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {years.map((grad) => (
                <div
                  key={grad.year}
                  onClick={() => handleCardClick(grad.year)}
                  style={styles.yearCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 18px 28px rgba(16, 24, 40, 0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(16, 24, 40, 0.10)';
                  }}
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.cardIcon}>
                      <FaGraduationCap />
                    </div>
                    <div style={styles.cardYear}>CLASS OF {grad.year}</div>
                  </div>
                  <div style={styles.cardContent}>
                    <div style={styles.cardStats}>
                      <div style={styles.statItem}>
                        <FaUsers style={styles.statIcon} />
                        <span style={styles.statNumber}>{grad.count}</span>
                        <span style={styles.statLabel}>Alumni</span>
                      </div>
                    </div>
                    <div style={styles.cardFooter}>
                      <span style={styles.viewText}>Open details</span>
                      <span style={{ marginLeft: 8, transition: 'transform .2s ease' }}>→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        {showModal && <GenerateStatsModal onClose={handleCloseModal} onGenerate={handleGenerateStats} />}

        {showExportModal && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalContent, maxWidth: 640, paddingBottom: 8 }}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Import Alumni Data</h2>
                <button onClick={() => setShowExportModal(false)} style={styles.modalCloseButton}>×</button>
              </div>

              <div style={styles.modalBody}>
                {/* Download Template Section */}
                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                    📥 Download Template
                  </h3>
                  <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>
                    Download an Excel template with all required columns and sample data to help you format your import file correctly.
                  </p>
                  <button
                    type="button"
                    onClick={handleTemplateDownload}
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

                {/* Upload */}
                <div
                  style={{
                    border: '2px dashed #d1d5db',
                    borderRadius: 12,
                    padding: 28,
                    textAlign: 'center',
                    background: isDragging ? '#f8fafc' : 'white',
                    transition: 'background 0.15s ease',
                    marginBottom: 16,
                  }}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                >
                  <input
                    id="alumni-import-file"
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  />
                  <label htmlFor="alumni-import-file" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                      {importFile ? importFile.name : 'Choose Excel File'}
                    </div>
                    <div style={{ color: '#6b7280' }}>Click to browse or drag and drop</div>
                    <div style={{ color: '#9ca3af', marginTop: 6, fontSize: 13 }}>Supports .xlsx and .xls files</div>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <button style={styles.importButton} onClick={handleExportedImport}>Import Alumni</button>
                </div>

                <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />

                {/* Export section */}
                <div style={styles.modalSection}>
                  <h3 style={styles.sectionTitle}>Export Alumni Data</h3>
                  <p style={styles.sectionDescription}>Download alumni data for a specific batch year.</p>
                  <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>Select Batch Year</label>
                    <select
                      style={styles.selectInput}
                      value={selectedBatchYear}
                      onChange={(e) => setSelectedBatchYear(e.target.value)}
                    >
                      <option value="">Choose a graduation year...</option>
                      {years.map((y) => (
                        <option key={y.year} value={y.year}>Class of {y.year} ({y.count} alumni)</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button style={{ ...styles.importButton, background: '#e5e7eb', color: '#111827' }} onClick={() => setShowExportModal(false)}>Cancel</button>
                    <button style={{ ...styles.importButton }} onClick={handleExport}>Export to Excel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate File Modal */}
        {showDuplicateModal && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalContent, maxWidth: 500 }}>
              <div style={styles.modalHeader}>
                <h2 style={{ ...styles.modalTitle, color: '#f59e0b' }}>⚠️ Duplicate File Detected</h2>
                <button onClick={() => setShowDuplicateModal(false)} style={styles.modalCloseButton}>×</button>
              </div>
              <div style={styles.modalBody}>
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '16px', color: '#374151', marginBottom: '12px' }}>
                    {duplicateMessage}
                  </p>
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#fef3c7', 
                    borderRadius: '8px', 
                    border: '1px solid #fbbf24',
                    marginTop: '16px'
                  }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
                      <strong>Note:</strong> This file appears to have been imported before. Each file can only be imported once to prevent duplicate records.
                    </p>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
                    <p style={{ margin: '8px 0' }}>• If you need to update existing records, please use the edit functionality instead.</p>
                    <p style={{ margin: '8px 0' }}>• If this is a new file with different data, please verify the CTU IDs are unique.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button 
                    style={{ ...styles.importButton, background: '#3b82f6', color: 'white' }} 
                    onClick={() => setShowDuplicateModal(false)}
                  >
                    Understood
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invalid CTU ID Format Modal */}
        {showCtuIdErrorModal && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalContent, maxWidth: 600 }}>
              <div style={styles.modalHeader}>
                <h2 style={{ ...styles.modalTitle, color: '#ef4444' }}>❌ Invalid CTU ID Format</h2>
                <button onClick={() => setShowCtuIdErrorModal(false)} style={styles.modalCloseButton}>×</button>
              </div>
              <div style={styles.modalBody}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#fee2e2', 
                    borderRadius: '8px', 
                    border: '1px solid #fca5a5',
                    marginBottom: '16px'
                  }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#991b1b', fontWeight: '600' }}>
                      All CTU IDs must be exactly 7 numeric digits (e.g., 1234567).
                    </p>
                  </div>
                  
                  {ctuIdErrorDetails.length > 0 && (
                    <div style={{ 
                      maxHeight: '300px', 
                      overflowY: 'auto', 
                      padding: '12px', 
                      backgroundColor: '#f9fafb', 
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      marginBottom: '16px'
                    }}>
                      {ctuIdErrorDetails.map((detail, idx) => (
                        <p key={idx} style={{ 
                          margin: idx === 0 ? '0 0 8px 0' : '4px 0', 
                          fontSize: '14px', 
                          color: '#374151',
                          fontWeight: idx === 0 ? '600' : 'normal'
                        }}>
                          {detail}
                        </p>
                      ))}
                    </div>
                  )}
                  
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#eff6ff', 
                    borderRadius: '8px', 
                    border: '1px solid #93c5fd',
                    marginTop: '16px'
                  }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e40af', fontWeight: '600' }}>
                      Requirements:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#1e40af' }}>
                      <li>Exactly 7 characters</li>
                      <li>Only numbers (0-9)</li>
                      <li>No letters, spaces, or special characters</li>
                    </ul>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button 
                    style={{ ...styles.importButton, background: '#ef4444', color: 'white' }} 
                    onClick={() => {
                      setShowCtuIdErrorModal(false);
                      setCtuIdErrorMessage('');
                      setCtuIdErrorDetails([]);
                    }}
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  // Deprecated header styles removed
  headerActions: {
    display: 'flex',
    gap: '12px',
    position: 'absolute',
    right: '-32px',
  },
  actionButton: {
    background: '#1C4E80',
    border: '2px solid #1C4E80',
    color: 'white',
    padding: '14px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  generateButton: {
    background: '#1C4E80',
    border: '2px solid #1C4E80',
    color: 'white',
    padding: '14px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },

  // Stats overview
  statsOverview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
    padding: '32px',
    backgroundColor: 'white',
    margin: '0 32px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  overviewCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    background: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  overviewIcon: {
    fontSize: '32px',
    color: '#6C63FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '60px',
    height: '60px',
    background: '#f0f0ff',
    borderRadius: '12px',
  },
  overviewContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  overviewNumber: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 1,
  },
  overviewLabel: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px',
  },

  // Cards container
  cardsContainer: {
    padding: '0 48px 32px 48px',
    display: 'flex',
    justifyContent: 'flex-start',
    width: '100%',
  },
  cardsHeader: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  cardsTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsSubtitle: {
    fontSize: '16px',
    color: '#6b7280',
    margin: '0',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 280px))',
    gap: '20px',
    width: '100%',
    margin: '0',
    justifyItems: 'start',
  },

  // Year card styles
  yearCard: {
    background: 'white',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 8px 16px rgba(16, 24, 40, 0.10)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid #e5e7eb',
    width: '280px',
  },
  cardHeader: {
    background: 'linear-gradient(90deg, #1C4E80 0%, #275f9b 100%)',
    color: 'white',
    padding: '18px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  cardIcon: {
    fontSize: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
    background: 'rgba(255, 255, 255, 0.18)',
    borderRadius: '10px',
  },
  cardYear: {
    fontSize: '16px',
    fontWeight: '600',
  },
  cardContent: {
    padding: '16px',
  },
  cardStats: {
    marginBottom: '8px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statIcon: {
    fontSize: '14px',
    color: '#6b7280',
  },
  statNumber: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    color: '#1c4e80',
  },
  viewText: {
    fontSize: '12px',
    color: '#1c4e80',
    fontWeight: '700',
  },

  // Loading and empty states
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #6C63FF',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    color: '#6b7280',
    fontSize: '16px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    minHeight: '50vh',
    textAlign: 'center',
    width: '100%',
  },
  emptyIcon: {
    fontSize: '64px',
    color: '#d1d5db',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#374151',
    margin: '0 0 8px 0',
  },
  emptyText: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0,
    maxWidth: '400px',
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalContent: {
    background: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  modalHeader: {
    padding: '24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    maxHeight: 'calc(90vh - 100px)',
  },
  modalSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 8px 0',
  },
  sectionDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 16px 0',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  inputLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px',
    display: 'block',
  },
  selectInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  fileInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  exportButton: {
    background: '#1C4E80',
    border: '2px solid #1C4E80',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  importButton: {
    background: '#1C4E80',
    border: '2px solid #1C4E80',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  modalDivider: {
    height: '1px',
    background: '#e5e7eb',
    margin: '24px 0',
  },
};

// Add CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default ViewStats;
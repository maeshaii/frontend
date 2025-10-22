// components/GenerateStatsModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  fetchAlumniEmploymentStats,
  generateSpecificStats,
  exportDetailedAlumniData,
} from '../services/api';
import { useAvailableYears } from '../hooks/useStats';
import { AnyStats, StatsType } from '../types/stats';
import { queryClient } from '../services/utils/queryClient';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

// Import institutional images
import ctuLogo from '../images/ctu_logo-removebg-preview.png';
import bagongPilipinasLogo from '../images/bagong_pilipinas_logo-removebg-preview.png';
import footerImage from '../images/footer-removebg-preview.png';

interface Props {
  onClose: () => void;
  onGenerate?: (data: any) => void;
}

const GenerateStatsModal: React.FC<Props> = ({ onClose, onGenerate }) => {
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedProgram, setSelectedProgram] = useState('ALL');
  const [selectedType, setSelectedType] = useState<StatsType>('ALL');
  const [availableYears, setAvailableYears] = useState<{ year: number; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedStats, setGeneratedStats] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [allStats, setAllStats] = useState<any | null>(null);
  const [detailedData, setDetailedData] = useState<Record<string, any[]> | null>(null);
  const [detailedLoading, setDetailedLoading] = useState<Record<string, boolean>>({});
  const [currentChartSection, setCurrentChartSection] = useState<string>('');

  // Safe percent helper to avoid NaN when total is 0
  const pct = (part: number, total: number) => {
    const p = Number(part) || 0;
    const t = Number(total) || 0;
    return t > 0 ? `${((p / t) * 100).toFixed(2)}%` : '0.00%';
  };

  // Utility function to convert image to base64 for PDF
  const getImageAsBase64 = async (imagePath: string): Promise<string> => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading image:', error);
      return '';
    }
  };

  // ========================================
  // PDF HEADER FUNCTION
  // ========================================
  // Utility function to add institutional header to PDF
  const addInstitutionalHeaderToPDF = async (doc: jsPDF, pageWidth: number) => {
    try {
      // Load images
      const ctuLogoBase64 = await getImageAsBase64(ctuLogo);
      const bagongPilipinasBase64 = await getImageAsBase64(bagongPilipinasLogo);
      
      let yPosition = 15;
      
      // Create a proper 3-column layout like Word document
      // Left column: CTU Logo - smaller and higher position
      if (ctuLogoBase64) {
        doc.addImage(ctuLogoBase64, 'PNG', 60, yPosition + 5, 35, 35); // Smaller (35x35) and higher (yPosition + 5)
      }
      
      // Right column: Bagong Pilipinas Logo - smaller and higher position
      if (bagongPilipinasBase64) {
        doc.addImage(bagongPilipinasBase64, 'PNG', pageWidth - 95, yPosition + 5, 35, 35); // Smaller (35x35) and higher (yPosition + 5)
      }

      // Center column: Institutional text (positioned between logos with tighter spacing)
      const centerX = pageWidth / 2;
      
      // Republic of the Philippines - Match Word default size (12pt)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Republic of the Philippines', centerX, yPosition + 4, { align: 'center' }); // Tighter spacing (was 6, now 4)
      
      // CEBU TECHNOLOGICAL UNIVERSITY (bold, red) - Match Word size 24 exactly
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 20, 60);
      doc.setFontSize(12); // Exact match to Word size 24
      doc.text('CEBU TECHNOLOGICAL UNIVERSITY', centerX, yPosition + 12, { align: 'center' }); // Much tighter spacing (was 14, now 12)
      
      // Address - Match Word default size (12pt)
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10); // Match Word default size
      doc.text('M. J. Cuenco Avenue Cor. R. Palma Street, Cebu City, Philippines', centerX, yPosition + 17, { align: 'center' }); // Much tighter spacing (was 20, now 17)
      
      // Website and Phone - Match Word default size (12pt)
      doc.setFontSize(10); // Match Word default size
      doc.text('Website: http://www.ctu.edu.ph', centerX, yPosition + 21, { align: 'center' }); // Much tighter spacing (was 25, now 21)
      doc.text('Phone: +6332 402 4060 loc. 1146', centerX, yPosition + 25, { align: 'center' }); // Much tighter spacing (was 30, now 25)
      
      // UNIVERSITY ALUMNI AFFAIRS OFFICE (bold, red) - Match Word size 18 exactly
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 20, 60);
      doc.setFontSize(9); // Exact match to Word size 18
      doc.text('UNIVERSITY ALUMNI AFFAIRS OFFICE', centerX, yPosition + 30, { align: 'center' }); // Much tighter spacing (was 36, now 30)
      
      // Reset color for content
      doc.setTextColor(0, 0, 0);
    } catch (error) {
      console.error('Error adding institutional header to PDF:', error);
    }
  };

  // ========================================
  // PDF FOOTER FUNCTION
  // ========================================
  // Utility function to add institutional footer to PDF
  const addInstitutionalFooterToPDF = async (doc: jsPDF, pageWidth: number, pageHeight: number) => {
    try {
      const footerBase64 = await getImageAsBase64(footerImage);
      
      if (footerBase64) {
        // Add compact footer image at the bottom - match Word document proportions
        // Calculate proper width and height to maintain aspect ratio
        const footerWidth = pageWidth - 40; // Full width minus margins
        const footerHeight = 12; // Compact height like Word document
        
        doc.addImage(footerBase64, 'PNG', 20, pageHeight - 30, footerWidth, footerHeight);
        
        // Add footer text below the image
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated by Cebu Technological University Alumni Affairs Office', pageWidth / 2, pageHeight - 12, { align: 'center' });
        doc.text('This report is generated automatically by the Alumni Tracking System', pageWidth / 2, pageHeight - 7, { align: 'center' });
      }
    } catch (error) {
      console.error('Error adding institutional footer to PDF:', error);
    }
  };

  // ========================================
  // EXCEL HEADER FUNCTION
  // ========================================
  // Utility function to add institutional header to Excel
  const addInstitutionalHeaderToExcel = (sheet: any, startRow: number = 1) => {
    let r = startRow;
    
    // Add empty row for spacing (moved down)
    sheet.getRow(r).height = 10;
    r++;
    
    // Set row height for header section
    sheet.getRow(r).height = 20;
    sheet.getRow(r + 1).height = 25;
    sheet.getRow(r + 2).height = 20;
    sheet.getRow(r + 3).height = 20;
    sheet.getRow(r + 4).height = 20;
    sheet.getRow(r + 5).height = 20;
    sheet.getRow(r + 6).height = 20;
    sheet.getRow(r + 7).height = 25;
    sheet.getRow(r + 8).height = 20;
    sheet.getRow(r + 9).height = 20; // Added for report title spacing
    
    // Republic of the Philippines
    sheet.getCell(`A${r}`).value = 'Republic of the Philippines';
    sheet.getCell(`A${r}`).font = { bold: true, size: 11 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // CEBU TECHNOLOGICAL UNIVERSITY (bold, red)
    sheet.getCell(`A${r}`).value = 'CEBU TECHNOLOGICAL UNIVERSITY';
    sheet.getCell(`A${r}`).font = { bold: true, size: 16, color: { argb: 'FFDC143C' } }; // Red color
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Address
    sheet.getCell(`A${r}`).value = 'M. J. Cuenco Avenue Cor. R. Palma Street, Cebu City, Philippines';
    sheet.getCell(`A${r}`).font = { size: 10 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Website and Phone
    sheet.getCell(`A${r}`).value = 'Website: http://www.ctu.edu.ph';
    sheet.getCell(`A${r}`).font = { size: 9 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    sheet.getCell(`A${r}`).value = 'Phone: +6332 402 4060 loc. 1146';
    sheet.getCell(`A${r}`).font = { size: 9 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // UNIVERSITY ALUMNI AFFAIRS OFFICE (bold, red)
    sheet.getCell(`A${r}`).value = 'UNIVERSITY ALUMNI AFFAIRS OFFICE';
    sheet.getCell(`A${r}`).font = { bold: true, size: 12, color: { argb: 'FFDC143C' } }; // Red color
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r += 3; // Added extra spacing before report title
    
    // Report Title
    sheet.getCell(`A${r}`).value = 'PERCENTAGE OF GRADUATE TRACING BATCH 2023';
    sheet.getCell(`A${r}`).font = { bold: true, size: 14 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Report Subtitle
    sheet.getCell(`A${r}`).value = 'REPORT FOR THE 3RD QUARTER QPRO 2025';
    sheet.getCell(`A${r}`).font = { bold: true, size: 12 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r += 2;
    
    return r;
  };

  // ========================================
  // EXCEL FOOTER FUNCTION
  // ========================================
  // Utility function to add institutional footer to Excel
  const addInstitutionalFooterToExcel = (sheet: any, startRow: number) => {
    let r = startRow + 2;
    
    // Add footer information
    sheet.getCell(`A${r}`).value = 'Generated by Cebu Technological University Alumni Affairs Office';
    sheet.getCell(`A${r}`).font = { italic: true, size: 9 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    sheet.getCell(`A${r}`).value = 'This report is generated automatically by the Alumni Tracking System';
    sheet.getCell(`A${r}`).font = { italic: true, size: 9 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center' };
    sheet.mergeCells(`A${r}:H${r}`);
    
    return r;
  };

  // Refs for chart containers
  const barChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);

  const courseOptions = ['ALL', 'BSIT', 'BSIS', 'BIT-CT'];
  const typeOptions = [
    { value: 'ALL', label: 'All Statistics' },
    { value: 'QPRO', label: 'QPRO Statistics' },
    { value: 'CHED', label: 'CHED Statistics' },
    { value: 'SUC', label: 'SUC Statistics' },
    { value: 'AACUP', label: 'AACUP Statistics' },
    { value: 'HIGH_POSITION', label: 'High Position Statistics' },
  ];

  // Color schemes for charts
  const chartColors = {
    primary: ['#1D4E89', '#4f46e5', '#28a745', '#ffc107', '#dc3545'],
    secondary: ['#6c757d', '#17a2b8', '#20c997', '#fd7e14', '#e83e8c'],
    qpro: ['#28a745', '#dc3545', '#6c757d'],
    ched: ['#17a2b8', '#6c757d', '#28a745'],
    suc: ['#1D4E89', '#6c757d', '#ffc107'],
    aacup: ['#28a745', '#17a2b8', '#1D4E89', '#6c757d'],
  };

  const yearsQuery = useAvailableYears();
  useEffect(() => {
    if (yearsQuery.data) setAvailableYears(yearsQuery.data);
  }, [yearsQuery.data]);

  const handleGenerate = async () => {
    setLoading(true);
    setAllStats(null);
    setDetailedData(null);
    setDetailedLoading({});
    try {
      if (selectedType === 'ALL') {
        // Fetch all four types in parallel
        const [qpro, ched, suc, aacup] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: [
              'stats',
              'generate',
              { year: selectedYear, course: selectedProgram, type: 'QPRO' },
            ],
            queryFn: async () => generateSpecificStats(selectedYear, selectedProgram, 'QPRO'),
          }) as Promise<AnyStats>,
          queryClient.fetchQuery({
            queryKey: [
              'stats',
              'generate',
              { year: selectedYear, course: selectedProgram, type: 'CHED' },
            ],
            queryFn: async () => generateSpecificStats(selectedYear, selectedProgram, 'CHED'),
          }) as Promise<AnyStats>,
          queryClient.fetchQuery({
            queryKey: [
              'stats',
              'generate',
              { year: selectedYear, course: selectedProgram, type: 'SUC' },
            ],
            queryFn: async () => generateSpecificStats(selectedYear, selectedProgram, 'SUC'),
          }) as Promise<AnyStats>,
          queryClient.fetchQuery({
            queryKey: [
              'stats',
              'generate',
              { year: selectedYear, course: selectedProgram, type: 'AACUP' },
            ],
            queryFn: async () => generateSpecificStats(selectedYear, selectedProgram, 'AACUP'),
          }) as Promise<AnyStats>,
        ]);
        setAllStats({ QPRO: qpro, CHED: ched, SUC: suc, AACUP: aacup });
        setGeneratedStats(null);
        if (onGenerate) onGenerate({ QPRO: qpro, CHED: ched, SUC: suc, AACUP: aacup });
        // Fetch detailed data for all
        (['QPRO', 'CHED', 'SUC', 'AACUP'] as StatsType[]).forEach(async (type) => {
          setDetailedLoading((prev) => ({ ...prev, [type]: true }));
          try {
            const res = await queryClient.fetchQuery({
              queryKey: ['stats', 'detailed', { year: selectedYear, course: selectedProgram, type }],
              queryFn: async () => exportDetailedAlumniData(selectedYear, selectedProgram, type),
            });
            setDetailedData((prev) => ({
              ...(prev || {}),
              [type]: (res as any)?.detailed_data || [],
            }));
          } finally {
            setDetailedLoading((prev) => ({ ...prev, [type]: false }));
          }
        });
      } else {
        const stats = (await queryClient.fetchQuery({
          queryKey: [
            'stats',
            'generate',
            { year: selectedYear, course: selectedProgram, type: selectedType },
          ],
          queryFn: async () => generateSpecificStats(selectedYear, selectedProgram, selectedType),
        })) as AnyStats;
        setGeneratedStats(stats);
        setAllStats(null);
        if (onGenerate) onGenerate(stats);
        // Show a proper success message for single type
        alert(
          `Successfully generated ${stats?.type || selectedType || 'statistics'} statistics for ${stats?.total_alumni || 'selected'} alumni.`
        );
        // Fetch detailed data for the selected type
        setDetailedLoading({ [selectedType]: true });
        try {
          const res = await queryClient.fetchQuery({
            queryKey: [
              'stats',
              'detailed',
              { year: selectedYear, course: selectedProgram, type: selectedType },
            ],
            queryFn: async () =>
              exportDetailedAlumniData(selectedYear, selectedProgram, selectedType),
          });
          setDetailedData({ [selectedType]: (res as any)?.detailed_data || [] });
        } finally {
          setDetailedLoading({ [selectedType]: false });
        }
      }
    } catch (error) {
      console.error('Error generating statistics:', error);
      alert('Error generating statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setGeneratedStats(null);
    onClose();
  };

  // Helper functions to prepare chart data
  const prepareQPROChartData = (stats: any) => {
    const barData = [
      { name: 'Employed', value: stats.employed_count, fill: chartColors.qpro[0] },
      { name: 'Unemployed', value: stats.unemployed_count, fill: chartColors.qpro[1] },
    ];

    const pieData = [
      { name: 'Employed', value: stats.employed_count, fill: chartColors.qpro[0] },
      { name: 'Unemployed', value: stats.unemployed_count, fill: chartColors.qpro[1] },
    ];

    return { barData, pieData };
  };

  const prepareCHEDChartData = (stats: any) => {
    const barData = [
      {
        name: 'Pursuing Further Study',
        value: stats.pursuing_further_study,
        fill: chartColors.ched[0],
      },
      {
        name: 'Not Pursuing',
        value: stats.total_alumni - stats.pursuing_further_study,
        fill: chartColors.ched[1],
      },
    ];

    const pieData = [
      {
        name: 'Pursuing Further Study',
        value: stats.pursuing_further_study,
        fill: chartColors.ched[0],
      },
      {
        name: 'Not Pursuing',
        value: stats.total_alumni - stats.pursuing_further_study,
        fill: chartColors.ched[1],
      },
    ];

    return { barData, pieData };
  };

  const prepareSUCChartData = (stats: any) => {
    const barData = [
      { name: 'High Position', value: stats.high_position_count, fill: chartColors.suc[0] },
      {
        name: 'Other Positions',
        value: stats.total_alumni - stats.high_position_count,
        fill: chartColors.suc[1],
      },
    ];

    const pieData = [
      { name: 'High Position', value: stats.high_position_count, fill: chartColors.suc[0] },
      {
        name: 'Other Positions',
        value: stats.total_alumni - stats.high_position_count,
        fill: chartColors.suc[1],
      },
    ];

    return { barData, pieData };
  };

  const prepareAACUPChartData = (stats: any) => {
    const barData = [
      { name: 'Pending', value: stats.pending_count || 0, fill: '#EE82EE' },
      { name: 'Employed', value: stats.employed_count, fill: '#662d91' },
      { name: 'Unemployed', value: stats.unemployed_count || 0, fill: '#800080' },
      { name: 'Absorbed', value: stats.absorbed_count, fill: '#1d1160' },
    ];

    const pieData = [
      { name: 'Pending', value: stats.pending_count || 0, fill: '#EE82EE' },
      { name: 'Employed', value: stats.employed_count, fill: '#662d91' },
      { name: 'Unemployed', value: stats.unemployed_count || 0, fill: '#800080' },
      { name: 'Absorbed', value: stats.absorbed_count, fill: '#1d1160' },
    ];

    return { barData, pieData };
  };

  const prepareALLChartData = (stats: any) => {
    const statusEntries = Object.entries(stats.status_counts || {});
    const barData = statusEntries.map(([status, count], index) => ({
      name: status,
      value: count as number,
      fill: chartColors.primary[index % chartColors.primary.length],
    }));

    const pieData = statusEntries.map(([status, count], index) => ({
      name: status,
      value: count as number,
      fill: chartColors.primary[index % chartColors.primary.length],
    }));

    return { barData, pieData };
  };

  // Function to generate chart images
  const generateChartImages = async () => {
    const images: { barChart?: string; pieChart?: string } = {};

    try {
      // Generate bar chart image
      if (barChartRef.current) {
        const canvas = await html2canvas(barChartRef.current, {
          background: 'white',
          useCORS: true,
          allowTaint: true,
        });
        images.barChart = canvas.toDataURL('image/png');
      }

      // Generate pie chart image
      if (pieChartRef.current) {
        const canvas = await html2canvas(pieChartRef.current, {
          background: 'white',
          useCORS: true,
          allowTaint: true,
        });
        images.pieChart = canvas.toDataURL('image/png');
      }
    } catch (error) {
      console.error('Error generating chart images:', error);
    }

    return images;
  };

  // QPRO export helpers (placed before export to avoid hoist issues)
  const qproHeaders = [
    'Program',
    'First_Name',
    'Middle_Name',
    'Last_Name',
    'Status',
    'Current Company Name',
    'Position_Current',
    'Current Salary Range',
    'Sector_Current',
    'Please specify post graduate/degree',
  ];

  const mapQPRORow = (row: any) => {
    const safe = (v: any) => (v === undefined || v === null ? '' : v);
    const pick = (keys: string[]) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && `${row[k]}` !== '') return row[k];
      }
      return '';
    };

    const statusRaw = `${row['Status'] || row['user_status'] || ''}`.toLowerCase();
    let status = '';
    if (statusRaw.includes('employ')) status = 'Employed';
    else if (statusRaw.includes('unemploy')) status = 'Unemployed';
    if (!status) {
      if (row['Company_Name_Current'] || row['Position_Current'] || row['Salary_Current']) status = 'Employed';
      else if (row['Unemployment_Reason']) status = 'Unemployed';
      else status = 'Not Tracked';
    }

    return [
      safe(row['Program']),
      safe(row['First_Name']),
      safe(row['Middle_Name']),
      safe(row['Last_Name']),
      status,
      safe(pick(['Current Company Name', 'Company_Name_Current'])),
      safe(pick(['Position_Current'])),
      safe(pick(['Current Salary range', 'Current Salary Range', 'Salary Range', 'Salary_Current'])),
      safe(pick(['Sector_Current', 'Current Company Sector', 'Sector'])),
      safe(pick(['Please specify post graduate/degree', 'Please specify postgraduate/degree', 'Post graduate/degree', 'Post Graduate/Degree', 'Program', 'Pursue_Further_Study'])),
    ];
  };

  // Enhanced sorting function: answered tracker first (alphabetical), not answered last (alphabetical)
  const sortAlumniData = (mappedData: any[][]) => {
    return mappedData.sort((a, b) => {
      const aAnswered = a[4] !== 'Not Tracked'; // Status is at index 4
      const bAnswered = b[4] !== 'Not Tracked';
      
      // First priority: answered vs not answered
      if (aAnswered !== bAnswered) {
        return aAnswered ? -1 : 1; // answered first
      }
      
      // Second priority: alphabetical by last name (index 3)
      const aLastName = (a[3] || '').toLowerCase();
      const bLastName = (b[3] || '').toLowerCase();
      return aLastName.localeCompare(bLastName);
    });
  };

  const addQPRODetailedSheet = (workbook: ExcelJS.Workbook, rows: any[], sheetName = 'QPRO Detailed Alumni Data') => {
    const detail = workbook.addWorksheet(sheetName);
    const headerRow = detail.addRow(qproHeaders);
    // Make headers bold
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
    });
    const mapped = (rows || []).map(mapQPRORow);
    sortAlumniData(mapped).forEach((vals) => detail.addRow(vals));
    // Move to first position
    const idx = workbook.worksheets.indexOf(detail);
    if (idx > 0) {
      workbook.worksheets.splice(idx, 1);
      workbook.worksheets.splice(0, 0, detail);
    }
  };

  // Ensure columns auto-size and wrap text so long headers/values are fully visible
  const autoSizeAndWrapSheet = (sheet: ExcelJS.Worksheet) => {
    try {
      if (!sheet || !sheet.columns || !Array.isArray(sheet.columns)) return;
      // Determine max content length per column by scanning all rows
      const numCols = (sheet as any).columnCount || ((sheet as any).columns?.length ?? 0);
      for (let c = 1; c <= numCols; c++) {
        let maxLen = 10;
        (sheet as any).eachRow?.({ includeEmpty: true }, (row: any) => {
          const cell = row.getCell(c);
          const v = cell?.value as any;
          const text =
            v === null || v === undefined
              ? ''
              : typeof v === 'object' && 'text' in (v as any)
              ? String((v as any).text)
              : String(v);
          if (text.length > maxLen) maxLen = text.length;
          cell.alignment = { ...(cell.alignment || {}), wrapText: true, vertical: 'middle' };
        });
        // Generous padding so long labels fully show in Calibri 11
        const width = Math.min(maxLen + 6, 100);
        const col = (sheet as any).getColumn?.(c);
        if (col) col.width = Math.max(col.width || 0, width, 14);
      }

      // Make likely header rows taller and wrapped so long labels are visible
      const maybeHeaderMatches = (row: any) => {
        try {
          const c1 = String(row.getCell(1)?.value || '');
          const c2 = String(row.getCell(2)?.value || '');
          const c3 = String(row.getCell(3)?.value || '');
          // Match QPRO/Detail headers
          const isQproHeader = c1 === 'Program' && c2 === 'First_Name' && c3 === 'Middle_Name';
          const isMetricHeader = c1 === 'Metric' && c2 === 'Value';
          return isQproHeader || isMetricHeader;
        } catch (_) {
          return false;
        }
      };

      (sheet as any).eachRow?.({ includeEmpty: false }, (row: any) => {
        if (maybeHeaderMatches(row)) {
          row.height = Math.max(28, row.height || 0);
          row.eachCell?.({ includeEmpty: true }, (cell: any) => {
            cell.alignment = { ...(cell.alignment || {}), wrapText: true, vertical: 'middle' };
          });
        }
      });

      // If we find the QPRO detailed header, enforce user-friendly widths per column
      const explicitHeaderWidths: Record<string, number> = {
        Program: 14,
        First_Name: 18,
        Middle_Name: 22,
        Last_Name: 18,
        Status: 16,
        'Current Company Name': 42,
        Position_Current: 42,
        'Current Salary Range': 32,
        Sector_Current: 26,
        'Please specify post graduate/degree': 60,
      };

      let headerRowIndex: number | null = null;
      (sheet as any).eachRow?.({ includeEmpty: false }, (row: any, rowNumber: number) => {
        try {
          const c1 = String(row.getCell(1)?.value || '');
          const c2 = String(row.getCell(2)?.value || '');
          const c3 = String(row.getCell(3)?.value || '');
          if (c1 === 'Program' && c2 === 'First_Name' && c3 === 'Middle_Name') {
            headerRowIndex = rowNumber;
            throw 'found';
          }
        } catch (e) {
          // break using throw/try pattern
        }
      });

      if (headerRowIndex) {
        const headerRow: any = (sheet as any).getRow(headerRowIndex);
        if (headerRow && Array.isArray((sheet as any).columns)) {
          (sheet as any).columns.forEach((col: any, idx: number) => {
            const headerText = String(headerRow.getCell(idx + 1)?.value || '');
            const desired = explicitHeaderWidths[headerText];
            if (desired) {
              col.width = Math.max(col.width || 0, desired);
            }
          });
        }
      }
    } catch (_) {
      // ignore sizing errors; exporting should still succeed
    }
  };

  // High Position helpers for ALL export reuse
  const headersHighPosition = ['Program','First_Name','Middle_Name','Last_Name','Company_Name_Current','Position_Current'];
  const mapHighPositionRow = (alumnusOrRow: any) => {
    // Supports both high_position_data shape and detailed row shape
    const course = alumnusOrRow.course || alumnusOrRow['Program'] || '';
    const company = alumnusOrRow.company || alumnusOrRow['Company_Name_Current'] || '';
    const position = alumnusOrRow.position || alumnusOrRow['Position_Current'] || '';
    if (alumnusOrRow.name) {
      const name = (alumnusOrRow.name || '').trim();
      const parts = name.split(/\s+/);
      const first = parts[0] || '';
      const last = parts.length > 1 ? parts[parts.length - 1] : '';
      const middle = parts.length > 2 ? parts.slice(1, parts.length - 1).join(' ') : '';
      return [course, first, middle, last, company, position];
    }
    return [
      course,
      alumnusOrRow['First_Name'] || '',
      alumnusOrRow['Middle_Name'] || '',
      alumnusOrRow['Last_Name'] || '',
      company,
      position,
    ];
  };

  // Add this helper function before handleExportCompleteData
  const renderAndCaptureChartImages = async (
    sectionType: string,
    stats: any
  ): Promise<{ barChart?: string; pieChart?: string }> => {
    // Create a hidden container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '420px';
    container.style.height = '660px';
    document.body.appendChild(container);

    // Prepare chart data
    let chartData;
    switch (sectionType) {
      case 'QPRO':
        chartData = prepareQPROChartData(stats);
        break;
      case 'CHED':
        chartData = prepareCHEDChartData(stats);
        break;
      case 'SUC':
        chartData = prepareSUCChartData(stats);
        break;
      case 'AACUP':
        chartData = prepareAACUPChartData(stats);
        break;
      default:
        chartData = null;
    }
    if (!chartData) {
      document.body.removeChild(container);
      return {};
    }

    // Render bar chart
    const barDiv = document.createElement('div');
    barDiv.style.width = '400px';
    barDiv.style.height = '300px';
    barDiv.style.backgroundColor = 'white';
    barDiv.style.padding = '20px';
    container.appendChild(barDiv);

    const pieDiv = document.createElement('div');
    pieDiv.style.width = '400px';
    pieDiv.style.height = '300px';
    pieDiv.style.backgroundColor = 'white';
    pieDiv.style.padding = '20px';
    container.appendChild(pieDiv);

    // Use React 18 createRoot API to render charts
    const { createElement } = require('react');
    const { createRoot } = require('react-dom/client');
    const barRoot = createRoot(barDiv);
    barRoot.render(
      createElement(
        ResponsiveContainer,
        { width: '100%', height: 200 },
        createElement(
          BarChart,
          { data: chartData.barData },
          createElement(CartesianGrid, { strokeDasharray: '3 3' }),
          createElement(XAxis, { dataKey: 'name' }),
          createElement(YAxis),
          createElement(Tooltip),
          createElement(Bar, { dataKey: 'value', fill: '#7161EF' })
        )
      )
    );
    const pieRoot = createRoot(pieDiv);
    pieRoot.render(
      createElement(
        ResponsiveContainer,
        { width: '100%', height: 200 },
        createElement(
          PieChart,
          null,
          createElement(
            Pie,
            {
              data: chartData.pieData,
              cx: '50%',
              cy: '50%',
              labelLine: false,
              label: ({ name, percent }: { name: string; percent: number }) =>
                `${name} ${(percent * 100).toFixed(0)}%`,
              outerRadius: 80,
              fill: '#8884d8',
              dataKey: 'value',
            },
            chartData.pieData.map((entry: any, index: number) =>
              createElement(Cell, { key: `cell-${index}`, fill: entry.fill })
            )
          ),
          createElement(Tooltip, null),
          createElement(Legend, null)
        )
      )
    );

    // Wait for charts to render
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Capture images
    const images: { barChart?: string; pieChart?: string } = {};
    try {
      const barCanvas = await html2canvas(barDiv, {
        background: 'white',
        useCORS: true,
        allowTaint: true,
      });
      images.barChart = barCanvas.toDataURL('image/png');
      const pieCanvas = await html2canvas(pieDiv, {
        background: 'white',
        useCORS: true,
        allowTaint: true,
      });
      images.pieChart = pieCanvas.toDataURL('image/png');
    } catch (e) {
      // ignore
    }

    // Clean up
    barRoot.unmount();
    pieRoot.unmount();
    document.body.removeChild(container);
    return images;
  };

  // PDF Export Utility Function
  const exportToPDF = async (
    statsByType: Record<string, any>,
    detailedDataByType: Record<string, any[]>,
    exportType: string
  ) => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Add institutional header
    await addInstitutionalHeaderToPDF(doc, pageWidth);
    
    let yPosition = 70; // Moved higher (was 100, now 85)

    // Report Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PERCENTAGE OF GRADUATE TRACING BATCH 2023', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    
    // Report Subtitle
    doc.setFontSize(12);
    doc.text('REPORT FOR THE 3RD QUARTER QPRO 2025', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Year Filter: ${selectedYear || 'ALL'}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Program Filter: ${selectedProgram || 'ALL'}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Report Type: ${exportType}`, 20, yPosition);
    yPosition += 12;

    // Helper function to add a new page if needed
    const checkPageBreak = (needed: number) => {
      if (yPosition + needed > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
        return true;
      }
      return false;
    };

    // Export based on type
    if (exportType === 'QPRO' && statsByType['QPRO']) {
      const stats = statsByType['QPRO'];
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('QPRO Statistics Summary', 20, yPosition);
      yPosition += 8;

      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['Employed', String(stats.employed_count || 0), pct(stats.employed_count, stats.total_alumni)],
        ['Unemployed', String(stats.unemployed_count || 0), pct(stats.unemployed_count, stats.total_alumni)],
        ['Employment Rate', '', `${stats.employment_rate || 0}%`],
        ['Untracked', String(stats.untracked_count || 0), pct(stats.untracked_count, stats.total_alumni)],
      ];

      autoTable(doc, {
        head: [summaryData[0]],
        body: summaryData.slice(1),
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
      checkPageBreak(20);

      // Detailed data
      const detailedData = detailedDataByType['QPRO'] || [];
      if (detailedData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Alumni Data', 20, yPosition);
        yPosition += 6;

        // Use the same headers as Excel export for consistency
        const headers = qproHeaders;
        const rows = sortAlumniData(detailedData.map((row: any) => mapQPRORow(row)));

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 6, cellPadding: 1 },
          headStyles: { fillColor: [29, 78, 137], textColor: 255 },
          columnStyles: {
            4: { cellWidth: 20 }, // Status
            5: { cellWidth: 35 }, // Company
            6: { cellWidth: 30 }, // Position
            7: { cellWidth: 25 }, // Salary
            8: { cellWidth: 20 }, // Sector
            9: { cellWidth: 30 }, // Post graduate
          },
        });
      }
    } else if (exportType === 'CHED' && statsByType['CHED']) {
      const stats = statsByType['CHED'];
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('CHED Statistics Summary', 20, yPosition);
      yPosition += 8;

      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['Pursuing Further Study', String(stats.pursuing_further_study || 0), pct(stats.pursuing_further_study, stats.total_alumni)],
        ['Not Pursuing', String((stats.total_alumni || 0) - (stats.pursuing_further_study || 0)), pct((stats.total_alumni || 0) - (stats.pursuing_further_study || 0), stats.total_alumni)],
        ['Further Study Rate', '', `${stats.further_study_rate || 0}%`],
        ['Job Aligned', String(stats.job_aligned_count || 0), pct(stats.job_aligned_count, stats.total_alumni)],
        ['Self-Employed', String(stats.self_employed_count || 0), pct(stats.self_employed_count, stats.total_alumni)],
      ];

      autoTable(doc, {
        head: [summaryData[0]],
        body: summaryData.slice(1),
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [23, 162, 184], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
      checkPageBreak(20);

      // Detailed data for CHED
      const detailedData = detailedDataByType['CHED'] || [];
      if (detailedData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Alumni Data', 20, yPosition);
        yPosition += 6;

        // Use the same headers as Excel export for consistency
        const headers = qproHeaders;
        const rows = detailedData.map((row: any) => mapQPRORow(row));

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 6, cellPadding: 1 },
          headStyles: { fillColor: [23, 162, 184], textColor: 255 },
          columnStyles: {
            4: { cellWidth: 20 }, // Status
            5: { cellWidth: 35 }, // Company
            6: { cellWidth: 30 }, // Position
            7: { cellWidth: 25 }, // Salary
            8: { cellWidth: 20 }, // Sector
            9: { cellWidth: 30 }, // Post graduate
          },
        });
      }
    } else if (exportType === 'AACUP' && statsByType['AACUP']) {
      const stats = statsByType['AACUP'];
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('AACUP Statistics Summary', 20, yPosition);
      yPosition += 8;

      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['Employed', String(stats.employed_count || 0), pct(stats.employed_count, stats.total_alumni)],
        ['Absorbed', String(stats.absorbed_count || 0), pct(stats.absorbed_count, stats.total_alumni)],
        ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
        ['Employment Rate', '', `${stats.employment_rate || 0}%`],
        ['Absorption Rate', '', `${stats.absorption_rate || 0}%`],
      ];

      autoTable(doc, {
        head: [summaryData[0]],
        body: summaryData.slice(1),
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [40, 167, 69], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
      checkPageBreak(20);

      // Detailed data for AACUP
      const detailedData = detailedDataByType['AACUP'] || [];
      if (detailedData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Alumni Data', 20, yPosition);
        yPosition += 6;

        // Use the same headers as Excel export for consistency
        const headers = qproHeaders;
        const rows = detailedData.map((row: any) => mapQPRORow(row));

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 6, cellPadding: 1 },
          headStyles: { fillColor: [40, 167, 69], textColor: 255 },
          columnStyles: {
            4: { cellWidth: 20 }, // Status
            5: { cellWidth: 35 }, // Company
            6: { cellWidth: 30 }, // Position
            7: { cellWidth: 25 }, // Salary
            8: { cellWidth: 20 }, // Sector
            9: { cellWidth: 30 }, // Post graduate
          },
        });
      }
    } else if (exportType === 'SUC' && statsByType['SUC']) {
      const stats = statsByType['SUC'];
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SUC Statistics Summary', 20, yPosition);
      yPosition += 8;

      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
        ['Other Positions', String((stats.total_alumni || 0) - (stats.high_position_count || 0)), pct((stats.total_alumni || 0) - (stats.high_position_count || 0), stats.total_alumni)],
        ['Government', String(stats.public_count || 0), pct(stats.public_count, stats.total_alumni)],
        ['Private', String(stats.private_count || 0), pct(stats.private_count, stats.total_alumni)],
        ['Local', String(stats.local_count || 0), pct(stats.local_count, stats.total_alumni)],
        ['International', String(stats.international_count || 0), pct(stats.international_count, stats.total_alumni)],
      ];

      autoTable(doc, {
        head: [summaryData[0]],
        body: summaryData.slice(1),
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
      checkPageBreak(20);

      // Detailed data for SUC
      const detailedData = detailedDataByType['SUC'] || [];
      if (detailedData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Alumni Data', 20, yPosition);
        yPosition += 6;

        // Use the same headers as Excel export for consistency
        const headers = qproHeaders;
        const rows = sortAlumniData(detailedData.map((row: any) => mapQPRORow(row)));

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 6, cellPadding: 1 },
          headStyles: { fillColor: [29, 78, 137], textColor: 255 },
          columnStyles: {
            4: { cellWidth: 20 }, // Status
            5: { cellWidth: 35 }, // Company
            6: { cellWidth: 30 }, // Position
            7: { cellWidth: 25 }, // Salary
            8: { cellWidth: 20 }, // Sector
            9: { cellWidth: 30 }, // Post graduate
          },
        });
      }
    } else if (exportType === 'HIGH_POSITION' && statsByType['HIGH_POSITION']) {
      const stats = statsByType['HIGH_POSITION'];
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('High Position Statistics Summary', 20, yPosition);
      yPosition += 8;

      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['High Position Alumni', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
        ['High Position Rate', '', `${stats.high_position_rate || 0}%`],
      ];

      autoTable(doc, {
        head: [summaryData[0]],
        body: summaryData.slice(1),
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [255, 193, 7], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 9 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
      checkPageBreak(20);

      // Detailed data for HIGH_POSITION
      const detailedData = detailedDataByType['HIGH_POSITION'] || [];
      if (detailedData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Alumni Data', 20, yPosition);
        yPosition += 6;

        // Use the same headers as Excel export for consistency
        const headers = qproHeaders;
        const rows = detailedData.map((row: any) => mapQPRORow(row));

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 6, cellPadding: 1 },
          headStyles: { fillColor: [255, 193, 7], textColor: 0 },
          columnStyles: {
            4: { cellWidth: 20 }, // Status
            5: { cellWidth: 35 }, // Company
            6: { cellWidth: 30 }, // Position
            7: { cellWidth: 25 }, // Salary
            8: { cellWidth: 20 }, // Sector
            9: { cellWidth: 30 }, // Post graduate
          },
        });
      }
    } else if (exportType === 'ALL') {
      // Summary for all types
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Complete Statistics Summary - All Types', 20, yPosition);
      yPosition += 10;

      for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP']) {
        const stats = statsByType[type];
        if (!stats) continue;

        checkPageBreak(60);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${type} Statistics`, 20, yPosition);
        yPosition += 6;

        let summaryData: string[][] = [['Metric', 'Value', 'Percentage']];

        if (type === 'QPRO') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['Employed', String(stats.employed_count || 0), pct(stats.employed_count, stats.total_alumni)],
            ['Unemployed', String(stats.unemployed_count || 0), pct(stats.unemployed_count, stats.total_alumni)],
            ['Employment Rate', '', `${stats.employment_rate || 0}%`],
            ['Untracked', String(stats.untracked_count || 0), pct(stats.untracked_count, stats.total_alumni)]
          );
        } else if (type === 'CHED') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['Pursuing Further Study', String(stats.pursuing_further_study || 0), pct(stats.pursuing_further_study, stats.total_alumni)],
            ['Not Pursuing', String((stats.total_alumni || 0) - (stats.pursuing_further_study || 0)), pct((stats.total_alumni || 0) - (stats.pursuing_further_study || 0), stats.total_alumni)],
            ['Further Study Rate', '', `${stats.further_study_rate || 0}%`],
            ['Job Aligned', String(stats.job_aligned_count || 0), pct(stats.job_aligned_count, stats.total_alumni)],
            ['Self-Employed', String(stats.self_employed_count || 0), pct(stats.self_employed_count, stats.total_alumni)]
          );
        } else if (type === 'SUC') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
            ['Other Positions', String((stats.total_alumni || 0) - (stats.high_position_count || 0)), pct((stats.total_alumni || 0) - (stats.high_position_count || 0), stats.total_alumni)],
            ['Government', String(stats.public_count || 0), pct(stats.public_count, stats.total_alumni)],
            ['Private', String(stats.private_count || 0), pct(stats.private_count, stats.total_alumni)],
            ['Local', String(stats.local_count || 0), pct(stats.local_count, stats.total_alumni)],
            ['International', String(stats.international_count || 0), pct(stats.international_count, stats.total_alumni)]
          );
        } else if (type === 'AACUP') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['Employed', String(stats.employed_count || 0), pct(stats.employed_count, stats.total_alumni)],
            ['Absorbed', String(stats.absorbed_count || 0), pct(stats.absorbed_count, stats.total_alumni)],
            ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
            ['Employment Rate', '', `${stats.employment_rate || 0}%`],
            ['Absorption Rate', '', `${stats.absorption_rate || 0}%`],
            ['High Position Rate', '', `${stats.high_position_rate || 0}%`]
          );
        }

        autoTable(doc, {
          head: [summaryData[0]],
          body: summaryData.slice(1),
          startY: yPosition,
          theme: 'grid',
          headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 8 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
        
        // Add detailed alumni data for each type
        const detailedData = detailedDataByType[type] || [];
        if (detailedData.length > 0) {
          checkPageBreak(40);
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`${type} Detailed Alumni Data`, 20, yPosition);
          yPosition += 6;

          // Use the same headers as Excel export for consistency
          const headers = qproHeaders;
          const rows = detailedData.map((row: any) => mapQPRORow(row));

          autoTable(doc, {
            head: [headers],
            body: rows,
            startY: yPosition,
            theme: 'striped',
            styles: { fontSize: 6, cellPadding: 1 },
            headStyles: { fillColor: [29, 78, 137], textColor: 255 },
            columnStyles: {
              4: { cellWidth: 20 }, // Status
              5: { cellWidth: 35 }, // Company
              6: { cellWidth: 30 }, // Position
              7: { cellWidth: 25 }, // Salary
              8: { cellWidth: 20 }, // Sector
              9: { cellWidth: 30 }, // Post graduate
            },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
        }
      }
    }

    // Add institutional footer to all pages
    await addInstitutionalFooterToPDF(doc, pageWidth, pageHeight);

    // Save PDF
    const filename = `Alumni_Statistics_${exportType}_${selectedYear}_${selectedProgram}.pdf`;
    doc.save(filename);
  };

  // ========================================
  // WORD EXPORT FUNCTION
  // ========================================
  // Word Export Utility Function
  const exportToWord = async (
    statsByType: Record<string, any>,
    detailedDataByType: Record<string, any[]>,
    exportType: string
  ) => {
    const children: (Paragraph | Table)[] = [];

    // Load images for Word document
    const ctuLogoBase64 = await getImageAsBase64(ctuLogo);
    const bagongPilipinasBase64 = await getImageAsBase64(bagongPilipinasLogo);
    const footerBase64 = await getImageAsBase64(footerImage);

    // ========================================
    // WORD HEADER SECTION
    // ========================================
    // Create header with proper logo positioning using a table
    if (ctuLogoBase64 && bagongPilipinasBase64) {
    children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                // Left cell - CTU Logo
                new TableCell({
                  children: [
      new Paragraph({
                      text: '',
                      spacing: { before: 200 }, // Move logo down
                    }),
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: ctuLogoBase64.split(',')[1],
                          type: 'png',
                          transformation: {
                            width: 100, // Bigger logo
                            height: 100, // Bigger logo
                          },
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                // Center cell - Institutional text
                new TableCell({
                  children: [
                    new Paragraph({
                      text: 'Republic of the Philippines',
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'CEBU TECHNOLOGICAL UNIVERSITY',
                          bold: true,
                          color: 'DC143C',
                          size: 24,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      text: 'M. J. Cuenco Avenue Cor. R. Palma Street, Cebu City, Philippines',
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      text: 'Website: http://www.ctu.edu.ph',
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 50 },
                    }),
                    new Paragraph({
                      text: 'Phone: +6332 402 4060 loc. 1146',
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'UNIVERSITY ALUMNI AFFAIRS OFFICE',
                          bold: true,
                          color: 'DC143C',
                          size: 18,
                        }),
                      ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
                    }),
                  ],
                  width: { size: 60, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                // Right cell - Bagong Pilipinas Logo
                new TableCell({
                  children: [
                    new Paragraph({
                      text: '',
                      spacing: { before: 200 }, // Move logo down
                    }),
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: bagongPilipinasBase64.split(',')[1],
                          type: 'png',
                          transformation: {
                            width: 100, // Bigger logo
                            height: 100, // Bigger logo
                          },
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
          ],
        })
      );
    } else {
      // Fallback if logos not available - just text
      children.push(
        new Paragraph({
          text: 'Republic of the Philippines',
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'CEBU TECHNOLOGICAL UNIVERSITY',
              bold: true,
              color: 'DC143C',
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: 'M. J. Cuenco Avenue Cor. R. Palma Street, Cebu City, Philippines',
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: 'Website: http://www.ctu.edu.ph',
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 },
        }),
        new Paragraph({
          text: 'Phone: +6332 402 4060 loc. 1146',
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'UNIVERSITY ALUMNI AFFAIRS OFFICE',
              bold: true,
              color: 'DC143C',
              size: 18,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    }


    // Report Title
    children.push(
      new Paragraph({
        text: '',
        spacing: { before: 200 }, // Add space before title
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'PERCENTAGE OF GRADUATE TRACING BATCH 2023',
            bold: true,
            size: 28,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'REPORT FOR THE 3RD QUARTER QPRO 2025',
            bold: true,
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    // Metadata
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Generated: ', bold: true }),
          new TextRun(new Date().toLocaleDateString()),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Year Filter: ', bold: true }),
          new TextRun(selectedYear || 'ALL'),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Program Filter: ', bold: true }),
          new TextRun(selectedProgram || 'ALL'),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Report Type: ', bold: true }),
          new TextRun(exportType),
        ],
        spacing: { after: 400 },
      })
    );

    // Helper function to create summary table
    const createSummaryTable = (title: string, data: string[][]): (Paragraph | Table)[] => {
      const elements: (Paragraph | Table)[] = [];

      elements.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        })
      );

      elements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: data.map((row, index) =>
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        text: cell,
                        alignment: AlignmentType.CENTER,
                        style: index === 0 ? 'strong' : undefined,
                      }),
                    ],
                    shading: index === 0 ? { fill: '1D4E89' } : undefined,
                  })
              ),
            })
          ),
        })
      );

      return elements;
    };

    // Helper function to create detailed alumni data table
    const createDetailedTable = (title: string, detailedData: any[]): (Paragraph | Table)[] => {
      const elements: (Paragraph | Table)[] = [];

      if (detailedData.length === 0) return elements;

      elements.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        })
      );

      // Use the same headers as Excel export for consistency
      const headers = qproHeaders;
      const rows = sortAlumniData(detailedData.map((row: any) => mapQPRORow(row)));

      elements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            // Header row
            new TableRow({
              children: headers.map((header) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      text: header,
                      alignment: AlignmentType.CENTER,
                      style: 'strong',
                    }),
                  ],
                  shading: { fill: '1D4E89' },
                })
              ),
            }),
            // Data rows
            ...rows.map((row) =>
              new TableRow({
                children: row.map((cell: any) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        text: String(cell || ''),
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  })
                ),
              })
            ),
          ],
        })
      );

      return elements;
    };

    // Export based on type
    if (exportType === 'QPRO' && statsByType['QPRO']) {
      const stats = statsByType['QPRO'];
      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['Employed', String(stats.employed_count || 0), pct(stats.employed_count, stats.total_alumni)],
        ['Unemployed', String(stats.unemployed_count || 0), pct(stats.unemployed_count, stats.total_alumni)],
        ['Employment Rate', '', `${stats.employment_rate || 0}%`],
        ['Untracked', String(stats.untracked_count || 0), pct(stats.untracked_count, stats.total_alumni)],
      ];
      children.push(...createSummaryTable('QPRO Statistics Summary', summaryData));
      
      // Add detailed alumni data
      const detailedData = detailedDataByType['QPRO'] || [];
      children.push(...createDetailedTable('Detailed Alumni Data', detailedData));
    } else if (exportType === 'CHED' && statsByType['CHED']) {
      const stats = statsByType['CHED'];
      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['Pursuing Further Study', String(stats.pursuing_further_study || 0), pct(stats.pursuing_further_study, stats.total_alumni)],
        ['Not Pursuing', String((stats.total_alumni || 0) - (stats.pursuing_further_study || 0)), pct((stats.total_alumni || 0) - (stats.pursuing_further_study || 0), stats.total_alumni)],
        ['Further Study Rate', '', `${stats.further_study_rate || 0}%`],
        ['Job Aligned', String(stats.job_aligned_count || 0), pct(stats.job_aligned_count, stats.total_alumni)],
      ];
      children.push(...createSummaryTable('CHED Statistics Summary', summaryData));
      
      // Add detailed alumni data
      const detailedData = detailedDataByType['CHED'] || [];
      children.push(...createDetailedTable('Detailed Alumni Data', detailedData));
    } else if (exportType === 'AACUP' && statsByType['AACUP']) {
      const stats = statsByType['AACUP'];
      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['Employed', String(stats.employed_count || 0), pct(stats.employed_count, stats.total_alumni)],
        ['Absorbed', String(stats.absorbed_count || 0), pct(stats.absorbed_count, stats.total_alumni)],
        ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
        ['Employment Rate', '', `${stats.employment_rate || 0}%`],
      ];
      children.push(...createSummaryTable('AACUP Statistics Summary', summaryData));
      
      // Add detailed alumni data
      const detailedData = detailedDataByType['AACUP'] || [];
      children.push(...createDetailedTable('Detailed Alumni Data', detailedData));
    } else if (exportType === 'SUC' && statsByType['SUC']) {
      const stats = statsByType['SUC'];
      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
        ['Government', String(stats.public_count || 0), pct(stats.public_count, stats.total_alumni)],
        ['Private', String(stats.private_count || 0), pct(stats.private_count, stats.total_alumni)],
      ];
      children.push(...createSummaryTable('SUC Statistics Summary', summaryData));
      
      // Add detailed alumni data
      const detailedData = detailedDataByType['SUC'] || [];
      children.push(...createDetailedTable('Detailed Alumni Data', detailedData));
    } else if (exportType === 'HIGH_POSITION' && statsByType['HIGH_POSITION']) {
      const stats = statsByType['HIGH_POSITION'];
      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['High Position Alumni', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
        ['High Position Rate', '', `${stats.high_position_rate || 0}%`],
      ];
      children.push(...createSummaryTable('High Position Statistics Summary', summaryData));
      
      // Add detailed alumni data
      const detailedData = detailedDataByType['HIGH_POSITION'] || [];
      children.push(...createDetailedTable('Detailed Alumni Data', detailedData));
    } else if (exportType === 'ALL') {
      // Summary for all types
      for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP']) {
        const stats = statsByType[type];
        if (!stats) continue;

        let summaryData: string[][] = [['Metric', 'Value', 'Percentage']];

        if (type === 'QPRO') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['Employed', String(stats.employed_count || 0), pct(stats.employed_count, stats.total_alumni)],
            ['Unemployed', String(stats.unemployed_count || 0), pct(stats.unemployed_count, stats.total_alumni)],
            ['Employment Rate', '', `${stats.employment_rate || 0}%`],
            ['Untracked', String(stats.untracked_count || 0), pct(stats.untracked_count, stats.total_alumni)]
          );
        } else if (type === 'CHED') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['Pursuing Further Study', String(stats.pursuing_further_study || 0), pct(stats.pursuing_further_study, stats.total_alumni)],
            ['Not Pursuing', String((stats.total_alumni || 0) - (stats.pursuing_further_study || 0)), pct((stats.total_alumni || 0) - (stats.pursuing_further_study || 0), stats.total_alumni)],
            ['Further Study Rate', '', `${stats.further_study_rate || 0}%`],
            ['Job Aligned', String(stats.job_aligned_count || 0), pct(stats.job_aligned_count, stats.total_alumni)],
            ['Self-Employed', String(stats.self_employed_count || 0), pct(stats.self_employed_count, stats.total_alumni)]
          );
        } else if (type === 'SUC') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
            ['Other Positions', String((stats.total_alumni || 0) - (stats.high_position_count || 0)), pct((stats.total_alumni || 0) - (stats.high_position_count || 0), stats.total_alumni)],
            ['Government', String(stats.public_count || 0), pct(stats.public_count, stats.total_alumni)],
            ['Private', String(stats.private_count || 0), pct(stats.private_count, stats.total_alumni)],
            ['Local', String(stats.local_count || 0), pct(stats.local_count, stats.total_alumni)],
            ['International', String(stats.international_count || 0), pct(stats.international_count, stats.total_alumni)]
          );
        } else if (type === 'AACUP') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['Employed', String(stats.employed_count || 0), pct(stats.employed_count, stats.total_alumni)],
            ['Absorbed', String(stats.absorbed_count || 0), pct(stats.absorbed_count, stats.total_alumni)],
            ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
            ['Employment Rate', '', `${stats.employment_rate || 0}%`],
            ['Absorption Rate', '', `${stats.absorption_rate || 0}%`],
            ['High Position Rate', '', `${stats.high_position_rate || 0}%`]
          );
        }

        children.push(...createSummaryTable(`${type} Statistics`, summaryData));
        
        // Add detailed alumni data for each type
        const detailedData = detailedDataByType[type] || [];
        children.push(...createDetailedTable(`${type} Detailed Alumni Data`, detailedData));
      }
    }

    // ========================================
    // WORD FOOTER SECTION
    // ========================================
    // Add institutional footer with image
    children.push(
      new Paragraph({
        text: '',
        spacing: { before: 800, after: 200 },
      })
    );

    // Add compact footer image if available
    if (footerBase64) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: footerBase64.split(',')[1],
              type: 'png',
              transformation: {
                width: 600,
                height: 30, // Compact height to match the logo row design
              },
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    }

    // Add footer text
    children.push(
      new Paragraph({
        text: 'Generated by Cebu Technological University Alumni Affairs Office',
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        text: 'This report is generated automatically by the Alumni Tracking System',
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      })
    );

    // Create document
    const doc = new Document({
      sections: [{
        properties: {},
        children: children,
      }],
    });

    // Generate and save
    const blob = await Packer.toBlob(doc);
    const filename = `Alumni_Statistics_${exportType}_${selectedYear}_${selectedProgram}.docx`;
    saveAs(blob, filename);
  };

  const handleExportCompleteData = async (format: 'excel' | 'pdf' | 'word' = 'excel') => {
    if (!generatedStats && !allStats) return;
    setExporting(true);
    try {
      // Get detailed alumni data for export
      let detailedDataByType: Record<string, any[]> = {};
      let statsByType: Record<string, any> = {};
      if (allStats) {
        // For ALL, fetch for each type
        for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
          const res = await exportDetailedAlumniData(selectedYear, selectedProgram, type);
          detailedDataByType[type] = res.detailed_data || [];
          
          // Use stats from allStats if available, otherwise use stats from the API response
          let stats = allStats[type] || res.stats || null;
          
          // For HIGH_POSITION, generate stats from detailed data if not available
          if (type === 'HIGH_POSITION' && !stats && res.detailed_data) {
            const totalAlumni = res.detailed_data.length;
            const highPositionCount = res.detailed_data.filter((alumnus: any) => {
              const position = (alumnus.Position_Current || alumnus.position_current || '').toLowerCase();
              return position.includes('manager') || position.includes('director') || 
                     position.includes('ceo') || position.includes('president') || 
                     position.includes('vp') || position.includes('vice president') ||
                     position.includes('head') || position.includes('chief') ||
                     position.includes('executive') || position.includes('senior');
            }).length;
            
            stats = {
              type: 'HIGH_POSITION',
              total_alumni: totalAlumni,
              high_position_count: highPositionCount,
              high_position_rate: totalAlumni > 0 ? ((highPositionCount / totalAlumni) * 100).toFixed(1) : '0.0'
            };
          }
          
          statsByType[type] = stats;
        }
      } else {
        const res = await exportDetailedAlumniData(
          selectedYear,
          selectedProgram,
          generatedStats.type
        );
        detailedDataByType[generatedStats.type] = res.detailed_data || [];
        statsByType[generatedStats.type] = generatedStats;
      }

      // Determine export type name
      const exportType = allStats ? 'ALL' : (generatedStats?.type || 'ALL');

      // Route to appropriate export function based on format
      if (format === 'pdf') {
        await exportToPDF(statsByType, detailedDataByType, exportType);
        setExporting(false);
        alert('PDF exported successfully!');
        return;
      } else if (format === 'word') {
        await exportToWord(statsByType, detailedDataByType, exportType);
        setExporting(false);
        alert('Word document exported successfully!');
        return;
      }

      // Continue with Excel export if format is 'excel'
      const workbook = new ExcelJS.Workbook();

      // If exporting only QPRO, produce a single-tab workbook with summary + details (no charts)
      if (!allStats && generatedStats?.type === 'QPRO') {
        const sheet = workbook.addWorksheet('QPRO Report');
        
        // Add institutional header
        let r = addInstitutionalHeaderToExcel(sheet, 1);
        
        // Add metadata
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString();
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage';
        // Make summary headers bold
        sheet.getCell(`A${r}`).font = { bold: true };
        sheet.getCell(`B${r}`).font = { bold: true };
        sheet.getCell(`C${r}`).font = { bold: true };
        r++;
        // Employed
        sheet.getCell(`A${r}`).value = 'Employed';
        sheet.getCell(`B${r}`).value = generatedStats.employed_count;
        sheet.getCell(`C${r}`).value = `${pct(generatedStats.employed_count, generatedStats.total_alumni)}`; r++;
        // Unemployed
        sheet.getCell(`A${r}`).value = 'Unemployed';
        sheet.getCell(`B${r}`).value = generatedStats.unemployed_count;
        sheet.getCell(`C${r}`).value = `${pct(generatedStats.unemployed_count, generatedStats.total_alumni)}`; r++;
        // Employment Rate (percentage only)
        sheet.getCell(`A${r}`).value = 'Employment Rate';
        sheet.getCell(`C${r}`).value = `${pct(generatedStats.employed_count, generatedStats.total_alumni)}`; r++;
        // Untracked
        const untracked = Number(generatedStats.untracked_count) || Math.max(
          (Number(generatedStats.total_alumni) || 0) - (Number(generatedStats.employed_count) || 0) - (Number(generatedStats.unemployed_count) || 0),
          0
        );
        sheet.getCell(`A${r}`).value = 'Untracked';
        sheet.getCell(`B${r}`).value = untracked;
        sheet.getCell(`C${r}`).value = `${pct(untracked, generatedStats.total_alumni)}`; r++;
        // Total Alumni
        sheet.getCell(`A${r}`).value = 'Total Alumni';
        sheet.getCell(`B${r}`).value = generatedStats.total_alumni;
        sheet.getCell(`C${r}`).value = '100%'; r += 2;

        sheet.getCell(`A${r}`).value = 'QPRO Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(qproHeaders);
        // Make headers bold
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
        });
        r++;
        const mapped = sortAlumniData((detailedDataByType['QPRO'] || []).map(mapQPRORow));
        mapped.forEach((vals) => { sheet.addRow(vals); r++; });

        // Add institutional footer
        addInstitutionalFooterToExcel(sheet, r);

        // Auto size and wrap
        autoSizeAndWrapSheet(sheet);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `QPRO_Complete_Report_${selectedYear}_${selectedProgram}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExporting(false);
        return;
      }

      // If exporting only CHED, produce a single-tab workbook with CHED matrix + details
      if (!allStats && generatedStats?.type === 'CHED') {
        const sheet = workbook.addWorksheet('CHED Report');
        
        // Add institutional header
        let r = addInstitutionalHeaderToExcel(sheet, 1);
        
        // Add metadata
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString();
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage';
        // Make summary headers bold
        sheet.getCell(`A${r}`).font = { bold: true };
        sheet.getCell(`B${r}`).font = { bold: true };
        sheet.getCell(`C${r}`).font = { bold: true };
        r++;
        // Pursuing Further Study
        const pursuing = Number(generatedStats.pursuing_further_study) || 0;
        sheet.getCell(`A${r}`).value = 'Pursuing Further Study';
        sheet.getCell(`B${r}`).value = pursuing;
        sheet.getCell(`C${r}`).value = `${pct(pursuing, generatedStats.total_alumni)}`; r++;
        // Job Alignment
        const jobAligned = Number(generatedStats.job_aligned_count) || 0;
        sheet.getCell(`A${r}`).value = 'Job Alignment';
        sheet.getCell(`B${r}`).value = jobAligned;
        sheet.getCell(`C${r}`).value = `${pct(jobAligned, generatedStats.total_alumni)}`; r++;
        // Self-Employed
        const selfEmp = Number(generatedStats.self_employed_count) || 0;
        sheet.getCell(`A${r}`).value = 'Self-Employed';
        sheet.getCell(`B${r}`).value = selfEmp;
        sheet.getCell(`C${r}`).value = `${pct(selfEmp, generatedStats.total_alumni)}`; r++;
        // Further Study Rate (percentage only)
        sheet.getCell(`A${r}`).value = 'Further Study Rate';
        sheet.getCell(`C${r}`).value = `${generatedStats.further_study_rate}%`; r++;
        // Not Pursuing (derived)
        const notPursuing = Math.max((Number(generatedStats.total_alumni) || 0) - pursuing, 0);
        sheet.getCell(`A${r}`).value = 'Not Pursuing';
        sheet.getCell(`B${r}`).value = notPursuing;
        sheet.getCell(`C${r}`).value = `${pct(notPursuing, generatedStats.total_alumni)}`; r++;
        // Total Alumni
        sheet.getCell(`A${r}`).value = 'Total Alumni';
        sheet.getCell(`B${r}`).value = generatedStats.total_alumni;
        sheet.getCell(`C${r}`).value = '100%'; r += 2;

        // Detailed
        sheet.getCell(`A${r}`).value = 'CHED Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(qproHeaders);
        // Make headers bold
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
        });
        r++;
        const mapped = sortAlumniData((detailedDataByType['CHED'] || []).map(mapQPRORow));
        mapped.forEach((vals) => { sheet.addRow(vals); r++; });

        // Add institutional footer
        addInstitutionalFooterToExcel(sheet, r);

        // Auto size and wrap
        autoSizeAndWrapSheet(sheet);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `CHED_Complete_Report_${selectedYear}_${selectedProgram}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExporting(false);
        return;
      }

      // If exporting only AACUP, produce a single-tab workbook with AACUP matrix + details
      if (!allStats && generatedStats?.type === 'AACUP') {
        const sheet = workbook.addWorksheet('AACUP Report');
        
        // Add institutional header
        let r = addInstitutionalHeaderToExcel(sheet, 1);
        
        // Add metadata
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString();
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage';
        // Make summary headers bold
        sheet.getCell(`A${r}`).font = { bold: true };
        sheet.getCell(`B${r}`).font = { bold: true };
        sheet.getCell(`C${r}`).font = { bold: true };
        r++;
        // Employed
        const employed = Number(generatedStats.employed_count) || 0;
        sheet.getCell(`A${r}`).value = 'Employed';
        sheet.getCell(`B${r}`).value = employed;
        sheet.getCell(`C${r}`).value = `${pct(employed, generatedStats.total_alumni)}`; r++;
        // Absorbed
        const absorbed = Number(generatedStats.absorbed_count) || 0;
        sheet.getCell(`A${r}`).value = 'Absorbed';
        sheet.getCell(`B${r}`).value = absorbed;
        sheet.getCell(`C${r}`).value = `${pct(absorbed, generatedStats.total_alumni)}`; r++;
        // High Position
        const highPos = Number(generatedStats.high_position_count) || 0;
        sheet.getCell(`A${r}`).value = 'High Position';
        sheet.getCell(`B${r}`).value = highPos;
        sheet.getCell(`C${r}`).value = `${pct(highPos, generatedStats.total_alumni)}`; r++;
        // Employment/Absorption/High Position Rates (percent only)
        sheet.getCell(`A${r}`).value = 'Employment Rate';
        sheet.getCell(`C${r}`).value = `${generatedStats.employment_rate || pct(employed, generatedStats.total_alumni)}%`; r++;
        sheet.getCell(`A${r}`).value = 'Absorption Rate';
        sheet.getCell(`C${r}`).value = `${generatedStats.absorption_rate || pct(absorbed, generatedStats.total_alumni)}%`; r++;
        sheet.getCell(`A${r}`).value = 'High Position Rate';
        sheet.getCell(`C${r}`).value = `${generatedStats.high_position_rate || pct(highPos, generatedStats.total_alumni)}%`; r++;
        // Total
        sheet.getCell(`A${r}`).value = 'Total Alumni';
        sheet.getCell(`B${r}`).value = generatedStats.total_alumni;
        sheet.getCell(`C${r}`).value = '100%'; r += 2;

        // Detailed
        sheet.getCell(`A${r}`).value = 'AACUP Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(qproHeaders);
        // Make headers bold
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
        });
        r++;
        const mapped2 = sortAlumniData((detailedDataByType['AACUP'] || []).map(mapQPRORow));
        mapped2.forEach((vals) => { sheet.addRow(vals); r++; });

        // Add institutional footer
        addInstitutionalFooterToExcel(sheet, r);

        // Auto size and wrap
        autoSizeAndWrapSheet(sheet);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `AACUP_Complete_Report_${selectedYear}_${selectedProgram}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExporting(false);
        return;
      }

      // If exporting only HIGH_POSITION, produce a single-tab workbook with summary + filtered details
      if (!allStats && generatedStats?.type === 'HIGH_POSITION') {
        const sheet = workbook.addWorksheet('High Position Report');
        
        // Add institutional header
        let r = addInstitutionalHeaderToExcel(sheet, 1);
        
        // Add metadata
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString();
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage';
        // Make summary headers bold
        sheet.getCell(`A${r}`).font = { bold: true };
        sheet.getCell(`B${r}`).font = { bold: true };
        sheet.getCell(`C${r}`).font = { bold: true };
        r++;
        // High Position metrics
        const hpCount = Number(generatedStats.high_position_count) || 0;
        sheet.getCell(`A${r}`).value = 'High Position Alumni';
        sheet.getCell(`B${r}`).value = hpCount;
        sheet.getCell(`C${r}`).value = `${pct(hpCount, generatedStats.total_alumni)}`; r++;
        sheet.getCell(`A${r}`).value = 'High Position Rate';
        sheet.getCell(`C${r}`).value = `${generatedStats.high_position_rate || pct(hpCount, generatedStats.total_alumni)}%`; r++;
        sheet.getCell(`A${r}`).value = 'Total Alumni';
        sheet.getCell(`B${r}`).value = generatedStats.total_alumni;
        sheet.getCell(`C${r}`).value = '100%'; r += 2;

        // Detailed: only high-position alumni with limited columns
        const headersHP = ['Program','First_Name','Middle_Name','Last_Name','Company_Name_Current','Position_Current'];
        sheet.getCell(`A${r}`).value = 'High Position Detailed Alumni Data'; r++;
        sheet.addRow(headersHP); r++;

        const rows: any[] = [];
        if (generatedStats.high_position_data && Array.isArray(generatedStats.high_position_data)) {
          generatedStats.high_position_data.forEach((alumnus: any) => {
            const course = alumnus.course || '';
            const name = (alumnus.name || '').trim();
            const parts = name.split(/\s+/);
            const first = parts[0] || '';
            const last = parts.length > 1 ? parts[parts.length - 1] : '';
            const middle = parts.length > 2 ? parts.slice(1, parts.length - 1).join(' ') : '';
            rows.push([
              course,
              first,
              middle,
              last,
              alumnus.company || '',
              alumnus.position || '',
            ]);
          });
        } else {
          const raw = detailedDataByType['HIGH_POSITION'] || [];
          raw.forEach((row: any) => {
            if (row['Position_Current']) {
              rows.push([
                row['Program'] || '',
                row['First_Name'] || '',
                row['Middle_Name'] || '',
                row['Last_Name'] || '',
                row['Company_Name_Current'] || '',
                row['Position_Current'] || '',
              ]);
            }
          });
        }
        // Respondents first: defined by having company or position
        rows.sort((a, b) => {
          const aAns = (a[4] && `${a[4]}`.trim()) || (a[5] && `${a[5]}`.trim()) ? 1 : 0;
          const bAns = (b[4] && `${b[4]}`.trim()) || (b[5] && `${b[5]}`.trim()) ? 1 : 0;
          return bAns - aAns;
        });
        rows.forEach((vals) => { sheet.addRow(vals); r++; });

        // Add institutional footer
        addInstitutionalFooterToExcel(sheet, r);

        // Auto size and wrap
        autoSizeAndWrapSheet(sheet);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `HIGH_POSITION_Complete_Report_${selectedYear}_${selectedProgram}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExporting(false);
        return;
      }

      // If exporting only SUC, produce a single-tab workbook with SUC matrix + details
      if (!allStats && generatedStats?.type === 'SUC') {
        const sheet = workbook.addWorksheet('SUC Report');
        
        // Add institutional header
        let r = addInstitutionalHeaderToExcel(sheet, 1);
        
        // Add metadata
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString();
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL';
        sheet.getCell(`A${r}`).font = { bold: true };
        r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage';
        // Make summary headers bold
        sheet.getCell(`A${r}`).font = { bold: true };
        sheet.getCell(`B${r}`).font = { bold: true };
        sheet.getCell(`C${r}`).font = { bold: true };
        r++;
        // High Position
        const highPos = Number(generatedStats.high_position_count) || 0;
        sheet.getCell(`A${r}`).value = 'High Position';
        sheet.getCell(`B${r}`).value = highPos;
        sheet.getCell(`C${r}`).value = `${pct(highPos, generatedStats.total_alumni)}`; r++;
        // Other Positions (derived)
        const otherPos = Math.max((Number(generatedStats.total_alumni) || 0) - highPos, 0);
        sheet.getCell(`A${r}`).value = 'Other Positions';
        sheet.getCell(`B${r}`).value = otherPos;
        sheet.getCell(`C${r}`).value = `${pct(otherPos, generatedStats.total_alumni)}`; r++;
        // Leadership Rate (percent only)
        sheet.getCell(`A${r}`).value = 'Leadership Rate';
        sheet.getCell(`C${r}`).value = `${pct(highPos, generatedStats.total_alumni)}`; r++;
        // Government/Private/Local/International
        const publicCnt = Number(generatedStats.public_count) || 0;
        const privateCnt = Number(generatedStats.private_count) || 0;
        const localCnt = Number(generatedStats.local_count) || 0;
        const intlCnt = Number(generatedStats.international_count) || 0;
        sheet.getCell(`A${r}`).value = 'Government'; sheet.getCell(`B${r}`).value = publicCnt; sheet.getCell(`C${r}`).value = `${pct(publicCnt, generatedStats.total_alumni)}`; r++;
        sheet.getCell(`A${r}`).value = 'Private'; sheet.getCell(`B${r}`).value = privateCnt; sheet.getCell(`C${r}`).value = `${pct(privateCnt, generatedStats.total_alumni)}`; r++;
        sheet.getCell(`A${r}`).value = 'Local'; sheet.getCell(`B${r}`).value = localCnt; sheet.getCell(`C${r}`).value = `${pct(localCnt, generatedStats.total_alumni)}`; r++;
        sheet.getCell(`A${r}`).value = 'International'; sheet.getCell(`B${r}`).value = intlCnt; sheet.getCell(`C${r}`).value = `${pct(intlCnt, generatedStats.total_alumni)}`; r++;
        // Total
        sheet.getCell(`A${r}`).value = 'Total Alumni';
        sheet.getCell(`B${r}`).value = generatedStats.total_alumni;
        sheet.getCell(`C${r}`).value = '100%'; r += 2;

        // Detailed
        sheet.getCell(`A${r}`).value = 'SUC Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(qproHeaders);
        // Make headers bold
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
        });
        r++;
        const mapped = sortAlumniData((detailedDataByType['SUC'] || []).map(mapQPRORow));
        mapped.forEach((vals) => { sheet.addRow(vals); r++; });

        // Add institutional footer
        addInstitutionalFooterToExcel(sheet, r);

        // Auto size and wrap
        autoSizeAndWrapSheet(sheet);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `SUC_Complete_Report_${selectedYear}_${selectedProgram}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExporting(false);
        return;
      }

      const worksheet = workbook.addWorksheet('Alumni Statistics');

      let rowIdx = 1;
      if (allStats) {
        // Add institutional header
        rowIdx = addInstitutionalHeaderToExcel(worksheet, 1);
        
        // Add metadata
        worksheet.getCell(`A${rowIdx}`).value = `Generated Date`;
        worksheet.getCell(`B${rowIdx}`).value = new Date().toLocaleDateString();
        worksheet.getCell(`A${rowIdx}`).font = { bold: true };
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Year Filter`;
        worksheet.getCell(`B${rowIdx}`).value = selectedYear || 'All';
        worksheet.getCell(`A${rowIdx}`).font = { bold: true };
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Program Filter`;
        worksheet.getCell(`B${rowIdx}`).value = selectedProgram || 'All';
        worksheet.getCell(`A${rowIdx}`).font = { bold: true };
        rowIdx += 2;
        for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
          const stats = statsByType[type];
          if (!stats) {
            console.warn(`No stats found for type: ${type}`);
            continue;
          }
          worksheet.getCell(`A${rowIdx}`).value = `${type} Statistics`;
          worksheet.getCell(`A${rowIdx}`).font = { bold: true };
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Metric';
          worksheet.getCell(`B${rowIdx}`).value = 'Value';
          worksheet.getCell(`C${rowIdx}`).value = 'Percentage';
          // Make headers bold
          worksheet.getCell(`A${rowIdx}`).font = { bold: true };
          worksheet.getCell(`B${rowIdx}`).font = { bold: true };
          worksheet.getCell(`C${rowIdx}`).font = { bold: true };
          rowIdx++;

          // Set current chart section for this type
          setCurrentChartSection(type);
          // Add summary rows for each type
          if (stats?.type === 'QPRO') {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Employment Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${stats.employment_rate}%`;
            worksheet.getCell(`C${rowIdx}`).value = `${stats.employment_rate}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Employed Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.employed_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.employed_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Unemployed Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.unemployed_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.unemployed_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Untracked Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.untracked_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.untracked_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Unemployment Rate';
            worksheet.getCell(`B${rowIdx}`).value =
              `${pct(stats.unemployed_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Employment Success Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${stats.employment_rate}%`;
            rowIdx++;
          } else if (stats?.type === 'CHED') {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Pursuing Further Study';
            worksheet.getCell(`B${rowIdx}`).value = stats.pursuing_further_study;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.pursuing_further_study, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Further Study Rate';
            worksheet.getCell(`B${rowIdx}`).value =
              `${pct(stats.further_study_rate, stats.total_alumni)}`;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.further_study_rate, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Not Pursuing Further Study';
            worksheet.getCell(`B${rowIdx}`).value =
              stats.total_alumni - stats.pursuing_further_study;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.total_alumni - stats.pursuing_further_study, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Academic Advancement Rate';
            worksheet.getCell(`B${rowIdx}`).value =
              `${pct(stats.further_study_rate, stats.total_alumni)}`;
            rowIdx++;
          } else if (stats?.type === 'SUC') {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'High Position Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.high_position_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Other Positions';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni - stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.total_alumni - stats.high_position_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Leadership Rate';
            worksheet.getCell(`B${rowIdx}`).value =
              `${pct(stats.high_position_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Government Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.public_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.public_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Private Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.private_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.private_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Local Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.local_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.local_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'International Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.international_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.international_count, stats.total_alumni)}`;
            rowIdx++;
          } else if (stats?.type === 'AACUP') {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Employed Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.employed_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.employed_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Absorbed Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.absorbed_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.absorbed_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'High Position Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.high_position_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Others';
            worksheet.getCell(`B${rowIdx}`).value =
              stats.total_alumni -
              stats.employed_count -
              stats.absorbed_count -
              stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.total_alumni - stats.employed_count - stats.absorbed_count - stats.high_position_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Employment Rate';
            worksheet.getCell(`B${rowIdx}`).value =
              `${pct(stats.employed_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Absorption Rate';
            worksheet.getCell(`B${rowIdx}`).value =
              `${pct(stats.absorbed_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Leadership Rate';
            worksheet.getCell(`B${rowIdx}`).value =
              `${pct(stats.high_position_count, stats.total_alumni)}`;
            rowIdx++;
          } else if (stats?.type === 'HIGH_POSITION') {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni || 0;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'High Position Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value = `${pct(stats.high_position_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'High Position Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${stats.high_position_rate}%`;
            worksheet.getCell(`C${rowIdx}`).value = `${stats.high_position_rate}%`;
            rowIdx++;
            
            // Add detailed high position alumni data
            if (stats.high_position_data && stats.high_position_data.length > 0) {
              worksheet.getCell(`A${rowIdx}`).value = '=== HIGH POSITION ALUMNI DETAILS ===';
              rowIdx++;
              worksheet.getCell(`A${rowIdx}`).value = 'CTU ID';
              worksheet.getCell(`B${rowIdx}`).value = 'Name';
              worksheet.getCell(`C${rowIdx}`).value = 'Position';
              worksheet.getCell(`D${rowIdx}`).value = 'Company';
              worksheet.getCell(`E${rowIdx}`).value = 'Sector';
              worksheet.getCell(`F${rowIdx}`).value = 'Program';
              worksheet.getCell(`G${rowIdx}`).value = 'Year Graduated';
              worksheet.getCell(`H${rowIdx}`).value = 'Email';
              worksheet.getCell(`I${rowIdx}`).value = 'Phone';
              worksheet.getCell(`J${rowIdx}`).value = 'Address';
              // Make headers bold
              worksheet.getCell(`A${rowIdx}`).font = { bold: true };
              worksheet.getCell(`B${rowIdx}`).font = { bold: true };
              worksheet.getCell(`C${rowIdx}`).font = { bold: true };
              worksheet.getCell(`D${rowIdx}`).font = { bold: true };
              worksheet.getCell(`E${rowIdx}`).font = { bold: true };
              worksheet.getCell(`F${rowIdx}`).font = { bold: true };
              worksheet.getCell(`G${rowIdx}`).font = { bold: true };
              worksheet.getCell(`H${rowIdx}`).font = { bold: true };
              worksheet.getCell(`I${rowIdx}`).font = { bold: true };
              worksheet.getCell(`J${rowIdx}`).font = { bold: true };
              rowIdx++;
              
              stats.high_position_data.forEach((alumnus: any) => {
                worksheet.getCell(`A${rowIdx}`).value = alumnus.ctu_id || '';
                worksheet.getCell(`B${rowIdx}`).value = alumnus.name || '';
                worksheet.getCell(`C${rowIdx}`).value = alumnus.position || '';
                worksheet.getCell(`D${rowIdx}`).value = alumnus.company || '';
                worksheet.getCell(`E${rowIdx}`).value = alumnus.sector || '';
                worksheet.getCell(`F${rowIdx}`).value = alumnus.course || '';
                worksheet.getCell(`G${rowIdx}`).value = alumnus.year_graduated || '';
                worksheet.getCell(`H${rowIdx}`).value = alumnus.email || '';
                worksheet.getCell(`I${rowIdx}`).value = alumnus.phone || '';
                worksheet.getCell(`J${rowIdx}`).value = alumnus.address || '';
                rowIdx++;
              });
            }
          } else {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            Object.entries(stats.status_counts || {}).forEach(([status, count]) => {
              worksheet.getCell(`A${rowIdx}`).value = status;
              worksheet.getCell(`B${rowIdx}`).value = count as number;
              worksheet.getCell(`C${rowIdx}`).value = `${pct(count as number, stats.total_alumni)}`;
              rowIdx++;
            });
          }
          rowIdx++;
          // Skip all chart images in ALL export
          // Build tailored detailed tables per type
          const rows = detailedDataByType[type] as any[];
          if (Array.isArray(rows) && rows.length > 0) {
            worksheet.getCell(`A${rowIdx}`).value = `${type} Detailed Alumni Data`;
            rowIdx++;
            if (type === 'HIGH_POSITION') {
              // Filter to only high-position alumni if high_position_data is not available
              let highPositionRows = rows;
              if (!stats.high_position_data || !Array.isArray(stats.high_position_data)) {
                highPositionRows = rows.filter((alumnus: any) => {
                  const position = (alumnus.Position_Current || alumnus.position_current || '').toLowerCase();
                  return position.includes('manager') || position.includes('director') || 
                         position.includes('ceo') || position.includes('president') || 
                         position.includes('vp') || position.includes('vice president') ||
                         position.includes('head') || position.includes('chief') ||
                         position.includes('executive') || position.includes('senior');
                });
              } else {
                highPositionRows = stats.high_position_data;
              }
              
              const mappedHP = highPositionRows.map(mapHighPositionRow);
              const headerRow = worksheet.addRow(headersHighPosition);
              // Make headers bold
              headerRow.eachCell((cell) => {
                cell.font = { bold: true };
              });
              rowIdx++;
              mappedHP.forEach((vals: (string | number)[]) => { worksheet.addRow(vals); rowIdx++; });
              // Excel sheet names must be <= 31 chars; use a concise, clear name
              const detailSheet = workbook.addWorksheet('High Position Details');
              
              // Add summary metrics to HIGH_POSITION sheet
              let detailRowIdx = 1;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'HIGH_POSITION Statistics Summary';
              detailSheet.getCell(`A${detailRowIdx}`).font = { bold: true };
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Generated Date';
              detailSheet.getCell(`B${detailRowIdx}`).value = new Date().toLocaleDateString();
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Year Filter';
              detailSheet.getCell(`B${detailRowIdx}`).value = selectedYear || 'ALL';
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Program Filter';
              detailSheet.getCell(`B${detailRowIdx}`).value = selectedProgram || 'ALL';
              detailRowIdx += 2;
              detailSheet.getCell(`A${detailRowIdx}`).value = '=== SUMMARY STATISTICS ===';
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Metric';
              detailSheet.getCell(`B${detailRowIdx}`).value = 'Value';
              detailSheet.getCell(`C${detailRowIdx}`).value = 'Percentage';
              // Make summary headers bold
              detailSheet.getCell(`A${detailRowIdx}`).font = { bold: true };
              detailSheet.getCell(`B${detailRowIdx}`).font = { bold: true };
              detailSheet.getCell(`C${detailRowIdx}`).font = { bold: true };
              detailRowIdx++;
              
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Total Alumni';
              detailSheet.getCell(`B${detailRowIdx}`).value = stats.total_alumni || 0;
              detailSheet.getCell(`C${detailRowIdx}`).value = '100%';
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'High Position Alumni';
              detailSheet.getCell(`B${detailRowIdx}`).value = stats.high_position_count || 0;
              detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.high_position_count, stats.total_alumni);
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'High Position Rate';
              detailSheet.getCell(`C${detailRowIdx}`).value = `${stats.high_position_rate || 0}%`;
              detailRowIdx++;
              
              detailRowIdx += 2;
              detailSheet.getCell(`A${detailRowIdx}`).value = '=== HIGH POSITION DETAILED ALUMNI DATA ===';
              detailRowIdx++;
              
              const detailHeaderRow = detailSheet.addRow(headersHighPosition);
              // Make headers bold
              detailHeaderRow.eachCell((cell) => {
                cell.font = { bold: true };
              });
              mappedHP.forEach((vals: (string | number)[]) => detailSheet.addRow(vals));
              autoSizeAndWrapSheet(detailSheet);
            } else {
              const mapped = sortAlumniData(rows.map(mapQPRORow));
              const headerRow = worksheet.addRow(qproHeaders);
              // Make headers bold
              headerRow.eachCell((cell) => {
                cell.font = { bold: true };
              });
              rowIdx++;
              mapped.forEach((vals) => { worksheet.addRow(vals); rowIdx++; });
              const detailSheet = workbook.addWorksheet(`${type} Detailed Alumni Data`);
              
              // Add summary metrics to individual sheets
              let detailRowIdx = 1;
              detailSheet.getCell(`A${detailRowIdx}`).value = `${type} Statistics Summary`;
              detailSheet.getCell(`A${detailRowIdx}`).font = { bold: true };
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Generated Date';
              detailSheet.getCell(`B${detailRowIdx}`).value = new Date().toLocaleDateString();
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Year Filter';
              detailSheet.getCell(`B${detailRowIdx}`).value = selectedYear || 'ALL';
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Program Filter';
              detailSheet.getCell(`B${detailRowIdx}`).value = selectedProgram || 'ALL';
              detailRowIdx += 2;
              detailSheet.getCell(`A${detailRowIdx}`).value = '=== SUMMARY STATISTICS ===';
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Metric';
              detailSheet.getCell(`B${detailRowIdx}`).value = 'Value';
              detailSheet.getCell(`C${detailRowIdx}`).value = 'Percentage';
              // Make summary headers bold
              detailSheet.getCell(`A${detailRowIdx}`).font = { bold: true };
              detailSheet.getCell(`B${detailRowIdx}`).font = { bold: true };
              detailSheet.getCell(`C${detailRowIdx}`).font = { bold: true };
              detailRowIdx++;
              
              // Add type-specific metrics
              if (type === 'QPRO') {
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Total Alumni';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.total_alumni || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = '100%';
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Employed';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.employed_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.employed_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Unemployed';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.unemployed_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.unemployed_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Employment Rate';
                detailSheet.getCell(`C${detailRowIdx}`).value = `${stats.employment_rate || 0}%`;
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Untracked';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.untracked_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.untracked_count, stats.total_alumni);
                detailRowIdx++;
              } else if (type === 'CHED') {
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Total Alumni';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.total_alumni || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = '100%';
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Pursuing Further Study';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.pursuing_further_study || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.pursuing_further_study, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Not Pursuing';
                detailSheet.getCell(`B${detailRowIdx}`).value = (stats.total_alumni || 0) - (stats.pursuing_further_study || 0);
                detailSheet.getCell(`C${detailRowIdx}`).value = pct((stats.total_alumni || 0) - (stats.pursuing_further_study || 0), stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Further Study Rate';
                detailSheet.getCell(`C${detailRowIdx}`).value = `${stats.further_study_rate || 0}%`;
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Job Aligned';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.job_aligned_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.job_aligned_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Self-Employed';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.self_employed_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.self_employed_count, stats.total_alumni);
                detailRowIdx++;
              } else if (type === 'SUC') {
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Total Alumni';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.total_alumni || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = '100%';
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'High Position';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.high_position_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.high_position_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Other Positions';
                detailSheet.getCell(`B${detailRowIdx}`).value = (stats.total_alumni || 0) - (stats.high_position_count || 0);
                detailSheet.getCell(`C${detailRowIdx}`).value = pct((stats.total_alumni || 0) - (stats.high_position_count || 0), stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Government';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.public_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.public_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Private';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.private_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.private_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Local';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.local_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.local_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'International';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.international_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.international_count, stats.total_alumni);
                detailRowIdx++;
              } else if (type === 'AACUP') {
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Total Alumni';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.total_alumni || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = '100%';
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Employed';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.employed_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.employed_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Absorbed';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.absorbed_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.absorbed_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'High Position';
                detailSheet.getCell(`B${detailRowIdx}`).value = stats.high_position_count || 0;
                detailSheet.getCell(`C${detailRowIdx}`).value = pct(stats.high_position_count, stats.total_alumni);
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Employment Rate';
                detailSheet.getCell(`C${detailRowIdx}`).value = `${stats.employment_rate || 0}%`;
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'Absorption Rate';
                detailSheet.getCell(`C${detailRowIdx}`).value = `${stats.absorption_rate || 0}%`;
                detailRowIdx++;
                detailSheet.getCell(`A${detailRowIdx}`).value = 'High Position Rate';
                detailSheet.getCell(`C${detailRowIdx}`).value = `${stats.high_position_rate || 0}%`;
                detailRowIdx++;
              }
              
              detailRowIdx += 2;
              detailSheet.getCell(`A${detailRowIdx}`).value = `=== ${type} DETAILED ALUMNI DATA ===`;
              detailRowIdx++;
              
              const detailHeaderRow = detailSheet.addRow(qproHeaders);
              // Make headers bold
              detailHeaderRow.eachCell((cell) => {
                cell.font = { bold: true };
              });
              mapped.forEach((vals) => detailSheet.addRow(vals));
              autoSizeAndWrapSheet(detailSheet);
            }
          }
        }
      } else {
        worksheet.getCell(`A${rowIdx}`).value =
          `${generatedStats?.type || 'All'} Complete Statistics Report`;
        worksheet.getCell(`A${rowIdx}`).font = { bold: true };
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Generated Date`;
        worksheet.getCell(`B${rowIdx}`).value = new Date().toLocaleDateString();
        worksheet.getCell(`A${rowIdx}`).font = { bold: true };
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Year Filter`;
        worksheet.getCell(`B${rowIdx}`).value = generatedStats?.year || 'All';
        worksheet.getCell(`A${rowIdx}`).font = { bold: true };
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Program Filter`;
        worksheet.getCell(`B${rowIdx}`).value = generatedStats?.course || 'All';
        worksheet.getCell(`A${rowIdx}`).font = { bold: true };
        rowIdx += 2;
        worksheet.getCell(`A${rowIdx}`).value = '=== SUMMARY STATISTICS ===';
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = 'Metric';
        worksheet.getCell(`B${rowIdx}`).value = 'Value';
        worksheet.getCell(`C${rowIdx}`).value = 'Percentage';
        rowIdx++;
        if (generatedStats?.type === 'QPRO') {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employment Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.employed_count, generatedStats.total_alumni)}`;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.employed_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employed Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.employed_count;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.employed_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Unemployed Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.unemployed_count;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.unemployed_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Unemployment Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.unemployed_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employment Success Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.employed_count, generatedStats.total_alumni)}`;
          rowIdx++;
        } else if (generatedStats?.type === 'CHED') {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Pursuing Further Study';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.pursuing_further_study;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.pursuing_further_study, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Further Study Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.further_study_rate, generatedStats.total_alumni)}`;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.further_study_rate, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Not Pursuing Further Study';
          worksheet.getCell(`B${rowIdx}`).value =
            generatedStats.total_alumni - generatedStats.pursuing_further_study;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.total_alumni - generatedStats.pursuing_further_study, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Academic Advancement Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.further_study_rate, generatedStats.total_alumni)}`;
          rowIdx++;
        } else if (generatedStats?.type === 'SUC') {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'High Position Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.high_position_count;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.high_position_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Other Positions';
          worksheet.getCell(`B${rowIdx}`).value =
            generatedStats.total_alumni - generatedStats.high_position_count;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.total_alumni - generatedStats.high_position_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Leadership Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.high_position_count, generatedStats.total_alumni)}`;
          rowIdx++;
        } else if (generatedStats?.type === 'AACUP') {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employed Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.employed_count;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.employed_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Absorbed Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.absorbed_count;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.absorbed_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'High Position Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.high_position_count;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.high_position_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Others';
          worksheet.getCell(`B${rowIdx}`).value =
            generatedStats.total_alumni -
            generatedStats.employed_count -
            generatedStats.absorbed_count -
            generatedStats.high_position_count;
          worksheet.getCell(`C${rowIdx}`).value =
            `${pct(generatedStats.total_alumni - generatedStats.employed_count - generatedStats.absorbed_count - generatedStats.high_position_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employment Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.employed_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Absorption Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.absorbed_count, generatedStats.total_alumni)}`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Leadership Rate';
          worksheet.getCell(`B${rowIdx}`).value =
            `${pct(generatedStats.high_position_count, generatedStats.total_alumni)}`;
          rowIdx++;
        } else {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          Object.entries(generatedStats.status_counts || {}).forEach(([status, count]) => {
            worksheet.getCell(`A${rowIdx}`).value = status;
            worksheet.getCell(`B${rowIdx}`).value = count as number;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(count as number, generatedStats.total_alumni)}`;
            rowIdx++;
          });
        }
        rowIdx++;
        // Generate chart images for this section using the robust method
        const chartImages: { barChart?: string; pieChart?: string } =
          await renderAndCaptureChartImages(generatedStats.type, generatedStats);
        worksheet.getCell(`A${rowIdx}`).value = '=== CHART IMAGES ===';
        rowIdx++;
        // Embed bar chart image
        if (chartImages.barChart) {
          const barImgId = workbook.addImage({
            base64: chartImages.barChart,
            extension: 'png',
          });
          worksheet.addImage(barImgId, {
            tl: { col: 0, row: rowIdx },
            ext: { width: 500, height: 300 },
          });
          rowIdx += 18;
        }
        // Embed pie chart image
        if (chartImages.pieChart) {
          const pieImgId = workbook.addImage({
            base64: chartImages.pieChart,
            extension: 'png',
          });
          worksheet.addImage(pieImgId, {
            tl: { col: 0, row: rowIdx },
            ext: { width: 500, height: 300 },
          });
          rowIdx += 18;
        }
        // Add extra buffer rows to prevent overlap
        rowIdx += 5; // fixed buffer to avoid relying on lastRow
        // Add detailed data for this section (same as ALL export)
        let lastHeader: string[] | null = null;
        const rows = detailedDataByType[generatedStats.type] as any[];
        if (Array.isArray(rows) && rows.length > 0) {
          // Determine which columns are non-empty for at least one row
          const currentHeader = Object.keys(rows[0]);
          const nonEmptyColumns = currentHeader.filter((key) =>
            rows.some((row) => row[key] !== '' && row[key] !== null && row[key] !== undefined)
          );
          worksheet.getCell(`A${rowIdx}`).value = `${generatedStats.type} Detailed Alumni Data`;
          rowIdx++;
          // Only add header if different from lastHeader
          if (!lastHeader || JSON.stringify(nonEmptyColumns) !== JSON.stringify(lastHeader)) {
            worksheet.addRow(nonEmptyColumns);
            rowIdx++;
            lastHeader = nonEmptyColumns;
          }
          // Deduplicate rows for this section (basic details + tracker answers)
          const seenRows = new Set<string>();
          rows.forEach((row: any) => {
            const rowValues = nonEmptyColumns.map((key) => row[key]);
            const rowString = JSON.stringify(rowValues);
            if (!seenRows.has(rowString)) {
              worksheet.addRow(rowValues);
              rowIdx++;
              seenRows.add(rowString);
            }
          });
          rowIdx++;
          // Also add as a separate worksheet
          const worksheetName = generatedStats.type === 'HIGH_POSITION' 
            ? 'High Position Alumni' 
            : `${generatedStats.type} Detailed Alumni Data`;
          const detailSheet = workbook.addWorksheet(worksheetName);
          detailSheet.addRow(nonEmptyColumns);
          const seenDetailRows = new Set<string>();
          rows.forEach((row: any) => {
            const rowValues = nonEmptyColumns.map((key) => row[key]);
            const rowString = JSON.stringify(rowValues);
            if (!seenDetailRows.has(rowString)) {
              detailSheet.addRow(rowValues);
              seenDetailRows.add(rowString);
            }
          });
          autoSizeAndWrapSheet(detailSheet);
        }
      }

      // Auto size and wrap on all sheets
      if (Array.isArray((workbook as any).worksheets)) {
        (workbook as any).worksheets.forEach((s: ExcelJS.Worksheet) => autoSizeAndWrapSheet(s));
      }

      // Add institutional footer to main worksheet
      addInstitutionalFooterToExcel(worksheet, rowIdx);

      // Download the Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${allStats ? 'All' : generatedStats?.type || 'All'}_Complete_Report_${selectedYear}_${selectedProgram}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('Export completed successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Get chart data based on stats type
  const getChartData = () => {
    if (!generatedStats && !allStats) return null;

    // If we have a current chart section and allStats, use that
    if (currentChartSection && allStats && allStats[currentChartSection]) {
      const stats = allStats[currentChartSection];
      switch (currentChartSection) {
        case 'QPRO':
          return prepareQPROChartData(stats);
        case 'CHED':
          return prepareCHEDChartData(stats);
        case 'SUC':
          return prepareSUCChartData(stats);
        case 'AACUP':
          return prepareAACUPChartData(stats);
        default:
          return null;
      }
    }

    // Otherwise use generatedStats
    if (!generatedStats) return null;

    switch (generatedStats.type) {
      case 'QPRO':
        return prepareQPROChartData(generatedStats);
      case 'CHED':
        return prepareCHEDChartData(generatedStats);
      case 'SUC':
        return prepareSUCChartData(generatedStats);
      case 'AACUP':
        return prepareAACUPChartData(generatedStats);
      default:
        return prepareALLChartData(generatedStats);
    }
  };

  const chartData = getChartData();

  // Helper to render a section (summary only for modal)
  const renderSummarySection = (type: string, stats: any) => {
    // Parse stats if it's a JSON string
    let parsedStats = stats;
    if (typeof stats === 'string') {
      try {
        parsedStats = JSON.parse(stats);
      } catch (e) {
        console.error(`Failed to parse stats for ${type}:`, e);
        parsedStats = stats;
      }
    }
    console.log(`Rendering ${type} with stats:`, parsedStats);
    return (
      <div
        style={{
          marginBottom: 32,
          padding: 16,
          background: '#f8f9fa',
          borderRadius: 8,
          border: '1px solid #e9ecef',
        }}
      >
        <h3 style={{ color: '#1D4E89', marginBottom: 12 }}>{type} Statistics</h3>
        {/* Summary Table */}
        <table style={{ width: '100%', marginBottom: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#e9ecef' }}>
              <th style={{ padding: 8, border: '1px solid #dee2e6' }}>Metric</th>
              <th style={{ padding: 8, border: '1px solid #dee2e6' }}>Value</th>
              <th style={{ padding: 8, border: '1px solid #dee2e6' }}>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {/* Render summary rows based on type */}
            {type === 'QPRO' && (
              <>
                <tr>
                  <td style={td}>Employed</td>
                  <td style={td}>{Number(stats.employed_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.employed_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Unemployed</td>
                  <td style={td}>{Number(stats.unemployed_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.unemployed_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Employment Rate</td>
                  <td style={td}></td>
                  <td style={td}>{(Number(stats.employment_rate) || 0).toFixed(2)}%</td>
                </tr>
                <tr>
                  <td style={td}>Untracked</td>
                  <td style={td}>{Number(stats.untracked_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.untracked_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Total Alumni</td>
                  <td style={td}>{Number(stats.total_alumni) || 0}</td>
                  <td style={td}>100%</td>
                </tr>
              </>
            )}
            {type === 'CHED' && (
              <>
                <tr>
                  <td style={td}>Pursuing Further Study</td>
                  <td style={td}>{Number(stats.pursuing_further_study) || 0}</td>
                  <td style={td}>{pct(Number(stats.pursuing_further_study) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr key="ched-job-alignment">
                  <td style={td}>Job Alignment</td>
                  <td style={td}>{Number(parsedStats.job_aligned_count) || 0}</td>
                  <td style={td}>
                    {pct(Number(parsedStats.job_aligned_count) || 0, stats.total_alumni)}
                  </td>
                </tr>
                <tr key="ched-self-employed">
                  <td style={td}>Self-Employed</td>
                  <td style={td}>{Number(parsedStats.self_employed_count) || 0}</td>
                  <td style={td}>
                    {pct(Number(parsedStats.self_employed_count) || 0, stats.total_alumni)}
                  </td>
                </tr>
                <tr>
                  <td style={td}>Further Study Rate</td>
                  <td style={td}></td>
                  <td style={td}>{(Number(stats.further_study_rate) || 0).toFixed(2)}%</td>
                </tr>
                <tr>
                  <td style={td}>Total Alumni</td>
                  <td style={td}>{Number(stats.total_alumni) || 0}</td>
                  <td style={td}>100%</td>
                </tr>
              </>
            )}
            {type === 'SUC' && (
              <>
                <tr>
                  <td style={td}>High Position</td>
                  <td style={td}>{Number(stats.high_position_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.high_position_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Other Positions</td>
                  <td style={td}>{(Number(stats.total_alumni) || 0) - (Number(stats.high_position_count) || 0)}</td>
                  <td style={td}>{pct(((Number(stats.total_alumni) || 0) - (Number(stats.high_position_count) || 0)), Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>High Position Rate</td>
                  <td style={td}></td>
                  <td style={td}>{(Number(stats.high_position_rate) || 0).toFixed(2)}%</td>
                </tr>
                <tr>
                  <td style={td}>Government</td>
                  <td style={td}>{Number(stats.public_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.public_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Private</td>
                  <td style={td}>{Number(stats.private_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.private_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Local</td>
                  <td style={td}>{Number(stats.local_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.local_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>International</td>
                  <td style={td}>{Number(stats.international_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.international_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Total Alumni</td>
                  <td style={td}>{Number(stats.total_alumni) || 0}</td>
                  <td style={td}>100%</td>
                </tr>
              </>
            )}
            {type === 'AACUP' && (
              <>
                <tr>
                  <td style={td}>Employed</td>
                  <td style={td}>{Number(stats.employed_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.employed_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Absorbed</td>
                  <td style={td}>{Number(stats.absorbed_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.absorbed_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>High Position</td>
                  <td style={td}>{Number(stats.high_position_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.high_position_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Employment Rate</td>
                  <td style={td}></td>
                  <td style={td}>{(Number(stats.employment_rate) || 0).toFixed(2)}%</td>
                </tr>
                <tr>
                  <td style={td}>Absorption Rate</td>
                  <td style={td}></td>
                  <td style={td}>{(Number(stats.absorption_rate) || 0).toFixed(2)}%</td>
                </tr>
                <tr>
                  <td style={td}>High Position Rate</td>
                  <td style={td}></td>
                  <td style={td}>{(Number(stats.high_position_rate) || 0).toFixed(2)}%</td>
                </tr>
                <tr>
                  <td style={td}>Total Alumni</td>
                  <td style={td}>{Number(stats.total_alumni) || 0}</td>
                  <td style={td}>100%</td>
                </tr>
              </>
            )}
            {type === 'HIGH_POSITION' && (
              <>
                <tr>
                  <td style={td}>High Position Alumni</td>
                  <td style={td}>{stats.high_position_count}</td>
                  <td style={td}>{pct(stats.high_position_count, stats.total_alumni)}</td>
                </tr>
                <tr>
                  <td style={td}>High Position Rate</td>
                  <td style={td}></td>
                  <td style={td}>{stats.high_position_rate}%</td>
                </tr>
                <tr>
                  <td style={td}>Total Alumni</td>
                  <td style={td}>{stats.total_alumni}</td>
                  <td style={td}>{pct(stats.total_alumni, stats.total_alumni)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={modalOverlay} onClick={handleClose}>
      <div style={modalContent} onClick={(e) => e.stopPropagation()}>
        <button style={closeButton} onClick={handleClose}>
          &times;
        </button>
        <h2 style={modalTitle}>Generate Statistics</h2>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={dropdown}
            >
              <option value="ALL">All Years</option>
              {availableYears.map((year) => (
                <option key={year.year} value={year.year}>
                  {year.year} ({year.count} alumni)
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Program:</label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              style={dropdown}
            >
              {courseOptions.map((course) => (
                <option key={course} value={course}>
                  {course === 'ALL' ? 'All Programs' : course}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Statistics Report:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as StatsType)}
              style={dropdown}
            >
              {typeOptions.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <button
            style={{...exportButton, backgroundColor: '#28a745', marginRight: '8px'}}
            onClick={() => handleExportCompleteData('excel')}
            disabled={exporting || loading}
            title="Export data to Excel format"
          >
            {exporting ? '⏳ Exporting...' : '📊 Export Excel'}
          </button>
          <button
            style={{...exportButton, backgroundColor: '#dc3545', marginRight: '8px'}}
            onClick={() => handleExportCompleteData('pdf')}
            disabled={exporting || loading}
            title="Export data to PDF format"
          >
            {exporting ? '⏳ Exporting...' : '📄 Export PDF'}
          </button>
          <button
            style={{...exportButton, backgroundColor: '#0d6efd', marginRight: '8px'}}
            onClick={() => handleExportCompleteData('word')}
            disabled={exporting || loading}
            title="Export data to Word format"
          >
            {exporting ? '⏳ Exporting...' : '📝 Export Word'}
          </button>
          <button
            style={generateButton}
            onClick={handleGenerate}
            disabled={loading}
          >
            Generate
          </button>
        </div>

        {allStats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            marginBottom: 24,
          }}>
            {['QPRO', 'CHED', 'SUC', 'AACUP'].map((type) =>
              allStats[type] ? (
                <div key={type}>{renderSummarySection(type, allStats[type])}</div>
              ) : null
            )}
          </div>
        )}
        {generatedStats && !allStats && renderSummarySection(generatedStats.type, generatedStats)}

        {/* Hidden chart containers for image generation */}
        {chartData && (
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <div
              ref={barChartRef}
              style={{ width: '400px', height: '300px', backgroundColor: 'white', padding: '20px' }}
            >
              <h4>Bar Chart</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData.barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7161EF" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div
              ref={pieChartRef}
              style={{ width: '400px', height: '300px', backgroundColor: 'white', padding: '20px' }}
            >
              <h4>Pie Chart</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData.pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const { name, percent } = props;
                      return `${name} ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const modalOverlay: React.CSSProperties = {
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
};

const modalContent: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '30px',
  borderRadius: '15px',
  minWidth: '600px',
  maxWidth: '900px',
  position: 'relative',
  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  maxHeight: '80vh', // Add this line
  overflowY: 'auto', // Add this line
};

const closeButton: React.CSSProperties = {
  position: 'absolute',
  top: '15px',
  right: '20px',
  background: 'none',
  border: 'none',
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#666',
  cursor: 'pointer',
  lineHeight: '1',
};

const modalTitle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 'bold',
  textAlign: 'center',
  marginBottom: '25px',
  color: '#1D4E89',
};

const formGroup: React.CSSProperties = {
  marginBottom: '20px',
};

const label: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontWeight: '600',
  color: '#333',
  fontSize: '14px',
};

const dropdown: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '14px',
  backgroundColor: 'white',
};

const statsPreview: React.CSSProperties = {
  marginTop: '20px',
  padding: '15px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  border: '1px solid #e9ecef',
};

const statsTitle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '15px',
  color: '#333',
};

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '10px',
};

const chartsContainer: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px',
  marginTop: '20px',
};

const chartSection: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '15px',
  borderRadius: '8px',
  border: '1px solid #e9ecef',
};

const chartTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  marginBottom: '10px',
  color: '#333',
  textAlign: 'center',
};

const chartWrapper: React.CSSProperties = {
  width: '100%',
  height: '200px',
};

const statCard: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '12px',
  borderRadius: '6px',
  textAlign: 'center',
  border: '1px solid #dee2e6',
};

const statLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#666',
  marginBottom: '4px',
};

const statValue: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1D4E89',
};

const buttonGroup: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '25px',
};

const cancelButton: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#6c757d',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: '500',
  fontSize: '14px',
};

const exportButton: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#28a745',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: '500',
  fontSize: '14px',
};

const generateButton: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#1D4E89',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: '500',
  fontSize: '14px',
};

const td = { padding: 8, border: '1px solid #dee2e6', textAlign: 'center' as const };

export default GenerateStatsModal;

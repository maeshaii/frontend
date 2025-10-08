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
    'Course',
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
      safe(row['Course']),
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

  const addQPRODetailedSheet = (workbook: ExcelJS.Workbook, rows: any[], sheetName = 'QPRO Detailed Alumni Data') => {
    const detail = workbook.addWorksheet(sheetName);
    detail.addRow(qproHeaders);
    const mapped = (rows || []).map(mapQPRORow);
    mapped
      .sort((a, b) => ((a[4] !== 'Not Tracked') === (b[4] !== 'Not Tracked') ? 0 : a[4] !== 'Not Tracked' ? -1 : 1))
      .forEach((vals) => detail.addRow(vals));
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
          const isQproHeader = c1 === 'Course' && c2 === 'First_Name' && c3 === 'Middle_Name';
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
        Course: 14,
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
          if (c1 === 'Course' && c2 === 'First_Name' && c3 === 'Middle_Name') {
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
  const headersHighPosition = ['Course','First_Name','Middle_Name','Last_Name','Company_Name_Current','Position_Current'];
  const mapHighPositionRow = (alumnusOrRow: any) => {
    // Supports both high_position_data shape and detailed row shape
    const course = alumnusOrRow.course || alumnusOrRow['Course'] || '';
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
          createElement(Bar, { dataKey: 'value', fill: '#1D4E89' })
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

  const handleExportCompleteData = async () => {
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

      // Create a new Excel workbook and worksheet
      const workbook = new ExcelJS.Workbook();

      // If exporting only QPRO, produce a single-tab workbook with summary + details (no charts)
      if (!allStats && generatedStats?.type === 'QPRO') {
        const sheet = workbook.addWorksheet('QPRO Report');
        let r = 1;
        sheet.getCell(`A${r}`).value = 'QPRO Complete Statistics Report'; r++;
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString(); r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL'; r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL'; r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage'; r++;
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
        sheet.addRow(qproHeaders); r++;
        const mapped = (detailedDataByType['QPRO'] || []).map(mapQPRORow)
          .sort((a, b) => ((a[4] !== 'Not Tracked') === (b[4] !== 'Not Tracked') ? 0 : a[4] !== 'Not Tracked' ? -1 : 1));
        mapped.forEach((vals) => { sheet.addRow(vals); r++; });

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
        let r = 1;
        sheet.getCell(`A${r}`).value = 'CHED Complete Statistics Report'; r++;
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString(); r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL'; r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL'; r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage'; r++;
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
        sheet.addRow(qproHeaders); r++;
        const mapped = (detailedDataByType['CHED'] || []).map(mapQPRORow)
          .sort((a, b) => ((a[4] !== 'Not Tracked') === (b[4] !== 'Not Tracked') ? 0 : a[4] !== 'Not Tracked' ? -1 : 1));
        mapped.forEach((vals) => { sheet.addRow(vals); r++; });

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
        let r = 1;
        sheet.getCell(`A${r}`).value = 'AACUP Complete Statistics Report'; r++;
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString(); r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL'; r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL'; r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage'; r++;
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
        sheet.addRow(qproHeaders); r++;
        const mapped2 = (detailedDataByType['AACUP'] || []).map(mapQPRORow)
          .sort((a, b) => ((a[4] !== 'Not Tracked') === (b[4] !== 'Not Tracked') ? 0 : a[4] !== 'Not Tracked' ? -1 : 1));
        mapped2.forEach((vals) => { sheet.addRow(vals); r++; });

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
        let r = 1;
        sheet.getCell(`A${r}`).value = 'HIGH POSITION Complete Statistics Report'; r++;
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString(); r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL'; r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL'; r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage'; r++;
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
        const headersHP = ['Course','First_Name','Middle_Name','Last_Name','Company_Name_Current','Position_Current'];
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
                row['Course'] || '',
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
        let r = 1;
        sheet.getCell(`A${r}`).value = 'SUC Complete Statistics Report'; r++;
        sheet.getCell(`A${r}`).value = 'Generated Date'; sheet.getCell(`B${r}`).value = new Date().toLocaleDateString(); r++;
        sheet.getCell(`A${r}`).value = 'Year Filter'; sheet.getCell(`B${r}`).value = selectedYear || 'ALL'; r++;
        sheet.getCell(`A${r}`).value = 'Program Filter'; sheet.getCell(`B${r}`).value = selectedProgram || 'ALL'; r += 2;
        sheet.getCell(`A${r}`).value = '=== SUMMARY STATISTICS ==='; r++;
        sheet.getCell(`A${r}`).value = 'Metric'; sheet.getCell(`B${r}`).value = 'Value'; sheet.getCell(`C${r}`).value = 'Percentage'; r++;
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
        sheet.addRow(qproHeaders); r++;
        const mapped = (detailedDataByType['SUC'] || []).map(mapQPRORow)
          .sort((a, b) => ((a[4] !== 'Not Tracked') === (b[4] !== 'Not Tracked') ? 0 : a[4] !== 'Not Tracked' ? -1 : 1));
        mapped.forEach((vals) => { sheet.addRow(vals); r++; });

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
        worksheet.getCell(`A${rowIdx}`).value = `All Complete Statistics Report`;
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Generated Date`;
        worksheet.getCell(`B${rowIdx}`).value = new Date().toLocaleDateString();
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Year Filter`;
        worksheet.getCell(`B${rowIdx}`).value = selectedYear || 'All';
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Program Filter`;
        worksheet.getCell(`B${rowIdx}`).value = selectedProgram || 'All';
        rowIdx += 2;
        for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
          const stats = statsByType[type];
          if (!stats) {
            console.warn(`No stats found for type: ${type}`);
            continue;
          }
          worksheet.getCell(`A${rowIdx}`).value = `${type} Statistics`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Metric';
          worksheet.getCell(`B${rowIdx}`).value = 'Value';
          worksheet.getCell(`C${rowIdx}`).value = 'Percentage';
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
              worksheet.getCell(`F${rowIdx}`).value = 'Course';
              worksheet.getCell(`G${rowIdx}`).value = 'Year Graduated';
              worksheet.getCell(`H${rowIdx}`).value = 'Email';
              worksheet.getCell(`I${rowIdx}`).value = 'Phone';
              worksheet.getCell(`J${rowIdx}`).value = 'Address';
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
              worksheet.addRow(headersHighPosition); rowIdx++;
              mappedHP.forEach((vals: (string | number)[]) => { worksheet.addRow(vals); rowIdx++; });
              // Excel sheet names must be <= 31 chars; use a concise, clear name
              const detailSheet = workbook.addWorksheet('High Position Details');
              detailSheet.addRow(headersHighPosition);
              mappedHP.forEach((vals: (string | number)[]) => detailSheet.addRow(vals));
              autoSizeAndWrapSheet(detailSheet);
            } else {
              const mapped = rows.map(mapQPRORow)
                .sort((a, b) => ((a[4] !== 'Not Tracked') === (b[4] !== 'Not Tracked') ? 0 : a[4] !== 'Not Tracked' ? -1 : 1));
              worksheet.addRow(qproHeaders); rowIdx++;
              mapped.forEach((vals) => { worksheet.addRow(vals); rowIdx++; });
              const detailSheet = workbook.addWorksheet(`${type} Detailed Alumni Data`);
              detailSheet.addRow(qproHeaders);
              mapped.forEach((vals) => detailSheet.addRow(vals));
              autoSizeAndWrapSheet(detailSheet);
            }
          }
        }
      } else {
        worksheet.getCell(`A${rowIdx}`).value =
          `${generatedStats?.type || 'All'} Complete Statistics Report`;
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Generated Date`;
        worksheet.getCell(`B${rowIdx}`).value = new Date().toLocaleDateString();
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Year Filter`;
        worksheet.getCell(`B${rowIdx}`).value = generatedStats?.year || 'All';
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Program Filter`;
        worksheet.getCell(`B${rowIdx}`).value = generatedStats?.course || 'All';
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
            <label style={label}>Course:</label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              style={dropdown}
            >
              {courseOptions.map((course) => (
                <option key={course} value={course}>
                  {course === 'ALL' ? 'All Courses' : course}
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
            style={exportButton}
            onClick={handleExportCompleteData}
            disabled={exporting || loading}
          >
            Export Complete Report
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
                  <Bar dataKey="value" fill="#1D4E89" />
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
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
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

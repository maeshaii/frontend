// components/GenerateStatsModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { fetchAlumniStatistics, fetchAlumniEmploymentStats, generateSpecificStats, exportDetailedAlumniData } from '../services/api';
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
  Legend
} from 'recharts';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';

interface Props {
  onClose: () => void;
  onGenerate?: (data: any) => void;
}

const GenerateStatsModal: React.FC<Props> = ({ onClose, onGenerate }) => {
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [availableYears, setAvailableYears] = useState<{ year: number; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedStats, setGeneratedStats] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [allStats, setAllStats] = useState<any | null>(null);
  const [detailedData, setDetailedData] = useState<Record<string, any[]> | null>(null);
  const [detailedLoading, setDetailedLoading] = useState<Record<string, boolean>>({});
  const [currentChartSection, setCurrentChartSection] = useState<string>('');
  
  // Refs for chart containers
  const barChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);

  const courseOptions = ['ALL', 'BSIT', 'BSIS', 'BIT-CT'];
  const typeOptions = [
    { value: 'ALL', label: 'All Statistics' },
    { value: 'QPRO', label: 'QPRO Statistics' },
    { value: 'CHED', label: 'CHED Statistics' },
    { value: 'SUC', label: 'SUC Statistics' },
    { value: 'AACUP', label: 'AACUP Statistics' }
  ];

  // Color schemes for charts
  const chartColors = {
    primary: ['#1D4E89', '#4f46e5', '#28a745', '#ffc107', '#dc3545'],
    secondary: ['#6c757d', '#17a2b8', '#20c997', '#fd7e14', '#e83e8c'],
    qpro: ['#28a745', '#dc3545', '#6c757d'],
    ched: ['#17a2b8', '#6c757d', '#28a745'],
    suc: ['#1D4E89', '#6c757d', '#ffc107'],
    aacup: ['#28a745', '#17a2b8', '#1D4E89', '#6c757d']
  };

  useEffect(() => {
    const loadYears = async () => {
      try {
        const data = await fetchAlumniStatistics();
        setAvailableYears(data.years || []);
      } catch (error) {
        console.error('Error loading years:', error);
        setAvailableYears([]);
      }
    };
    loadYears();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setAllStats(null);
    setDetailedData(null);
    setDetailedLoading({});
    try {
      if (selectedType === 'ALL') {
        // Fetch all four types in parallel
        const [qpro, ched, suc, aacup] = await Promise.all([
          generateSpecificStats(selectedYear, selectedCourse, 'QPRO'),
          generateSpecificStats(selectedYear, selectedCourse, 'CHED'),
          generateSpecificStats(selectedYear, selectedCourse, 'SUC'),
          generateSpecificStats(selectedYear, selectedCourse, 'AACUP'),
        ]);
        setAllStats({ QPRO: qpro, CHED: ched, SUC: suc, AACUP: aacup });
        setGeneratedStats(null);
        if (onGenerate) onGenerate({ QPRO: qpro, CHED: ched, SUC: suc, AACUP: aacup });
        // Show a proper success message for ALL
        alert('Successfully generated all statistics for all alumni.');
        // Fetch detailed data for all
        ['QPRO', 'CHED', 'SUC', 'AACUP'].forEach(async (type) => {
          setDetailedLoading((prev) => ({ ...prev, [type]: true }));
          try {
            const res = await exportDetailedAlumniData(selectedYear, selectedCourse, type);
            setDetailedData((prev) => ({ ...(prev || {}), [type]: res.detailed_data || [] }));
          } finally {
            setDetailedLoading((prev) => ({ ...prev, [type]: false }));
          }
        });
      } else {
        const stats = await generateSpecificStats(selectedYear, selectedCourse, selectedType);
        setGeneratedStats(stats);
        setAllStats(null);
        if (onGenerate) onGenerate(stats);
        // Show a proper success message for single type
        alert(`Successfully generated ${stats.type || selectedType} statistics for ${stats.total_alumni || 'selected'} alumni.`);
        // Fetch detailed data for the selected type
        setDetailedLoading({ [selectedType]: true });
        try {
          const res = await exportDetailedAlumniData(selectedYear, selectedCourse, selectedType);
          setDetailedData({ [selectedType]: res.detailed_data || [] });
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
      { name: 'Unemployed', value: stats.unemployed_count, fill: chartColors.qpro[1] }
    ];
    
    const pieData = [
      { name: 'Employed', value: stats.employed_count, fill: chartColors.qpro[0] },
      { name: 'Unemployed', value: stats.unemployed_count, fill: chartColors.qpro[1] }
    ];
    
    return { barData, pieData };
  };

  const prepareCHEDChartData = (stats: any) => {
    const barData = [
      { name: 'Pursuing Further Study', value: stats.pursuing_further_study, fill: chartColors.ched[0] },
      { name: 'Post Graduate Degree', value: stats.post_graduate_degree, fill: chartColors.ched[1] },
      { name: 'Not Pursuing', value: stats.total_alumni - stats.pursuing_further_study, fill: chartColors.ched[2] }
    ];
    
    const pieData = [
      { name: 'Pursuing Further Study', value: stats.pursuing_further_study, fill: chartColors.ched[0] },
      { name: 'Post Graduate Degree', value: stats.post_graduate_degree, fill: chartColors.ched[1] },
      { name: 'Not Pursuing', value: stats.total_alumni - stats.pursuing_further_study, fill: chartColors.ched[2] }
    ];
    
    return { barData, pieData };
  };

  const prepareSUCChartData = (stats: any) => {
    const barData = [
      { name: 'High Position', value: stats.high_position_count, fill: chartColors.suc[0] },
      { name: 'Other Positions', value: stats.total_alumni - stats.high_position_count, fill: chartColors.suc[1] }
    ];
    
    const pieData = [
      { name: 'High Position', value: stats.high_position_count, fill: chartColors.suc[0] },
      { name: 'Other Positions', value: stats.total_alumni - stats.high_position_count, fill: chartColors.suc[1] }
    ];
    
    return { barData, pieData };
  };

  const prepareAACUPChartData = (stats: any) => {
    const barData = [
      { name: 'Employed', value: stats.employed_count, fill: chartColors.aacup[0] },
      { name: 'Absorbed', value: stats.absorbed_count, fill: chartColors.aacup[1] },
      { name: 'High Position', value: stats.high_position_count, fill: chartColors.aacup[2] },
      { name: 'Others', value: stats.total_alumni - stats.employed_count - stats.absorbed_count - stats.high_position_count, fill: chartColors.aacup[3] }
    ];
    
    const pieData = [
      { name: 'Employed', value: stats.employed_count, fill: chartColors.aacup[0] },
      { name: 'Absorbed', value: stats.absorbed_count, fill: chartColors.aacup[1] },
      { name: 'High Position', value: stats.high_position_count, fill: chartColors.aacup[2] },
      { name: 'Others', value: stats.total_alumni - stats.employed_count - stats.absorbed_count - stats.high_position_count, fill: chartColors.aacup[3] }
    ];
    
    return { barData, pieData };
  };

  const prepareALLChartData = (stats: any) => {
    const statusEntries = Object.entries(stats.status_counts || {});
    const barData = statusEntries.map(([status, count], index) => ({
      name: status,
      value: count as number,
      fill: chartColors.primary[index % chartColors.primary.length]
    }));
    
    const pieData = statusEntries.map(([status, count], index) => ({
      name: status,
      value: count as number,
      fill: chartColors.primary[index % chartColors.primary.length]
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
          allowTaint: true
        });
        images.barChart = canvas.toDataURL('image/png');
      }
      
      // Generate pie chart image
      if (pieChartRef.current) {
        const canvas = await html2canvas(pieChartRef.current, {
          background: 'white',
          useCORS: true,
          allowTaint: true
        });
        images.pieChart = canvas.toDataURL('image/png');
      }
    } catch (error) {
      console.error('Error generating chart images:', error);
    }
    
    return images;
  };

  // Add this helper function before handleExportCompleteData
  const renderAndCaptureChartImages = async (sectionType: string, stats: any): Promise<{ barChart?: string; pieChart?: string }> => {
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

    // Use ReactDOM to render charts
    const { createElement } = require('react');
    const { render, unmountComponentAtNode } = require('react-dom');
    render(
      createElement(ResponsiveContainer, { width: '100%', height: 200 },
        createElement(BarChart, { data: chartData.barData },
          createElement(CartesianGrid, { strokeDasharray: '3 3' }),
          createElement(XAxis, { dataKey: 'name' }),
          createElement(YAxis),
          createElement(Tooltip),
          createElement(Bar, { dataKey: 'value', fill: '#1D4E89' })
        )
      ),
      barDiv
    );
    render(
      createElement(ResponsiveContainer, { width: '100%', height: 200 },
        createElement(PieChart, null,
          createElement(Pie, {
            data: chartData.pieData,
            cx: '50%',
            cy: '50%',
            labelLine: false,
            label: ({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`,
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
      ),
      pieDiv
    );

    // Wait for charts to render
    await new Promise(resolve => setTimeout(resolve, 200));

    // Capture images
    const images: { barChart?: string; pieChart?: string } = {};
    try {
      const barCanvas = await html2canvas(barDiv, { background: 'white', useCORS: true, allowTaint: true });
      images.barChart = barCanvas.toDataURL('image/png');
      const pieCanvas = await html2canvas(pieDiv, { background: 'white', useCORS: true, allowTaint: true });
      images.pieChart = pieCanvas.toDataURL('image/png');
    } catch (e) {
      // ignore
    }

    // Clean up
    unmountComponentAtNode(barDiv);
    unmountComponentAtNode(pieDiv);
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
        for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP']) {
          const res = await exportDetailedAlumniData(selectedYear, selectedCourse, type);
          detailedDataByType[type] = res.detailed_data || [];
          statsByType[type] = allStats[type];
        }
      } else {
        const res = await exportDetailedAlumniData(selectedYear, selectedCourse, generatedStats.type);
        detailedDataByType[generatedStats.type] = res.detailed_data || [];
        statsByType[generatedStats.type] = generatedStats;
      }

      // Create a new Excel workbook and worksheet
      const workbook = new ExcelJS.Workbook();
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
        worksheet.getCell(`A${rowIdx}`).value = `Course Filter`;
        worksheet.getCell(`B${rowIdx}`).value = selectedCourse || 'All';
        rowIdx += 2;
        for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP']) {
          const stats = statsByType[type];
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
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.employed_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Unemployed Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.unemployed_count;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.unemployed_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Unemployment Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${((stats.unemployed_count / stats.total_alumni) * 100).toFixed(2)}%`;
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
            worksheet.getCell(`C${rowIdx}`).value = `${stats.further_study_rate}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Post Graduate Degree Holders';
            worksheet.getCell(`B${rowIdx}`).value = stats.post_graduate_degree;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.post_graduate_degree / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Further Study Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${stats.further_study_rate}%`;
            worksheet.getCell(`C${rowIdx}`).value = `${stats.further_study_rate}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Not Pursuing Further Study';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni - stats.pursuing_further_study;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.total_alumni - stats.pursuing_further_study) / stats.total_alumni * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Academic Advancement Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${stats.further_study_rate}%`;
            rowIdx++;
          } else if (stats?.type === 'SUC') {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'High Position Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.high_position_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Other Positions';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni - stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.total_alumni - stats.high_position_count) / stats.total_alumni * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Leadership Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${((stats.high_position_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
          } else if (stats?.type === 'AACUP') {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Employed Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.employed_count;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.employed_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Absorbed Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.absorbed_count;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.absorbed_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'High Position Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.high_position_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Others';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni - stats.employed_count - stats.absorbed_count - stats.high_position_count;
            worksheet.getCell(`C${rowIdx}`).value = `${((stats.total_alumni - stats.employed_count - stats.absorbed_count - stats.high_position_count) / stats.total_alumni * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Employment Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${((stats.employed_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Absorption Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${((stats.absorbed_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Leadership Rate';
            worksheet.getCell(`B${rowIdx}`).value = `${((stats.high_position_count / stats.total_alumni) * 100).toFixed(2)}%`;
            rowIdx++;
          } else {
            worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
            worksheet.getCell(`B${rowIdx}`).value = stats.total_alumni;
            worksheet.getCell(`C${rowIdx}`).value = '100%';
            rowIdx++;
            Object.entries(stats.status_counts || {}).forEach(([status, count]) => {
              worksheet.getCell(`A${rowIdx}`).value = status;
              worksheet.getCell(`B${rowIdx}`).value = count as number;
              worksheet.getCell(`C${rowIdx}`).value = `${((count as number) / stats.total_alumni * 100).toFixed(2)}%`;
              rowIdx++;
            });
          }
          rowIdx++;
          // Generate chart images for this section using the robust method
          const chartImagesForType: { barChart?: string; pieChart?: string } = await renderAndCaptureChartImages(type, stats);
          worksheet.getCell(`A${rowIdx}`).value = '=== CHART IMAGES ===';
          rowIdx++;
          if (chartImagesForType.barChart) {
            const barImgId = workbook.addImage({ base64: chartImagesForType.barChart, extension: 'png' });
            worksheet.addImage(barImgId, { tl: { col: 0, row: rowIdx }, ext: { width: 500, height: 300 } });
            rowIdx += 18; // Add more space after bar chart
          }
          if (chartImagesForType.pieChart) {
            const pieImgId = workbook.addImage({ base64: chartImagesForType.pieChart, extension: 'png' });
            worksheet.addImage(pieImgId, { tl: { col: 0, row: rowIdx }, ext: { width: 500, height: 300 } });
            rowIdx += 18; // Add more space after pie chart
          }
          // Add extra buffer rows to prevent overlap
          rowIdx += 3;
          rowIdx = worksheet.lastRow ? Math.max(worksheet.lastRow.number + 2, rowIdx) : rowIdx + 2;
          // Add detailed data for this section (same as ALL export)
          let lastHeader: string[] | null = null;
          const rows = detailedDataByType[type] as any[];
          if (Array.isArray(rows) && rows.length > 0) {
            // Determine which columns are non-empty for at least one row
            const currentHeader = Object.keys(rows[0]);
            const nonEmptyColumns = currentHeader.filter((key) => rows.some((row) => row[key] !== '' && row[key] !== null && row[key] !== undefined));
            worksheet.getCell(`A${rowIdx}`).value = `${type} Detailed Alumni Data`;
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
            const detailSheet = workbook.addWorksheet(`${type} Detailed Alumni Data`);
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
          }
        }
      } else {
        worksheet.getCell(`A${rowIdx}`).value = `${generatedStats?.type || 'All'} Complete Statistics Report`;
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Generated Date`;
        worksheet.getCell(`B${rowIdx}`).value = new Date().toLocaleDateString();
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Year Filter`;
        worksheet.getCell(`B${rowIdx}`).value = generatedStats?.year || 'All';
        rowIdx++;
        worksheet.getCell(`A${rowIdx}`).value = `Course Filter`;
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
          worksheet.getCell(`B${rowIdx}`).value = `${generatedStats.employment_rate}%`;
          worksheet.getCell(`C${rowIdx}`).value = `${generatedStats.employment_rate}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employed Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.employed_count;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.employed_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Unemployed Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.unemployed_count;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.unemployed_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Unemployment Rate';
          worksheet.getCell(`B${rowIdx}`).value = `${((generatedStats.unemployed_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employment Success Rate';
          worksheet.getCell(`B${rowIdx}`).value = `${generatedStats.employment_rate}%`;
          rowIdx++;
        } else if (generatedStats?.type === 'CHED') {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Pursuing Further Study';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.pursuing_further_study;
          worksheet.getCell(`C${rowIdx}`).value = `${generatedStats.further_study_rate}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Post Graduate Degree Holders';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.post_graduate_degree;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.post_graduate_degree / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Further Study Rate';
          worksheet.getCell(`B${rowIdx}`).value = `${generatedStats.further_study_rate}%`;
          worksheet.getCell(`C${rowIdx}`).value = `${generatedStats.further_study_rate}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Not Pursuing Further Study';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni - generatedStats.pursuing_further_study;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.total_alumni - generatedStats.pursuing_further_study) / generatedStats.total_alumni * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Academic Advancement Rate';
          worksheet.getCell(`B${rowIdx}`).value = `${generatedStats.further_study_rate}%`;
          rowIdx++;
        } else if (generatedStats?.type === 'SUC') {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'High Position Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.high_position_count;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.high_position_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Other Positions';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni - generatedStats.high_position_count;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.total_alumni - generatedStats.high_position_count) / generatedStats.total_alumni * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Leadership Rate';
          worksheet.getCell(`B${rowIdx}`).value = `${((generatedStats.high_position_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
        } else if (generatedStats?.type === 'AACUP') {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employed Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.employed_count;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.employed_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Absorbed Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.absorbed_count;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.absorbed_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'High Position Count';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.high_position_count;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.high_position_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Others';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni - generatedStats.employed_count - generatedStats.absorbed_count - generatedStats.high_position_count;
          worksheet.getCell(`C${rowIdx}`).value = `${((generatedStats.total_alumni - generatedStats.employed_count - generatedStats.absorbed_count - generatedStats.high_position_count) / generatedStats.total_alumni * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Employment Rate';
          worksheet.getCell(`B${rowIdx}`).value = `${((generatedStats.employed_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Absorption Rate';
          worksheet.getCell(`B${rowIdx}`).value = `${((generatedStats.absorbed_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Leadership Rate';
          worksheet.getCell(`B${rowIdx}`).value = `${((generatedStats.high_position_count / generatedStats.total_alumni) * 100).toFixed(2)}%`;
          rowIdx++;
        } else {
          worksheet.getCell(`A${rowIdx}`).value = 'Total Alumni';
          worksheet.getCell(`B${rowIdx}`).value = generatedStats.total_alumni;
          worksheet.getCell(`C${rowIdx}`).value = '100%';
          rowIdx++;
          Object.entries(generatedStats.status_counts || {}).forEach(([status, count]) => {
            worksheet.getCell(`A${rowIdx}`).value = status;
            worksheet.getCell(`B${rowIdx}`).value = count as number;
            worksheet.getCell(`C${rowIdx}`).value = `${((count as number) / generatedStats.total_alumni * 100).toFixed(2)}%`;
            rowIdx++;
          });
        }
        rowIdx++;
        // Generate chart images for this section using the robust method
        const chartImages: { barChart?: string; pieChart?: string } = await renderAndCaptureChartImages(generatedStats.type, generatedStats);
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
        rowIdx += 3;
        rowIdx = worksheet.lastRow ? Math.max(worksheet.lastRow.number + 2, rowIdx) : rowIdx + 2;
        // Add detailed data for this section (same as ALL export)
        let lastHeader: string[] | null = null;
        const rows = detailedDataByType[generatedStats.type] as any[];
        if (Array.isArray(rows) && rows.length > 0) {
          // Determine which columns are non-empty for at least one row
          const currentHeader = Object.keys(rows[0]);
          const nonEmptyColumns = currentHeader.filter((key) => rows.some((row) => row[key] !== '' && row[key] !== null && row[key] !== undefined));
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
          const detailSheet = workbook.addWorksheet(`${generatedStats.type} Detailed Alumni Data`);
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
        }
      }

      // Download the Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${allStats ? 'All' : (generatedStats?.type || 'All')}_Complete_Report_${selectedYear}_${selectedCourse}.xlsx`;
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
    return (
      <div style={{ marginBottom: 32, padding: 16, background: '#f8f9fa', borderRadius: 8, border: '1px solid #e9ecef' }}>
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
                <tr><td style={td}>Total Alumni</td><td style={td}>{stats.total_alumni}</td><td style={td}>100%</td></tr>
                <tr><td style={td}>Employed</td><td style={td}>{stats.employed_count}</td><td style={td}>{((stats.employed_count / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>Unemployed</td><td style={td}>{stats.unemployed_count}</td><td style={td}>{((stats.unemployed_count / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>Employment Rate</td><td style={td}>{stats.employment_rate}%</td><td style={td}></td></tr>
              </>
            )}
            {type === 'CHED' && (
              <>
                <tr><td style={td}>Total Alumni</td><td style={td}>{stats.total_alumni}</td><td style={td}>100%</td></tr>
                <tr><td style={td}>Pursuing Further Study</td><td style={td}>{stats.pursuing_further_study}</td><td style={td}>{((stats.pursuing_further_study / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>Post Graduate Degree</td><td style={td}>{stats.post_graduate_degree}</td><td style={td}>{((stats.post_graduate_degree / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>Further Study Rate</td><td style={td}>{stats.further_study_rate}%</td><td style={td}></td></tr>
              </>
            )}
            {type === 'SUC' && (
              <>
                <tr><td style={td}>Total Alumni</td><td style={td}>{stats.total_alumni}</td><td style={td}>100%</td></tr>
                <tr><td style={td}>High Position</td><td style={td}>{stats.high_position_count}</td><td style={td}>{((stats.high_position_count / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>Other Positions</td><td style={td}>{stats.total_alumni - stats.high_position_count}</td><td style={td}>{(((stats.total_alumni - stats.high_position_count) / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>Average Salary</td><td style={td}>{stats.average_salary}</td><td style={td}></td></tr>
              </>
            )}
            {type === 'AACUP' && (
              <>
                <tr><td style={td}>Total Alumni</td><td style={td}>{stats.total_alumni}</td><td style={td}>100%</td></tr>
                <tr><td style={td}>Employed</td><td style={td}>{stats.employed_count}</td><td style={td}>{((stats.employed_count / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>Absorbed</td><td style={td}>{stats.absorbed_count}</td><td style={td}>{((stats.absorbed_count / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>High Position</td><td style={td}>{stats.high_position_count}</td><td style={td}>{((stats.high_position_count / stats.total_alumni) * 100).toFixed(2)}%</td></tr>
                <tr><td style={td}>Employment Rate</td><td style={td}>{stats.employment_rate}%</td><td style={td}></td></tr>
                <tr><td style={td}>Absorption Rate</td><td style={td}>{stats.absorption_rate}%</td><td style={td}></td></tr>
                <tr><td style={td}>High Position Rate</td><td style={td}>{stats.high_position_rate}%</td><td style={td}></td></tr>
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
        <button style={closeButton} onClick={handleClose}>&times;</button>
        <h2 style={modalTitle}>Generate Statistics</h2>
        
        <div style={formGroup}>
          <label style={label}>Year:</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            style={dropdown}
          >
            <option value="ALL">All Years</option>
            {availableYears.map(year => (
              <option key={year.year} value={year.year}>
                {year.year} ({year.count} alumni)
              </option>
            ))}
          </select>
        </div>

        <div style={formGroup}>
          <label style={label}>Course:</label>
          <select 
            value={selectedCourse} 
            onChange={(e) => setSelectedCourse(e.target.value)}
            style={dropdown}
          >
            {courseOptions.map(course => (
              <option key={course} value={course}>
                {course === 'ALL' ? 'All Courses' : course}
              </option>
            ))}
          </select>
        </div>

        <div style={formGroup}>
          <label style={label}>Statistics Type:</label>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            style={dropdown}
          >
            {typeOptions.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {allStats && (
          <div>
            {['QPRO', 'CHED', 'SUC', 'AACUP'].map((type) =>
              allStats[type] ? renderSummarySection(type, allStats[type]) : null
            )}
          </div>
        )}
        {generatedStats && !allStats && (
          renderSummarySection(generatedStats.type, generatedStats)
        )}

        {/* Hidden chart containers for image generation */}
        {chartData && (
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <div ref={barChartRef} style={{ width: '400px', height: '300px', backgroundColor: 'white', padding: '20px' }}>
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
            
            <div ref={pieChartRef} style={{ width: '400px', height: '300px', backgroundColor: 'white', padding: '20px' }}>
              <h4>Pie Chart</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData.pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
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

        <div style={buttonGroup}>
          <button 
            onClick={handleClose} 
            style={cancelButton}
          >
            Cancel
          </button>
          {(generatedStats || allStats) && (
            <button 
              onClick={handleExportCompleteData} 
              style={exportButton}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export Complete Report'}
            </button>
          )}
          <button 
            onClick={handleGenerate} 
            style={generateButton}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
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
  zIndex: 1000
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
  lineHeight: '1'
};

const modalTitle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 'bold',
  textAlign: 'center',
  marginBottom: '25px',
  color: '#1D4E89'
};

const formGroup: React.CSSProperties = {
  marginBottom: '20px'
};

const label: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontWeight: '600',
  color: '#333',
  fontSize: '14px'
};

const dropdown: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '14px',
  backgroundColor: 'white'
};

const statsPreview: React.CSSProperties = {
  marginTop: '20px',
  padding: '15px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  border: '1px solid #e9ecef'
};

const statsTitle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '15px',
  color: '#333'
};

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '10px'
};

const chartsContainer: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '20px',
  marginTop: '20px'
};

const chartSection: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '15px',
  borderRadius: '8px',
  border: '1px solid #e9ecef'
};

const chartTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  marginBottom: '10px',
  color: '#333',
  textAlign: 'center'
};

const chartWrapper: React.CSSProperties = {
  width: '100%',
  height: '200px'
};

const statCard: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '12px',
  borderRadius: '6px',
  textAlign: 'center',
  border: '1px solid #dee2e6'
};

const statLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#666',
  marginBottom: '4px'
};

const statValue: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1D4E89'
};

const buttonGroup: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '25px'
};

const cancelButton: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#6c757d',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: '500',
  fontSize: '14px'
};

const exportButton: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#28a745',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: '500',
  fontSize: '14px'
};



const generateButton: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#1D4E89',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: '500',
  fontSize: '14px'
};

const td = { padding: 8, border: '1px solid #dee2e6', textAlign: 'center' as const };

export default GenerateStatsModal;

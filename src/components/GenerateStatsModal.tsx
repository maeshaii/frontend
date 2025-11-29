// components/GenerateStatsModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  fetchAlumniEmploymentStats,
  generateSpecificStats,
  exportDetailedAlumniData,
} from '../services/api';
import { api } from '../services/api';
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
  const [reportSettings, setReportSettings] = useState<any>(null);
  
  // Track if filters changed and need to regenerate before exporting
  const [needsRegenerate, setNeedsRegenerate] = useState(true);
  
  // Toast notification state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  // Show toast notification that auto-dismisses after 3 seconds
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Add toast animation styles on mount
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Safe percent helper to avoid NaN when total is 0
  const pct = (part: number, total: number) => {
    const p = Number(part) || 0;
    const t = Number(total) || 0;
    return t > 0 ? `${((p / t) * 100).toFixed(2)}%` : '0.00%';
  };

  const toNumericValue = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const sanitized = Number(String(value).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(sanitized) ? sanitized : null;
  };

  const formatCurrency = (value: any) => {
    const numeric = toNumericValue(value);
    if (numeric === null) return 'N/A';
    try {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
      }).format(numeric);
    } catch (error) {
      console.warn('Currency format fallback triggered:', error);
      return `₱${numeric.toFixed(2)}`;
    }
  };

  // PDF-safe currency formatter (jsPDF cannot render ₱ symbol properly)
  const formatCurrencyForPDF = (value: any) => {
    const numeric = toNumericValue(value);
    if (numeric === null) return 'N/A';
    try {
      // Use basic number formatting with PHP prefix instead of ₱ symbol
      const formatted = new Intl.NumberFormat('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric);
      return `PHP ${formatted}`;
    } catch (error) {
      console.warn('Currency format fallback triggered:', error);
      return `PHP ${numeric.toFixed(2)}`;
    }
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

  // Helper to load image from URL or local path
  const loadImageOrUrl = async (imageUrl: string, fallback: string): Promise<string> => {
    try {
      // Check if imageUrl is already an absolute URL
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        return await getImageAsBase64(imageUrl);
      } else if (imageUrl && imageUrl.startsWith('/')) {
        // Relative URL from backend, prepend API base URL
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        return await getImageAsBase64(`${baseUrl}${imageUrl}`);
      } else if (imageUrl) {
        // Relative path, try with base URL
        return await getImageAsBase64(imageUrl);
      }
      return await getImageAsBase64(fallback);
    } catch (error) {
      console.error('Error loading image from URL or local:', error);
      return await getImageAsBase64(fallback);
    }
  };

  // Helper to convert hex color to RGB for PDF
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };

  // Helper to convert hex color to DOCX color format (RGB, no #)
  // Note: docx library expects RGB format (not BGR)
  const hexToDocxColor = (hex: string): string => {
    // Normalize hex: ensure it has # prefix for hexToRgb
    const normalizedHex = hex.startsWith('#') ? hex : `#${hex}`;
    const rgb = hexToRgb(normalizedHex);
    // Return RGB format (Red, Green, Blue) as uppercase hex without #
    // For #DC143C (RGB 220, 20, 60): returns DC143C
    return `${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`.toUpperCase();
  };

  // Helper to convert ARGB hex to RGB hex for DOCX shading
  // For docx shading, we need 6 digits (RGB), not 8 (ARGB)
  const argbToDocxShading = (argbHex: string): string => {
    // If it's already 6 digits, return as is
    if (argbHex.length === 6) return argbHex;
    // If it's 8 digits (ARGB), remove the alpha channel (first 2 chars)
    if (argbHex.length === 8) return argbHex.substring(2);
    // If it has # prefix and is 7 digits, remove #
    if (argbHex.startsWith('#') && argbHex.length === 7) return argbHex.substring(1);
    // If it has # prefix and is 9 digits (A#RRGGBB), remove # and alpha
    if (argbHex.startsWith('#') && argbHex.length === 9) return argbHex.substring(3);
    return argbHex;
  };

  // ========================================
  // PDF HEADER FUNCTION
  // ========================================
  // Utility function to add institutional header to PDF
  const addInstitutionalHeaderToPDF = async (doc: jsPDF, pageWidth: number) => {
    try {
      const settings = reportSettings || {};
      
      // Check if header is enabled
      if (settings.header_enabled === false) return;
      
      // Load images with fallbacks
      const leftLogoBase64 = settings.left_logo_enabled !== false 
        ? await loadImageOrUrl(settings.left_logo_url || '', ctuLogo)
        : '';
      const rightLogoBase64 = settings.right_logo_enabled !== false
        ? await loadImageOrUrl(settings.right_logo_url || '', bagongPilipinasLogo)
        : '';
      
      let yPosition = 15;
      
      // Create a proper 3-column layout like Word document
      // Left column: Logo
      if (leftLogoBase64) {
        doc.addImage(leftLogoBase64, 'PNG', 60, yPosition + 5, 35, 35);
      }
      
      // Right column: Logo
      if (rightLogoBase64) {
        doc.addImage(rightLogoBase64, 'PNG', pageWidth - 95, yPosition + 5, 35, 35);
      }

      // Center column: Institutional text
      const centerX = pageWidth / 2;
      
      // Line 1
      const line1 = settings.header_line1 || 'Republic of the Philippines';
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(line1, centerX, yPosition + 4, { align: 'center' });
      
      // Line 2 (CEBU TECHNOLOGICAL UNIVERSITY) - bold, red
      const line2 = settings.header_line2 || 'CEBU TECHNOLOGICAL UNIVERSITY';
      doc.setFont('helvetica', settings.header_line2_bold !== false ? 'bold' : 'normal');
      const line2Color = hexToRgb(settings.header_line2_color || '#DC143C');
      doc.setTextColor(line2Color[0], line2Color[1], line2Color[2]);
      doc.setFontSize(12);
      doc.text(line2, centerX, yPosition + 12, { align: 'center' });
      
      // Line 3 (Address)
      const line3 = settings.header_line3 || 'M. J. Cuenco Avenue Cor. R. Palma Street, Cebu City, Philippines';
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(line3, centerX, yPosition + 17, { align: 'center' });
      
      // Line 4 (Website)
      const line4 = settings.header_line4 || 'Website: http://www.ctu.edu.ph';
      doc.setFontSize(10);
      doc.text(line4, centerX, yPosition + 21, { align: 'center' });
      
      // Line 5 (Phone)
      const line5 = settings.header_line5 || 'Phone: +6332 402 4060 loc. 1146';
      doc.text(line5, centerX, yPosition + 25, { align: 'center' });
      
      // Line 6 (UNIVERSITY ALUMNI AFFAIRS OFFICE) - bold, red
      const line6 = settings.header_line6 || 'UNIVERSITY ALUMNI AFFAIRS OFFICE';
      doc.setFont('helvetica', settings.header_line6_bold !== false ? 'bold' : 'normal');
      const line6Color = hexToRgb(settings.header_line6_color || '#DC143C');
      doc.setTextColor(line6Color[0], line6Color[1], line6Color[2]);
      doc.setFontSize(9);
      doc.text(line6, centerX, yPosition + 30, { align: 'center' });
      
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
      const settings = reportSettings || {};
      
      // Check if footer is enabled
      if (settings.footer_enabled === false) return;
      
      // Get the position of the last autoTable to determine where to place footer
      const lastTableY = (doc as any).lastAutoTable?.finalY || 150;
      
      // Check if we need a new page for the footer (footer needs about 80mm of space)
      const spaceNeeded = 80;
      let currentY;
      if (lastTableY + spaceNeeded > pageHeight - 20) {
        doc.addPage();
        // Start footer at a reasonable position on the new page
        currentY = 50;
      } else {
        // Start footer after the last table with some spacing
        currentY = lastTableY + 40;
      }
      
      // Work from top to bottom
      // 1. Signature section at the top (no boxes, clean format)
      if (settings.signature_enabled !== false) {
        const sectionWidth = 70;
        const lineHeight = 7;
        
        // Prepared by section (left)
        const preparedX = 40;
        let preparedY = currentY;
        
        // "Prepared by:" text (no box)
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Prepared by:', preparedX + sectionWidth / 2, preparedY, { align: 'center' });
        preparedY += lineHeight + 2;
        
        // Name in Bold
        const preparedByName = settings.prepared_by_name || 'MARIE JOY B. ALIT, Ph.D.';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(preparedByName, preparedX + sectionWidth / 2, preparedY, { align: 'center' });
        preparedY += lineHeight + 2;
        
        // Signature Line (horizontal line)
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(preparedX, preparedY, preparedX + sectionWidth, preparedY);
        preparedY += lineHeight + 2;
        
        // Title
        const preparedByTitle = settings.prepared_by_title || 'University Director for Alumni Affairs';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(preparedByTitle, preparedX + sectionWidth / 2, preparedY, { align: 'center' });
        const preparedFinalY = preparedY + lineHeight;
        
        // Approved by section (right)
        const approvedX = pageWidth - 110;
        let approvedY = currentY;
        
        // "Approved by:" text (no box)
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Approved by:', approvedX + sectionWidth / 2, approvedY, { align: 'center' });
        approvedY += lineHeight + 2;
        
        // Name in Bold
        const approvedByName = settings.approved_by_name || 'ROMEO P. MONTECILLO, Ph.D.';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(approvedByName, approvedX + sectionWidth / 2, approvedY, { align: 'center' });
        approvedY += lineHeight + 2;
        
        // Signature Line (horizontal line)
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(approvedX, approvedY, approvedX + sectionWidth, approvedY);
        approvedY += lineHeight + 2;
        
        // Title
        const approvedByTitle = settings.approved_by_title || 'Vice President for Student Affairs';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(approvedByTitle, approvedX + sectionWidth / 2, approvedY, { align: 'center' });
        const approvedFinalY = approvedY + lineHeight;
        
        currentY = Math.max(preparedFinalY, approvedFinalY) + 10;
      }
      
      // 2. Footer image below signature (with proper aspect ratio)
      if (settings.footer_image_enabled !== false) {
        const footerBase64 = await loadImageOrUrl(settings.footer_image_url || '', footerImage);
        
        if (footerBase64) {
          // Calculate proper aspect ratio to prevent stretching
          const maxFooterWidth = pageWidth - 40;
          const maxFooterHeight = 120; // Increased maximum height to prevent stretching
          
          // Create an image element to get natural dimensions
          const img = new Image();
          img.src = footerBase64;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue even if image fails to load
          });
          
          let footerWidth = maxFooterWidth;
          let footerHeight = maxFooterHeight;
          
          // If we have image dimensions, calculate proper aspect ratio
          if (img.width && img.height) {
            const aspectRatio = img.width / img.height;
            // Calculate height based on width while maintaining aspect ratio
            footerHeight = footerWidth / aspectRatio;
            // If calculated height exceeds max, adjust width instead
            if (footerHeight > maxFooterHeight) {
              footerHeight = maxFooterHeight;
              footerWidth = footerHeight * aspectRatio;
            }
          }
          
          // Center the image horizontally
          const footerX = (pageWidth - footerWidth) / 2;
          doc.addImage(footerBase64, 'PNG', footerX, currentY, footerWidth, footerHeight);
          // Increased spacing after image to prevent text overlap
          currentY += footerHeight + 20;
        }
      }
      
      // 3. Generated date below footer image
      const generatedDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${generatedDate}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 10;
      
      // 4. Footer text at the bottom
      const footerText1 = settings.footer_text1 || 'Generated by Cebu Technological University Alumni Affairs Office';
      const footerText2 = settings.footer_text2 || 'This report is generated automatically by the Alumni Tracking System';
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(footerText1, pageWidth / 2, currentY, { align: 'center' });
      doc.text(footerText2, pageWidth / 2, currentY + 5, { align: 'center' });
    } catch (error) {
      console.error('Error adding institutional footer to PDF:', error);
    }
  };

  // ========================================
  // EXCEL HEADER FUNCTION
  // ========================================
  // Utility function to add institutional header to Excel
  const addInstitutionalHeaderToExcel = async (workbook: any, sheet: any, startRow: number = 1) => {
    const settings = reportSettings || {};
    
    // Check if header is enabled
    if (settings.header_enabled === false) {
      return startRow; // Return startRow if disabled
    }
    
    let r = startRow;
    
    // Load header images if enabled
    const leftLogoBase64 = settings.left_logo_enabled !== false 
      ? await loadImageOrUrl(settings.left_logo_url || '', ctuLogo)
      : '';
    const rightLogoBase64 = settings.right_logo_enabled !== false
      ? await loadImageOrUrl(settings.right_logo_url || '', bagongPilipinasLogo)
      : '';
    
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
    
    // Add logos to row 2
    if (leftLogoBase64) {
      const leftImgId = workbook.addImage({
        base64: leftLogoBase64.split(',')[1],
        extension: 'png',
      });
      sheet.addImage(leftImgId, {
        tl: { col: 3, row: r - startRow },
        ext: { width: 100, height: 100 },
      });
    }
    
    if (rightLogoBase64) {
      const rightImgId = workbook.addImage({
        base64: rightLogoBase64.split(',')[1],
        extension: 'png',
      });
      sheet.addImage(rightImgId, {
        tl: { col: 5, row: r - startRow },
        ext: { width: 100, height: 100 },
      });
    }
    
    // Line 1
    const line1 = settings.header_line1 || 'Republic of the Philippines';
    sheet.getCell(`A${r}`).value = line1;
    sheet.getCell(`A${r}`).font = { bold: true, size: 11 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Line 2 - CEBU TECHNOLOGICAL UNIVERSITY (bold, red)
    const line2 = settings.header_line2 || 'CEBU TECHNOLOGICAL UNIVERSITY';
    const line2Color = settings.header_line2_color || '#DC143C';
    const argbColor = line2Color.replace('#', 'FF');
    sheet.getCell(`A${r}`).value = line2;
    sheet.getCell(`A${r}`).font = { bold: settings.header_line2_bold !== false, size: 16, color: { argb: argbColor } };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Line 3 - Address
    const line3 = settings.header_line3 || 'M. J. Cuenco Avenue Cor. R. Palma Street, Cebu City, Philippines';
    sheet.getCell(`A${r}`).value = line3;
    sheet.getCell(`A${r}`).font = { size: 10 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Line 4 - Website
    const line4 = settings.header_line4 || 'Website: http://www.ctu.edu.ph';
    sheet.getCell(`A${r}`).value = line4;
    sheet.getCell(`A${r}`).font = { size: 9 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Line 5 - Phone
    const line5 = settings.header_line5 || 'Phone: +6332 402 4060 loc. 1146';
    sheet.getCell(`A${r}`).value = line5;
    sheet.getCell(`A${r}`).font = { size: 9 };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Line 6 - UNIVERSITY ALUMNI AFFAIRS OFFICE (bold, red)
    const line6 = settings.header_line6 || 'UNIVERSITY ALUMNI AFFAIRS OFFICE';
    const line6Color = settings.header_line6_color || '#DC143C';
    const argb6Color = line6Color.replace('#', 'FF');
    sheet.getCell(`A${r}`).value = line6;
    sheet.getCell(`A${r}`).font = { bold: settings.header_line6_bold !== false, size: 12, color: { argb: argb6Color } };
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
  const addInstitutionalFooterToExcel = async (workbook: any, sheet: any, startRow: number, statsType?: string) => {
    const settings = reportSettings || {};
    
    // Check if footer is enabled
    if (settings.footer_enabled === false) {
      return startRow;
    }
    
    let r = startRow + 2;
    
    // Add signature section if enabled (NO BOXES - clean plain text format matching PDF)
    // PDF shows both sections centered in their respective halves of the page
    if (settings.signature_enabled !== false) {
      // Skip a row for spacing
      r++;
      
      // Use balanced column layout: B-D for left (3 cols), E-G for right (3 cols)
      // This creates equal halves with centered content, matching PDF layout
      
      // Row 1: "Prepared by:" / "Approved by:" labels (plain text, no boxes, centered)
      // Match PDF: font size 9, normal weight, centered in their sections
      sheet.getCell(`B${r}`).value = 'Prepared by:';
      sheet.getCell(`B${r}`).font = { bold: false, size: 9 };
      sheet.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells(`B${r}:D${r}`);
      
      sheet.getCell(`E${r}`).value = 'Approved by:';
      sheet.getCell(`E${r}`).font = { bold: false, size: 9 };
      sheet.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells(`E${r}:G${r}`);
      r++;
      
      // Row 2: Names in Bold (plain text, no boxes, centered)
      // Match PDF: font size 10, bold, centered in their sections
      const preparedByName = settings.prepared_by_name || 'MARIE JOY B. ALIT, Ph.D.';
      sheet.getCell(`B${r}`).value = preparedByName;
      sheet.getCell(`B${r}`).font = { bold: true, size: 10 };
      sheet.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells(`B${r}:D${r}`);
      
      const approvedByName = settings.approved_by_name || 'ROMEO P. MONTECILLO, Ph.D.';
      sheet.getCell(`E${r}`).value = approvedByName;
      sheet.getCell(`E${r}`).font = { bold: true, size: 10 };
      sheet.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells(`E${r}:G${r}`);
      r++;
      
      // Row 3: Signature Lines (two separate horizontal lines, centered under names)
      // Match PDF: horizontal line with thin style, centered in their sections
      const signatureRow = sheet.getRow(r);
      
      // Prepared by signature line - centered in B-D space
      // Use column C (middle of B-D) for the line to center it
      signatureRow.getCell(2).border = { 
        top: { style: 'none' },
        bottom: { style: 'none' },
        left: { style: 'none' },
        right: { style: 'none' }
      };
      signatureRow.getCell(2).value = '';
      signatureRow.getCell(3).border = { 
        bottom: { style: 'thin' },
        top: { style: 'none' },
        left: { style: 'none' },
        right: { style: 'none' }
      };
      signatureRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      signatureRow.getCell(4).border = { 
        top: { style: 'none' },
        bottom: { style: 'none' },
        left: { style: 'none' },
        right: { style: 'none' }
      };
      signatureRow.getCell(4).value = '';
      
      // GAP COLUMN - Empty buffer to prevent border connection
      signatureRow.getCell(5).border = { 
        top: { style: 'none' },
        bottom: { style: 'none' },
        left: { style: 'none' },
        right: { style: 'none' }
      };
      signatureRow.getCell(5).value = '';
      
      // Approved by signature line - centered in E-G space
      // Use column F (middle of E-G) for the line to center it
      signatureRow.getCell(6).border = { 
        bottom: { style: 'thin' },
        top: { style: 'none' },
        left: { style: 'none' },
        right: { style: 'none' }
      };
      signatureRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      signatureRow.getCell(7).border = { 
        top: { style: 'none' },
        bottom: { style: 'none' },
        left: { style: 'none' },
        right: { style: 'none' }
      };
      signatureRow.getCell(7).value = '';
      
      signatureRow.height = 15;
      r++;
      
      // Row 4: Titles (plain text, no boxes, centered)
      // Match PDF: font size 8, normal weight, centered in their sections
      const preparedByTitle = settings.prepared_by_title || 'University Director for Alumni Affairs';
      sheet.getCell(`B${r}`).value = preparedByTitle;
      sheet.getCell(`B${r}`).font = { bold: false, size: 8 };
      sheet.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells(`B${r}:D${r}`);
      
      const approvedByTitle = settings.approved_by_title || 'Vice President for Student Affairs';
      sheet.getCell(`E${r}`).value = approvedByTitle;
      sheet.getCell(`E${r}`).font = { bold: false, size: 8 };
      sheet.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells(`E${r}:G${r}`);
      r += 2;
    }
    
    // Add footer image if enabled (with proper aspect ratio and centered like PDF)
    if (settings.footer_image_enabled !== false) {
      // Get the appropriate footer image based on statistics type
      // Priority: type-specific URL > generic URL > generic default image
      let footerImageUrl = settings.footer_image_url || '';
      
      // Check for type-specific footer URL if statsType is provided
      if (statsType) {
        const typeSpecificKey = `${statsType.toLowerCase()}_footer_image_url`;
        const typeSpecificUrl = (settings as any)[typeSpecificKey];
        
        // Use type-specific footer if configured, otherwise use generic
        if (typeSpecificUrl) {
          footerImageUrl = typeSpecificUrl;
        }
        // If no type-specific footer is configured, footerImageUrl already has the generic one
      }
      
      // Load the footer image (will use generic footer as fallback if URL fails)
      const footerImgBase64 = await loadImageOrUrl(footerImageUrl, footerImage);
      if (footerImgBase64) {
        // Calculate proper aspect ratio to prevent stretching (matching PDF logic exactly)
        const img = new Image();
        img.src = footerImgBase64;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        
        // Match PDF logic exactly: Calculate available width and maintain aspect ratio
        // Excel columns A-H typically span approximately 800-1000 pixels
        // Use a standard width that works well for most Excel sheets
        const estimatedSheetWidth = 900; // pixels (reasonable estimate for columns A-H)
        const maxFooterWidth = estimatedSheetWidth - 40; // Match PDF: pageWidth - 40
        const maxFooterHeight = 120; // Increased maximum height to prevent stretching (matching PDF)
        
        // Initialize with max dimensions
        let footerWidth = maxFooterWidth;
        let footerHeight = maxFooterHeight;
        
        // CRITICAL: Maintain aspect ratio to prevent stretching (matching PDF logic exactly)
        if (img.naturalWidth && img.naturalHeight && img.naturalWidth > 0 && img.naturalHeight > 0) {
          // Use naturalWidth/naturalHeight for accurate aspect ratio
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          
          // Calculate height based on width while maintaining aspect ratio
          footerHeight = footerWidth / aspectRatio;
          
          // If calculated height exceeds max, adjust width instead (matching PDF logic)
          if (footerHeight > maxFooterHeight) {
            footerHeight = maxFooterHeight;
            footerWidth = footerHeight * aspectRatio;
          }
        } else if (img.width && img.height && img.width > 0 && img.height > 0) {
          // Fallback to width/height if naturalWidth/Height not available
          const aspectRatio = img.width / img.height;
          footerHeight = footerWidth / aspectRatio;
          if (footerHeight > maxFooterHeight) {
            footerHeight = maxFooterHeight;
            footerWidth = footerHeight * aspectRatio;
          }
        }
        
        // Ensure dimensions are valid
        if (footerWidth <= 0 || footerHeight <= 0 || !isFinite(footerWidth) || !isFinite(footerHeight)) {
          // Fallback to reasonable defaults if calculation failed
          footerWidth = 860;
          footerHeight = 60;
        }
        
        const footerImgId = workbook.addImage({
          base64: footerImgBase64.split(',')[1],
          extension: 'png',
        });
        
        // Get the image's natural aspect ratio
        let aspectRatio = 1;
        if (img.naturalWidth && img.naturalHeight && img.naturalWidth > 0 && img.naturalHeight > 0) {
          aspectRatio = img.naturalWidth / img.naturalHeight;
        } else if (img.width && img.height && img.width > 0 && img.height > 0) {
          aspectRatio = img.width / img.height;
        }
        
        // Recalculate based on aspect ratio
        footerHeight = footerWidth / aspectRatio;
        
        // Ensure height doesn't exceed reasonable maximum
        const maxHeight = 200; // Increased maximum height in pixels to prevent stretching
        if (footerHeight > maxHeight) {
          footerHeight = maxHeight;
          footerWidth = footerHeight * aspectRatio;
        }
        
        // Add the image to span from column C (index 2) to column F (index 5)
        // Using tl/br with editAs: 'twoCell' to ensure it spans exactly C to F
        const rowsNeeded = Math.ceil(footerHeight / 20) + 2; // Calculate rows based on height
        sheet.addImage(footerImgId, {
          tl: { col: 2, row: r - 1 }, // Start at column C (index 2)
          br: { col: 6, row: r - 1 + rowsNeeded }, // End at column F+1 (index 6) to span C-F
          editAs: 'twoCell' // Image resizes with cells, spanning C to F
        });
        r += rowsNeeded;
      }
    }
    
    // Add generated date (matching PDF: font size 8, normal weight, not italic)
    const generatedDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    sheet.getCell(`A${r}`).value = `Generated on: ${generatedDate}`;
    sheet.getCell(`A${r}`).font = { bold: false, size: 8 }; // Match PDF: size 8, normal (not italic)
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    // Add footer information (matching PDF: font size 8, normal weight, not italic)
    const footerText1 = settings.footer_text1 || 'Generated by Cebu Technological University Alumni Affairs Office';
    sheet.getCell(`A${r}`).value = footerText1;
    sheet.getCell(`A${r}`).font = { bold: false, size: 8 }; // Match PDF: size 8, normal (not italic)
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A${r}:H${r}`);
    r++;
    
    const footerText2 = settings.footer_text2 || 'This report is generated automatically by the Alumni Tracking System';
    sheet.getCell(`A${r}`).value = footerText2;
    sheet.getCell(`A${r}`).font = { bold: false, size: 8 }; // Match PDF: size 8, normal (not italic)
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
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

  // Load header/footer settings on mount
  useEffect(() => {
    const loadReportSettings = async () => {
      try {
        const response = await api.get('shared/report-settings/');
        if (response.data.success && response.data.settings) {
          setReportSettings(response.data.settings);
        }
      } catch (error) {
        console.error('Error loading header/footer settings:', error);
        // Use defaults if settings can't be loaded
      }
    };
    loadReportSettings();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setAllStats(null);
    setDetailedData(null);
    setDetailedLoading({});
    try {
      if (selectedType === 'ALL') {
        // Fetch all four types in parallel
        const [qpro, ched, suc, aacup, highPosition] = await Promise.all([
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
          queryClient.fetchQuery({
            queryKey: [
              'stats',
              'generate',
              { year: selectedYear, course: selectedProgram, type: 'HIGH_POSITION' },
            ],
            queryFn: async () => generateSpecificStats(selectedYear, selectedProgram, 'HIGH_POSITION'),
          }) as Promise<AnyStats>,
        ]);
        setAllStats({ QPRO: qpro, CHED: ched, SUC: suc, AACUP: aacup, HIGH_POSITION: highPosition });
        setGeneratedStats(null);
        if (onGenerate) onGenerate({ QPRO: qpro, CHED: ched, SUC: suc, AACUP: aacup, HIGH_POSITION: highPosition });
        
        // Show success toast for all statistics
        const totalAlumni = qpro?.total_alumni || 0;
        showToast(
          `Successfully generated all statistics for ${totalAlumni} alumni.`
        );
        
        // Enable export buttons after successful generation
        setNeedsRegenerate(false);
        
        // Fetch detailed data for all
        (['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION'] as StatsType[]).forEach(async (type) => {
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
        showToast(
          `Successfully generated ${stats?.type || selectedType || 'statistics'} statistics for ${stats?.total_alumni || 'selected'} alumni.`
        );
        
        // Enable export buttons after successful generation
        setNeedsRegenerate(false);
        
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
      showToast('Error generating statistics. Please try again.', 'error');
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
    'Batch_Graduated',
    'Last_Name',
    'First_Name',
    'Middle_Name',
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
      safe(pick(['Batch_Graduated', 'batch', 'year_graduated', 'Batch', 'Year_Graduated'])),
      safe(row['Last_Name']),
      safe(row['First_Name']),
      safe(row['Middle_Name']),
      status,
      safe(pick(['Current Company Name', 'Company_Name_Current'])),
      safe(pick(['Position_Current'])),
      safe(pick(['Current Salary range', 'Current Salary Range', 'Salary Range', 'Salary_Current'])),
      safe(pick(['Sector_Current', 'Current Company Sector', 'Sector'])),
      safe(pick(['Please specify post graduate/degree', 'Please specify postgraduate/degree', 'Post graduate/degree', 'Post Graduate/Degree'])),
    ];
  };

  // Enhanced sorting function: answered tracker first (alphabetical), not answered last (alphabetical)
  const sortAlumniData = (mappedData: any[][]) => {
    return mappedData.sort((a, b) => {
      const aAnswered = a[5] !== 'Not Tracked'; // Status is now at index 5 (after adding Batch_Graduated)
      const bAnswered = b[5] !== 'Not Tracked';
      
      // First priority: answered vs not answered
      if (aAnswered !== bAnswered) {
        return aAnswered ? -1 : 1; // answered first
      }
      
      // Second priority: alphabetical by last name, then first name, then middle name
      // Index: 2 = Last_Name, 3 = First_Name, 4 = Middle_Name (after adding Batch_Graduated at index 1)
      const aLastName = (a[2] || '').toLowerCase().trim();
      const bLastName = (b[2] || '').toLowerCase().trim();
      const lastNameCompare = aLastName.localeCompare(bLastName);
      
      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }
      
      // If last names are the same, sort by first name
      const aFirstName = (a[3] || '').toLowerCase().trim();
      const bFirstName = (b[3] || '').toLowerCase().trim();
      const firstNameCompare = aFirstName.localeCompare(bFirstName);
      
      if (firstNameCompare !== 0) {
        return firstNameCompare;
      }
      
      // If first names are also the same, sort by middle name
      const aMiddleName = (a[4] || '').toLowerCase().trim();
      const bMiddleName = (b[4] || '').toLowerCase().trim();
      return aMiddleName.localeCompare(bMiddleName);
    });
  };

  // Calculate QPRO program breakdown with quarterly statistics
  const calculateQPROProgramBreakdown = (detailedData: any[]) => {
    const programs = ['BSIT', 'BSIS', 'BIT-CT'];
    const breakdown: Record<string, {
      program: string;
      total: number;
      employed: number;
      unemployed: number;
      notTracked: number;
      q1: { employed: number; unemployed: number; total: number };
      q2: { employed: number; unemployed: number; total: number };
      q3: { employed: number; unemployed: number; total: number };
      q4: { employed: number; unemployed: number; total: number };
    }> = {};

    // Helper to get quarter from date
    const getQuarter = (dateStr: string) => {
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        if (month >= 1 && month <= 3) return 1;
        if (month >= 4 && month <= 6) return 2;
        if (month >= 7 && month <= 9) return 3;
        if (month >= 10 && month <= 12) return 4;
      } catch (e) {}
      return null;
    };

    // Initialize breakdown for each program
    programs.forEach(prog => {
      breakdown[prog] = {
        program: prog,
        total: 0,
        employed: 0,
        unemployed: 0,
        notTracked: 0,
        q1: { employed: 0, unemployed: 0, total: 0 },
        q2: { employed: 0, unemployed: 0, total: 0 },
        q3: { employed: 0, unemployed: 0, total: 0 },
        q4: { employed: 0, unemployed: 0, total: 0 },
      };
    });

    // Process each alumni
    detailedData.forEach(row => {
      const program = String(row['Program'] || '').toUpperCase();
      const programMatch = programs.find(p => program.includes(p));
      
      if (!programMatch) return;

      const breakdownData = breakdown[programMatch];
      
      // Determine status
      const statusRaw = String(row['Status'] || '').toLowerCase();
      let isEmployed = false;
      let isUnemployed = false;

      if (statusRaw.includes('employ')) {
        isEmployed = true;
      } else if (statusRaw.includes('unemploy')) {
        isUnemployed = true;
      } else if (row['Company_Name_Current'] || row['Position_Current']) {
        isEmployed = true;
      } else if (row['Unemployment_Reason']) {
        isUnemployed = true;
      }

      // Update overall counts
      breakdownData.total++;
      if (isEmployed) breakdownData.employed++;
      else if (isUnemployed) breakdownData.unemployed++;
      else breakdownData.notTracked++;

      // Update quarterly counts
      const trackerDate = row['Tracker_Submission_Date'] || '';
      const quarter = getQuarter(trackerDate);
      
      if (quarter) {
        const qData = breakdownData[`q${quarter}` as 'q1' | 'q2' | 'q3' | 'q4'];
        qData.total++;
        if (isEmployed) qData.employed++;
        else if (isUnemployed) qData.unemployed++;
      }
    });

    // Calculate tracking rates and prepare result
    const result = programs.map(prog => {
      const data = breakdown[prog];
      const trackingTotal = data.employed + data.unemployed;
      const trackingRate = data.total > 0 ? (trackingTotal / data.total * 100).toFixed(1) : '0.0';
      
      const q1Rate = data.q1.total > 0 ? ((data.q1.employed + data.q1.unemployed) / data.q1.total * 100).toFixed(1) : '0.0';
      const q2Rate = data.q2.total > 0 ? ((data.q2.employed + data.q2.unemployed) / data.q2.total * 100).toFixed(1) : '0.0';
      const q3Rate = data.q3.total > 0 ? ((data.q3.employed + data.q3.unemployed) / data.q3.total * 100).toFixed(1) : '0.0';
      const q4Rate = data.q4.total > 0 ? ((data.q4.employed + data.q4.unemployed) / data.q4.total * 100).toFixed(1) : '0.0';

      return {
        program: data.program,
        total: data.total,
        employed: data.employed,
        unemployed: data.unemployed,
        notTracked: data.notTracked,
        trackingRate,
        q1: { ...data.q1, trackingRate: q1Rate },
        q2: { ...data.q2, trackingRate: q2Rate },
        q3: { ...data.q3, trackingRate: q3Rate },
        q4: { ...data.q4, trackingRate: q4Rate },
        isTotal: false,
      };
    });

    // Add TOTAL row
    const totalRow = result.reduce((acc, row) => {
      acc.total += row.total;
      acc.employed += row.employed;
      acc.unemployed += row.unemployed;
      acc.notTracked += row.notTracked;
      acc.q1.employed += row.q1.employed;
      acc.q1.unemployed += row.q1.unemployed;
      acc.q1.total += row.q1.total;
      acc.q2.employed += row.q2.employed;
      acc.q2.unemployed += row.q2.unemployed;
      acc.q2.total += row.q2.total;
      acc.q3.employed += row.q3.employed;
      acc.q3.unemployed += row.q3.unemployed;
      acc.q3.total += row.q3.total;
      acc.q4.employed += row.q4.employed;
      acc.q4.unemployed += row.q4.unemployed;
      acc.q4.total += row.q4.total;
      return acc;
    }, {
      program: 'TOTAL',
      total: 0,
      employed: 0,
      unemployed: 0,
      notTracked: 0,
      trackingRate: '0.0',
      q1: { employed: 0, unemployed: 0, total: 0, trackingRate: '0.0' },
      q2: { employed: 0, unemployed: 0, total: 0, trackingRate: '0.0' },
      q3: { employed: 0, unemployed: 0, total: 0, trackingRate: '0.0' },
      q4: { employed: 0, unemployed: 0, total: 0, trackingRate: '0.0' },
      isTotal: true,
    });

    const grandTotal = totalRow.total;
    totalRow.trackingRate = grandTotal > 0 ? ((totalRow.employed + totalRow.unemployed) / grandTotal * 100).toFixed(1) : '0.0';
    totalRow.q1.trackingRate = totalRow.q1.total > 0 ? ((totalRow.q1.employed + totalRow.q1.unemployed) / totalRow.q1.total * 100).toFixed(1) : '0.0';
    totalRow.q2.trackingRate = totalRow.q2.total > 0 ? ((totalRow.q2.employed + totalRow.q2.unemployed) / totalRow.q2.total * 100).toFixed(1) : '0.0';
    totalRow.q3.trackingRate = totalRow.q3.total > 0 ? ((totalRow.q3.employed + totalRow.q3.unemployed) / totalRow.q3.total * 100).toFixed(1) : '0.0';
    totalRow.q4.trackingRate = totalRow.q4.total > 0 ? ((totalRow.q4.employed + totalRow.q4.unemployed) / totalRow.q4.total * 100).toFixed(1) : '0.0';

    result.push(totalRow);

    return result;
  };

  const addQPRODetailedSheet = (workbook: ExcelJS.Workbook, rows: any[], sheetName = 'QPRO Detailed Alumni Data') => {
    const detail = workbook.addWorksheet(sheetName);
    const headerRow = detail.addRow(qproHeaders);
    // Make headers bold with blue background and white text
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1D4E89' }
      };
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
        const width = Math.min(maxLen + 4, 100);
        const col = (sheet as any).getColumn?.(c);
        if (col) col.width = Math.max(col.width || 0, width, 12);
      }

      // Make likely header rows taller and wrapped so long labels are visible
      const maybeHeaderMatches = (row: any) => {
        try {
          const c1 = String(row.getCell(1)?.value || '');
          const c2 = String(row.getCell(2)?.value || '');
          const c3 = String(row.getCell(3)?.value || '');
          // Match QPRO/Detail headers
          const isQproHeader = c1 === 'Program' && c2 === 'Last_Name' && c3 === 'First_Name';
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
          if (c1 === 'Program' && c2 === 'Last_Name' && c3 === 'First_Name') {
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
  const headersHighPosition = ['Program','Batch_Graduated','Last_Name','First_Name','Middle_Name','Company_Name_Current','Position_Current'];
  const mapHighPositionRow = (alumnusOrRow: any) => {
    // Supports both high_position_data shape and detailed row shape
    const course = alumnusOrRow.course || alumnusOrRow['Program'] || '';
    const batch = alumnusOrRow.batch || alumnusOrRow.year_graduated || alumnusOrRow['Batch_Graduated'] || alumnusOrRow['Batch'] || alumnusOrRow['Year_Graduated'] || '';
    const company = alumnusOrRow.company || alumnusOrRow['Company_Name_Current'] || '';
    const position = alumnusOrRow.position || alumnusOrRow['Position_Current'] || '';
    if (alumnusOrRow.name) {
      const name = (alumnusOrRow.name || '').trim();
      const parts = name.split(/\s+/);
      const first = parts[0] || '';
      const last = parts.length > 1 ? parts[parts.length - 1] : '';
      const middle = parts.length > 2 ? parts.slice(1, parts.length - 1).join(' ') : '';
      return [course, batch, last, first, middle, company, position];
    }
    return [
      course,
      batch,
      alumnusOrRow['Last_Name'] || '',
      alumnusOrRow['First_Name'] || '',
      alumnusOrRow['Middle_Name'] || '',
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

      // Add Employability Report by Program table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Employability Report by Program', 20, yPosition);
      yPosition += 8;

      const programBreakdown = calculateQPROProgramBreakdown(detailedDataByType['QPRO'] || []);
      
      // Prepare table data with two-row header
      const breakdownHead = [
        ['PROGRAMS', 'TOTAL', 'E', 'UE', 'NT', 'GT', 'FIRST QUARTER', '', '', 'SECOND QUARTER', '', '', 'THIRD QUARTER', '', '', 'FOURTH QUARTER', '', ''],
        ['', '', '', '', '', '', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT']
      ];
      
      const breakdownBody = programBreakdown.map(progData => [
        progData.program,
        progData.total,
        progData.employed,
        progData.unemployed,
        progData.notTracked,
        progData.trackingRate,
        progData.q1.employed,
        progData.q1.unemployed,
        progData.q1.trackingRate,
        progData.q2.employed,
        progData.q2.unemployed,
        progData.q2.trackingRate,
        progData.q3.employed,
        progData.q3.unemployed,
        progData.q3.trackingRate,
        progData.q4.employed,
        progData.q4.unemployed,
        progData.q4.trackingRate,
      ]);

      autoTable(doc, {
        head: breakdownHead,
        body: breakdownBody,
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 6, cellPadding: 1 },
        margin: { left: 20, right: 20 },
        // Let autoTable auto-size columns like Detailed Alumni Data table
        didParseCell: (data: any) => {
          // Apply white fill to TOTAL row
          if (data.row.raw && Array.isArray(data.row.raw) && data.row.raw[0] === 'TOTAL') {
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.textColor = 0;
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
      
      // Add institutional footer after summary
      await addInstitutionalFooterToPDF(doc, pageWidth, pageHeight);

      // Detailed data
      const detailedData = detailedDataByType['QPRO'] || [];
      
      // Add new page for detailed data only if we have data
      if (detailedData.length > 0) {
        doc.addPage();
        yPosition = 20;
      }
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
            1: { cellWidth: 12 }, // Batch_Graduated
            5: { cellWidth: 20 }, // Status
            6: { cellWidth: 35 }, // Company
            7: { cellWidth: 30 }, // Position
            8: { cellWidth: 25 }, // Salary
            9: { cellWidth: 20 }, // Sector
            10: { cellWidth: 30 }, // Post graduate
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
        headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
      
      // Add institutional footer after summary
      await addInstitutionalFooterToPDF(doc, pageWidth, pageHeight);

      // Detailed data for CHED
      const detailedData = detailedDataByType['CHED'] || [];
      if (detailedData.length > 0) {
        // Add new page for detailed data
        doc.addPage();
        yPosition = 20; // Reset yPosition for new page

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
          headStyles: { fillColor: [29, 78, 137], textColor: 255 },
          columnStyles: {
            1: { cellWidth: 12 }, // Batch_Graduated
            5: { cellWidth: 20 }, // Status
            6: { cellWidth: 35 }, // Company
            7: { cellWidth: 30 }, // Position
            8: { cellWidth: 25 }, // Salary
            9: { cellWidth: 20 }, // Sector
            10: { cellWidth: 30 }, // Post graduate
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
        ['Self-Employed', String(stats.self_employed_count || 0), pct(stats.self_employed_count, stats.total_alumni)],
        ['Awards Received', String(stats.awards_count || 0), pct(stats.awards_count, stats.total_alumni)],
        ['Employment Rate', '', `${stats.employment_rate || 0}%`],
        ['Absorption Rate', '', `${stats.absorption_rate || 0}%`],
        ['High Position Rate', '', `${stats.high_position_rate || 0}%`],
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
      
      // Add institutional footer after summary
      await addInstitutionalFooterToPDF(doc, pageWidth, pageHeight);

      // Detailed data for AACUP
      const detailedData = detailedDataByType['AACUP'] || [];
      if (detailedData.length > 0) {
        // Add new page for detailed data
        doc.addPage();
        yPosition = 20;
        
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
          headStyles: { fillColor: [29, 78, 137], textColor: 255 },
          columnStyles: {
            1: { cellWidth: 12 }, // Batch_Graduated
            5: { cellWidth: 20 }, // Status
            6: { cellWidth: 35 }, // Company
            7: { cellWidth: 30 }, // Position
            8: { cellWidth: 25 }, // Salary
            9: { cellWidth: 20 }, // Sector
            10: { cellWidth: 30 }, // Post graduate
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
        ['Average Salary', formatCurrencyForPDF(stats.average_salary), '--'],
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
      
      // Add institutional footer after summary
      await addInstitutionalFooterToPDF(doc, pageWidth, pageHeight);

      // Detailed data for SUC
      const detailedData = detailedDataByType['SUC'] || [];
      if (detailedData.length > 0) {
        // Add new page for detailed data
        doc.addPage();
        yPosition = 20;
        
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
            1: { cellWidth: 12 }, // Batch_Graduated
            5: { cellWidth: 20 }, // Status
            6: { cellWidth: 35 }, // Company
            7: { cellWidth: 30 }, // Position
            8: { cellWidth: 25 }, // Salary
            9: { cellWidth: 20 }, // Sector
            10: { cellWidth: 30 }, // Post graduate
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
        headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
      
      // Add institutional footer after summary
      await addInstitutionalFooterToPDF(doc, pageWidth, pageHeight);
      
      // Add new page for detailed data
      doc.addPage();
      yPosition = 20;

      // Detailed data for HIGH_POSITION
      let detailedData = detailedDataByType['HIGH_POSITION'] || [];
      
      // Use high_position_data from stats if available, otherwise filter detailed data
      if (stats.high_position_data && Array.isArray(stats.high_position_data) && stats.high_position_data.length > 0) {
        // Convert high_position_data format to detailed data format
        detailedData = stats.high_position_data.map((hp: any) => ({
          Program: hp.course || '',
          Last_Name: hp.name?.split(' ').slice(-1)[0] || '',
          First_Name: hp.name?.split(' ')[0] || '',
          Middle_Name: hp.name?.split(' ').slice(1, -1).join(' ') || '',
          Company_Name_Current: hp.company || '',
          Position_Current: hp.position || '',
        }));
      } else if (detailedData.length > 0) {
        // Filter detailed data to only high position alumni
        detailedData = detailedData.filter((alumnus: any) => {
          const position = (alumnus.Position_Current || alumnus.position_current || '').toLowerCase();
          return position.includes('manager') || position.includes('director') || 
                 position.includes('ceo') || position.includes('president') || 
                 position.includes('vp') || position.includes('vice president') ||
                 position.includes('head') || position.includes('chief') ||
                 position.includes('executive') || position.includes('senior');
        });
      }
      
      // Always show detailed data section for consistency
      // If detailedData is still empty, try to get it from stats
      if (detailedData.length === 0 && stats.high_position_data && Array.isArray(stats.high_position_data) && stats.high_position_data.length > 0) {
        detailedData = stats.high_position_data.map((hp: any) => ({
          Program: hp.course || '',
          Last_Name: hp.name?.split(' ').slice(-1)[0] || '',
          First_Name: hp.name?.split(' ')[0] || '',
          Middle_Name: hp.name?.split(' ').slice(1, -1).join(' ') || '',
          Company_Name_Current: hp.company || '',
          Position_Current: hp.position || '',
        }));
      }
      
      // Always show the detailed data section header and table
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
      doc.text('High Position Detailed Alumni Data', 20, yPosition);
        yPosition += 6;

      // Use High Position specific headers and mapper
      const headers = headersHighPosition;
      const rows = detailedData.map((row: any) => mapHighPositionRow(row));

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 6, cellPadding: 1 },
        headStyles: { fillColor: [29, 78, 137], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 15 }, // Program
            1: { cellWidth: 12 }, // Batch_Graduated
            2: { cellWidth: 15 }, // Last_Name
            3: { cellWidth: 15 }, // First_Name
            4: { cellWidth: 15 }, // Middle_Name
            5: { cellWidth: 20 }, // Company_Name_Current
            6: { cellWidth: 20 }, // Position_Current
          },
        });
    } else if (exportType === 'ALL') {
      // PHASE 1: Summary for all types
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Complete Statistics Summary - All Types', 20, yPosition);
      yPosition += 10;

      // First loop: Add ONLY summaries for all types
      for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
        const stats = statsByType[type];
        if (!stats) continue;

        checkPageBreak(60);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${type === 'HIGH_POSITION' ? 'High Position' : type} Statistics`, 20, yPosition);
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
          
          autoTable(doc, {
            head: [summaryData[0]],
            body: summaryData.slice(1),
            startY: yPosition,
            theme: 'grid',
            headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8 },
          });

          yPosition = (doc as any).lastAutoTable.finalY + 10;
          
          // Add Employability Report by Program table after QPRO summary
          checkPageBreak(20);
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Employability Report by Program', 20, yPosition);
          yPosition += 8;
          
          const programBreakdown = calculateQPROProgramBreakdown(detailedDataByType['QPRO'] || []);
          
          // Prepare table data with two-row header
          const breakdownHead = [
            ['PROGRAMS', 'TOTAL', 'E', 'UE', 'NT', 'GT', 'FIRST QUARTER', '', '', 'SECOND QUARTER', '', '', 'THIRD QUARTER', '', '', 'FOURTH QUARTER', '', ''],
            ['', '', '', '', '', '', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT']
          ];
          
          const breakdownBody = programBreakdown.map(progData => [
            progData.program,
            progData.total,
            progData.employed,
            progData.unemployed,
            progData.notTracked,
            progData.trackingRate,
            progData.q1.employed,
            progData.q1.unemployed,
            progData.q1.trackingRate,
            progData.q2.employed,
            progData.q2.unemployed,
            progData.q2.trackingRate,
            progData.q3.employed,
            progData.q3.unemployed,
            progData.q3.trackingRate,
            progData.q4.employed,
            progData.q4.unemployed,
            progData.q4.trackingRate,
          ]);
          
          autoTable(doc, {
            head: breakdownHead,
            body: breakdownBody,
            startY: yPosition,
            theme: 'grid',
            headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 6, cellPadding: 1 },
            margin: { left: 20, right: 20 },
            // Let autoTable auto-size columns like Detailed Alumni Data table
          });
          
          yPosition = (doc as any).lastAutoTable.finalY + 10;
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
            ['Average Salary', formatCurrencyForPDF(stats.average_salary), '--'],
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
            ['Self-Employed', String(stats.self_employed_count || 0), pct(stats.self_employed_count, stats.total_alumni)],
            ['Awards Received', String(stats.awards_count || 0), pct(stats.awards_count, stats.total_alumni)],
            ['Employment Rate', '', `${stats.employment_rate || 0}%`],
            ['Absorption Rate', '', `${stats.absorption_rate || 0}%`],
            ['High Position Rate', '', `${stats.high_position_rate || 0}%`]
          );
        } else if (type === 'HIGH_POSITION') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['High Position Alumni', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
            ['High Position Rate', '', `${stats.high_position_rate || 0}%`]
          );
        }

        if (type !== 'QPRO') {
          autoTable(doc, {
            head: [summaryData[0]],
            body: summaryData.slice(1),
            startY: yPosition,
            theme: 'grid',
            headStyles: { fillColor: [29, 78, 137], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8 },
          });

          yPosition = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // PHASE 2: Add footer BEFORE all detailed data
      await addInstitutionalFooterToPDF(doc, pageWidth, pageHeight);
      
      // Add new page for detailed data
      doc.addPage();
      yPosition = 20;

      // PHASE 3: Add detailed alumni data for ALL types
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Alumni Data - All Types', 20, yPosition);
      yPosition += 10;

      for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
        let detailedData = detailedDataByType[type] || [];
        if (detailedData.length === 0) continue;
        
        // For HIGH_POSITION, filter to only show high position alumni
        if (type === 'HIGH_POSITION') {
          const stats = statsByType[type];
          if (stats?.high_position_data && Array.isArray(stats.high_position_data) && stats.high_position_data.length > 0) {
            detailedData = stats.high_position_data.map((hp: any) => ({
              Program: hp.course || '',
              Batch_Graduated: hp.year_graduated || hp.batch || '',
              Last_Name: hp.name?.split(' ').slice(-1)[0] || '',
              First_Name: hp.name?.split(' ')[0] || '',
              Middle_Name: hp.name?.split(' ').slice(1, -1).join(' ') || '',
              Company_Name_Current: hp.company || '',
              Position_Current: hp.position || '',
            }));
          } else if (detailedData.length > 0) {
            detailedData = detailedData.filter((alumnus: any) => {
              const position = (alumnus.Position_Current || alumnus.position_current || '').toLowerCase();
              return position.includes('manager') || position.includes('director') || 
                     position.includes('ceo') || position.includes('president') || 
                     position.includes('vp') || position.includes('vice president') ||
                     position.includes('head') || position.includes('chief') ||
                     position.includes('executive') || position.includes('senior');
            });
          }
        }
        
        checkPageBreak(40);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${type === 'HIGH_POSITION' ? 'High Position' : type} Detailed Alumni Data`, 20, yPosition);
        yPosition += 6;

        const headers = type === 'HIGH_POSITION' ? headersHighPosition : qproHeaders;
        const rows = type === 'HIGH_POSITION' 
          ? detailedData.map((row: any) => mapHighPositionRow(row))
          : sortAlumniData(detailedData.map((row: any) => mapQPRORow(row)));

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 6, cellPadding: 1 },
          headStyles: { fillColor: [29, 78, 137], textColor: 255 },
          columnStyles: type === 'HIGH_POSITION' ? {
            0: { cellWidth: 15 }, // Program
            1: { cellWidth: 12 }, // Batch_Graduated
            2: { cellWidth: 15 }, // Last_Name
            3: { cellWidth: 15 }, // First_Name
            4: { cellWidth: 15 }, // Middle_Name
            5: { cellWidth: 20 }, // Company_Name_Current
            6: { cellWidth: 20 }, // Position_Current
          } : {
            5: { cellWidth: 20 }, // Status
            6: { cellWidth: 35 }, // Company
            7: { cellWidth: 30 }, // Position
            8: { cellWidth: 25 }, // Salary
            9: { cellWidth: 20 }, // Sector
            10: { cellWidth: 30 }, // Post graduate
          },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }
    }

    // Footer is now added BEFORE detailed data in each section above
    // No need to add footer here again for single type exports

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

    const settings = reportSettings || {};
    
    // Skip header if disabled
    if (settings.header_enabled !== false) {
      // Load images for Word document with fallbacks
      const leftLogoBase64 = settings.left_logo_enabled !== false 
        ? await loadImageOrUrl(settings.left_logo_url || '', ctuLogo)
        : '';
      const rightLogoBase64 = settings.right_logo_enabled !== false
        ? await loadImageOrUrl(settings.right_logo_url || '', bagongPilipinasLogo)
        : '';

    // ========================================
    // WORD HEADER SECTION
    // ========================================
    // Create header with proper logo positioning using a table
      if (leftLogoBase64 && rightLogoBase64) {
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
                          data: leftLogoBase64.split(',')[1],
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
                      text: settings.header_line1 || 'Republic of the Philippines',
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: settings.header_line2 || 'CEBU TECHNOLOGICAL UNIVERSITY',
                          bold: settings.header_line2_bold !== false,
                          color: settings.header_line2_color ? hexToDocxColor(settings.header_line2_color) : hexToDocxColor('#DC143C'),
                          size: 24,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      text: settings.header_line3 || 'M. J. Cuenco Avenue Cor. R. Palma Street, Cebu City, Philippines',
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      text: settings.header_line4 || 'Website: http://www.ctu.edu.ph',
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 50 },
                    }),
                    new Paragraph({
                      text: settings.header_line5 || 'Phone: +6332 402 4060 loc. 1146',
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: settings.header_line6 || 'UNIVERSITY ALUMNI AFFAIRS OFFICE',
                          bold: settings.header_line6_bold !== false,
                          color: settings.header_line6_color ? hexToDocxColor(settings.header_line6_color) : hexToDocxColor('#DC143C'),
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
                          data: rightLogoBase64.split(',')[1],
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
          text: settings.header_line1 || 'Republic of the Philippines',
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: settings.header_line2 || 'CEBU TECHNOLOGICAL UNIVERSITY',
              bold: settings.header_line2_bold !== false,
              color: settings.header_line2_color ? hexToDocxColor(settings.header_line2_color) : hexToDocxColor('#DC143C'),
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: settings.header_line3 || 'M. J. Cuenco Avenue Cor. R. Palma Street, Cebu City, Philippines',
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: settings.header_line4 || 'Website: http://www.ctu.edu.ph',
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 },
        }),
        new Paragraph({
          text: settings.header_line5 || 'Phone: +6332 402 4060 loc. 1146',
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: settings.header_line6 || 'UNIVERSITY ALUMNI AFFAIRS OFFICE',
              bold: settings.header_line6_bold !== false,
              color: settings.header_line6_color ? hexToDocxColor(settings.header_line6_color) : hexToDocxColor('#DC143C'),
              size: 18,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    }
    } // Close header enabled check


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
            new TextRun({ text: new Date().toLocaleDateString() }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Year Filter: ', bold: true }),
            new TextRun({ text: selectedYear || 'ALL' }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Program Filter: ', bold: true }),
            new TextRun({ text: selectedProgram || 'ALL' }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Report Type: ', bold: true }),
            new TextRun({ text: exportType }),
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
                        children: index === 0 ? [
                          new TextRun({
                            text: String(cell || ''),
                            bold: true,
                            color: 'FFFFFF',
                          }),
                        ] : [new TextRun({ text: String(cell || '') })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    shading: index === 0 ? { fill: argbToDocxShading('FF1D4E89') } : undefined,
                  })
              ),
            })
          ),
        })
      );

      return elements;
    };

    // Helper function to add Word footer (reusable)
    const addWordFooter = async (): Promise<(Paragraph | Table)[]> => {
      const elements: (Paragraph | Table)[] = [];
      
      // Add spacing before footer
      elements.push(
        new Paragraph({
          text: '',
          spacing: { before: 800, after: 200 },
        })
      );

      // Add signature section if enabled
      if (settings.signature_enabled !== false && settings.footer_enabled !== false) {
        elements.push(
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
                  // Left cell - Prepared by
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Prepared by:', size: 18 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 180 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: settings.prepared_by_name || 'MARIE JOY B. ALIT, Ph.D.',
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 180 },
                      }),
                      new Table({
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        columnWidths: [100],
                        borders: {
                          top: { style: BorderStyle.NONE },
                          bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' },
                          left: { style: BorderStyle.NONE },
                          right: { style: BorderStyle.NONE },
                          insideHorizontal: { style: BorderStyle.NONE },
                          insideVertical: { style: BorderStyle.NONE },
                        },
                        alignment: AlignmentType.CENTER,
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({
                                children: [
                                  new Paragraph({
                                    text: '',
                                    spacing: { before: 0, after: 0 },
                                  }),
                                ],
                                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                              }),
                            ],
                            height: { value: 60, rule: 'atLeast' },
                          }),
                        ],
                      }),
                      new Paragraph({
                        text: '',
                        spacing: { before: 0, after: 180 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: settings.prepared_by_title || 'University Director for Alumni Affairs',
                            size: 16,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 0 },
                      }),
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    verticalAlign: 'top',
                  }),
                  // Right cell - Approved by
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Approved by:', size: 18 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 180 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: settings.approved_by_name || 'ROMEO P. MONTECILLO, Ph.D.',
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 180 },
                      }),
                      new Table({
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        columnWidths: [100],
                        borders: {
                          top: { style: BorderStyle.NONE },
                          bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' },
                          left: { style: BorderStyle.NONE },
                          right: { style: BorderStyle.NONE },
                          insideHorizontal: { style: BorderStyle.NONE },
                          insideVertical: { style: BorderStyle.NONE },
                        },
                        alignment: AlignmentType.CENTER,
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({
                                children: [
                                  new Paragraph({
                                    text: '',
                                    spacing: { before: 0, after: 0 },
                                  }),
                                ],
                                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                              }),
                            ],
                            height: { value: 60, rule: 'atLeast' },
                          }),
                        ],
                      }),
                      new Paragraph({
                        text: '',
                        spacing: { before: 0, after: 180 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: settings.approved_by_title || 'Vice President for Student Affairs',
                            size: 16,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 0 },
                      }),
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    verticalAlign: 'top',
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({
            text: '',
            spacing: { after: 200 },
          })
        );
      }

      // Add footer image if enabled
      if (settings.footer_enabled !== false && settings.footer_image_enabled !== false) {
        const footerBase64 = await loadImageOrUrl(settings.footer_image_url || '', footerImage);
        if (footerBase64) {
          const img = new Image();
          img.src = footerBase64;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
          
          let footerWidth = 600;
          let footerHeight = 60;
          
          if (img.width && img.height) {
            const aspectRatio = img.width / img.height;
            footerHeight = footerWidth / aspectRatio;
            if (footerHeight > 200) {
              footerHeight = 200;
              footerWidth = footerHeight * aspectRatio;
            }
          }
          
          elements.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: footerBase64.split(',')[1],
                  type: 'png',
                  transformation: {
                    width: footerWidth,
                    height: footerHeight,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            })
          );
        }
      }
      
      // Add page break after footer
      elements.push(
        new Paragraph({
          text: '',
          pageBreakBefore: true,
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
              children: headers.map((header, idx) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: header,
                          bold: true,
                          color: 'FFFFFF',
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  width: { size: idx === 0 ? 10 : idx === 9 ? 30 : 12, type: WidthType.PERCENTAGE },
                })
              ),
            }),
            // Data rows
            ...rows.map((row) =>
              new TableRow({
                children: row.map((cell: any, idx: number) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        text: String(cell || ''),
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: idx === 0 ? 10 : idx === 9 ? 30 : 12, type: WidthType.PERCENTAGE },
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
      
      // Add Employability Report by Program table
      const programBreakdown = calculateQPROProgramBreakdown(detailedDataByType['QPRO'] || []);
      
      children.push(
        new Paragraph({
          text: 'Employability Report by Program',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );

      // Create the breakdown table with two-row header
      const breakdownRows = [
        // First header row with merged cells for quarter headers
        new TableRow({
          children: [
            // PROGRAMS
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'PROGRAMS', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              verticalMerge: 'restart',
            }),
            // TOTAL
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'TOTAL', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              verticalMerge: 'restart',
            }),
            // E
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'E', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              verticalMerge: 'restart',
            }),
            // UE
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'UE', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              verticalMerge: 'restart',
            }),
            // NT
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'NT', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              verticalMerge: 'restart',
            }),
            // GT
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'GT', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              verticalMerge: 'restart',
            }),
            // FIRST QUARTER (merges 3 columns)
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'FIRST QUARTER', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              columnSpan: 3,
            }),
            // SECOND QUARTER (merges 3 columns)
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'SECOND QUARTER', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              columnSpan: 3,
            }),
            // THIRD QUARTER (merges 3 columns)
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'THIRD QUARTER', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              columnSpan: 3,
            }),
            // FOURTH QUARTER (merges 3 columns)
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'FOURTH QUARTER', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
              columnSpan: 3,
            }),
          ],
        }),
        // Second header row
        new TableRow({
          children: [
            // Empty cells for vertically merged PROGRAMS, TOTAL, E, UE, NT, GT
            new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
            new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
            new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
            new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
            new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
            new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
            // E, UE, GT for Q1
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'E', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'UE', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'GT', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            // E, UE, GT for Q2
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'E', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'UE', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'GT', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            // E, UE, GT for Q3
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'E', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'UE', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'GT', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            // E, UE, GT for Q4
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'E', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'UE', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'GT', bold: true, color: 'FFFFFF' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: argbToDocxShading('FF1D4E89') },
            }),
          ],
        }),
        // Data rows
        ...programBreakdown.map((progData: any) =>
          new TableRow({
            children: [
              progData.program || '',
              progData.total || 0,
              progData.employed || 0,
              progData.unemployed || 0,
              progData.notTracked || 0,
              progData.trackingRate || '0.0',
              (progData.q1?.employed || 0),
              (progData.q1?.unemployed || 0),
              (progData.q1?.trackingRate || '0.0'),
              (progData.q2?.employed || 0),
              (progData.q2?.unemployed || 0),
              (progData.q2?.trackingRate || '0.0'),
              (progData.q3?.employed || 0),
              (progData.q3?.unemployed || 0),
              (progData.q3?.trackingRate || '0.0'),
              (progData.q4?.employed || 0),
              (progData.q4?.unemployed || 0),
              (progData.q4?.trackingRate || '0.0'),
            ].map((cell: any) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: progData.isTotal ? [
                      new TextRun({
                        text: String(cell || ''),
                        bold: true,
                      }),
                    ] : [new TextRun({ text: String(cell || '') })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                shading: progData.isTotal ? { fill: 'FFFFFF' } : undefined,
              })
            ),
          })
        ),
      ];

      children.push(
        new Table({
          rows: breakdownRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE },
            bottom: { style: BorderStyle.SINGLE },
            left: { style: BorderStyle.SINGLE },
            right: { style: BorderStyle.SINGLE },
            insideHorizontal: { style: BorderStyle.SINGLE },
            insideVertical: { style: BorderStyle.SINGLE },
          },
        })
      );
      
      // Add footer BEFORE detailed alumni data
      children.push(...await addWordFooter());
      
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
      
      // Add footer BEFORE detailed alumni data
      children.push(...await addWordFooter());
      
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
        ['Self-Employed', String(stats.self_employed_count || 0), pct(stats.self_employed_count, stats.total_alumni)],
        ['Awards Received', String(stats.awards_count || 0), pct(stats.awards_count, stats.total_alumni)],
        ['Employment Rate', '', `${stats.employment_rate || 0}%`],
        ['Absorption Rate', '', `${stats.absorption_rate || 0}%`],
        ['High Position Rate', '', `${stats.high_position_rate || 0}%`],
      ];
      children.push(...createSummaryTable('AACUP Statistics Summary', summaryData));
      
      // Add footer BEFORE detailed alumni data
      children.push(...await addWordFooter());
      
      // Add detailed alumni data
      const detailedData = detailedDataByType['AACUP'] || [];
      children.push(...createDetailedTable('Detailed Alumni Data', detailedData));
    } else if (exportType === 'SUC' && statsByType['SUC']) {
      const stats = statsByType['SUC'];
      const summaryData = [
        ['Metric', 'Value', 'Percentage'],
        ['Total Alumni', String(stats.total_alumni || 0), '100%'],
        ['High Position', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
        ['Average Salary', formatCurrencyForPDF(stats.average_salary), '--'],
        ['Government', String(stats.public_count || 0), pct(stats.public_count, stats.total_alumni)],
        ['Private', String(stats.private_count || 0), pct(stats.private_count, stats.total_alumni)],
      ];
      children.push(...createSummaryTable('SUC Statistics Summary', summaryData));
      
      // Add footer BEFORE detailed alumni data
      children.push(...await addWordFooter());
      
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
      
      // Add footer BEFORE detailed alumni data
      children.push(...await addWordFooter());
      
      // Add detailed alumni data
      let detailedData = detailedDataByType['HIGH_POSITION'] || [];
      
      // Use high_position_data from stats if available, otherwise filter detailed data
      if (stats.high_position_data && Array.isArray(stats.high_position_data) && stats.high_position_data.length > 0) {
        // Convert high_position_data format to detailed data format
        detailedData = stats.high_position_data.map((hp: any) => ({
          Program: hp.course || '',
          Last_Name: hp.name?.split(' ').slice(-1)[0] || '',
          First_Name: hp.name?.split(' ')[0] || '',
          Middle_Name: hp.name?.split(' ').slice(1, -1).join(' ') || '',
          Company_Name_Current: hp.company || '',
          Position_Current: hp.position || '',
        }));
      } else if (detailedData.length > 0) {
        // Filter detailed data to only high position alumni
        detailedData = detailedData.filter((alumnus: any) => {
          const position = (alumnus.Position_Current || alumnus.position_current || '').toLowerCase();
          return position.includes('manager') || position.includes('director') || 
                 position.includes('ceo') || position.includes('president') || 
                 position.includes('vp') || position.includes('vice president') ||
                 position.includes('head') || position.includes('chief') ||
                 position.includes('executive') || position.includes('senior');
        });
      }
      
      // Always show detailed data section for consistency
      // If detailedData is still empty, try to get it from stats
      if (detailedData.length === 0 && stats.high_position_data && Array.isArray(stats.high_position_data) && stats.high_position_data.length > 0) {
        detailedData = stats.high_position_data.map((hp: any) => ({
          Program: hp.course || '',
          Last_Name: hp.name?.split(' ').slice(-1)[0] || '',
          First_Name: hp.name?.split(' ')[0] || '',
          Middle_Name: hp.name?.split(' ').slice(1, -1).join(' ') || '',
          Company_Name_Current: hp.company || '',
          Position_Current: hp.position || '',
        }));
      }
      
      // Always show the detailed data section header and table
      children.push(
        new Paragraph({
          text: 'High Position Detailed Alumni Data',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        })
      );
      
      const headers = headersHighPosition;
      const rows = detailedData.map((row: any) => mapHighPositionRow(row));
    
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            // Header row
            new TableRow({
              children: headers.map((header, idx) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: header,
                          bold: true,
                          color: 'FFFFFF',
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  width: { size: idx === 0 ? 15 : idx === 1 ? 15 : idx === 2 ? 15 : idx === 3 ? 15 : idx === 4 ? 20 : 20, type: WidthType.PERCENTAGE },
                })
              ),
            }),
            // Data rows
            ...rows.map((row) =>
              new TableRow({
                children: row.map((cell: any, idx: number) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        text: String(cell || ''),
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    borders: {
                      top: { style: BorderStyle.SINGLE },
                      bottom: { style: BorderStyle.SINGLE },
                      left: { style: BorderStyle.SINGLE },
                      right: { style: BorderStyle.SINGLE },
                    },
                  })
                ),
              })
            ),
          ],
        })
      );
    } else if (exportType === 'ALL') {
      // PHASE 1: Summary for all types (summaries ONLY)
      for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
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
            ['Average Salary', formatCurrencyForPDF(stats.average_salary), '--'],
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
        } else if (type === 'HIGH_POSITION') {
          summaryData.push(
            ['Total Alumni', String(stats.total_alumni || 0), '100%'],
            ['High Position Alumni', String(stats.high_position_count || 0), pct(stats.high_position_count, stats.total_alumni)],
            ['High Position Rate', '', `${stats.high_position_rate || 0}%`]
          );
        }

        children.push(...createSummaryTable(`${type === 'HIGH_POSITION' ? 'High Position' : type} Statistics`, summaryData));
        
        // Add Employability Report by Program table for QPRO in ALL export
        if (type === 'QPRO') {
          const programBreakdown = calculateQPROProgramBreakdown(detailedDataByType['QPRO'] || []);
          
          children.push(
            new Paragraph({
              text: 'Employability Report by Program',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 240, after: 120 },
            })
          );
          
          // Create the breakdown table with two-row header (same structure as QPRO-only export)
          const breakdownRows = [
            // First header row
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'PROGRAMS', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  verticalMerge: 'restart',
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  verticalMerge: 'restart',
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'E', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  verticalMerge: 'restart',
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'UE', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  verticalMerge: 'restart',
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'NT', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  verticalMerge: 'restart',
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'GT', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  verticalMerge: 'restart',
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'FIRST QUARTER', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  columnSpan: 3,
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'SECOND QUARTER', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  columnSpan: 3,
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'THIRD QUARTER', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  columnSpan: 3,
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'FOURTH QUARTER', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                  shading: { fill: argbToDocxShading('FF1D4E89') },
                  columnSpan: 3,
                }),
              ],
            }),
            // Second header row
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
                new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
                new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
                new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
                new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
                new TableCell({ children: [new Paragraph('')], verticalMerge: 'continue' }),
                ...['E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT'].map(text =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                    shading: { fill: argbToDocxShading('FF1D4E89') },
                  })
                ),
              ],
            }),
            // Data rows
            ...programBreakdown.map(progData =>
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: progData.program, bold: progData.isTotal || false })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: String(progData.total), bold: progData.isTotal || false })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: String(progData.employed), bold: progData.isTotal || false })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: String(progData.unemployed), bold: progData.isTotal || false })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: String(progData.notTracked), bold: progData.isTotal || false })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: progData.trackingRate, bold: progData.isTotal || false })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  ...[
                    progData.q1.employed, progData.q1.unemployed, progData.q1.trackingRate,
                    progData.q2.employed, progData.q2.unemployed, progData.q2.trackingRate,
                    progData.q3.employed, progData.q3.unemployed, progData.q3.trackingRate,
                    progData.q4.employed, progData.q4.unemployed, progData.q4.trackingRate,
                  ].map(val =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: String(val), bold: progData.isTotal || false })],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                    })
                  ),
                ],
              })
            ),
          ];
          
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: breakdownRows,
              borders: {
                top: { style: BorderStyle.SINGLE },
                bottom: { style: BorderStyle.SINGLE },
                left: { style: BorderStyle.SINGLE },
                right: { style: BorderStyle.SINGLE },
                insideHorizontal: { style: BorderStyle.SINGLE },
                insideVertical: { style: BorderStyle.SINGLE },
              },
            })
          );
        }
      }

      // PHASE 2: Add footer BEFORE all detailed data
      children.push(...await addWordFooter());

      // PHASE 3: Add detailed alumni data for ALL types
      for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
        let detailedData = detailedDataByType[type] || [];
        if (detailedData.length === 0) continue;
        
        // For HIGH_POSITION, filter to only show high position alumni
        if (type === 'HIGH_POSITION') {
          const stats = statsByType[type];
          if (stats?.high_position_data && Array.isArray(stats.high_position_data) && stats.high_position_data.length > 0) {
            detailedData = stats.high_position_data.map((hp: any) => ({
              Program: hp.course || '',
              Batch_Graduated: hp.year_graduated || hp.batch || '',
              Last_Name: hp.name?.split(' ').slice(-1)[0] || '',
              First_Name: hp.name?.split(' ')[0] || '',
              Middle_Name: hp.name?.split(' ').slice(1, -1).join(' ') || '',
              Company_Name_Current: hp.company || '',
              Position_Current: hp.position || '',
            }));
          } else if (detailedData.length > 0) {
            detailedData = detailedData.filter((alumnus: any) => {
              const position = (alumnus.Position_Current || alumnus.position_current || '').toLowerCase();
              return position.includes('manager') || position.includes('director') || 
                     position.includes('ceo') || position.includes('president') || 
                     position.includes('vp') || position.includes('vice president') ||
                     position.includes('head') || position.includes('chief') ||
                     position.includes('executive') || position.includes('senior');
            });
          }
        }
        
        // Add detailed data table for this type
        if (type === 'HIGH_POSITION') {
          children.push(
            new Paragraph({
              text: 'High Position Detailed Alumni Data',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            })
          );
          
          const headers = headersHighPosition;
          const rows = detailedData.map((row: any) => mapHighPositionRow(row));
          
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: headers.map((header, idx) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: header,
                              bold: true,
                              color: 'FFFFFF',
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      shading: { fill: argbToDocxShading('FF1D4E89') },
                      width: { size: idx === 0 ? 15 : idx === 1 ? 12 : idx === 2 ? 15 : idx === 3 ? 15 : idx === 4 ? 15 : idx === 5 ? 20 : 20, type: WidthType.PERCENTAGE },
                    })
                  ),
                }),
                ...rows.map((row) =>
                  new TableRow({
                    children: row.map((cell: any, idx: number) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            text: String(cell || ''),
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        borders: {
                          top: { style: BorderStyle.SINGLE },
                          bottom: { style: BorderStyle.SINGLE },
                          left: { style: BorderStyle.SINGLE },
                          right: { style: BorderStyle.SINGLE },
                        },
                      })
                    ),
                  })
                ),
              ],
            })
          );
        } else {
          children.push(...createDetailedTable(`${type} Detailed Alumni Data`, detailedData));
        }
      }
    }

    // ========================================
    // WORD FOOTER - NOW ADDED BEFORE DETAILED DATA
    // ========================================
    // Footer is now added BEFORE detailed alumni data in each section above using addWordFooter()
    // No need to add footer here again

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
        showToast('PDF exported successfully!');
        return;
      } else if (format === 'word') {
        await exportToWord(statsByType, detailedDataByType, exportType);
        setExporting(false);
        showToast('Word document exported successfully!');
        return;
      }

      // Continue with Excel export if format is 'excel'
      const workbook = new ExcelJS.Workbook();

      // If exporting only QPRO, produce a single-tab workbook with summary + details (no charts)
      if (!allStats && generatedStats?.type === 'QPRO') {
        const sheet = workbook.addWorksheet('QPRO Report');
        
        // Add institutional header
        let r = await addInstitutionalHeaderToExcel(workbook, sheet, 1);
        
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
        // Make summary headers bold with blue background and white text
        ['A', 'B', 'C'].forEach(col => {
          sheet.getCell(`${col}${r}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          sheet.getCell(`${col}${r}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
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

        // Add Employability Report by Program table
        sheet.getCell(`A${r}`).value = '=== EMPLOYABILITY REPORT BY PROGRAM ==='; r++;
        
        const programBreakdown = calculateQPROProgramBreakdown(detailedDataByType['QPRO'] || []);
        
        // First header row with overall stats and quarter labels
        const progHeaderRow = sheet.addRow([
          'PROGRAMS', 'TOTAL', 'E', 'UE', 'NT', 'GT', '', '', '', '', '', '', '', '', '', '', '', ''
        ]);
        progHeaderRow.eachCell((cell, colNumber) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Merge cells for quarter labels
        sheet.mergeCells(`G${r}:I${r}`);
        sheet.mergeCells(`J${r}:L${r}`);
        sheet.mergeCells(`M${r}:O${r}`);
        sheet.mergeCells(`P${r}:R${r}`);
        
        sheet.getCell(`G${r}`).value = 'FIRST QUARTER';
        sheet.getCell(`J${r}`).value = 'SECOND QUARTER';
        sheet.getCell(`M${r}`).value = 'THIRD QUARTER';
        sheet.getCell(`P${r}`).value = 'FOURTH QUARTER';
        
        ['G', 'J', 'M', 'P'].forEach(col => {
          sheet.getCell(`${col}${r}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          sheet.getCell(`${col}${r}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
          sheet.getCell(`${col}${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
        });
        r++;
        
        // Second header row
        const progSubHeaderRow = sheet.addRow([
          '', '', '', '', '', '', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT'
        ]);
        progSubHeaderRow.eachCell((cell, colNumber) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        r++;
        
        // Add data rows
        programBreakdown.forEach(progData => {
          const progRow = sheet.addRow([
            progData.program,
            progData.total,
            progData.employed,
            progData.unemployed,
            progData.notTracked,
            progData.trackingRate,
            progData.q1.employed,
            progData.q1.unemployed,
            progData.q1.trackingRate,
            progData.q2.employed,
            progData.q2.unemployed,
            progData.q2.trackingRate,
            progData.q3.employed,
            progData.q3.unemployed,
            progData.q3.trackingRate,
            progData.q4.employed,
            progData.q4.unemployed,
            progData.q4.trackingRate,
          ]);
          
          // Style TOTAL row
          if (progData.isTotal) {
            progRow.eachCell((cell) => {
              cell.font = { bold: true };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' }
              };
            });
          }
          
          r++;
        });
        r += 2;

        // Add institutional footer BEFORE detailed data
        r = await addInstitutionalFooterToExcel(workbook, sheet, r);
        r += 2; // Add spacing after footer

        sheet.getCell(`A${r}`).value = 'QPRO Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(qproHeaders);
        // Make headers bold with blue background and white text
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
        r++;
        const mapped = sortAlumniData((detailedDataByType['QPRO'] || []).map(mapQPRORow));
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
        
        // Add institutional header
        let r = await addInstitutionalHeaderToExcel(workbook, sheet, 1);
        
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
        // Make summary headers bold with blue background and white text
        ['A', 'B', 'C'].forEach(col => {
          sheet.getCell(`${col}${r}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          sheet.getCell(`${col}${r}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
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

        // Add institutional footer BEFORE detailed data
        r = await addInstitutionalFooterToExcel(workbook, sheet, r);
        r += 2; // Add spacing after footer

        // Detailed
        sheet.getCell(`A${r}`).value = 'CHED Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(qproHeaders);
        // Make headers bold with blue background and white text
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
        r++;
        const mapped = sortAlumniData((detailedDataByType['CHED'] || []).map(mapQPRORow));
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
        
        // Add institutional header
        let r = await addInstitutionalHeaderToExcel(workbook, sheet, 1);
        
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
        // Make summary headers bold with blue background and white text
        ['A', 'B', 'C'].forEach(col => {
          sheet.getCell(`${col}${r}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          sheet.getCell(`${col}${r}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
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
        // Self-Employed
        const selfEmployed = Number(generatedStats.self_employed_count) || 0;
        sheet.getCell(`A${r}`).value = 'Self-Employed';
        sheet.getCell(`B${r}`).value = selfEmployed;
        sheet.getCell(`C${r}`).value = `${pct(selfEmployed, generatedStats.total_alumni)}`; r++;
        // Awards Received
        const awards = Number(generatedStats.awards_count) || 0;
        sheet.getCell(`A${r}`).value = 'Awards Received';
        sheet.getCell(`B${r}`).value = awards;
        sheet.getCell(`C${r}`).value = `${pct(awards, generatedStats.total_alumni)}`; r++;
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

        // Add institutional footer BEFORE detailed data
        r = await addInstitutionalFooterToExcel(workbook, sheet, r);
        r += 2; // Add spacing after footer

        // Detailed
        sheet.getCell(`A${r}`).value = 'AACUP Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(qproHeaders);
        // Make headers bold with blue background and white text
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
        r++;
        const mapped2 = sortAlumniData((detailedDataByType['AACUP'] || []).map(mapQPRORow));
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
        
        // Add institutional header
        let r = await addInstitutionalHeaderToExcel(workbook, sheet, 1);
        
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
        // Make summary headers bold with blue background and white text
        ['A', 'B', 'C'].forEach(col => {
          sheet.getCell(`${col}${r}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          sheet.getCell(`${col}${r}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
        r++;
        // High Position metrics (Total Alumni first, matching PDF/Word format)
        sheet.getCell(`A${r}`).value = 'Total Alumni';
        sheet.getCell(`B${r}`).value = generatedStats.total_alumni;
        sheet.getCell(`C${r}`).value = '100%'; r++;
        const hpCount = Number(generatedStats.high_position_count) || 0;
        sheet.getCell(`A${r}`).value = 'High Position Alumni';
        sheet.getCell(`B${r}`).value = hpCount;
        sheet.getCell(`C${r}`).value = `${pct(hpCount, generatedStats.total_alumni)}`; r++;
        sheet.getCell(`A${r}`).value = 'High Position Rate';
        sheet.getCell(`C${r}`).value = `${generatedStats.high_position_rate || pct(hpCount, generatedStats.total_alumni)}%`; r += 2;

        // Detailed: only high-position alumni with limited columns
        // Always show detailed data section for consistency
        const headersHP = ['Program','Last_Name','First_Name','Middle_Name','Company_Name_Current','Position_Current'];
        sheet.getCell(`A${r}`).value = 'High Position Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(headersHP);
        // Make headers bold with blue background and white text
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
        r++;

        // Add institutional footer BEFORE detailed data
        r = await addInstitutionalFooterToExcel(workbook, sheet, r);
        r += 2; // Add spacing after footer

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
          // If raw data is empty, try to get from high_position_data in stats
          if (raw.length === 0 && generatedStats.high_position_data && Array.isArray(generatedStats.high_position_data)) {
            generatedStats.high_position_data.forEach((alumnus: any) => {
              const course = alumnus.course || '';
              const name = (alumnus.name || '').trim();
              const parts = name.split(/\s+/);
              const first = parts[0] || '';
              const last = parts.length > 1 ? parts[parts.length - 1] : '';
              const middle = parts.length > 2 ? parts.slice(1, parts.length - 1).join(' ') : '';
              rows.push([
                course,
                last,
                first,
                middle,
                alumnus.company || '',
                alumnus.position || '',
              ]);
            });
          } else {
          raw.forEach((row: any) => {
              // Check if it's a high position (either has Position_Current or matches high position criteria)
              const position = (row['Position_Current'] || row['position_current'] || '').toLowerCase();
              const isHighPosition = position && (
                position.includes('manager') || position.includes('director') || 
                position.includes('ceo') || position.includes('president') || 
                position.includes('vp') || position.includes('vice president') ||
                position.includes('head') || position.includes('chief') ||
                position.includes('executive') || position.includes('senior')
              );
              
              if (row['Position_Current'] || isHighPosition) {
              rows.push([
                row['Program'] || '',
                  row['Last_Name'] || '',
                row['First_Name'] || '',
                row['Middle_Name'] || '',
                row['Company_Name_Current'] || '',
                row['Position_Current'] || '',
              ]);
            }
          });
        }
        }
        
        // Add rows (even if empty, to show the table structure)
        if (rows.length > 0) {
        // Respondents first: defined by having company or position
        rows.sort((a, b) => {
          const aAns = (a[4] && `${a[4]}`.trim()) || (a[5] && `${a[5]}`.trim()) ? 1 : 0;
          const bAns = (b[4] && `${b[4]}`.trim()) || (b[5] && `${b[5]}`.trim()) ? 1 : 0;
          return bAns - aAns;
        });
        rows.forEach((vals) => { sheet.addRow(vals); r++; });
        }

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
        let r = await addInstitutionalHeaderToExcel(workbook, sheet, 1);
        
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
        // Make summary headers bold with blue background and white text
        ['A', 'B', 'C'].forEach(col => {
          sheet.getCell(`${col}${r}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          sheet.getCell(`${col}${r}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
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
        const avgSalary = toNumericValue(generatedStats.average_salary);
        sheet.getCell(`A${r}`).value = 'Average Salary';
        if (avgSalary !== null) {
          sheet.getCell(`B${r}`).value = avgSalary;
          sheet.getCell(`B${r}`).numFmt = '"₱"#,##0.00';
        } else {
          sheet.getCell(`B${r}`).value = 'N/A';
        }
        sheet.getCell(`C${r}`).value = '--'; r++;
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

        // Add institutional footer BEFORE detailed data
        r = await addInstitutionalFooterToExcel(workbook, sheet, r);
        r += 2; // Add spacing after footer

        // Detailed
        sheet.getCell(`A${r}`).value = 'SUC Detailed Alumni Data'; r++;
        const headerRow = sheet.addRow(qproHeaders);
        // Make headers bold with blue background and white text
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
        r++;
        const mapped = sortAlumniData((detailedDataByType['SUC'] || []).map(mapQPRORow));
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
        // Add institutional header
        rowIdx = await addInstitutionalHeaderToExcel(workbook, worksheet, 1);
        
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
        
        // PHASE 1: Add ONLY summaries for all types
        for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
          const stats = statsByType[type];
          if (!stats) {
            console.warn(`No stats found for type: ${type}`);
            continue;
          }
          worksheet.getCell(`A${rowIdx}`).value = `${type === 'HIGH_POSITION' ? 'High Position' : type} Statistics`;
          worksheet.getCell(`A${rowIdx}`).font = { bold: true };
          rowIdx++;
          worksheet.getCell(`A${rowIdx}`).value = 'Metric';
          worksheet.getCell(`B${rowIdx}`).value = 'Value';
          worksheet.getCell(`C${rowIdx}`).value = 'Percentage';
          // Make headers bold with blue background and white text
          ['A', 'B', 'C'].forEach(col => {
            worksheet.getCell(`${col}${rowIdx}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getCell(`${col}${rowIdx}`).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF1D4E89' }
            };
          });
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
            rowIdx += 2;
            
            // Add Employability Report by Program table
            worksheet.getCell(`A${rowIdx}`).value = '=== EMPLOYABILITY REPORT BY PROGRAM ===';
            rowIdx++;
            
            const programBreakdown = calculateQPROProgramBreakdown(detailedDataByType['QPRO'] || []);
            
            // First header row with overall stats and quarter labels
            const progHeaderRow = worksheet.addRow([
              'PROGRAMS', 'TOTAL', 'E', 'UE', 'NT', 'GT', '', '', '', '', '', '', '', '', '', '', '', ''
            ]);
            progHeaderRow.eachCell((cell, colNumber) => {
              cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1D4E89' }
              };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            
            // Merge cells for quarter labels
            worksheet.mergeCells(`G${rowIdx}:I${rowIdx}`);
            worksheet.mergeCells(`J${rowIdx}:L${rowIdx}`);
            worksheet.mergeCells(`M${rowIdx}:O${rowIdx}`);
            worksheet.mergeCells(`P${rowIdx}:R${rowIdx}`);
            
            worksheet.getCell(`G${rowIdx}`).value = 'FIRST QUARTER';
            worksheet.getCell(`J${rowIdx}`).value = 'SECOND QUARTER';
            worksheet.getCell(`M${rowIdx}`).value = 'THIRD QUARTER';
            worksheet.getCell(`P${rowIdx}`).value = 'FOURTH QUARTER';
            
            ['G', 'J', 'M', 'P'].forEach(col => {
              worksheet.getCell(`${col}${rowIdx}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
              worksheet.getCell(`${col}${rowIdx}`).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1D4E89' }
              };
              worksheet.getCell(`${col}${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
            });
            rowIdx++;
            
            // Second header row
            const progSubHeaderRow = worksheet.addRow([
              '', '', '', '', '', '', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT', 'E', 'UE', 'GT'
            ]);
            progSubHeaderRow.eachCell((cell, colNumber) => {
              cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1D4E89' }
              };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            rowIdx++;
            
            // Add data rows
            programBreakdown.forEach(progData => {
              const progRow = worksheet.addRow([
                progData.program,
                progData.total,
                progData.employed,
                progData.unemployed,
                progData.notTracked,
                progData.trackingRate,
                progData.q1.employed,
                progData.q1.unemployed,
                progData.q1.trackingRate,
                progData.q2.employed,
                progData.q2.unemployed,
                progData.q2.trackingRate,
                progData.q3.employed,
                progData.q3.unemployed,
                progData.q3.trackingRate,
                progData.q4.employed,
                progData.q4.unemployed,
                progData.q4.trackingRate,
              ]);
              
              // Style TOTAL row
              if (progData.isTotal) {
                progRow.eachCell((cell) => {
                  cell.font = { bold: true };
                  cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFFFFF' }
                  };
                });
              }
              
              rowIdx++;
            });
            rowIdx += 2;
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
          const avgSalary = toNumericValue(stats.average_salary);
          worksheet.getCell(`A${rowIdx}`).value = 'Average Salary';
          if (avgSalary !== null) {
            worksheet.getCell(`B${rowIdx}`).value = avgSalary;
            worksheet.getCell(`B${rowIdx}`).numFmt = '"₱"#,##0.00';
          } else {
            worksheet.getCell(`B${rowIdx}`).value = 'N/A';
          }
          worksheet.getCell(`C${rowIdx}`).value = '--';
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
            worksheet.getCell(`A${rowIdx}`).value = 'Self-Employed Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.self_employed_count;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.self_employed_count, stats.total_alumni)}`;
            rowIdx++;
            worksheet.getCell(`A${rowIdx}`).value = 'Awards Received Count';
            worksheet.getCell(`B${rowIdx}`).value = stats.awards_count || 0;
            worksheet.getCell(`C${rowIdx}`).value =
              `${pct(stats.awards_count || 0, stats.total_alumni)}`;
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
        }
        
        // PHASE 2: Add footer BEFORE all detailed data
        rowIdx = await addInstitutionalFooterToExcel(workbook, worksheet, rowIdx);
        rowIdx += 2; // Add spacing after footer
        
        // PHASE 3: Add detailed data for ALL types
        worksheet.getCell(`A${rowIdx}`).value = '=== DETAILED ALUMNI DATA - ALL TYPES ===';
        worksheet.getCell(`A${rowIdx}`).font = { bold: true, size: 12 };
        rowIdx += 2;
        
        for (const type of ['QPRO', 'CHED', 'SUC', 'AACUP', 'HIGH_POSITION']) {
          const stats = statsByType[type];
          // Skip all chart images in ALL export
          // Build tailored detailed tables per type
          const rows = detailedDataByType[type] as any[];
            if (type === 'HIGH_POSITION') {
            // For HIGH_POSITION, prepare the data
            let highPositionRows: any[] = [];
            if (stats.high_position_data && Array.isArray(stats.high_position_data) && stats.high_position_data.length > 0) {
              // Convert high_position_data format to detailed data format
              highPositionRows = stats.high_position_data.map((hp: any) => ({
                Program: hp.course || '',
                Last_Name: hp.name?.split(' ').slice(-1)[0] || '',
                First_Name: hp.name?.split(' ')[0] || '',
                Middle_Name: hp.name?.split(' ').slice(1, -1).join(' ') || '',
                Company_Name_Current: hp.company || '',
                Position_Current: hp.position || '',
              }));
            } else if (Array.isArray(rows) && rows.length > 0) {
              // Filter to only high-position alumni if high_position_data is not available
                highPositionRows = rows.filter((alumnus: any) => {
                  const position = (alumnus.Position_Current || alumnus.position_current || '').toLowerCase();
                  return position.includes('manager') || position.includes('director') || 
                         position.includes('ceo') || position.includes('president') || 
                         position.includes('vp') || position.includes('vice president') ||
                         position.includes('head') || position.includes('chief') ||
                         position.includes('executive') || position.includes('senior');
                });
              }
              
            // Always show detailed data section for HIGH_POSITION
            worksheet.getCell(`A${rowIdx}`).value = 'High Position Detailed Alumni Data';
            rowIdx++;
              const mappedHP = highPositionRows.map(mapHighPositionRow);
              const headerRow = worksheet.addRow(headersHighPosition);
              // Make headers bold with blue background and white text
              headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FF1D4E89' }
                };
              });
              rowIdx++;
              mappedHP.forEach((vals: (string | number)[]) => { worksheet.addRow(vals); rowIdx++; });
            
            // Also create a separate complete worksheet for HIGH_POSITION
            const hpDetailSheet = workbook.addWorksheet('High Position Statistics');
            let hpDetailRowIdx = await addInstitutionalHeaderToExcel(workbook, hpDetailSheet, 1);
            
            // Add metadata
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = 'Generated Date';
            hpDetailSheet.getCell(`B${hpDetailRowIdx}`).value = new Date().toLocaleDateString();
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).font = { bold: true };
            hpDetailRowIdx++;
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = 'Year Filter';
            hpDetailSheet.getCell(`B${hpDetailRowIdx}`).value = selectedYear || 'ALL';
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).font = { bold: true };
            hpDetailRowIdx++;
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = 'Program Filter';
            hpDetailSheet.getCell(`B${hpDetailRowIdx}`).value = selectedProgram || 'ALL';
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).font = { bold: true };
            hpDetailRowIdx += 2;
            
            // Add summary statistics
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = '=== SUMMARY STATISTICS ===';
            hpDetailRowIdx++;
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = 'Metric';
            hpDetailSheet.getCell(`B${hpDetailRowIdx}`).value = 'Value';
            hpDetailSheet.getCell(`C${hpDetailRowIdx}`).value = 'Percentage';
              ['A', 'B', 'C'].forEach(col => {
              hpDetailSheet.getCell(`${col}${hpDetailRowIdx}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
              hpDetailSheet.getCell(`${col}${hpDetailRowIdx}`).fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FF1D4E89' }
                };
              });
            hpDetailRowIdx++;
            
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = 'Total Alumni';
            hpDetailSheet.getCell(`B${hpDetailRowIdx}`).value = stats.total_alumni || 0;
            hpDetailSheet.getCell(`C${hpDetailRowIdx}`).value = '100%';
            hpDetailRowIdx++;
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = 'High Position Alumni';
            hpDetailSheet.getCell(`B${hpDetailRowIdx}`).value = stats.high_position_count || 0;
            hpDetailSheet.getCell(`C${hpDetailRowIdx}`).value = pct(stats.high_position_count, stats.total_alumni);
            hpDetailRowIdx++;
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = 'High Position Rate';
            hpDetailSheet.getCell(`C${hpDetailRowIdx}`).value = `${stats.high_position_rate || 0}%`;
            hpDetailRowIdx += 2;
            
            // Add footer BEFORE detailed data
            hpDetailRowIdx = await addInstitutionalFooterToExcel(workbook, hpDetailSheet, hpDetailRowIdx);
            hpDetailRowIdx += 2; // Add spacing after footer
            
            // Add detailed data
            hpDetailSheet.getCell(`A${hpDetailRowIdx}`).value = 'High Position Detailed Alumni Data';
            hpDetailRowIdx++;
            const hpDetailHeaderRow = hpDetailSheet.addRow(headersHighPosition);
            hpDetailHeaderRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FF1D4E89' }
                };
              });
            hpDetailRowIdx++;
              mappedHP.forEach((vals: (string | number)[]) => { 
              hpDetailSheet.addRow(vals); 
              hpDetailRowIdx++; 
            });
            
            autoSizeAndWrapSheet(hpDetailSheet);
          } else if (Array.isArray(rows) && rows.length > 0) {
            worksheet.getCell(`A${rowIdx}`).value = `${type} Detailed Alumni Data`;
            rowIdx++;
              const headerRow = worksheet.addRow(qproHeaders);
              // Make headers bold with blue background and white text
              headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FF1D4E89' }
                };
              });
              rowIdx++;
            const mapped = sortAlumniData(rows.map(mapQPRORow));
              mapped.forEach((vals) => { worksheet.addRow(vals); rowIdx++; });
              
            // Also create a separate complete worksheet for this type
            const detailSheet = workbook.addWorksheet(`${type} Statistics`);
              let detailRowIdx = await addInstitutionalHeaderToExcel(workbook, detailSheet, 1);
              
            // Add metadata
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Generated Date';
              detailSheet.getCell(`B${detailRowIdx}`).value = new Date().toLocaleDateString();
              detailSheet.getCell(`A${detailRowIdx}`).font = { bold: true };
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Year Filter';
              detailSheet.getCell(`B${detailRowIdx}`).value = selectedYear || 'ALL';
              detailSheet.getCell(`A${detailRowIdx}`).font = { bold: true };
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Program Filter';
              detailSheet.getCell(`B${detailRowIdx}`).value = selectedProgram || 'ALL';
              detailSheet.getCell(`A${detailRowIdx}`).font = { bold: true };
              detailRowIdx += 2;
            
            // Add summary statistics for this type
              detailSheet.getCell(`A${detailRowIdx}`).value = '=== SUMMARY STATISTICS ===';
              detailRowIdx++;
              detailSheet.getCell(`A${detailRowIdx}`).value = 'Metric';
              detailSheet.getCell(`B${detailRowIdx}`).value = 'Value';
              detailSheet.getCell(`C${detailRowIdx}`).value = 'Percentage';
              ['A', 'B', 'C'].forEach(col => {
                detailSheet.getCell(`${col}${detailRowIdx}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                detailSheet.getCell(`${col}${detailRowIdx}`).fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FF1D4E89' }
                };
              });
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
              
            // Add footer BEFORE detailed data
            detailRowIdx = await addInstitutionalFooterToExcel(workbook, detailSheet, detailRowIdx);
            detailRowIdx += 2; // Add spacing after footer
              
            // Add detailed data
            detailSheet.getCell(`A${detailRowIdx}`).value = `${type} Detailed Alumni Data`;
            detailRowIdx++;
              const detailHeaderRow = detailSheet.addRow(qproHeaders);
              detailHeaderRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FF1D4E89' }
                };
              });
              detailRowIdx++;
              mapped.forEach((vals) => { 
                detailSheet.addRow(vals);
                detailRowIdx++;
              });
              
              autoSizeAndWrapSheet(detailSheet);
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
        // Make summary headers bold with blue background and white text
        ['A', 'B', 'C'].forEach(col => {
          worksheet.getCell(`${col}${rowIdx}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          worksheet.getCell(`${col}${rowIdx}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1D4E89' }
          };
        });
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
        
        // Add institutional footer BEFORE detailed data
        rowIdx = await addInstitutionalFooterToExcel(workbook, worksheet, rowIdx);
        rowIdx += 2; // Add spacing after footer
        
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

      // Footer is now added BEFORE detailed data in each section above
      // No need to add footer here again

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
      showToast('Excel file exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      showToast('Error exporting data. Please try again.', 'error');
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
                  <td style={td}>Average Salary</td>
                  <td style={td}>{formatCurrency(stats.average_salary)}</td>
                  <td style={td}>--</td>
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
                  <td style={td}>Self-Employed</td>
                  <td style={td}>{Number(stats.self_employed_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.self_employed_count) || 0, Number(stats.total_alumni) || 0)}</td>
                </tr>
                <tr>
                  <td style={td}>Awards Received</td>
                  <td style={td}>{Number(stats.awards_count) || 0}</td>
                  <td style={td}>{pct(Number(stats.awards_count) || 0, Number(stats.total_alumni) || 0)}</td>
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
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setNeedsRegenerate(true);
              }}
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
              onChange={(e) => {
                setSelectedProgram(e.target.value);
                setNeedsRegenerate(true);
              }}
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
              onChange={(e) => {
                setSelectedType(e.target.value as StatsType);
                setNeedsRegenerate(true);
              }}
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
            style={{
              ...exportButton, 
              backgroundColor: '#28a745', 
              marginRight: '8px',
              opacity: (exporting || loading || needsRegenerate) ? 0.5 : 1,
              cursor: (exporting || loading || needsRegenerate) ? 'not-allowed' : 'pointer'
            }}
            onClick={() => handleExportCompleteData('excel')}
            disabled={exporting || loading || needsRegenerate}
            title={needsRegenerate ? 'Please click Generate first' : 'Export data to Excel format'}
          >
            {exporting ? '⏳ Exporting...' : '📊 Export Excel'}
          </button>
          <button
            style={{
              ...exportButton, 
              backgroundColor: '#dc3545', 
              marginRight: '8px',
              opacity: (exporting || loading || needsRegenerate) ? 0.5 : 1,
              cursor: (exporting || loading || needsRegenerate) ? 'not-allowed' : 'pointer'
            }}
            onClick={() => handleExportCompleteData('pdf')}
            disabled={exporting || loading || needsRegenerate}
            title={needsRegenerate ? 'Please click Generate first' : 'Export data to PDF format'}
          >
            {exporting ? '⏳ Exporting...' : '📄 Export PDF'}
          </button>
          <button
            style={{
              ...exportButton, 
              backgroundColor: '#0d6efd', 
              marginRight: '8px',
              opacity: (exporting || loading || needsRegenerate) ? 0.5 : 1,
              cursor: (exporting || loading || needsRegenerate) ? 'not-allowed' : 'pointer'
            }}
            onClick={() => handleExportCompleteData('word')}
            disabled={exporting || loading || needsRegenerate}
            title={needsRegenerate ? 'Please click Generate first' : 'Export data to Word format'}
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

      {/* Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: toast.type === 'success' ? '#28a745' : '#dc3545',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 10000,
          maxWidth: '400px',
          animation: 'slideIn 0.3s ease-out',
          fontSize: '14px',
          fontWeight: '500',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.type === 'success' ? (
              <span style={{ fontSize: '20px' }}>✓</span>
            ) : (
              <span style={{ fontSize: '20px' }}>✕</span>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
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

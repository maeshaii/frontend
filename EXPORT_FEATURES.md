# Multi-Format Export Feature Documentation

## Overview
The Alumni Statistics Export system now supports **three export formats**:
- 📊 **Excel** (.xlsx) - Comprehensive spreadsheets with multiple tabs
- 📄 **PDF** (.pdf) - Professional formatted reports  
- 📝 **Word** (.docx) - Editable documents

## Location
**File:** `frontend/src/components/GenerateStatsModal.tsx`

**UI Path:** Admin → Statistics → View Users → Generate Statistics Button

## Features

### 1. Excel Export (Original + Enhanced)
- **Format:** .xlsx
- **Features:**
  - Multiple worksheets for different statistic types
  - Auto-sized columns with text wrapping
  - Detailed alumni data with all fields
  - Summary statistics with calculations
  - Color-coded headers
  
### 2. PDF Export (NEW)
- **Format:** .pdf
- **Features:**
  - Landscape orientation for better table display
  - Professional headers and metadata
  - Summary tables with color-coded headers
  - Detailed alumni data (first 100 records)
  - Automatic page breaks
  - Consistent branding colors

**Libraries Used:**
- `jspdf` - PDF generation
- `jspdf-autotable` - Table formatting

### 3. Word Export (NEW)
- **Format:** .docx
- **Features:**
  - Professional document structure
  - Heading hierarchy (H1, H2)
  - Formatted tables with headers
  - Metadata section
  - Editable content
  - Consistent styling

**Libraries Used:**
- `docx` - Word document generation
- `file-saver` - File download handling

## Supported Statistics Types

All export formats support these report types:
1. **QPRO** - Employment statistics
2. **CHED** - Further study and job alignment
3. **SUC** - High position and sector analysis
4. **AACUP** - Employment, absorption, and high position rates
5. **HIGH_POSITION** - Leadership position tracking
6. **ALL** - Combined report with all types

## Usage

### For End Users
1. Navigate to **Admin → Statistics → View Users**
2. Click **"Generate Statistics"** button
3. Select filters:
   - Year (e.g., 2024, ALL)
   - Program (e.g., BSIT, BSIS, BIT-CT, ALL)
   - Statistics Type (QPRO, CHED, SUC, AACUP, HIGH_POSITION, ALL)
4. Click **"Generate"** to preview statistics
5. Choose export format:
   - **📊 Export Excel** - Full detailed export with all data
   - **📄 Export PDF** - Print-ready professional report
   - **📝 Export Word** - Editable document for customization

### For Developers

#### Adding a New Export Format

```typescript
// 1. Create export function
const exportToNewFormat = async (
  statsByType: Record<string, any>,
  detailedDataByType: Record<string, any[]>,
  exportType: string
) => {
  // Implementation here
};

// 2. Add to handleExportCompleteData
const handleExportCompleteData = async (format: 'excel' | 'pdf' | 'word' | 'newformat' = 'excel') => {
  // ... existing code ...
  
  if (format === 'newformat') {
    await exportToNewFormat(statsByType, detailedDataByType, exportType);
    setExporting(false);
    alert('New format exported successfully!');
    return;
  }
  
  // ... rest of code ...
};

// 3. Add button to UI
<button
  style={{...exportButton, backgroundColor: '#yourcolor'}}
  onClick={() => handleExportCompleteData('newformat')}
  disabled={exporting || loading}
  title="Export to new format"
>
  {exporting ? '⏳ Exporting...' : '🎯 Export NewFormat'}
</button>
```

## File Naming Convention

All exports follow this pattern:
```
Alumni_Statistics_{TYPE}_{YEAR}_{PROGRAM}.{extension}
```

**Examples:**
- `Alumni_Statistics_QPRO_2024_BSIT.xlsx`
- `Alumni_Statistics_ALL_2024_ALL.pdf`
- `Alumni_Statistics_CHED_2023_BSIS.docx`

## Data Structure

### Statistics by Type

#### QPRO Statistics
```typescript
{
  total_alumni: number;
  employed_count: number;
  unemployed_count: number;
  untracked_count: number;
  employment_rate: number;
}
```

#### CHED Statistics
```typescript
{
  total_alumni: number;
  pursuing_further_study: number;
  further_study_rate: number;
  job_aligned_count: number;
  self_employed_count: number;
}
```

#### SUC Statistics
```typescript
{
  total_alumni: number;
  high_position_count: number;
  public_count: number;
  private_count: number;
  local_count: number;
  international_count: number;
}
```

#### AACUP Statistics
```typescript
{
  total_alumni: number;
  employed_count: number;
  absorbed_count: number;
  high_position_count: number;
  employment_rate: number;
  absorption_rate: number;
}
```

## Dependencies

### Package Installation
```bash
cd frontend
npm install jspdf jspdf-autotable docx file-saver
npm install --save-dev @types/file-saver
```

### Package Versions (Current)
```json
{
  "jspdf": "^3.0.1",
  "jspdf-autotable": "^3.8.4",
  "docx": "^9.5.1",
  "file-saver": "^2.0.5",
  "exceljs": "^4.4.0"
}
```

## Color Scheme

The exports use consistent branding colors:

| Type | Color (RGB) | Hex | Usage |
|------|-------------|-----|-------|
| QPRO | [29, 78, 137] | #1D4E89 | Primary Blue |
| CHED | [23, 162, 184] | #17A2B8 | Info Teal |
| SUC | [29, 78, 137] | #1D4E89 | Primary Blue |
| AACUP | [40, 167, 69] | #28A745 | Success Green |
| HIGH_POSITION | [255, 193, 7] | #FFC107 | Warning Yellow |

## Performance Considerations

1. **PDF Export**: Limited to first 100 detailed records to prevent memory issues
2. **Word Export**: Optimized table generation for large datasets
3. **Excel Export**: No limitations, handles full dataset
4. **Async Operations**: All exports are asynchronous with loading states

## Error Handling

All export functions include:
- Try-catch blocks for error handling
- User-friendly error alerts
- Console logging for debugging
- Loading state management

```typescript
try {
  // Export logic
  alert('Export successful!');
} catch (error) {
  console.error('Export error:', error);
  alert('Error exporting data. Please try again.');
} finally {
  setExporting(false);
}
```

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE11 (Not supported)

## Troubleshooting

### Issue: Export button disabled
**Solution:** Ensure statistics are generated first by clicking "Generate"

### Issue: PDF looks cut off
**Solution:** PDF uses landscape orientation automatically. Check zoom level when viewing.

### Issue: Word document formatting issues
**Solution:** Open in Microsoft Word or LibreOffice for best compatibility.

### Issue: Excel formulas not calculating
**Solution:** Excel uses static values, not formulas. Percentages are pre-calculated.

## Future Enhancements

Potential improvements:
- [ ] CSV export option
- [ ] Charts embedded in PDF/Word
- [ ] Custom template support
- [ ] Batch export for multiple years
- [ ] Email export functionality
- [ ] Scheduled automated exports

## Changelog

### Version 2.0.0 (October 2025)
- ✨ Added PDF export functionality
- ✨ Added Word document export functionality
- 🎨 Updated UI with three separate export buttons
- 🐛 Fixed export type routing logic
- 📚 Added comprehensive documentation

### Version 1.0.0 (Previous)
- ✅ Excel export functionality
- ✅ Multiple statistics types support
- ✅ Detailed alumni data export

## Support

For issues or questions:
1. Check console for error messages
2. Verify all dependencies are installed
3. Clear browser cache
4. Contact development team

---

**Last Updated:** October 10, 2025  
**Developed by:** Senior Development Team  
**Component:** GenerateStatsModal.tsx















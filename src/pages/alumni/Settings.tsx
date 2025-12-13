import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';
import { Box, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, Alert, InputAdornment, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Checkbox, FormControlLabel, FormGroup, Divider, Table, TableBody, TableCell, TableHead, TableRow, TableContainer } from '@mui/material';
import PasswordVisibilityIcon from '../../components/PasswordVisibilityIcon';
import { validatePassword as validatePasswordStrength } from '../../utils/passwordValidator';
import { trackerApi } from '../../services/trackerApi';
import { api } from '../../services/api';

interface UserData {
  user_id: number;
  f_name: string;
  l_name: string;
  m_name?: string;
  civil_status?: string;
  contact_number?: string;
  email: string;
  address?: string;
  home_address?: string;
  social_media?: string;
  profile_pic?: string;
}

// Utility function to format employment duration: "1_2_years" -> "1-2 years"
const formatEmploymentDuration = (duration: string | undefined | null): string => {
  if (!duration || typeof duration !== 'string') return duration || 'N/A';
  
  const durationMap: Record<string, string> = {
    'less_than_6_months': 'Less than 6 months',
    '6_months_1_year': '6 months – 1 year',
    '1_2_years': '1-2 years',
    '3_5_years': '3-5 years',
    'more_than_5_years': 'More than 5 years'
  };
  
  // Check if it's a known value
  if (durationMap[duration]) {
    return durationMap[duration];
  }
  
  // Fallback: Try to format unknown patterns
  let formatted = duration.trim();
  formatted = formatted.replace(/_/g, '-');
  formatted = formatted.replace(/-years$/i, ' years');
  formatted = formatted.replace(/-year$/i, ' year');
  formatted = formatted.replace(/-months$/i, ' months');
  formatted = formatted.replace(/-month$/i, ' month');
  
  return formatted;
};

// Utility function to format salary range: "10001_20000" -> "10,001 - 20,000"
const formatSalaryRange = (salary: string | undefined | null): string => {
  if (!salary || typeof salary !== 'string') return salary || 'N/A';
  
  const salaryMap: Record<string, string> = {
    'below_5000': '5,000 below',
    '5001_10000': '5,001 - 10,000',
    '10001_20000': '10,001 - 20,000',
    '20001_30000': '20,001 - 30,000',
    'above_30000': '30,000 above'
  };
  
  // Check if it's a known value
  if (salaryMap[salary]) {
    return salaryMap[salary];
  }
  
  // Fallback: Try to parse as numeric range (e.g., "10001_20000")
  if (salary.includes('_')) {
    const parts = salary.split('_');
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        return `${start.toLocaleString()} - ${end.toLocaleString()}`;
      }
    }
  }
  
  // If not a range, try to format as number if possible
  const num = parseFloat(salary.replace(/[^\d.]/g, ''));
  if (!isNaN(num)) {
    return num.toLocaleString();
  }
  
  return salary;
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>(() => {
    return localStorage.getItem('settingsActiveSection') || 'personal';
  });
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingEmployment, setIsEditingEmployment] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    f_name: '',
    l_name: '',
    m_name: '',
    civil_status: '',
    contact_number: '',
    email: '',
    address: '',
    home_address: '',
    social_media: ''
  });

  // Password change states
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValidation = useMemo(() => {
    return validatePasswordStrength(passwordData.new_password);
  }, [passwordData.new_password]);

  const [employmentData, setEmploymentData] = useState<any>({
    organization_name: '',
    date_hired: '',
    position: '',
    employment_status: '',
    company_address: '',
    sector: '',
    employment_duration_current: '',
    salary_current: '',
    scope_current: '',
    company_email: '',
    company_contact: '',
    contact_person: '',
    position_alt: '',
    ojt_start_date: '',
    job_alignment_status: '',
    job_alignment_category: '',
    job_alignment_title: '',
    job_alignment_suggested_program: '',
    job_alignment_original_program: '',
    self_employed: false,
    high_position: false,
    absorbed: false,
    awards_recognition_current: '',
    supporting_document_current: '',
    supporting_document_awards_recognition: '',
    unemployment_reason: '',
    created_at: '',
    updated_at: '',
    // Part III: Employment Status fields
    employment_type: '',
    current_employment_status: '',
    current_company_name: '',
    current_position: '',
    current_sector: '',
    current_scope: '',
    employment_duration: '',
    salary_range: '',
    received_awards: '',
    awards_supporting_doc: '',
    employment_supporting_doc: '',
    employment_sector: '',
    // Part IV: Further Study fields
    study_start_date: '',
    post_graduate_degree: '',
    institution_name: '',
    units_obtained: '',
    // File uploads
    awards_file: null,
    employment_file: null
  });

  const employmentSummaryRows = [
    {
      label: 'Employment Type',
      value: employmentData.employment_type || 'N/A'
    },
    {
      label: 'Current Employment Status',
      value: employmentData.current_employment_status || 'N/A'
    },
    {
      label: 'Company Name',
      value: employmentData.current_company_name || 'N/A'
    },
    {
      label: 'Current Position',
      value: employmentData.current_position || 'N/A'
    },
    {
      label: 'Sector',
      value: employmentData.current_sector || 'N/A'
    },
    {
      label: 'Scope',
      value: employmentData.current_scope || 'N/A'
    },
    {
      label: 'Employment Duration',
      value: formatEmploymentDuration(employmentData.employment_duration)
    },
    {
      label: 'Salary Range',
      value: formatSalaryRange(employmentData.salary_range)
    },
    {
      label: 'Received Awards',
      value: employmentData.received_awards || 'N/A'
    }
  ];

  const employmentHistoryRow = {
    company: employmentData.current_company_name || 'N/A',
    position: employmentData.current_position || 'N/A',
    sector: employmentData.current_sector || 'N/A',
    scope: employmentData.current_scope || 'N/A',
    duration: formatEmploymentDuration(employmentData.employment_duration),
    salary: formatSalaryRange(employmentData.salary_range)
  };

  const trackerDocuments = [
    employmentData.employment_supporting_doc
      ? {
          label: 'Employment Supporting Document',
          url: `http://127.0.0.1:8000${employmentData.employment_supporting_doc}`
        }
      : null,
    employmentData.awards_supporting_doc
      ? {
          label: 'Awards Supporting Document',
          url: `http://127.0.0.1:8000${employmentData.awards_supporting_doc}`
        }
      : null
  ].filter(Boolean) as Array<{ label: string; url: string }>;

  // Employment flow state
  const [accountType, setAccountType] = useState<string>(''); // 'alumni' or 'ojt'
  const [hasJobInDB, setHasJobInDB] = useState<boolean | null>(null); // Check if user has job in database (for alumni: tracker data, for ojt: employment data)
  const [isEmployed, setIsEmployed] = useState<boolean | null>(null); // Are you employed? (for new users)
  const [pursueFurtherStudy, setPursueFurtherStudy] = useState<boolean | null>(null); // Did you pursue further study?
  
  // Unemployment tracker questions
  const [unemploymentQuestions, setUnemploymentQuestions] = useState<any[]>([]);
  const [unemploymentResponses, setUnemploymentResponses] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const userStr = localStorage.getItem('user');
      console.log('Raw user string from localStorage:', userStr);
      
      if (!userStr) {
        console.error('No user data found in localStorage');
        navigate('/login');
        return;
      }
      
      const user = JSON.parse(userStr);
      console.log('Parsed user object:', user);
      
      // Try both user_id and id fields
      const userId = user.user_id || user.id;
      console.log('User ID (user_id):', user.user_id);
      console.log('User ID (id):', user.id);
      console.log('Final User ID:', userId);
      
      if (!userId) {
        console.error('No user_id or id found in user object:', user);
        navigate('/login');
        return;
      }
      
      const accessToken = localStorage.getItem('accessToken');
      console.log('Access token:', accessToken ? 'Found' : 'Not found');
      
      const url = `http://127.0.0.1:8000/api/alumni/profile/${userId}/`;
      console.log('Making request to:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      console.log('Settings API Response:', data);
      console.log('Response status:', response.status);
      
      if (response.ok && data) {
        setUserData(data);
        setFormData({
          f_name: data.f_name || '',
          l_name: data.l_name || '',
          m_name: data.m_name || '',
          civil_status: data.civil_status || '',
          contact_number: data.contact_number || '',
          email: data.email || '',
          address: data.address || '',
          home_address: data.home_address || '',
          social_media: data.social_media || ''
        });
        console.log('Form data set successfully:', {
          f_name: data.f_name || '',
          l_name: data.l_name || '',
          m_name: data.m_name || '',
          civil_status: data.civil_status || '',
          contact_number: data.contact_number || '',
          email: data.email || '',
          address: data.address || '',
          home_address: data.home_address || '',
          social_media: data.social_media || ''
        });
        
        // Fetch employment data
        await fetchEmploymentData(userId);
      } else {
        console.error('Failed to fetch user data:', data.error || 'Unknown error');
        console.error('Response not ok:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to normalize dropdown values to match options
  const normalizeDropdownValue = (value: string, options: string[]): string => {
    if (!value) return '';
    const trimmedValue = value.trim();
    // Exact match
    if (options.includes(trimmedValue)) return trimmedValue;
    // Case-insensitive match
    const matchedOption = options.find(opt => opt.toLowerCase() === trimmedValue.toLowerCase());
    if (matchedOption) return matchedOption;
    // Return original value if no match found
    return trimmedValue;
  };

  const fetchEmploymentData = async (userId: number) => {
    try {
      const { data } = await api.get(`alumni/employment/${userId}/`);
      
      if (data) {
        
        console.log('📊 RAW EMPLOYMENT API RESPONSE:', JSON.stringify(data, null, 2));
        
        // Normalize dropdown values to match options
        const normalizedEmploymentStatus = normalizeDropdownValue(
          data.current_employment_status || data.employment_status || '', 
          currentEmploymentStatusOptions
        );
        const normalizedSector = normalizeDropdownValue(
          data.current_sector || data.sector || '', 
          sectorRadioOptions
        );
        const normalizedScope = normalizeDropdownValue(
          data.current_scope || data.scope_current || '', 
          scopeOptions
        );
        const normalizedAwards = normalizeDropdownValue(
          data.received_awards || data.awards_recognition_current || '', 
          awardsOptions
        );
        const normalizedEmploymentType = normalizeDropdownValue(
          data.employment_type || '', 
          employmentTypeOptions
        );
        
        setEmploymentData({
          organization_name: data.organization_name || '',
          date_hired: data.date_hired || '',
          position: data.position || '',
          employment_status: data.employment_status || '',
          company_address: data.company_address || '',
          sector: data.sector || '',
          employment_duration_current: data.employment_duration_current || '',
          salary_current: data.salary_current || '',
          scope_current: data.scope_current || '',
          company_email: data.company_email || '',
          company_contact: data.company_contact || '',
          contact_person: data.contact_person || '',
          position_alt: data.position_alt || '',
          ojt_start_date: data.ojt_start_date || '',
          job_alignment_status: data.job_alignment_status || '',
          job_alignment_category: data.job_alignment_category || '',
          job_alignment_title: data.job_alignment_title || '',
          job_alignment_suggested_program: data.job_alignment_suggested_program || '',
          job_alignment_original_program: data.job_alignment_original_program || '',
          self_employed: data.self_employed || false,
          high_position: data.high_position || false,
          absorbed: data.absorbed || false,
          awards_recognition_current: data.awards_recognition_current || '',
          supporting_document_current: data.supporting_document_current || '',
          supporting_document_awards_recognition: data.supporting_document_awards_recognition || '',
          unemployment_reason: data.unemployment_reason || '',
          created_at: data.created_at || '',
          updated_at: data.updated_at || '',
          // Part III fields - prioritize tracker data fields from API response
          employment_type: data.employment_type || normalizedEmploymentType || '',
          current_employment_status: data.current_employment_status || normalizedEmploymentStatus || '',
          current_company_name: data.current_company_name || data.organization_name || '',
          current_position: data.current_position || data.position || '',
          current_sector: data.current_sector || normalizedSector || '',
          current_scope: data.current_scope || normalizedScope || '',
          employment_duration: data.employment_duration || data.employment_duration_current || '',
          salary_range: data.salary_range || data.salary_current || '',
          received_awards: data.received_awards || normalizedAwards || '',
          awards_supporting_doc: data.awards_supporting_doc || data.supporting_document_awards_recognition || '',
          employment_supporting_doc: data.employment_supporting_doc || data.supporting_document_current || '',
          employment_sector: data.employment_sector || '',
          // Part IV fields - ONLY use q_ prefixed fields (from tracker/AcademicInfo) - do NOT fallback to employment fields
          // These fields should ONLY come from AcademicInfo, never from EmploymentHistory
          study_start_date: data.q_study_start_date || data.study_start_date || '',
          // Ensure we're not accidentally getting company name, position, or dates from employment fields
          post_graduate_degree: (data.q_post_graduate_degree || data.post_graduate_degree || '').trim(),
          institution_name: (data.q_institution_name || data.institution_name || '').trim(),
          units_obtained: (data.q_units_obtained || data.units_obtained || '').trim(),
          // File uploads - always null on load
          awards_file: null,
          employment_file: null
        });
        
        // Set account type
        const accType = data.account_type || 'alumni'; // Default to alumni if not specified
        setAccountType(accType);
        
        // For OJT accounts: use has_employment_data
        if (accType === 'ojt') {
          const hasEmploymentData = data.has_employment_data || (data.organization_name && data.organization_name.trim() !== '');
          setHasJobInDB(hasEmploymentData);
          // OJT accounts are view-only, so always start in non-editing mode
          if (hasEmploymentData) {
            setIsEditingEmployment(false);
          }
          console.log('OJT - hasEmploymentData:', hasEmploymentData);
        } else {
          // For Alumni accounts: check if they have Part III tracker data
          // Use strict boolean checking to ensure we only show data when explicitly true
          const hasPartIIIData = data.has_part_iii_data === true;
          // Fallback: check if actual employment fields are populated (in case backend flag isn't set but data exists)
          // This is a safety check, but backend should always return correct has_part_iii_data
          const hasAnyEmploymentFields = Boolean(
            (data.employment_type && data.employment_type.trim() !== '') ||
            (data.current_employment_status && data.current_employment_status.trim() !== '') ||
            (data.current_company_name && data.current_company_name.trim() !== '') ||
            (data.current_position && data.current_position.trim() !== '') ||
            (data.employment_supporting_doc && data.employment_supporting_doc !== '')
          );
          
          console.log('🔍 Alumni Employment Check:');
          console.log('  - has_part_iii_data from API:', data.has_part_iii_data);
          console.log('  - hasPartIIIData (computed):', hasPartIIIData);
          console.log('  - hasAnyEmploymentFields (fallback):', hasAnyEmploymentFields);
          console.log('  - employment_type:', data.employment_type);
          console.log('  - current_company_name:', data.current_company_name);
          
          // Only show Employment Details if Part III data actually exists (actual fields filled in tracker)
          // DO NOT use has_tracker_data because that only checks if TrackerData record exists,
          // not whether the user has actually filled in employment information
          // Backend's has_part_iii_data already checks for actual field values, so rely on that
          setHasJobInDB(hasPartIIIData || hasAnyEmploymentFields);
          
          // If user has Part III data in DB, start in view mode (not editing)
          if (hasPartIIIData === true) {
            setIsEditingEmployment(false);
          }
          
          // Set pursueFurtherStudy based on existing data
          if (data.post_graduate_degree || data.q_post_graduate_degree) {
            setPursueFurtherStudy(true);
          } else if (hasPartIIIData) {
            setPursueFurtherStudy(false);
          }
          
          console.log('  - Final hasJobInDB value:', hasPartIIIData || hasAnyEmploymentFields);
          console.log('  - Debug info:', data.debug || 'No debug info');
        }
        
        console.log('Employment data loaded:', data);
      } else {
        console.error('Failed to fetch employment data - invalid response');
        // Set to false to show "Please answer tracker" prompt instead of loading forever
        setHasJobInDB(false);
        setAccountType('alumni'); // Default to alumni
      }
    } catch (error) {
      console.error('Error fetching employment data:', error);
      // Set to false to show "Please answer tracker" prompt instead of loading forever
      setHasJobInDB(false);
      setAccountType('alumni'); // Default to alumni
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEmploymentChange = (field: string, value: any) => {
    setEmploymentData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const userId = user.user_id || user.id;
      await api.put(`alumni/profile/${userId}/`, formData);

      alert('Profile updated successfully!');
      
      const updatedUserData = {
        ...user,
        f_name: formData.f_name,
        m_name: formData.m_name,
        l_name: formData.l_name,
        civil_status: formData.civil_status,
        contact_number: formData.contact_number,
        email: formData.email,
        address: formData.address,
        home_address: formData.home_address,
        social_media: formData.social_media
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUserData));
      console.log('Updated localStorage user data:', updatedUserData);
      
      fetchUserData();
      
      window.dispatchEvent(new CustomEvent('userDataUpdated', { 
        detail: updatedUserData 
      }));
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(error?.response?.data?.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (userData) {
      setFormData({
        f_name: userData.f_name || '',
        l_name: userData.l_name || '',
        m_name: userData.m_name || '',
        civil_status: userData.civil_status || '',
        contact_number: userData.contact_number || '',
        email: userData.email || '',
        address: userData.address || '',
        home_address: userData.home_address || '',
        social_media: userData.social_media || ''
      });
    }
  };

  const handleEmploymentSave = async () => {
    // For unemployed alumni, save unemployment responses to TrackerData
    if (accountType === 'alumni' && isEmployed === false && unemploymentQuestions.length > 0) {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return;
        
        const user = JSON.parse(userStr);
        const userId = user.user_id || user.id;
      const unemploymentQuestion = unemploymentQuestions[0];
      const unemploymentReasons = unemploymentResponses[unemploymentQuestion.id] || [];
      
      await api.put(`alumni/employment/${userId}/`, {
        unemployment_reason: unemploymentReasons,
        q_unemployment_reason: unemploymentReasons
      });
      
      alert('Unemployment information saved successfully!');
      setIsEditingEmployment(false);
    } catch (error: any) {
      console.error('Error saving unemployment information:', error);
      alert(error?.response?.data?.error || 'Error saving unemployment information');
      }
      return;
    }
    
    // Existing save logic for employed users
    setSaving(true);
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const userId = user.user_id || user.id;
      const accessToken = localStorage.getItem('accessToken');
      
      // If user is unemployed, handle differently
      if (isEmployed === false) {
        // Navigate to tracker for unemployment reasons - this shouldn't reach here as we navigate earlier
        return;
      }
      
      // Use FormData if there's a file to upload, otherwise use JSON
      const hasAwardsFile = employmentData.awards_file instanceof File;
      const hasEmploymentFile = employmentData.employment_file instanceof File;
      const hasFile = hasAwardsFile || hasEmploymentFile;
      
      if (hasFile) {
        // Use FormData for file upload
        const formData = new FormData();
        
        // Add all employment data fields
        formData.append('employment_type', employmentData.employment_type || '');
        formData.append('current_employment_status', employmentData.current_employment_status || '');
        formData.append('current_company_name', employmentData.current_company_name || '');
        formData.append('current_position', employmentData.current_position || '');
        formData.append('current_sector', employmentData.current_sector || '');
        formData.append('current_scope', employmentData.current_scope || '');
        formData.append('employment_duration', employmentData.employment_duration || '');
        formData.append('salary_range', employmentData.salary_range || '');
        formData.append('received_awards', employmentData.received_awards || '');
        
        // Add the award file if present
        if (employmentData.awards_file) {
          formData.append('awards_supporting_doc', employmentData.awards_file);
        }
        
        // Add the employment file if present
        if (employmentData.employment_file) {
          formData.append('employment_supporting_doc', employmentData.employment_file);
        }
        
        await api.put(`alumni/employment/${userId}/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        // Use JSON for regular updates without file
        const dataToSend = {
          employment_type: employmentData.employment_type,
          current_employment_status: employmentData.current_employment_status,
          current_company_name: employmentData.current_company_name,
          current_position: employmentData.current_position,
          current_sector: employmentData.current_sector,
          current_scope: employmentData.current_scope,
          employment_duration: employmentData.employment_duration,
          salary_range: employmentData.salary_range,
          received_awards: employmentData.received_awards
        };
        
        await api.put(`alumni/employment/${userId}/`, dataToSend);
      }

      alert('Employment details updated successfully! ✓');
      setIsEditingEmployment(false);
      // Refresh employment data
      await fetchEmploymentData(userId);
    } catch (error: any) {
      console.error('Error updating employment details:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Error updating employment details';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleEmploymentCancel = async () => {
    // Reload employment data to reset fields to their original values
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const userId = user.user_id || user.id;
      await fetchEmploymentData(userId);
    }
    setIsEditingEmployment(false);
  };

  const validatePassword = (password: string): string => {
    if (password.length < 16) {
      return 'Password must be at least 16 characters long.';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter.';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter.';
    }
    if (!/\d/.test(password)) {
      return 'Password must contain at least one number.';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character.';
    }
    return '';
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!passwordData.old_password || !passwordData.new_password || !passwordData.confirm_password) {
      setPasswordError('All fields are required.');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('New passwords do not match.');
      return;
    }

    const validationError = validatePassword(passwordData.new_password);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    setSaving(true);
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/change-password/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          old_password: passwordData.old_password,
          new_password: passwordData.new_password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPasswordSuccess('Password changed successfully!');
        setPasswordData({
          old_password: '',
          new_password: '',
          confirm_password: ''
        });
        // Auto-hide success message after 3 seconds
        setTimeout(() => setPasswordSuccess(''), 3000);
      } else {
        setPasswordError(data.message || 'Failed to change password.');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('An error occurred while changing password.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const civilStatusOptions = [
    'Single',
    'Married',
    'Divorced',
    'Widowed',
    'Separated'
  ];

  const employmentStatusOptions = [
    'Full Time',
    'Part Time',
    'Unemployed'
  ];

  const sectorOptions = [
    'Private',
    'Government',
    'Unemployed'
  ];

  const employmentTypeOptions = [
    'Employed by a company/organization',
    'Self-employed',
    'Freelance/Contract-based'
  ];

  const currentEmploymentStatusOptions = [
    'Permanent',
    'Temporary'
  ];

  const scopeOptions = [
    'Local',
    'International'
  ];

  const sectorRadioOptions = [
    'Public',
    'Private'
  ];

  const awardsOptions = [
    'Yes',
    'No'
  ];

  // Get current user info for admin/peso detection
  const currentUserStr = localStorage.getItem('user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isAdmin = currentUser?.account_type?.admin || currentUser?.account_type?.ccict;
  const isPeso = currentUser?.account_type?.peso;

  // Redirect peso and admin accounts away from employment section
  useEffect(() => {
    if ((isAdmin || isPeso) && activeSection === 'employment') {
      setActiveSection('personal');
      localStorage.setItem('settingsActiveSection', 'personal');
    }
  }, [isAdmin, isPeso, activeSection]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f5f5f5', height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
        isAdmin={isAdmin}
        isPeso={isPeso}
      />
      
      <Box sx={{ py: 3, px: 6, flex: 1, width: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>


        <Box sx={{ display: 'flex', gap: 3, height: '100%' }}>
          {/* Left Sidebar - Settings Menu */}
          <Box sx={{ width: 300, flexShrink: 0 }}>
            <Paper elevation={2} sx={{ p: 2, height: 'fit-content' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Settings Menu
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant={activeSection === 'personal' ? 'contained' : 'text'}
                  onClick={() => {
                    setActiveSection('personal');
                    localStorage.setItem('settingsActiveSection', 'personal');
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontWeight: 'bold',
                    backgroundColor: activeSection === 'personal' ? '#174f84' : 'transparent',
                    color: activeSection === 'personal' ? 'white' : '#333',
                    '&:hover': {
                      backgroundColor: activeSection === 'personal' ? '#174f84' : '#f0f0f0'
                    }
                  }}
                >
                  Personal Details
                </Button>
                
                {!isAdmin && !isPeso && (
                  <Button
                    variant={activeSection === 'employment' ? 'contained' : 'text'}
                    onClick={() => {
                      setActiveSection('employment');
                      localStorage.setItem('settingsActiveSection', 'employment');
                    }}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      fontWeight: 'bold',
                      backgroundColor: activeSection === 'employment' ? '#174f84' : 'transparent',
                      color: activeSection === 'employment' ? 'white' : '#333',
                      '&:hover': {
                        backgroundColor: activeSection === 'employment' ? '#174f84' : '#f0f0f0'
                      }
                    }}
                  >
                    Employment Details
                  </Button>
                )}
                
                <Button
                  variant={activeSection === 'password' ? 'contained' : 'text'}
                  onClick={() => {
                    setActiveSection('password');
                    localStorage.setItem('settingsActiveSection', 'password');
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontWeight: 'bold',
                    backgroundColor: activeSection === 'password' ? '#174f84' : 'transparent',
                    color: activeSection === 'password' ? 'white' : '#333',
                    '&:hover': {
                      backgroundColor: activeSection === 'password' ? '#174f84' : '#f0f0f0'
                    }
                  }}
                >
                  Change Password
                </Button>
              </Box>
            </Paper>
          </Box>

          {/* Right Content Area */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              overflowY: 'auto',
              pr: 1,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': {
                display: 'none'
              }
            }}
          >
            <Paper elevation={2} sx={{ p: 4 }}>
              {activeSection === 'personal' && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      Personal Details
                    </Typography>
                    {!isEditingPersonal && (
                      <Button
                        variant="contained"
                        onClick={() => setIsEditingPersonal(true)}
                        sx={{
                          backgroundColor: '#174f84',
                          '&:hover': { backgroundColor: '#0d3a5f' },
                          px: 3,
                          py: 1
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </Box>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="First Name"
                        value={formData.f_name}
                        onChange={(e) => handleInputChange('f_name', e.target.value)}
                        sx={{ flex: 1 }}
                        variant="outlined"
                        disabled={!isEditingPersonal}
                      />
                      <TextField
                        label="Last Name"
                        value={formData.l_name}
                        onChange={(e) => handleInputChange('l_name', e.target.value)}
                        sx={{ flex: 1 }}
                        variant="outlined"
                        disabled={!isEditingPersonal}
                      />
                    </Box>
                    
                    <TextField
                      label="Middle Name"
                      value={formData.m_name}
                      onChange={(e) => handleInputChange('m_name', e.target.value)}
                      variant="outlined"
                      disabled={!isEditingPersonal}
                    />
                    
                    {!isAdmin && !isPeso && (
                      <FormControl variant="outlined" fullWidth>
                        <InputLabel>Civil Status</InputLabel>
                        <Select
                          value={formData.civil_status}
                          onChange={(e) => handleInputChange('civil_status', e.target.value)}
                          label="Civil Status"
                          disabled={!isEditingPersonal}
                        >
                          {civilStatusOptions.map((status) => (
                            <MenuItem key={status} value={status}>
                              {status}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    
                    <TextField
                      label="Contact Number"
                      value={formData.contact_number}
                      onChange={(e) => handleInputChange('contact_number', e.target.value)}
                      variant="outlined"
                      disabled={!isEditingPersonal}
                    />
                    
                    <TextField
                      label="Email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      variant="outlined"
                      type="email"
                      disabled={!isEditingPersonal}
                    />
                    
                    {!isAdmin && !isPeso && (
                      <>
                        <TextField
                          label="Address"
                          value={formData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          variant="outlined"
                          multiline
                          rows={3}
                          disabled={!isEditingPersonal}
                        />
                        
                        <TextField
                          label="Home Address"
                          value={formData.home_address}
                          onChange={(e) => handleInputChange('home_address', e.target.value)}
                          variant="outlined"
                          multiline
                          rows={3}
                          disabled={!isEditingPersonal}
                        />
                      </>
                    )}
                    
                    <TextField
                      label="Social Media"
                      value={formData.social_media}
                      onChange={(e) => handleInputChange('social_media', e.target.value)}
                      variant="outlined"
                      disabled={!isEditingPersonal}
                    />
                  </Box>
                  
                  {isEditingPersonal && (
                    <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'center' }}>
                      <Button
                        variant="contained"
                        onClick={() => {
                          handleSave();
                          setIsEditingPersonal(false);
                        }}
                        disabled={saving}
                        sx={{
                          backgroundColor: '#174f84',
                          '&:hover': { backgroundColor: '#0d3a5f' },
                          px: 4,
                          py: 1.5
                        }}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          handleCancel();
                          setIsEditingPersonal(false);
                        }}
                        sx={{
                          borderColor: '#174f84',
                          color: '#174f84',
                          px: 4,
                          py: 1.5
                        }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  )}
                </>
              )}

              {activeSection === 'employment' && !isAdmin && !isPeso && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      Employment Details
                    </Typography>
                    {!isEditingEmployment && hasJobInDB && (
                      <Button
                        variant="contained"
                        onClick={() => setIsEditingEmployment(true)}
                        sx={{
                          backgroundColor: '#174f84',
                          '&:hover': { backgroundColor: '#0d3a5f' },
                          px: 3,
                          py: 1
                        }}
                      >
                        EDIT
                      </Button>
                    )}
                  </Box>
                  
                  {/* Info Box - explaining the purpose */}
                  {hasJobInDB && accountType === 'alumni' && (
                    <Alert severity="info" sx={{ mb: 3 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Update Your Employment Status
                      </Typography>
                      <Typography variant="caption">
                        You can update your employment information here without redoing the entire tracker form. This is useful for periodic re-checks (e.g., after 6 months or 1 year) to update if you've changed companies, positions, or employment status.
                      </Typography>
                    </Alert>
                  )}
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Flow Logic */}
                    {hasJobInDB === null && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                        <Typography>Loading employment data...</Typography>
                      </Box>
                    )}

                    {/* OJT Account: Display only specified fields (view-only, no edit) */}
                    {accountType === 'ojt' && (hasJobInDB === true || hasJobInDB === false) && (
                      <>
                        <TextField
                          label="Company"
                          value={employmentData.organization_name}
                          variant="outlined"
                          fullWidth
                          disabled={true}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          label="Company Address"
                          value={employmentData.company_address}
                          variant="outlined"
                          multiline
                          rows={3}
                          disabled={true}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          label="Company Email"
                          value={employmentData.company_email}
                          variant="outlined"
                          fullWidth
                          type="email"
                          disabled={true}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          label="Company Contact"
                          value={employmentData.company_contact}
                          variant="outlined"
                          fullWidth
                          disabled={true}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          label="Contact Person Name"
                          value={employmentData.contact_person}
                          variant="outlined"
                          fullWidth
                          disabled={true}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          label="Contact Person Position"
                          value={employmentData.position_alt}
                          variant="outlined"
                          fullWidth
                          disabled={true}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          label="Start Date"
                          value={employmentData.ojt_start_date}
                          variant="outlined"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          disabled={true}
                          sx={{ mb: 2 }}
                        />
                      </>
                    )}

                    {/* Alumni Account: Display Part III tracker data or prompt to answer tracker */}
                    {accountType === 'alumni' && (hasJobInDB === true || hasJobInDB === false) && (
                      <>
                        {hasJobInDB ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Employment Type Dropdown */}
                            <FormControl variant="outlined" fullWidth>
                              <InputLabel>Employment Type</InputLabel>
                              <Select
                                value={employmentData.employment_type || ''}
                                onChange={(e) => handleEmploymentChange('employment_type', e.target.value)}
                                label="Employment Type"
                                disabled={!isEditingEmployment}
                              >
                                {employmentTypeOptions.map((type) => (
                                  <MenuItem key={type} value={type}>
                                    {type}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>

                            {/* Current Employment Status Dropdown */}
                            <FormControl variant="outlined" fullWidth>
                              <InputLabel>Current Employment Status</InputLabel>
                              <Select
                                value={employmentData.current_employment_status || ''}
                                onChange={(e) => handleEmploymentChange('current_employment_status', e.target.value)}
                                label="Current Employment Status"
                                disabled={!isEditingEmployment}
                              >
                                {currentEmploymentStatusOptions.map((status) => (
                                  <MenuItem key={status} value={status}>
                                    {status}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>

                            {/* Company Name and Position in one row */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <TextField
                                label="Company Name"
                                value={employmentData.current_company_name || ''}
                                onChange={(e) => handleEmploymentChange('current_company_name', e.target.value)}
                                sx={{ flex: 1 }}
                                variant="outlined"
                                disabled={!isEditingEmployment}
                              />
                              <TextField
                                label="Current Position"
                                value={employmentData.current_position || ''}
                                onChange={(e) => handleEmploymentChange('current_position', e.target.value)}
                                sx={{ flex: 1 }}
                                variant="outlined"
                                disabled={!isEditingEmployment}
                              />
                            </Box>

                            {/* Sector and Scope in one row */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <FormControl variant="outlined" sx={{ flex: 1 }}>
                                <InputLabel>Sector</InputLabel>
                                <Select
                                  value={employmentData.current_sector || ''}
                                  onChange={(e) => handleEmploymentChange('current_sector', e.target.value)}
                                  label="Sector"
                                  disabled={!isEditingEmployment}
                                >
                                  {sectorRadioOptions.map((sector) => (
                                    <MenuItem key={sector} value={sector}>
                                      {sector}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>

                              <FormControl variant="outlined" sx={{ flex: 1 }}>
                                <InputLabel>Scope</InputLabel>
                                <Select
                                  value={employmentData.current_scope || ''}
                                  onChange={(e) => handleEmploymentChange('current_scope', e.target.value)}
                                  label="Scope"
                                  disabled={!isEditingEmployment}
                                >
                                  {scopeOptions.map((scope) => (
                                    <MenuItem key={scope} value={scope}>
                                      {scope}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Box>

                            {/* Employment Duration Dropdown */}
                            <FormControl variant="outlined" fullWidth>
                              <InputLabel>Employment Duration</InputLabel>
                              <Select
                                value={employmentData.employment_duration || ''}
                                onChange={(e) => handleEmploymentChange('employment_duration', e.target.value)}
                                label="Employment Duration"
                                disabled={!isEditingEmployment}
                              >
                                <MenuItem value="less_than_6_months">Less than 6 months</MenuItem>
                                <MenuItem value="6_months_1_year">6 months – 1 year</MenuItem>
                                <MenuItem value="1_2_years">1-2 years</MenuItem>
                                <MenuItem value="3_5_years">3-5 years</MenuItem>
                                <MenuItem value="more_than_5_years">More than 5 years</MenuItem>
                              </Select>
                            </FormControl>

                            {/* Salary Range Dropdown */}
                            <FormControl variant="outlined" fullWidth>
                              <InputLabel>Salary Range</InputLabel>
                              <Select
                                value={employmentData.salary_range || ''}
                                onChange={(e) => handleEmploymentChange('salary_range', e.target.value)}
                                label="Salary Range"
                                disabled={!isEditingEmployment}
                              >
                                <MenuItem value="below_5000">5,000 below</MenuItem>
                                <MenuItem value="5001_10000">5,001 - 10,000</MenuItem>
                                <MenuItem value="10001_20000">10,001 - 20,000</MenuItem>
                                <MenuItem value="20001_30000">20,001 - 30,000</MenuItem>
                                <MenuItem value="above_30000">30,000 above</MenuItem>
                              </Select>
                            </FormControl>

                            {/* Received Awards Dropdown */}
                            <FormControl variant="outlined" fullWidth>
                              <InputLabel>Received Awards</InputLabel>
                              <Select
                                value={employmentData.received_awards || ''}
                                onChange={(e) => handleEmploymentChange('received_awards', e.target.value)}
                                label="Received Awards"
                                disabled={!isEditingEmployment}
                              >
                                {awardsOptions.map((award) => (
                                  <MenuItem key={award} value={award}>
                                    {award}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>

                            {/* Supporting Documents for Awards/Recognition - Only show if "Yes" */}
                            {employmentData.received_awards === 'Yes' && (
                              <Box sx={{ 
                                border: '2px dashed #174f84', 
                                borderRadius: 2, 
                                p: 3,
                                backgroundColor: '#f8fafc'
                              }}>
                                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#174f84' }}>
                                  Supporting Documents for Awards/Recognition
                                </Typography>
                                
                                {/* Show existing document if available */}
                                {employmentData.awards_supporting_doc && (
                                  <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, p: 2, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                                    <Box
                                      component="img"
                                      src={`http://127.0.0.1:8000${employmentData.awards_supporting_doc}`}
                                      alt="Award Document"
                              sx={{
                                        width: 80,
                                        height: 80,
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                        border: '1px solid #cbd5e1'
                                      }}
                                    />
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                                        Current Award Document
                              </Typography>
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                                        Image uploaded
                              </Typography>
                                    </Box>
                                    <Button
                                      component="a"
                                      href={`http://127.0.0.1:8000${employmentData.awards_supporting_doc}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="outlined"
                                      size="small"
                                sx={{
                                        borderColor: '#174f84',
                                        color: '#174f84',
                                        '&:hover': { backgroundColor: '#f1f5f9' }
                                      }}
                                    >
                                      View Full
                                    </Button>
                                  </Box>
                                )}

                                {/* File upload input - only when editing */}
                                {isEditingEmployment && (
                                  <Box>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      id="awards-document-upload"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          // Store the file for later upload
                                          handleEmploymentChange('awards_file', file);
                                        }
                                      }}
                                    />
                                    <label htmlFor="awards-document-upload">
                                      <Button
                                        variant="contained"
                                        component="span"
                                    sx={{
                                          backgroundColor: '#174f84',
                                          '&:hover': { backgroundColor: '#0d3a5f' },
                                          textTransform: 'none',
                                          fontWeight: 600
                                        }}
                                      >
                                        {employmentData.awards_supporting_doc ? 'Replace Award Document' : 'Upload Award Document'}
                                      </Button>
                                    </label>
                                    
                                    {/* Show selected file name */}
                                    {employmentData.awards_file && (
                                      <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#ecfdf5', border: '1px solid #86efac', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" sx={{ color: '#166534', fontWeight: 600 }}>
                                          ✓ New file selected: {employmentData.awards_file.name}
                                    </Typography>
                                      </Box>
                                    )}
                                    
                                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#64748b' }}>
                                      Upload an image of your award or recognition certificate (PNG, JPG, JPEG)
                                    </Typography>
                                  </Box>
                                )}

                                {!isEditingEmployment && !employmentData.awards_supporting_doc && (
                                  <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                                    No award document uploaded yet
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {/* Employment Supporting Documents Section */}
                            <Box sx={{ 
                              border: '2px dashed #475569', 
                              borderRadius: 2, 
                              p: 3,
                              backgroundColor: '#f8fafc'
                            }}>
                              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#475569' }}>
                                Employment Supporting Document (Current)
                              </Typography>
                              
                              {/* Show existing document if available */}
                              {employmentData.employment_supporting_doc && (
                                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, p: 2, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                                  <Box
                                    component="img"
                                    src={`http://127.0.0.1:8000${employmentData.employment_supporting_doc}`}
                                    alt="Employment Document"
                              sx={{
                                      width: 80,
                                      height: 80,
                                      objectFit: 'cover',
                                      borderRadius: 1,
                                      border: '1px solid #cbd5e1'
                                    }}
                                  />
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                                      Current Employment Document
                              </Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                                      Certificate of Employment or Company ID
                              </Typography>
                                  </Box>
                                    <Button
                                      component="a"
                                    href={`http://127.0.0.1:8000${employmentData.employment_supporting_doc}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="outlined"
                                    size="small"
                                      sx={{
                                      borderColor: '#475569',
                                      color: '#475569',
                                      '&:hover': { backgroundColor: '#f1f5f9' }
                                    }}
                                  >
                                    View Full
                                    </Button>
                                </Box>
                              )}

                              {/* File upload input - only when editing */}
                              {isEditingEmployment && (
                                <Box>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    id="employment-document-upload"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        // Store the file for later upload
                                        handleEmploymentChange('employment_file', file);
                                      }
                                    }}
                                  />
                                  <label htmlFor="employment-document-upload">
                                    <Button
                                      variant="contained"
                                      component="span"
                                      sx={{
                                        backgroundColor: '#174f84',
                                        '&:hover': { backgroundColor: '#0d3a5f' },
                                        textTransform: 'none',
                                        fontWeight: 600
                                      }}
                                    >
                                      {employmentData.employment_supporting_doc ? 'Replace Employment Document' : 'Upload Employment Document'}
                                    </Button>
                                  </label>
                                  
                                  {/* Show selected file name */}
                                  {employmentData.employment_file && (
                                    <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#ecfdf5', border: '1px solid #86efac', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="body2" sx={{ color: '#166534', fontWeight: 600 }}>
                                        ✓ New file selected: {employmentData.employment_file.name}
                                      </Typography>
                                    </Box>
                                  )}
                                  
                                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#64748b' }}>
                                    Upload Certificate of Employment or Company ID (PNG, JPG, JPEG)
                                  </Typography>
                                </Box>
                              )}

                              {!isEditingEmployment && !employmentData.employment_supporting_doc && (
                                <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                                  No employment document uploaded yet
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#475569', mb: 1 }}>
                              Please answer the tracker form to view your employment details
                            </Typography>
                            <Typography variant="body1" sx={{ color: '#94a3b8', maxWidth: 600, mx: 'auto', mb: 4 }}>
                              Your employment details (Part III - Employment Status) will be displayed here once you complete the tracker form.
                            </Typography>
                            <Button
                              variant="contained"
                              onClick={() => navigate('/tracker')}
                              sx={{
                                backgroundColor: '#174f84',
                                '&:hover': { backgroundColor: '#0d3a5f' },
                                px: 5,
                                py: 1.5,
                                fontWeight: 600,
                                borderRadius: 2,
                                textTransform: 'uppercase'
                              }}
                            >
                              Go to Tracker Form
                            </Button>
                          </Box>
                        )}
                      </>
                    )}

                  </Box>
                  
                  {/* Save/Cancel buttons - Only show for alumni accounts when editing */}
                  {accountType === 'alumni' && isEditingEmployment && hasJobInDB && (
                    <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'center' }}>
                      <Button
                        variant="contained"
                        onClick={async () => {
                          await handleEmploymentSave();
                          setIsEditingEmployment(false);
                        }}
                        disabled={saving}
                        sx={{
                          backgroundColor: '#174f84',
                          '&:hover': { backgroundColor: '#0d3a5f' },
                          px: 4,
                          py: 1.5
                        }}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={async () => {
                          // Reload employment data to reset fields
                          const userStr = localStorage.getItem('user');
                          if (userStr) {
                            const user = JSON.parse(userStr);
                            const userId = user.user_id || user.id;
                            await fetchEmploymentData(userId);
                          }
                          setIsEditingEmployment(false);
                        }}
                        sx={{
                          borderColor: '#174f84',
                          color: '#174f84',
                          px: 4,
                          py: 1.5
                        }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  )}
                </>
              )}

              {activeSection === 'password' && (
                <>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Change Password
                  </Typography>
                  
                  {passwordError && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      {passwordError}
                    </Alert>
                  )}
                  
                  {passwordSuccess && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                      {passwordSuccess}
                    </Alert>
                  )}
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}>
                    <TextField
                      label="Current Password"
                      type={showOldPassword ? 'text' : 'password'}
                      value={passwordData.old_password}
                      onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                      variant="outlined"
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowOldPassword(!showOldPassword)}
                              edge="end"
                              aria-label={showOldPassword ? 'Hide password' : 'Show password'}
                            >
                              <PasswordVisibilityIcon show={showOldPassword} size={20} color="#666" />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    
                    <TextField
                      label="New Password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      variant="outlined"
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              edge="end"
                              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            >
                              <PasswordVisibilityIcon show={showNewPassword} size={20} color="#666" />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    <Box sx={{
                      background: 'rgba(25, 118, 210, 0.08)',
                      border: '2px solid rgba(25, 118, 210, 0.2)',
                      borderRadius: '8px',
                      padding: '12px',
                      marginTop: '8px',
                      marginBottom: '8px',
                    }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: '700', color: '#1976d2', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📋 Password Requirements:
                      </Typography>
                      <Typography sx={{ fontSize: '13px', fontWeight: '500', color: '#333', lineHeight: '1.4' }}>
                        Must be 16+ chars with upper, lower, number, and symbol.
                      </Typography>
                    </Box>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: '2px solid',
                      fontWeight: '600',
                      ...(passwordValidation.message === 'Weak' ? {
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        color: '#d32f2f',
                      } : passwordValidation.message === 'Medium' ? {
                        background: 'rgba(234, 179, 8, 0.1)',
                        borderColor: 'rgba(234, 179, 8, 0.4)',
                        color: '#ed6c02',
                      } : {
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderColor: 'rgba(34, 197, 94, 0.4)',
                        color: '#2e7d32',
                      })
                    }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: '600' }}>
                        Strength:
                      </Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase' }}>
                        {passwordValidation.message}
                      </Typography>
                    </Box>
                    
                    <TextField
                      label="Confirm New Password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      variant="outlined"
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              edge="end"
                              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                              <PasswordVisibilityIcon show={showConfirmPassword} size={20} color="#666" />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                      <Button
                        variant="contained"
                        onClick={handlePasswordChange}
                        disabled={saving}
                        sx={{
                          backgroundColor: '#174f84',
                          '&:hover': { backgroundColor: '#0d3a5f' },
                          px: 4,
                          py: 1.5
                        }}
                      >
                        {saving ? 'Changing...' : 'Change Password'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setPasswordData({
                            old_password: '',
                            new_password: '',
                            confirm_password: ''
                          });
                          setPasswordError('');
                          setPasswordSuccess('');
                        }}
                        sx={{
                          borderColor: '#174f84',
                          color: '#174f84',
                          px: 4,
                          py: 1.5
                        }}
                      >
                        Clear
                      </Button>
                    </Box>
                  </Box>
                </>
              )}
            </Paper>
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default Settings;


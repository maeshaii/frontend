import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';
import { Box, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, Alert, InputAdornment, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Checkbox, FormControlLabel, FormGroup, Divider, Table, TableBody, TableCell, TableHead, TableRow, TableContainer } from '@mui/material';
import PasswordVisibilityIcon from '../../components/PasswordVisibilityIcon';
import { trackerApi } from '../../services/trackerApi';

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

  const [employmentData, setEmploymentData] = useState({
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
    units_obtained: ''
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
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/alumni/employment/${userId}/`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
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
          units_obtained: (data.q_units_obtained || data.units_obtained || '').trim()
        });
        
        // Set account type
        const accType = data.account_type || 'alumni'; // Default to alumni if not specified
        setAccountType(accType);
        
        // For OJT accounts: use has_employment_data
        if (accType === 'ojt') {
          const hasEmploymentData = data.has_employment_data || (data.organization_name && data.organization_name.trim() !== '');
          setHasJobInDB(hasEmploymentData);
          if (hasEmploymentData) {
            setIsEditingEmployment(true);
          }
          console.log('OJT - hasEmploymentData:', hasEmploymentData);
        } else {
          // For Alumni accounts: check if they have Part III tracker data
          // Use strict boolean checking to ensure we only show data when explicitly true
          const hasTrackerData = data.has_tracker_data === true;
          const hasPartIIIData = data.has_part_iii_data === true;
          
          console.log('🔍 Alumni Employment Check:');
          console.log('  - has_tracker_data from API:', data.has_tracker_data);
          console.log('  - has_part_iii_data from API:', data.has_part_iii_data);
          console.log('  - hasTrackerData (computed):', hasTrackerData);
          console.log('  - hasPartIIIData (computed):', hasPartIIIData);
          console.log('  - employment_type:', data.employment_type);
          console.log('  - current_company_name:', data.current_company_name);
          
          // CRITICAL: Only show Part III data if has_part_iii_data is explicitly true
          // If it's false, null, undefined, show the "Please answer tracker" prompt
          setHasJobInDB(hasPartIIIData);
          
          // If user has Part III data in DB, enable viewing mode automatically
          if (hasPartIIIData === true) {
            setIsEditingEmployment(true);
          }
          
          // Set pursueFurtherStudy based on existing data
          if (data.post_graduate_degree || data.q_post_graduate_degree) {
            setPursueFurtherStudy(true);
          } else if (hasPartIIIData) {
            setPursueFurtherStudy(false);
          }
          
          console.log('  - Final hasJobInDB value:', hasPartIIIData === true);
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
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEmploymentChange = (field: string, value: string) => {
    setEmploymentData(prev => ({
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
      const accessToken = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://127.0.0.1:8000/api/alumni/profile/${userId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Profile updated successfully!');
        
        // Update localStorage with new data
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
        
        // Update localStorage
        localStorage.setItem('user', JSON.stringify(updatedUserData));
        console.log('Updated localStorage user data:', updatedUserData);
        
        // Refresh the form data
        fetchUserData();
        
        // Trigger a custom event to notify other components
        window.dispatchEvent(new CustomEvent('userDataUpdated', { 
          detail: updatedUserData 
        }));
        
      } else {
        alert('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
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
        const accessToken = localStorage.getItem('accessToken');
        
        // Get the unemployment question ID
        const unemploymentQuestion = unemploymentQuestions[0];
        const unemploymentReasons = unemploymentResponses[unemploymentQuestion.id] || [];
        
        // Save unemployment reasons to TrackerData via the employment API
        const response = await fetch(`http://127.0.0.1:8000/api/alumni/employment/${userId}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            // Mark as unemployed
            unemployment_reason: unemploymentReasons,
            q_unemployment_reason: unemploymentReasons
          })
        });
        
        if (response.ok) {
          alert('Unemployment information saved successfully!');
          setIsEditingEmployment(false);
        } else {
          alert('Failed to save unemployment information');
        }
      } catch (error) {
        console.error('Error saving unemployment information:', error);
        alert('Error saving unemployment information');
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
      
      // Send employment data (either updating existing or creating new)
      const dataToSend = employmentData;
      
      const response = await fetch(`http://127.0.0.1:8000/api/alumni/employment/${userId}/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        alert('Employment details updated successfully!');
        setIsEditingEmployment(false);
        // Refresh employment data
        await fetchEmploymentData(userId);
      } else {
        const errorData = await response.json();
        alert(`Failed to update employment details: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating employment details:', error);
      alert('Error updating employment details');
    } finally {
      setSaving(false);
    }
  };

  const handleEmploymentCancel = () => {
    setEmploymentData({
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
      // Part III fields
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
      // Part IV fields
      study_start_date: '',
      post_graduate_degree: '',
      institution_name: '',
      units_obtained: ''
    });
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
                  </Box>
                  
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
                            <Paper
                              elevation={0}
                              sx={{
                                borderRadius: 3,
                                p: { xs: 3, md: 5 },
                                background: '#f5f7fb',
                                border: '1px solid #e3ebf6'
                              }}
                            >
                              <Typography variant="h5" sx={{ fontWeight: 600, color: '#174f84', mb: 0.5 }}>
                                Part III – Employment Status
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
                                Data is pulled from your latest tracker submission.
                              </Typography>
                              <Divider sx={{ mb: 3, borderColor: '#d7e3f4' }} />
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                                  gap: { xs: 2.5, md: 3 },
                                  color: '#1e293b'
                                }}
                              >
                                {employmentSummaryRows.map((item) => (
                                  <Box
                                    key={item.label}
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 0.5
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{ color: '#8c9db8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}
                                    >
                                      {item.label}
                                    </Typography>
                                    <Typography
                                      variant="subtitle1"
                                      sx={{ fontWeight: 600, color: '#0f172a' }}
                                    >
                                      {item.value || 'N/A'}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Paper>

                            <Paper
                              elevation={0}
                              sx={{
                                borderRadius: 3,
                                p: { xs: 3, md: 4 },
                                border: '1px solid #e3ebf6',
                                backgroundColor: '#fff'
                              }}
                            >
                              <Typography variant="h6" sx={{ fontWeight: 600, color: '#174f84' }}>
                                Employment History
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                                Displaying the employment details you provided in the tracker.
                              </Typography>
                              <Divider sx={{ mb: 3 }} />
                              <TableContainer sx={{ borderRadius: 2, border: '1px solid #e8eff9' }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      {['Company Name', 'Position', 'Sector', 'Scope', 'Duration', 'Salary Range'].map((header) => (
                                        <TableCell
                                          key={header}
                                          sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12, color: '#94a3b8', backgroundColor: '#f5f7fb' }}
                                        >
                                          {header}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    <TableRow sx={{ '& td': { fontWeight: 600, color: '#0f172a' } }}>
                                      <TableCell>{employmentHistoryRow.company}</TableCell>
                                      <TableCell>{employmentHistoryRow.position}</TableCell>
                                      <TableCell>{employmentHistoryRow.sector}</TableCell>
                                      <TableCell>{employmentHistoryRow.scope}</TableCell>
                                      <TableCell>{employmentHistoryRow.duration}</TableCell>
                                      <TableCell>{employmentHistoryRow.salary}</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </TableContainer>

                              {trackerDocuments.length > 0 && (
                                <Box sx={{ mt: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                                  {trackerDocuments.map((doc) => (
                                    <Button
                                      key={doc.label}
                                      component="a"
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="outlined"
                                      sx={{
                                        flex: 1,
                                        borderColor: '#174f84',
                                        color: '#174f84',
                                        fontWeight: 600,
                                        textTransform: 'none'
                                      }}
                                    >
                                      {doc.label}
                                    </Button>
                                  ))}
                                </Box>
                              )}
                            </Paper>
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
                  
                  {/* Save/Cancel buttons - Only show for alumni accounts (OJT is view-only) */}
                  {accountType === 'alumni' && false && isEditingEmployment && (
                    <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'center' }}>
                      <Button
                        variant="contained"
                        onClick={() => {
                          handleEmploymentSave();
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
                          // Reset to initial state - reload employment data to show "Are you employed?" question
                          const userStr = localStorage.getItem('user');
                          if (userStr) {
                            const user = JSON.parse(userStr);
                            const userId = user.user_id || user.id;
                            
                            // Reset all state
                            setIsEditingEmployment(false);
                            setIsEmployed(null);
                            setUnemploymentQuestions([]);
                            setUnemploymentResponses({});
                            
                            // Reload employment data to reset to initial state
                            await fetchEmploymentData(userId);
                          }
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
                      helperText="Password must be at least 16 characters long and contain uppercase, lowercase, number, and special character"
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


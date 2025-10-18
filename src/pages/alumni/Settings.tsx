import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';
import { Box, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

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

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('personal');
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
    sector: ''
  });

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
    setSaving(true);
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const userId = user.user_id || user.id;
      const response = await fetch(`http://127.0.0.1:8000/api/alumni/employment/${userId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(employmentData)
      });

      if (response.ok) {
        alert('Employment details updated successfully!');
      } else {
        alert('Failed to update employment details');
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
      sector: ''
    });
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
    'Full-time',
    'Part-time',
    'Contract',
    'Freelance',
    'Intern',
    'Unemployed',
    'Self-employed'
  ];

  const sectorOptions = [
    'Technology',
    'Healthcare',
    'Education',
    'Finance',
    'Manufacturing',
    'Retail',
    'Government',
    'Non-profit',
    'Construction',
    'Transportation',
    'Other'
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Get current user info for admin/peso detection
  const currentUserStr = localStorage.getItem('user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isAdmin = currentUser?.account_type?.admin || currentUser?.account_type?.ccict;
  const isPeso = currentUser?.account_type?.peso;

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
        isAdmin={isAdmin}
        isPeso={isPeso}
      />
      
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>


        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left Sidebar - Settings Menu */}
          <Box sx={{ width: 300 }}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Settings Menu
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant={activeSection === 'personal' ? 'contained' : 'text'}
                  onClick={() => setActiveSection('personal')}
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
                
                <Button
                  variant={activeSection === 'employment' ? 'contained' : 'text'}
                  onClick={() => setActiveSection('employment')}
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
                
                <Button
                  variant={activeSection === 'password' ? 'contained' : 'text'}
                  onClick={() => setActiveSection('password')}
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
          <Box sx={{ flex: 1 }}>
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

              {activeSection === 'employment' && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      Employment Details
                    </Typography>
                    {!isEditingEmployment && (
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
                        Edit
                      </Button>
                    )}
                  </Box>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField
                      label="Name of Organization"
                      value={employmentData.organization_name}
                      onChange={(e) => handleEmploymentChange('organization_name', e.target.value)}
                      variant="outlined"
                      fullWidth
                      disabled={!isEditingEmployment}
                    />
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="Date Hired"
                        value={employmentData.date_hired}
                        onChange={(e) => handleEmploymentChange('date_hired', e.target.value)}
                        variant="outlined"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1 }}
                        disabled={!isEditingEmployment}
                      />
                      <TextField
                        label="Position"
                        value={employmentData.position}
                        onChange={(e) => handleEmploymentChange('position', e.target.value)}
                        variant="outlined"
                        sx={{ flex: 1 }}
                        disabled={!isEditingEmployment}
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <FormControl variant="outlined" sx={{ flex: 1 }}>
                        <InputLabel>Status of Employment</InputLabel>
                        <Select
                          value={employmentData.employment_status}
                          onChange={(e) => handleEmploymentChange('employment_status', e.target.value)}
                          label="Status of Employment"
                          disabled={!isEditingEmployment}
                        >
                          {employmentStatusOptions.map((status) => (
                            <MenuItem key={status} value={status}>
                              {status}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl variant="outlined" sx={{ flex: 1 }}>
                        <InputLabel>Sector</InputLabel>
                        <Select
                          value={employmentData.sector}
                          onChange={(e) => handleEmploymentChange('sector', e.target.value)}
                          label="Sector"
                          disabled={!isEditingEmployment}
                        >
                          {sectorOptions.map((sector) => (
                            <MenuItem key={sector} value={sector}>
                              {sector}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    
                    <TextField
                      label="Company Address"
                      value={employmentData.company_address}
                      onChange={(e) => handleEmploymentChange('company_address', e.target.value)}
                      variant="outlined"
                      multiline
                      rows={3}
                      disabled={!isEditingEmployment}
                    />
                  </Box>
                  
                  {isEditingEmployment && (
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
                        onClick={() => {
                          handleEmploymentCancel();
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
                            >
                              {showOldPassword ? <VisibilityOff /> : <Visibility />}
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
                            >
                              {showNewPassword ? <VisibilityOff /> : <Visibility />}
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
                            >
                              {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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

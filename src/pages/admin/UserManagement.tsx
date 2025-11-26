import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../admin/global/sidebar';
import { api, updateUserStatus, verifyAdminPassword } from '../../services/api';
import PasswordVisibilityIcon from '../../components/PasswordVisibilityIcon';
import { toast } from '../../utils/toast';

interface User {
  id: number;
  user_id: number;
  ctu_id: string;
  acc_username?: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  f_name?: string;
  m_name?: string;
  l_name?: string;
  full_name?: string;
  middle_name?: string;
  phone_number?: string;
  phone_num?: string;
  contact_number?: string;
  address?: string;
  birthdate?: string;
  gender?: string;
  course?: string;
  year_graduated?: string;
  profile_pic?: string;
  bio?: string;
  account_type: {
    admin: boolean;
    peso: boolean;
    coordinator: boolean;
    user?: boolean;
    ojt?: boolean;
  };
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login?: string;
  employment_status?: string;
  current_company?: string;
  current_position?: string;
  current_salary?: string;
  sector?: string;
  further_study?: string;
  unemployment_reason?: string;
  social_media?: string;
  home_address?: string;
    user_status?: string;
}

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const [showPasswordDisplay, setShowPasswordDisplay] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [accountTypeSelected, setAccountTypeSelected] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingStatusAction, setPendingStatusAction] = useState<'activate' | 'deactivate' | null>(null);
  const [accountFilter, setAccountFilter] = useState<'all' | 'alumni' | 'ojt'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [securityVerified, setSecurityVerified] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [showSecurityPassword, setShowSecurityPassword] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const userUpdatesSocketRef = useRef<WebSocket | null>(null);
  
  // Create user form state
  const [formData, setFormData] = useState({
    acc_username: '',
    f_name: '',
    m_name: '',
    l_name: '',
    email: '',
    phone_number: '',
    gender: '',
    account_type: 'alumni',
    acc_password: '',
    acc_password_confirm: '',
    course: '',
    section: '',
    year_graduated: '',
    address: '',
    birthdate: '',
    ojt_start_date: '',
    ojt_end_date: '',
    job_code: '',
  });

  const downloadCredentialsExcel = useCallback(async (username: string, password: string) => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Credentials');

      worksheet.columns = [
        { header: 'CTU ID / Username', key: 'username', width: 28 },
        { header: 'Temporary Password', key: 'password', width: 28 },
        { header: 'Generated At', key: 'generatedAt', width: 32 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      worksheet.addRow({
        username,
        password,
        generatedAt: new Date().toLocaleString(),
      });

      worksheet.eachRow((row, rowNumber) => {
        row.alignment = { vertical: 'middle', horizontal: rowNumber === 1 ? 'center' : 'left' };
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const filename = `alumni_credentials_${username || 'user'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(blob, filename);
    } catch (err) {
      console.error('Failed to generate credentials workbook:', err);
      toast.error('User created, but failed to download the credentials file.');
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      console.log('Fetching users...');
      const response = await api.get('/admin/users/');
      console.log('API Response:', response.data);
      
      if (response.data.success) {
        console.log('Users data:', response.data.users);
        const usersList = response.data.users || [];
        setUsers(usersList);
        if (usersList.length === 0) {
          console.log('No users returned from API');
        }
      } else {
        console.error('API returned success: false', response.data.message);
        setError(response.data.message || 'Failed to fetch users');
        setUsers([]); // Set empty array on error
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      console.error('Error response:', error.response);
      setError(error.response?.data?.message || 'Failed to fetch users');
      setUsers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if already verified in this session
  useEffect(() => {
    const sessionVerified = sessionStorage.getItem('userManagementVerified');
    if (sessionVerified === 'true') {
      setSecurityVerified(true);
      setShowSecurityModal(false);
    } else {
      setShowSecurityModal(true);
    }
  }, []);

  useEffect(() => {
    if (!securityVerified) return;
    fetchUsers();
  }, [securityVerified, fetchUsers]);

  useEffect(() => {
    if (!securityVerified) {
      if (userUpdatesSocketRef.current) {
        userUpdatesSocketRef.current.close(1000, 'Security verification revoked');
        userUpdatesSocketRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const token = localStorage.getItem('accessToken');
    let wsUrl = `${protocol}//${host}:8000/ws/admin/user-management/`;
    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    const socket = new WebSocket(wsUrl);
    userUpdatesSocketRef.current = socket;

    socket.onopen = () => {
      console.log('✅ User management WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'user_management_update') {
          console.log('📡 User management update received', data);
          fetchUsers();
        }
      } catch (error) {
        console.warn('Failed to parse user management WebSocket payload', error);
      }
    };

    socket.onerror = (event) => {
      console.warn('User management WebSocket error', event);
    };

    socket.onclose = (event) => {
      console.log('User management WebSocket closed', event.code, event.reason);
    };

    return () => {
      socket.close(1000, 'Component cleanup');
      if (userUpdatesSocketRef.current === socket) {
        userUpdatesSocketRef.current = null;
      }
    };
  }, [securityVerified, fetchUsers]);

  // Reset password form and email when selected user changes
  useEffect(() => {
    if (selectedUser) {
      const isCoordinator = !!selectedUser?.account_type?.coordinator;
      const isPeso = !!selectedUser?.account_type?.peso;
      const canChange = isCoordinator || isPeso;
      if (!canChange) {
        setShowPasswordForm(false);
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      }
      // Set email value when user is selected
      setEmailValue(getEmailValue(selectedUser));
      setEditingEmail(false);
    }
  }, [selectedUser]);

  const handlePasswordChange = async () => {
    if (!selectedUser) return;
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!newPassword) {
      setError('Password is required');
      return;
    }

    try {
      setPasswordLoading(true);
      setError('');
      
      await api.post(`/admin/users/${selectedUser.user_id}/password/`, {
        new_password: newPassword
      });
      
      toast.success('Password updated successfully');
      setShowDetailsModal(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error: any) {
      console.error('Error updating password:', error);
      setError(error.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!selectedUser) return;
    
    const isOJT = !!selectedUser?.account_type?.ojt;
    const isAlumni = !!selectedUser?.account_type?.user;
    
    if (!isOJT && !isAlumni) {
      setError('Email can only be updated for OJT and Alumni accounts');
      return;
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailValue && !emailRegex.test(emailValue)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setEmailLoading(true);
      setError('');
      
      await api.put(`/userprofile/${selectedUser.user_id}/email/`, {
        email: emailValue || ''
      });
      
      toast.success('Email updated successfully');
      setEditingEmail(false);
      await fetchUsers();
      // Update selected user with new email
      const updatedUsers = await api.get('/admin/users/');
      const updatedUser = updatedUsers.data.users.find((u: User) => u.user_id === selectedUser.user_id);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }
    } catch (error: any) {
      console.error('Error updating email:', error);
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to update email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    if (updatingStatusId) return;
    const currentStatus = (user.user_status || 'active').toLowerCase();
    const nextStatus: 'active' | 'inactive' = currentStatus === 'active' ? 'inactive' : 'active';
    setUpdatingStatusId(user.user_id);
    try {
      await updateUserStatus(user.user_id, nextStatus);
      toast.success(nextStatus === 'inactive' ? 'User deactivated' : 'User reactivated');
      await fetchUsers();
      setSelectedUser((prev) => {
        if (prev && prev.user_id === user.user_id) {
          return { ...prev, user_status: nextStatus };
        }
        return prev;
      });
      setShowStatusConfirm(false);
      setPendingStatusAction(null);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update user status';
      toast.error(message);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSecuritySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!securityPassword.trim()) {
      setSecurityError('Password is required');
      return;
    }
    try {
      setSecurityLoading(true);
      setSecurityError('');
      await verifyAdminPassword(securityPassword.trim());
      setSecurityVerified(true);
      // Store verification in sessionStorage so it persists for the session
      sessionStorage.setItem('userManagementVerified', 'true');
      setShowSecurityModal(false);
      setSecurityPassword('');
      setShowSecurityPassword(false);
      await fetchUsers();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Verification failed';
      setSecurityError(message);
    } finally {
      setSecurityLoading(false);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordForm(false);
    setShowStatusConfirm(false);
    setPendingStatusAction(null);
  };

  const openStatusConfirm = (action: 'activate' | 'deactivate') => {
    setPendingStatusAction(action);
    setShowStatusConfirm(true);
  };

  const confirmStatusChange = () => {
    if (!selectedUser) {
      setShowStatusConfirm(false);
      setPendingStatusAction(null);
      return;
    }
    handleToggleUserStatus(selectedUser);
  };

  const togglePasswordForm = () => {
    setShowPasswordForm((prev) => {
      const next = !prev;
      if (!next) {
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setSuccess('');
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      }
      return next;
    });
  };

  const getAccountTypeLabel = (accountType: any) => {
    if (accountType.admin) return 'Admin';
    if (accountType.peso) return 'PESO';
    if (accountType.coordinator) return 'Coordinator';
    if (accountType.ojt) return 'OJT';
    return 'Alumni';
  };

  const getAccountTypeColor = (accountType: any) => {
    if (accountType.admin) return '#dc3545';
    if (accountType.peso) return '#28a745';
    if (accountType.coordinator) return '#ffc107';
    if (accountType.ojt) return '#17a2b8';
    return '#6c757d';
  };

  const getFieldValue = (...fields: Array<string | undefined | null>) => {
    for (const field of fields) {
      if (field && field.trim()) {
        return field.trim();
      }
    }
    return 'N/A';
  };

  const getFirstName = (user?: User | null) => getFieldValue(user?.first_name, user?.f_name);
  const getMiddleName = (user?: User | null) => getFieldValue(user?.middle_name, user?.m_name);
  const getLastName = (user?: User | null) => getFieldValue(user?.last_name, user?.l_name);
  const getEmailValue = (user?: User | null) => getFieldValue(user?.email);
  const getAddressValue = (user?: User | null) => getFieldValue(user?.address, user?.home_address);
  const getContactValue = (user?: User | null) => getFieldValue(user?.phone_number, user?.phone_num, user?.contact_number);
  const getDisplayName = (user?: User | null) => {
    if (!user) return 'N/A';
    if (user.full_name?.trim()) return user.full_name.trim();
    const first = getFirstName(user);
    const last = getLastName(user);
    if (first === 'N/A' && last === 'N/A') {
      return 'N/A';
    }
    const safeFirst = first === 'N/A' ? '' : first;
    const safeLast = last === 'N/A' ? '' : last;
    return `${safeFirst} ${safeLast}`.trim() || 'N/A';
  };

  const handleCreateUser = async () => {
    // Validation
    if (!accountTypeSelected || !formData.account_type) {
      setError('Please select an account type');
      return;
    }
    
    const trimmedUsername = (formData.acc_username || '').trim();
    if (!trimmedUsername) {
      setError('CTU ID / Username is required');
      toast.error('CTU ID / Username is required');
      return;
    }

    const requiredNameFields: Array<{ value: string; label: string }> = [
      { value: (formData.f_name || '').trim(), label: 'First Name' },
      { value: (formData.l_name || '').trim(), label: 'Last Name' },
    ];

    const missingName = requiredNameFields.find(field => !field.value);
    if (missingName) {
      setError(`${missingName.label} is required`);
      toast.error(`${missingName.label} is required`);
      return;
    }
    
    const passwordRequired = formData.account_type === 'coordinator' || formData.account_type === 'peso';
    
    // For coordinators, require program (name auto derives from program)
    if (formData.account_type === 'coordinator') {
      if (!formData.course) {
        setError('Program is required for coordinators');
        return;
      }
    }
    
    if (passwordRequired) {
      if (!formData.acc_password) {
        setError('Password is required for coordinator and peso accounts');
        return;
      }
      if (formData.acc_password !== formData.acc_password_confirm) {
        setError('Passwords do not match');
        return;
      }
    }
    
    // For Alumni and OJT accounts, password is optional and will be auto-generated if empty
    if ((formData.account_type === 'alumni' || formData.account_type === 'ojt') && !formData.acc_password) {
      // Password will be auto-generated by backend, no need to send it
    }
    
    // Validate phone number if provided - must be exactly 11 digits
    if (formData.phone_number && formData.phone_number.trim()) {
      const phoneDigits = formData.phone_number.replace(/\D/g, '');
      if (phoneDigits.length !== 11) {
        setError('Phone number must be exactly 11 digits');
        toast.error('Phone number must be exactly 11 digits');
        return;
      }
    }

    const normalizedFirstName = (formData.f_name || '').trim();
    const normalizedLastName = (formData.l_name || '').trim();
    const normalizedMiddleName = (formData.m_name || '').trim() || 'N/A';
    const createdUsername = trimmedUsername;

    try {
      setCreateLoading(true);
      setError('');
      
      // Prepare data, converting empty strings to null/undefined for optional fields
      // Backend expects: ctu_id, password, f_name, l_name, account_type
      const accountTypeValue = formData.account_type === 'alumni' ? 'user' : formData.account_type;
      const submitData: any = {
        ctu_id: createdUsername, // Backend expects 'ctu_id' not 'acc_username'
        account_type: accountTypeValue,
        m_name: normalizedMiddleName,
      };

      // Password handling:
      // - For coordinator/peso: password is required (validated above)
      // - For alumni/ojt: password is optional - if empty, backend will auto-generate
      if (formData.acc_password) {
        submitData.password = formData.acc_password; // Backend expects 'password' not 'acc_password'
      }
      // If password is empty for alumni/ojt, don't send it - backend will auto-generate

      // For coordinators, send username, account_type, password, and program
      if (formData.account_type === 'coordinator') {
        if (formData.course) submitData.course = formData.course;
        const programLabel = formData.course || 'Coordinator';
        submitData.f_name = programLabel;
        submitData.l_name = 'Coordinator';
      } else if (formData.account_type === 'peso') {
        // Backend requires f_name and l_name for all account types
        submitData.f_name = formData.f_name || 'PESO';
        submitData.l_name = formData.l_name || 'Account';
      } else {
        // For other account types, include all fields
        submitData.f_name = normalizedFirstName;
        submitData.l_name = normalizedLastName;
        
        // Add optional fields only if they have values
        if (formData.email) submitData.email = formData.email;
        if (formData.phone_number) submitData.phone_num = formData.phone_number; // Backend expects 'phone_num' not 'phone_number'
        if (formData.gender) submitData.gender = formData.gender;
        if (formData.course) submitData.course = formData.course;
        if (formData.section) submitData.section = formData.section;
        if (formData.year_graduated) submitData.year_graduated = formData.year_graduated;
        if (formData.address) submitData.address = formData.address;
        if (formData.birthdate) submitData.birthdate = formData.birthdate;
      }
      
      // OJT-specific fields
      if (formData.account_type === 'ojt') {
        if (formData.ojt_start_date) submitData.ojt_start_date = formData.ojt_start_date;
        if (formData.ojt_end_date) submitData.ojt_end_date = formData.ojt_end_date;
        if (formData.job_code) submitData.job_code = formData.job_code;
      }
      
      const response = await api.post('/admin/users/create/', submitData);
      
      if (response.data.success) {
        setSuccess('User created successfully!');
        setCreatedPassword(response.data.password || '');
        toast.success('Account created successfully!');
        setShowPasswordDisplay(true);

        if (formData.account_type === 'alumni' && response.data.password) {
          await downloadCredentialsExcel(createdUsername, response.data.password);
        }
        // Reset form
        setFormData({
          acc_username: '',
          f_name: '',
          m_name: '',
          l_name: '',
          email: '',
          phone_number: '',
          gender: '',
          account_type: 'alumni',
          acc_password: '',
        acc_password_confirm: '',
          course: '',
          section: '',
          year_graduated: '',
          address: '',
          birthdate: '',
          ojt_start_date: '',
          ojt_end_date: '',
          job_code: '',
        });
        // Refresh users list
        await fetchUsers();
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
          setShowPasswordDisplay(false);
          setShowCreateModal(false);
          setAccountTypeSelected(false);
        }, 5000);
      } else {
        const errorMessage = response.data.message || 'Failed to create user';
        const formatted = errorMessage
          .replace('Only one PESO account is allowed.', 'PESO account already exists.')
          .replace('Only one coordinator per program is allowed.', 'Coordinator already set for this program.');
        setError(formatted);
        toast.error(formatted);
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create user';
      const formatted = errorMessage
        .replace('Only one PESO account is allowed.', 'PESO account already exists.')
        .replace('Only one coordinator per program is allowed.', 'Coordinator already set for this program.');
      setError(formatted);
      toast.error(formatted);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // If account type is selected, show the rest of the form
    if (name === 'account_type') {
      setAccountTypeSelected(true);
    }
    
    // If account type changes, clear password fields and handle account-specific logic
    if (name === 'account_type') {
      if (value === 'coordinator' || value === 'peso') {
        // Clear all other fields except username and password for coordinator/peso
        setFormData(prev => {
          const base = {
            ...prev,
            account_type: value,
            f_name: '',
            m_name: '',
            l_name: '',
            email: '',
            phone_number: '',
            gender: '',
            course: value === 'coordinator' ? prev.course : '',
            section: '',
            year_graduated: '',
            address: '',
            birthdate: '',
            ojt_start_date: '',
            ojt_end_date: '',
            job_code: '',
            acc_password: '',
            acc_password_confirm: ''
          };
          if (value === 'coordinator') {
            const programLabel = (prev.course || 'Coordinator').toUpperCase();
            return { ...base, f_name: programLabel, l_name: 'Coordinator' };
          }
          if (value === 'peso') {
            return { ...base, f_name: 'PESO', l_name: 'Account' };
          }
          return base;
        });
      } else if (value === 'alumni' || value === 'ojt') {
        // Clear password fields for alumni/ojt since password is auto-generated
        setFormData(prev => ({
          ...prev,
          account_type: value,
          acc_password: '',
          acc_password_confirm: ''
        }));
      }
    } else if (name === 'course' && formData.account_type === 'coordinator') {
      const programLabel = value || 'Coordinator';
      setFormData(prev => ({
        ...prev,
        course: value,
        f_name: programLabel.toUpperCase(),
        l_name: 'Coordinator'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const isCoordinatorSelected = formData.account_type === 'coordinator';
  const isPesoSelected = formData.account_type === 'peso';
  const isAlumniSelected = formData.account_type === 'alumni';
  const passwordRequired = isCoordinatorSelected || isPesoSelected;
  const passwordHelperText = passwordRequired
    ? ''
    : 'Leave empty to auto-generate';

  const filteredUsers = users.filter((user) => {
    const matchesFilter =
      accountFilter === 'all' ||
      (accountFilter === 'alumni' && user.account_type?.user) ||
      (accountFilter === 'ojt' && user.account_type?.ojt);

    const fullName = getDisplayName(user).toLowerCase();
    const searchTerm = searchQuery.trim().toLowerCase();
    const matchesSearch = !searchTerm || fullName.includes(searchTerm);

    return matchesFilter && matchesSearch;
  });

  const isSelectedAlumni = !!selectedUser?.account_type?.user;
  const isSelectedOjt = !!selectedUser?.account_type?.ojt;
  const isSelectedCoordinator = !!selectedUser?.account_type?.coordinator;
  const isSelectedPeso = !!selectedUser?.account_type?.peso;
  const canChangePassword = isSelectedCoordinator || isSelectedPeso;
  const canManageSelectedUser = isSelectedAlumni || isSelectedOjt;
  const selectedUserStatus = (selectedUser?.user_status || 'active').toLowerCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      
      <div className="admin-content-page" style={{ flex: 1, padding: '32px 40px', marginLeft: 'var(--sidebar-width, 220px)' }}>
        {securityVerified ? (
          <>
        {/* Header Section */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            margin: 0, 
            color: '#1e293b', 
            fontSize: '32px',
            fontWeight: '800',
            letterSpacing: '-0.025em'
          }}>
            User Management
          </h1>
        </div>

        {/* Search and Actions Bar */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '28px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '160px', flexShrink: 0 }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Filter Accounts</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value as 'all' | 'alumni' | 'ojt')}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                color: '#1f2937',
                backgroundColor: '#f8fafc',
                minWidth: '140px'
              }}
            >
              <option value="all">All Accounts</option>
              <option value="alumni">Alumni</option>
              <option value="ojt">OJT</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '280px', flexShrink: 0 }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Search by Name</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name (e.g., Juan Dela Cruz)"
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                color: '#1f2937',
                backgroundColor: '#f8fafc',
                width: '100%'
              }}
            />
          </div>
          <button
            onClick={() => {
              // Reset form when opening modal
              setFormData({
                acc_username: '',
                f_name: '',
                m_name: '',
                l_name: '',
                email: '',
                phone_number: '',
                gender: '',
                account_type: 'alumni',
                acc_password: '',
                acc_password_confirm: '',
                course: '',
                section: '',
                year_graduated: '',
                address: '',
                birthdate: '',
                ojt_start_date: '',
                ojt_end_date: '',
                job_code: '',
              });
              setShowCreateModal(true);
              setAccountTypeSelected(false);
              setFormData({
                acc_username: '',
                f_name: '',
                m_name: '',
                l_name: '',
                email: '',
                phone_number: '',
                gender: '',
                account_type: '',
                acc_password: '',
                acc_password_confirm: '',
                course: '',
                section: '',
                year_graduated: '',
                address: '',
                birthdate: '',
                ojt_start_date: '',
                ojt_end_date: '',
                job_code: '',
              });
              setError('');
              setSuccess('');
              setShowPasswordDisplay(false);
              setCreatedPassword('');
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#285999',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(40, 89, 153, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1f4a7a';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(40, 89, 153, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#285999';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(40, 89, 153, 0.2)';
            }}
          >
            + Create User
          </button>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '14px 18px',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid #fecaca',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            backgroundColor: '#d1fae5',
            color: '#065f46',
            padding: '14px 18px',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid #a7f3d0',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {success}
          </div>
        )}

        {/* Users Table */}
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ color: '#64748b', fontSize: '15px' }}>Loading users...</div>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            <style>{`
              .user-table-scrollbar::-webkit-scrollbar {
                width: 8px;
              }
              .user-table-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .user-table-scrollbar::-webkit-scrollbar-thumb {
                background-color: rgba(99, 102, 241, 0.35);
                border-radius: 999px;
                transition: background-color 0.2s ease;
              }
              .user-table-scrollbar::-webkit-scrollbar-thumb:hover {
                background-color: rgba(99, 102, 241, 0.65);
              }
              .user-table-scrollbar::-webkit-scrollbar-thumb:active {
                background-color: rgba(79, 70, 229, 0.8);
              }
            `}</style>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <colgroup>
                <col style={{ width: '45%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ 
                    backgroundColor: '#5A6DFE',
                    color: 'white',
                    padding: '18px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase'
                  }}>Name</th>
                  <th style={{ 
                    backgroundColor: '#5A6DFE',
                    color: 'white',
                    padding: '18px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase'
                  }}>Account Type</th>
                  <th style={{ 
                    backgroundColor: '#5A6DFE',
                    color: 'white',
                    padding: '18px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase'
                  }}>Status</th>
                </tr>
              </thead>
            </table>
            <div style={{ 
              overflowX: 'auto',
              overflowY: 'auto',
              maxHeight: '600px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#64748b #f8fafc'
            }} className="user-table-scrollbar">
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '14px',
                tableLayout: 'fixed'
              }}>
                <colgroup>
                  <col style={{ width: '45%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '25%' }} />
                </colgroup>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <tr 
                      key={user.id || user.user_id} 
                      style={{ 
                        borderBottom: index < filteredUsers.length - 1 ? '1px solid #e5e7eb' : 'none',
                        backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                        transition: 'background-color 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9fafb';
                      }}
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDetailsModal(true);
                        setNewPassword('');
                        setConfirmPassword('');
                        setShowNewPassword(false);
                        setShowConfirmPassword(false);
                        setError('');
                        setSuccess('');
                        setShowPasswordForm(false);
                      }}
                    >
                      <td style={{ 
                        padding: '18px 20px',
                        color: '#1e293b',
                        fontWeight: '500',
                        fontSize: '14px'
                      }}>
                        {(() => {
                          // Try full_name first (from backend)
                          if (user.full_name?.trim()) {
                            return user.full_name.trim();
                          }
                          
                          // Try first_name and last_name
                          const firstName = user.first_name?.trim() || user.f_name?.trim() || '';
                          const lastName = user.last_name?.trim() || user.l_name?.trim() || '';
                          const fullName = `${firstName} ${lastName}`.trim();
                          
                          if (fullName) {
                            return fullName;
                          }
                          
                          // For alumni accounts, show N/A if no name available
                          return 'N/A';
                        })()}
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        <span style={{
                          backgroundColor: getAccountTypeColor(user.account_type),
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {getAccountTypeLabel(user.account_type)}
                        </span>
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        <span style={{
                          backgroundColor: (user.user_status?.toLowerCase() === 'inactive') ? '#f1f5f9' : '#dcfce7',
                          color: (user.user_status?.toLowerCase() === 'inactive') ? '#475569' : '#15803d',
                          padding: '6px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {(user.user_status || 'active').charAt(0).toUpperCase() + (user.user_status || 'active').slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ color: '#64748b', fontSize: '15px', fontWeight: '500' }}>
              {accountFilter === 'alumni'
                ? 'No alumni accounts found'
                : accountFilter === 'ojt'
                  ? 'No OJT accounts found'
                  : 'No users found'}
            </div>
          </div>
        )}
          </>
        ) : (
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '60px 30px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <h2 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>Verification Required</h2>
            <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '14px' }}>
              Re-enter your admin password to access user management features.
            </p>
            <button
              onClick={() => setShowSecurityModal(true)}
              style={{
                padding: '10px 22px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: '#1d4ed8',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Unlock User Management
            </button>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {securityVerified && showDetailsModal && selectedUser && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDetailsModal();
            }
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '18px',
              padding: '0 22px 24px',
              width: 'min(460px, 92vw)',
              maxWidth: '92vw',
              boxShadow: '0 24px 50px rgba(15, 23, 42, 0.32)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              margin: '0 -22px 18px',
              padding: '18px 22px 14px',
              background: 'linear-gradient(135deg, #eef2ff 0%, #dbeafe 45%, #e0f2fe 100%)',
              borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8' }}>
                  Selected User
                </p>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {getDisplayName(selectedUser)}
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ 
                    backgroundColor: getAccountTypeColor(selectedUser.account_type), 
                    color: 'white',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {getAccountTypeLabel(selectedUser.account_type)}
                  </span>
                  <span style={{
                    backgroundColor: selectedUserStatus === 'active' ? '#dcfce7' : '#fee2e2',
                    color: selectedUserStatus === 'active' ? '#15803d' : '#b91c1c',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {selectedUserStatus === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <button
                onClick={closeDetailsModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.color = '#212529';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6c757d';
                }}
                title="Close"
              >
                ×
              </button>
            </div>

            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '14px',
              padding: '14px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              overflow: 'visible'
            }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '10px',
              overflow: 'visible'
            }}>
              {(() => {
                const isOJT = !!selectedUser?.account_type?.ojt;
                const isAlumni = !!selectedUser?.account_type?.user;
                const isCoordinator = !!selectedUser?.account_type?.coordinator;
                const isPeso = !!selectedUser?.account_type?.peso;
                const isAdmin = !!selectedUser?.account_type?.admin;
                
                // For Coordinator, Admin, and PESO: Show minimal account info
                if (isCoordinator || isAdmin || isPeso) {
                  const accountDetails = [];
                  
                  // Username/CTU ID
                  accountDetails.push({
                    label: 'Username',
                    value: selectedUser.acc_username || selectedUser.ctu_id || selectedUser.username || 'N/A'
                  });
                  
                  // Program for Coordinators
                  if (isCoordinator && selectedUser.course) {
                    accountDetails.push({
                      label: 'Program',
                      value: selectedUser.course
                    });
                  }
                  
                  return accountDetails.map((detail) => (
                    <div
                      key={detail.label}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '9px 12px',
                        backgroundColor: 'white',
                        boxShadow: '0 4px 10px rgba(15, 23, 42, 0.04)',
                        position: 'relative'
                      }}
                    >
                      <p style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 700 }}>
                        {detail.label}
                      </p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>
                        {detail.value}
                      </p>
                    </div>
                  ));
                }
                
                // For Alumni and OJT: Show all personal details
                return [
                  { label: 'First Name', value: getFirstName(selectedUser) },
                  { label: 'Last Name', value: getLastName(selectedUser) },
                  { label: 'Middle Name', value: getMiddleName(selectedUser) },
                  { label: 'Email', value: getEmailValue(selectedUser), isEmail: true },
                  { label: 'Address', value: getAddressValue(selectedUser) },
                  { label: 'Contact Number', value: getContactValue(selectedUser) },
                ].map((detail) => {
                  const canEditEmail = detail.isEmail && (isOJT || isAlumni);
                
                return (
                  <div
                    key={detail.label}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '9px 12px',
                      backgroundColor: 'white',
                      boxShadow: '0 4px 10px rgba(15, 23, 42, 0.04)',
                      position: 'relative',
                      gridColumn: canEditEmail && editingEmail ? 'span 2' : 'span 1',
                      minWidth: canEditEmail && editingEmail ? '300px' : 'auto',
                      overflow: 'visible'
                    }}
                  >
                    <p style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 700 }}>
                      {detail.label}
                    </p>
                    {canEditEmail && editingEmail ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', minWidth: 0 }}>
                        <input
                          type="email"
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateEmail();
                            } else if (e.key === 'Escape') {
                              setEmailValue(getEmailValue(selectedUser));
                              setEditingEmail(false);
                            }
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '6px 8px',
                            border: '2px solid #3b82f6',
                            borderRadius: '6px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          autoFocus
                        />
                        <button
                          onClick={handleUpdateEmail}
                          disabled={emailLoading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: emailLoading ? 'not-allowed' : 'pointer',
                            opacity: emailLoading ? 0.6 : 1,
                            flexShrink: 0,
                            minWidth: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {emailLoading ? '...' : '✓'}
                        </button>
                        <button
                          onClick={() => {
                            setEmailValue(getEmailValue(selectedUser));
                            setEditingEmail(false);
                          }}
                          disabled={emailLoading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: emailLoading ? 'not-allowed' : 'pointer',
                            flexShrink: 0,
                            minWidth: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', width: '100%', minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {detail.value}
                        </p>
                        {canEditEmail && (
                          <button
                            onClick={() => setEditingEmail(true)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#f8f9fa',
                              color: '#495057',
                              border: '1px solid #dee2e6',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              transition: 'all 0.2s ease',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#e9ecef';
                              e.currentTarget.style.borderColor = '#adb5bd';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8f9fa';
                              e.currentTarget.style.borderColor = '#dee2e6';
                            }}
                            title="Edit email"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
              })()}
            </div>
            </div>

            {canManageSelectedUser ? (
              <>
                <div style={{
                  border: '1px solid #dbeafe',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  background: 'linear-gradient(120deg, #e0f2fe 0%, #eef2ff 90%)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                      Account Status
                    </p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: selectedUserStatus === 'active' ? '#047857' : '#b91c1c' }}>
                      {selectedUserStatus === 'active' ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <button
                    onClick={() => openStatusConfirm(selectedUserStatus === 'active' ? 'deactivate' : 'activate')}
                    disabled={updatingStatusId === selectedUser.user_id}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '28px',
                      border: 'none',
                      backgroundColor: selectedUserStatus === 'active' ? '#dc2626' : '#16a34a',
                      color: 'white',
                      fontWeight: 600,
                      cursor: updatingStatusId === selectedUser.user_id ? 'not-allowed' : 'pointer',
                      minWidth: '150px'
                    }}
                  >
                    {updatingStatusId === selectedUser.user_id
                      ? 'Updating...'
                      : selectedUserStatus === 'active'
                        ? 'Deactivate Account'
                        : 'Activate Account'}
                  </button>
                </div>
              </>
            ) : (
              <div>
                {!canChangePassword && (
                  <div style={{ 
                    backgroundColor: '#fef9c3',
                    border: '1px solid #fde68a',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: '#92400e',
                    fontSize: '13px',
                    marginBottom: '16px'
                  }}>
                    Only Alumni and OJT accounts support in-modal deactivation. Password changes are available for Coordinator and PESO accounts.
                  </div>
                )}

                {canChangePassword && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: showPasswordForm ? '12px' : '0' }}>
                      <button
                        onClick={togglePasswordForm}
                        style={{
                          padding: '10px 22px',
                          borderRadius: '999px',
                          border: '1px solid #c7d2fe',
                          backgroundColor: showPasswordForm ? '#e0e7ff' : '#f1f5f9',
                          color: '#1d4ed8',
                          fontWeight: 600,
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        {showPasswordForm ? 'Hide Password Form' : 'Change Password'}
                      </button>
                    </div>

                    {showPasswordForm && error && (
                      <div style={{
                        backgroundColor: '#f8d7da',
                        border: '1px solid #f5c6cb',
                        borderRadius: '6px',
                        padding: '10px',
                        marginBottom: '16px',
                        color: '#721c24',
                        fontSize: '14px'
                      }}>
                        {error}
                      </div>
                    )}

                    {showPasswordForm && success && (
                      <div style={{
                        backgroundColor: '#d4edda',
                        border: '1px solid #c3e6cb',
                        borderRadius: '6px',
                        padding: '10px',
                        marginBottom: '16px',
                        color: '#155724',
                        fontSize: '14px'
                      }}>
                        {success}
                      </div>
                    )}
                    
                    {showPasswordForm && (
                      <>
                        <div style={{ marginBottom: '14px' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                            New Password
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px 45px 10px 12px',
                                border: '2px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '14px',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box',
                                fontWeight: '500',
                                color: '#1e293b',
                                outline: 'none'
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#e2e8f0';
                                e.target.style.boxShadow = 'none';
                              }}
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title={showNewPassword ? 'Hide password' : 'Show password'}
                              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            >
                              <PasswordVisibilityIcon show={showNewPassword} size={20} color="#6c757d" />
                            </button>
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: '18px' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                            Confirm Password
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px 45px 10px 12px',
                                border: '2px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '14px',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box',
                                fontWeight: '500',
                                color: '#1e293b',
                                outline: 'none'
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#e2e8f0';
                                e.target.style.boxShadow = 'none';
                              }}
                              placeholder="Confirm new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title={showConfirmPassword ? 'Hide password' : 'Show password'}
                              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                              <PasswordVisibilityIcon show={showConfirmPassword} size={20} color="#6c757d" />
                            </button>
                          </div>
                        </div>
                        
                        <div style={{ 
                          display: 'flex', 
                          gap: '10px', 
                          justifyContent: 'flex-end',
                          paddingTop: '16px',
                          borderTop: '1px solid #e5e7eb'
                        }}>
                          <button
                            onClick={closeDetailsModal}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handlePasswordChange}
                            disabled={passwordLoading || !newPassword || !confirmPassword}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: passwordLoading ? '#6c757d' : '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: passwordLoading ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: '600',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => !passwordLoading && (e.currentTarget.style.backgroundColor = '#218838')}
                            onMouseLeave={(e) => !passwordLoading && (e.currentTarget.style.backgroundColor = '#28a745')}
                          >
                            {passwordLoading ? 'Updating...' : 'Update Password'}
                          </button>
                        </div>
                      </>
                    )}

                    {!showPasswordForm && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <button
                          onClick={closeDetailsModal}
                          style={{
                            padding: '10px 22px',
                            backgroundColor: '#1d4ed8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e40af'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </>
                )}

                {!canChangePassword && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button
                      onClick={closeDetailsModal}
                      style={{
                        padding: '10px 22px',
                        backgroundColor: '#1d4ed8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e40af'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {showSecurityModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1600
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSecurityPassword('');
              setShowSecurityPassword(false);
              setSecurityError('');
              setShowSecurityModal(false);
            }
          }}
        >
          <form
            onSubmit={handleSecuritySubmit}
            style={{
              width: 'min(400px, 90vw)',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              backgroundColor: '#ffffff',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              margin: '0 0 24px 0',
              fontSize: '22px',
              fontWeight: 700,
              color: '#1f2937',
              textAlign: 'center'
            }}>
              Confirm Admin Password
            </h2>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
            >
              {securityError && (
                <div
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    fontSize: '13px'
                  }}
                >
                  {securityError}
                </div>
              )}

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1f2937',
                  marginBottom: '8px'
                }}>
                  Password:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSecurityPassword ? 'text' : 'password'}
                    value={securityPassword}
                    onChange={(e) => setSecurityPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{
                      width: '100%',
                      padding: '12px 56px 12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      backgroundColor: '#ffffff',
                      fontSize: '15px',
                      color: '#1f2937',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#2563eb';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s ease, background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    aria-label={showSecurityPassword ? 'Hide password' : 'Show password'}
                  >
                    <PasswordVisibilityIcon show={showSecurityPassword} size={26} color="#4b5563" />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSecurityPassword('');
                    setShowSecurityPassword(false);
                    setSecurityError('');
                    setShowSecurityModal(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={securityLoading}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: securityLoading ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: securityLoading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!securityLoading) e.currentTarget.style.backgroundColor = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    if (!securityLoading) e.currentTarget.style.backgroundColor = '#2563eb';
                  }}
                >
                  {securityLoading ? 'Verifying...' : 'Submit'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {securityVerified && showStatusConfirm && selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowStatusConfirm(false);
              setPendingStatusAction(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '22px 28px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 18px 36px rgba(15,23,42,0.22)'
            }}
          >
            <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {pendingStatusAction === 'deactivate' ? 'Deactivate account?' : 'Activate account?'}
            </h4>
            <p style={{ margin: '0 0 18px 0', color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>
              {pendingStatusAction === 'deactivate'
                ? 'Are you sure you want to deactivate this account? The user will lose portal access until reactivated.'
                : 'Are you sure you want to reactivate this account? The user will regain portal access immediately.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowStatusConfirm(false);
                  setPendingStatusAction(null);
                }}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#e2e8f0',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#1e293b',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={updatingStatusId === selectedUser.user_id}
                style={{
                  padding: '9px 18px',
                  backgroundColor: pendingStatusAction === 'deactivate' ? '#dc2626' : '#16a34a',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: updatingStatusId === selectedUser.user_id ? 'not-allowed' : 'pointer',
                  opacity: updatingStatusId === selectedUser.user_id ? 0.7 : 1
                }}
              >
                {updatingStatusId === selectedUser.user_id
                  ? 'Working...'
                  : pendingStatusAction === 'deactivate'
                    ? 'Yes, deactivate'
                    : 'Yes, activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {securityVerified && showCreateModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
        setShowCreateModal(false);
        setError('');
        setSuccess('');
        setShowPasswordDisplay(false);
        setCreatedPassword('');
        setShowCreatePassword(false);
        setAccountTypeSelected(false);
            }
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '28px 32px',
              width: 'min(900px, 95vw)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              marginBottom: '16px',
              borderBottom: '1px solid #e9ecef',
              paddingBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#212529', letterSpacing: '-0.3px' }}>Create New User</h2>
              <button
                onClick={() => {
        setShowCreateModal(false);
        setError('');
        setSuccess('');
        setShowPasswordDisplay(false);
        setCreatedPassword('');
        setShowCreatePassword(false);
        setAccountTypeSelected(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.color = '#212529';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6c757d';
                }}
                title="Close"
              >
                ×
              </button>
            </div>
            
            <div style={{ 
              flex: 1,
              overflowY: 'visible',
              overflowX: 'hidden'
            }}>
            
            {showPasswordDisplay && createdPassword && (
              <div style={{
                backgroundColor: '#d1ecf1',
                border: '1px solid #bee5eb',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <strong>User created successfully!</strong>
                <p style={{ margin: '8px 0 0 0' }}>
                  <strong>Password:</strong> <code style={{ backgroundColor: '#f8f9fa', padding: '2px 6px', borderRadius: '3px' }}>{createdPassword}</code>
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6c757d' }}>
                  Please save this password. It will not be shown again.
                </p>
              </div>
            )}

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
              gap: '16px',
              margin: 0
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#212529' }}>
                  Account Type *
                </label>
                <select
                  name="account_type"
                  value={formData.account_type}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23333\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Select account type</option>
                  <option value="peso">PESO</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="alumni">Alumni</option>
                </select>
              </div>

              {accountTypeSelected && (
                <>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#212529' }}>
                  Username * <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 'normal' }}>(CTU ID)</span>
                </label>
                <input
                  type="text"
                  name="acc_username"
                  value={formData.acc_username}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    backgroundColor: '#fff'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#007bff';
                    e.target.style.boxShadow = '0 0 0 3px rgba(0,123,255,0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#dee2e6';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Enter username"
                />
              </div>

              {passwordRequired && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#212529' }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCreatePassword ? 'text' : 'password'}
                        name="acc_password"
                        value={formData.acc_password}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '10px 45px 10px 12px',
                          border: '1px solid #dee2e6',
                          borderRadius: '8px',
                          fontSize: '14px',
                          transition: 'all 0.2s',
                          boxSizing: 'border-box',
                          backgroundColor: '#fff'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#007bff';
                          e.target.style.boxShadow = '0 0 0 3px rgba(0,123,255,0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#dee2e6';
                          e.target.style.boxShadow = 'none';
                        }}
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title={showCreatePassword ? 'Hide password' : 'Show password'}
                        aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                      >
                        <PasswordVisibilityIcon show={showCreatePassword} size={20} color="#6c757d" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {!passwordRequired && (
                <div style={{
                  backgroundColor: '#e0f2fe',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#0369a1', fontWeight: '500' }}>
                    <strong>Password:</strong> Will be automatically generated for {formData.account_type === 'alumni' ? 'Alumni' : 'OJT'} accounts.
                  </p>
                </div>
              )}

              {passwordRequired && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#212529' }}>
                    Confirm Password <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 'normal' }}>(Required)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="acc_password_confirm"
                      value={formData.acc_password_confirm}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '10px 45px 10px 12px',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box',
                        backgroundColor: '#fff'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#007bff';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,123,255,0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#dee2e6';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      placeholder="Re-enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      <PasswordVisibilityIcon show={showConfirmPassword} size={20} color="#6c757d" />
                    </button>
                  </div>
                </div>
              )}

              {formData.account_type === 'coordinator' && (
                <>
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#212529' }}>
                    Program *
                  </label>
                  <select
                    name="course"
                    value={formData.course}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                        padding: '10px 40px 10px 12px',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box',
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23333\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 14px center'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#007bff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(0,123,255,0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#dee2e6';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">Select program</option>
                    <option value="BSIT">BSIT</option>
                    <option value="BITCT">BITCT</option>
                    <option value="BSIS">BSIS</option>
                  </select>
                </div>
                </>
              )}

              {/* PESO accounts have fixed name; no extra fields needed */}

              {formData.account_type !== 'coordinator' && formData.account_type !== 'peso' && (
                <>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  First Name *
                </label>
                <input
                  type="text"
                  name="f_name"
                  value={formData.f_name}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  Middle Name
                </label>
                <input
                  type="text"
                  name="m_name"
                  value={formData.m_name}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Enter middle name (type N/A if none)"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  name="l_name"
                  value={formData.l_name}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
                  required={false}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    const email = e.target.value;
                    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (email && !emailRegex.test(email)) {
                      e.target.style.borderColor = '#dc3545';
                      e.target.style.boxShadow = '0 0 0 3px rgba(220, 53, 69, 0.1)';
                      e.target.setCustomValidity('Please enter a valid email address (e.g., user@gmail.com)');
                    } else {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                      e.target.setCustomValidity('');
                    }
                  }}
                  placeholder="Enter email (e.g., user@gmail.com)"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => {
                    // Only allow numbers and limit to 11 digits
                    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setFormData({ ...formData, phone_number: value });
                  }}
                  inputMode="numeric"
                  pattern="[0-9]{11}"
                  maxLength={11}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                  onKeyPress={(e) => {
                    // Only allow numeric characters
                    const char = String.fromCharCode(e.which || e.keyCode);
                    if (!/[0-9]/.test(char)) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Enter phone number (11 digits)"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  Birthdate
                </label>
                <input
                  type="date"
                  name="birthdate"
                  value={formData.birthdate}
                  onChange={handleInputChange}
                  max="2100-12-31"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  Year Graduated
                </label>
                <select
                  name="year_graduated"
                  value={formData.year_graduated}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: formData.year_graduated ? '#1e293b' : '#9ca3af',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Select year graduated</option>
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const startYear = 1980; // Start from 1980 to accommodate older alumni
                    const endYear = currentYear + 1; // Allow current year + 1 for next academic year
                    const options = [];
                    for (let year = startYear; year <= endYear; year++) {
                      const nextYear = year + 1;
                      options.push(
                        <option key={year} value={year}>
                          {year}-{nextYear}
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Enter address"
                />
              </div>
              </>
              )}
              </>)}
              
              {formData.account_type === 'ojt' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                      OJT Start Date
                    </label>
                    <input
                      type="date"
                      name="ojt_start_date"
                      value={formData.ojt_start_date}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                      OJT End Date
                    </label>
                    <input
                      type="date"
                      name="ojt_end_date"
                      value={formData.ojt_end_date}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#495057' }}>
                      Job Code
                    </label>
                    <input
                      type="text"
                      name="job_code"
                      value={formData.job_code}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                      placeholder="Enter job code"
                    />
                  </div>
                </>
              )}
            </div>
            </div>

            {accountTypeSelected && (
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end', 
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e9ecef'
              }}>
                <button
                  onClick={() => {
          setShowCreateModal(false);
          setError('');
          setSuccess('');
          setShowPasswordDisplay(false);
          setCreatedPassword('');
          setShowCreatePassword(false);
          setAccountTypeSelected(false);
          setFormData({
            acc_username: '',
            account_type: 'alumni',
            acc_password: '',
          acc_password_confirm: '',
            f_name: '',
            m_name: '',
            l_name: '',
            email: '',
            phone_number: '',
            gender: '',
            course: '',
            section: '',
            year_graduated: '',
            address: '',
            birthdate: '',
            ojt_start_date: '',
            ojt_end_date: '',
            job_code: ''
          });
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#f8f9fa',
                    color: '#495057',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                    e.currentTarget.style.borderColor = '#adb5bd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                    e.currentTarget.style.borderColor = '#dee2e6';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={createLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: createLoading ? '#95a5a6' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: createLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    boxShadow: createLoading ? 'none' : '0 2px 4px rgba(40,167,69,0.2)'
                  }}
                  onMouseEnter={(e) => {
                    if (!createLoading) {
                      e.currentTarget.style.backgroundColor = '#218838';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(40,167,69,0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!createLoading) {
                      e.currentTarget.style.backgroundColor = '#28a745';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(40,167,69,0.2)';
                    }
                  }}
                >
                  {createLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default UserManagement;

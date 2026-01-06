import React, { useState, useEffect, useRef } from 'react';
import { fetchOJTByYear, updateOJTStatus, updateOJTUser, getCompanySuggestions, getSendDates } from '../../services/api';
import { toast } from '../../utils/toast';
import { FaArrowLeft } from 'react-icons/fa';

interface DetailsTableProps {
  onBack: () => void;
  selectedYear?: number;
  selectedSection?: string;
  searchQuery?: string;
}

export default function DetailsTable({ onBack, selectedYear, selectedSection, searchQuery }: DetailsTableProps) {
  const [ojtData, setOjtData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [search, setSearch] = useState(searchQuery || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [completingAll, setCompletingAll] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{[key: string]: string[]}>({});
  const [showSuggestions, setShowSuggestions] = useState<{[key: string]: boolean}>({});
  const suggestionRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const [sendDatePassed, setSendDatePassed] = useState(false);
  const [sendDateInfo, setSendDateInfo] = useState<{date: string, batchYear: number} | null>(null);
  const lastToastStateRef = useRef<{hasPassed: boolean, diffDays: number | null, batchYear: number | null} | null>(null);

  useEffect(() => {
    // Get coordinator username from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      // Use username instead of full name for coordinator
      const username = userData.username || userData.name || '';
      setCoordinatorUsername(username);
    }
  }, []);

  useEffect(() => {
    const loadOJTData = async () => {
      // CRITICAL: Don't load data if coordinator username is not available yet
      if (!coordinatorUsername || !coordinatorUsername.trim()) {
        console.warn('⚠️ No coordinator username available, skipping data load');
        setLoading(false);
        return;
      }

      if (selectedYear) {
        try {
          // Always pass coordinator username - required for filtering
          const data = await fetchOJTByYear(selectedYear.toString(), coordinatorUsername, selectedSection);
          setOjtData(data.ojt_data || []);
        } catch (error) {
          console.error('Error loading OJT data:', error);
          setOjtData([]);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadOJTData();
  }, [selectedYear, selectedSection, coordinatorUsername]);

  // Check send date on page load/refresh and show toast if within 7 days or passed
  useEffect(() => {
    const checkSendDateOnLoad = async () => {
      // Wait for both coordinatorUsername and selectedYear to be available
      if (!coordinatorUsername || !coordinatorUsername.trim() || !selectedYear) {
        console.log('⏳ [Send Date Check] Waiting for coordinatorUsername or selectedYear:', { 
          coordinatorUsername: coordinatorUsername || 'missing', 
          selectedYear: selectedYear || 'missing' 
        });
        return;
      }

      try {
        console.log('🔍 [Send Date Check] Checking send date for batch:', selectedYear, 'coordinator:', coordinatorUsername);
        const sendDatesResult = await getSendDates(coordinatorUsername);
        console.log('📅 [Send Date Check] API Response:', sendDatesResult);
        
        if (sendDatesResult && sendDatesResult.success && sendDatesResult.scheduled_dates) {
          const scheduledDates = sendDatesResult.scheduled_dates;
          console.log('📋 [Send Date Check] Scheduled dates found:', scheduledDates.length, scheduledDates);
          
          // Find send date for this batch year
          const batchSendDate = scheduledDates.find(
            (sd: any) => sd.batch_year === selectedYear
          );
          
          console.log('🎯 [Send Date Check] Batch send date found:', batchSendDate);
          
          if (batchSendDate && batchSendDate.send_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const sendDate = new Date(batchSendDate.send_date);
            sendDate.setHours(0, 0, 0, 0);
            
            // Calculate days until send date
            const diffTime = sendDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            console.log('📊 [Send Date Check] Date calculation:', {
              today: today.toISOString().split('T')[0],
              sendDate: sendDate.toISOString().split('T')[0],
              diffDays,
              hasPassed: sendDate <= today
            });
            
            // Check if send date has passed
            const hasPassed = sendDate <= today;
            
            if (hasPassed) {
              // Toast notification when send date has passed
              console.log('⚠️ [Send Date Check] Send date has PASSED - showing toast');
              toast.warning(`The send date for batch ${selectedYear} has passed (${batchSendDate.send_date}). Updates are no longer allowed.`);
            } else if (diffDays <= 7 && diffDays > 0) {
              // Toast warning if send date is almost passed (within 7 days)
              console.log('⚠️ [Send Date Check] Send date is within 7 days - showing toast. Days remaining:', diffDays);
              toast.warning(`The send date for batch ${selectedYear} is approaching. Only ${diffDays} day${diffDays !== 1 ? 's' : ''} remaining (${batchSendDate.send_date}).`);
            } else {
              console.log('✅ [Send Date Check] Send date is more than 7 days away:', diffDays, 'days');
            }
          } else {
            console.log('ℹ️ [Send Date Check] No send date found for batch:', selectedYear);
          }
        } else {
          console.log('⚠️ [Send Date Check] API response invalid or no scheduled dates:', sendDatesResult);
        }
      } catch (error) {
        console.error('❌ [Send Date Check] Error checking send date on load:', error);
      }
    };

    // Add a small delay to ensure coordinatorUsername is set
    const timeoutId = setTimeout(() => {
      checkSendDateOnLoad();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [coordinatorUsername, selectedYear]);

  // Check if send date has passed when student is selected
  useEffect(() => {
    const checkSendDate = async () => {
      if (selected && coordinatorUsername && selectedYear) {
        try {
          const sendDatesResult = await getSendDates(coordinatorUsername);
          if (sendDatesResult.success && sendDatesResult.scheduled_dates) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Find send date for this batch year
            const batchSendDate = sendDatesResult.scheduled_dates.find(
              (sd: any) => sd.batch_year === selectedYear
            );
            
            if (batchSendDate) {
              const sendDate = new Date(batchSendDate.send_date);
              sendDate.setHours(0, 0, 0, 0);
              
              // Calculate days until send date
              const diffTime = sendDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              // Check if send date has passed (is today or earlier)
              const hasPassed = sendDate <= today;
              setSendDatePassed(hasPassed);
              
              // Check if we need to show a toast (only if state changed)
              const currentState = { hasPassed, diffDays: hasPassed ? null : diffDays, batchYear: selectedYear };
              const lastState = lastToastStateRef.current;
              const stateChanged = !lastState || 
                lastState.hasPassed !== currentState.hasPassed || 
                lastState.batchYear !== currentState.batchYear ||
                (!hasPassed && lastState.diffDays !== currentState.diffDays && currentState.diffDays !== null && currentState.diffDays <= 7);
              
              if (hasPassed) {
                setSendDateInfo({
                  date: batchSendDate.send_date,
                  batchYear: selectedYear
                });
                // Toast notification when send date has passed (only show once per state change)
                if (stateChanged && (!lastState || !lastState.hasPassed)) {
                  toast.warning(`The send date for batch ${selectedYear} has passed (${batchSendDate.send_date}). Updates are no longer allowed.`);
                }
              } else {
                setSendDateInfo(null);
                // Toast warning if send date is almost passed (within 7 days) - only show once per state change
                if (diffDays <= 7 && diffDays > 0 && stateChanged) {
                  toast.warning(`The send date for batch ${selectedYear} is approaching. Only ${diffDays} day${diffDays !== 1 ? 's' : ''} remaining (${batchSendDate.send_date}).`);
                }
              }
              
              lastToastStateRef.current = currentState;
            } else {
              setSendDatePassed(false);
              setSendDateInfo(null);
            }
          } else {
            setSendDatePassed(false);
            setSendDateInfo(null);
          }
        } catch (error) {
          console.error('Error checking send date:', error);
          setSendDatePassed(false);
          setSendDateInfo(null);
        }
      } else {
        setSendDatePassed(false);
        setSendDateInfo(null);
      }
    };

    checkSendDate();
  }, [selected, coordinatorUsername, selectedYear]);

  // Modern, neat design styles
  const styles = {
    detailsTable: {
      margin: '24px auto',
      maxWidth: '96%',
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
      border: '1px solid #f1f5f9',
    },
    searchRow: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: '-6px',
      marginBottom: '12px',
    },
    searchInput: {
      padding: '10px 14px',
      border: '1px solid #ccc',
      borderRadius: '20px',
      width: '260px',
    },
    table: {
      width: '100%',
      borderCollapse: 'separate' as const,
      borderSpacing: '0',
      textAlign: 'left' as const,
      tableLayout: 'fixed' as const,
    },
    tableHeader: {
      position: 'sticky' as const,
      top: 0,
      zIndex: 10,
      backgroundColor: 'white',
      borderBottom: '2px solid #e5e7eb',
    },
    tableHeaderTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      textAlign: 'left' as const,
    },
    tableBodyContainer: {
      maxHeight: '450px',
      overflowY: 'auto' as const,
      overflowX: 'auto' as const,
      // Custom scrollbar styling
      scrollbarWidth: 'thin' as const,
      scrollbarColor: '#cbd5e1 #f1f5f9',
    },
    tableBodyTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      textAlign: 'left' as const,
    },
    th: {
      backgroundColor: 'white',
      color: '#374151',
      padding: '18px 20px',
      fontWeight: '600',
      fontSize: '14px',
      textAlign: 'left' as const,
      borderBottom: '1px solid #e5e7eb',
      verticalAlign: 'middle' as const,
      borderRight: '1px solid #e5e7eb',
      letterSpacing: '0.025em',
    },
    td: {
      padding: '16px 20px',
      fontSize: '14px',
      verticalAlign: 'middle' as const,
      borderBottom: '1px solid #f1f5f9',
      borderRight: '1px solid #f1f5f9',
      textAlign: 'left' as const,
      width: 'auto',
      color: '#374151',
      fontWeight: '400',
    },
    trEven: {
      backgroundColor: '#f9fafb',
    },
    statusCell: {
      textAlign: 'center' as const,
      padding: '16px 20px',
      fontSize: '14px',
      verticalAlign: 'middle' as const,
      borderBottom: '1px solid #f1f5f9',
      borderRight: 'none',
      width: '20%',
      position: 'relative' as const,
      borderLeft: '1px solid #f1f5f9',
      color: '#374151',
      fontWeight: '400',
    },
    statusText: {
      display: 'inline-block',
      padding: '6px 12px',
      borderRadius: '16px',
      fontSize: '12px',
      fontWeight: '600',
      textAlign: 'center' as const,
      margin: '0 auto',
      width: 'fit-content',
      letterSpacing: '0.025em',
    },
    statusApproved: {
      backgroundColor: '#dbeafe',
      color: '#1e40af',
    },
    statusPending: {
      backgroundColor: '#fef3c7',
      color: '#d97706',
    },
    statusNotStarted: {
      backgroundColor: '#f3f4f6',
      color: '#6b7280',
    },
    statusIncomplete: {
      backgroundColor: '#fee2e2',
      color: '#dc2626',
    },
    statusDropdown: {
      width: '100%',
      maxWidth: '160px',
      padding: '8px 12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      backgroundColor: 'white',
      cursor: 'pointer',
      fontSize: '12px',
      textAlign: 'center' as const,
      outline: 'none',
      margin: '0 auto',
      display: 'block',
      fontWeight: '400',
      color: '#374151',
    },
    tableActions: {
      padding: '20px 24px',
      backgroundColor: '#f8fafc',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      borderRadius: '0 0 12px 12px',
    },
    backBtn: {
      padding: '14px 24px',
      background: 'transparent',
      color: '#1e293b',
      border: 'none',
      borderRadius: '16px',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: 'none',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    modalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      backdropFilter: 'blur(4px)',
    },
    modal: {
      background: 'white',
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '98vh',
      borderRadius: '16px',
      padding: '0',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    modalHeader: {
      background: 'white',
      padding: '24px 32px',
      color: '#1f2937',
      position: 'relative' as const,
      borderBottom: '2px solid #e5e7eb',
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: '700',
      margin: '0',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    modalCloseBtn: {
      position: 'absolute' as const,
      top: '20px',
      right: '20px',
      background: '#f3f4f6',
      border: '2px solid #e5e7eb',
      borderRadius: '50%',
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#6b7280',
      fontSize: '18px',
      transition: 'all 0.2s ease',
    },
    modalContent: {
      padding: '24px',
      flex: 1,
      overflowY: 'visible' as const,
      overflowX: 'visible' as const,
    },
    modalGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '12px',
      alignItems: 'start',
    },
    modalSection: {
      background: '#f8fafc',
      borderRadius: '10px',
      padding: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      overflow: 'visible',
      minWidth: 0,
      alignSelf: 'start',
    },
    modalSectionTitle: {
      fontSize: '14px',
      fontWeight: '700',
      color: '#1f2937',
      marginBottom: '10px',
      paddingBottom: '6px',
      borderBottom: '2px solid #1f2937',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    modalField: {
      display: 'grid',
      gridTemplateColumns: '120px 1fr',
      gap: '12px',
      marginBottom: '8px',
      alignItems: 'center',
      maxWidth: '100%',
    },
    modalLabel: {
      color: '#4b5563',
      fontWeight: '600',
      fontSize: '11px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    modalValue: {
      color: '#1f2937',
      fontWeight: '500',
      fontSize: '13px',
      background: 'white',
      padding: '6px 10px',
      borderRadius: '6px',
      border: '1px solid #e5e7eb',
      minHeight: '32px',
      display: 'flex',
      alignItems: 'center',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      transition: 'all 0.2s ease',
      wordBreak: 'break-word' as const,
      overflowWrap: 'break-word' as const,
      whiteSpace: 'normal' as const,
    } as React.CSSProperties
  };

  const normalized = (v: any) => (v ? String(v).toLowerCase() : '');
  
  // Check if user has been sent to admin but not yet approved
  const isUserSentToAdmin = (user: any) => {
    // Show "Sent to Admin (Pending)" if user has is_sent_to_admin flag from backend
    // Note: Alumni are already filtered out, so we don't need to check is_alumni here
    return user.is_sent_to_admin === true;
  };

  // Fetch company suggestions
  const fetchSuggestions = async (field: string, query: string) => {
    if (query.length < 1) {
      setSuggestions(prev => ({ ...prev, [field]: [] }));
      return;
    }
    
    try {
      // Pass coordinator username to get only this coordinator's suggestions
      const result = await getCompanySuggestions(field, query, 5, coordinatorUsername);
      if (result.success) {
        setSuggestions(prev => ({ ...prev, [field]: result.suggestions || [] }));
        setShowSuggestions(prev => ({ ...prev, [field]: true }));
      }
    } catch (error) {
      // Silently fail - suggestions are optional
      setSuggestions(prev => ({ ...prev, [field]: [] }));
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (field: string, value: string) => {
    setEditFormData({ ...editFormData, [field]: value });
    setShowSuggestions(prev => ({ ...prev, [field]: false }));
    setSuggestions(prev => ({ ...prev, [field]: [] }));
  };

  // Render autocomplete input field
  const renderAutocompleteInput = (field: string, label: string, placeholder: string, type: string = 'text') => {
    const fieldMap: {[key: string]: string} = {
      'company_name': 'company_name',
      'company_address': 'company_address',
      'company_email': 'company_email',
      'company_contact': 'company_contact',
      'contact_person': 'contact_person',
      'position': 'position',
    };
    const apiField = fieldMap[field] || field;

    return (
      <div style={styles.modalField}>
        <div style={styles.modalLabel}>{label} <span style={{ color: '#ef4444' }}>*</span></div>
        <div style={{ position: 'relative', width: '100%', minWidth: 0 }}>
          <input
            type={type}
            required
            value={editFormData[field] || ''}
            onChange={(e) => {
              const value = e.target.value;
              setEditFormData({ ...editFormData, [field]: value });
              fetchSuggestions(apiField, value);
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.2)';
              if (editFormData[field]) {
                fetchSuggestions(apiField, editFormData[field]);
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(59, 130, 246, 0.1)';
              setTimeout(() => setShowSuggestions(prev => ({ ...prev, [apiField]: false })), 200);
            }}
            placeholder={placeholder}
            style={{
              width: '100%',
              maxWidth: '100%',
              padding: '8px 12px',
              border: '2px solid #3b82f6',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#1f2937',
              background: 'white',
              boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)',
              transition: 'all 0.2s ease',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {showSuggestions[apiField] && suggestions[apiField] && suggestions[apiField].length > 0 && (
            <div
              ref={(el) => suggestionRefs.current[apiField] = el}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                marginTop: '6px',
                overflow: 'visible',
                width: '100%',
              }}
            >
              {suggestions[apiField].map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSuggestionSelect(field, suggestion)}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderBottom: index < suggestions[apiField].length - 1 ? '1px solid #f1f5f9' : 'none',
                    fontSize: '13px',
                    fontWeight: '400',
                    color: '#374151',
                    transition: 'all 0.15s ease',
                    backgroundColor: 'white',
                    wordBreak: 'break-all' as const,
                    overflowWrap: 'break-word' as const,
                    whiteSpace: 'normal' as const,
                    overflow: 'visible' as const,
                    minWidth: 0,
                    width: '100%',
                    boxSizing: 'border-box' as const,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.color = '#1f2937';
                    e.currentTarget.style.paddingLeft = '16px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.paddingLeft = '14px';
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Check if student is overdue (past end date but still ongoing)
  const isOverdue = (ojt: any) => {
    if (ojt.ojt_status !== 'Ongoing') return false;
    if (!ojt.ojt_end_date) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
    
    const endDate = new Date(ojt.ojt_end_date);
    endDate.setHours(0, 0, 0, 0);
    
    return today > endDate; // Current date is past the end date
  };
  
  useEffect(() => {
    if (typeof searchQuery === 'string') setSearch(searchQuery);
  }, [searchQuery]);
  const filtered = ojtData.filter((ojt) => {
    // Filter out alumni - they are no longer OJT students
    if (ojt.is_alumni) {
      return false;
    }
    
    const ctuIdStr = String(ojt.ctu_id || '');
    const first = (ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '') || '').toLowerCase();
    const last = (ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '') || '').toLowerCase();
    
    // Filter by section if specified
    if (selectedSection) {
      // The backend already filters by section, so we don't need additional filtering here
      // This allows all users returned by the API to be displayed
    }
    
    // Search filter
    const q = normalized(search);
    const searchMatch = !q || (() => {
      const firstNorm = normalized(ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : ''));
      const lastNorm = normalized(ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : ''));
      const company = normalized(ojt.company);
      const ctuId = normalized(ojt.ctu_id || ojt.id);
      return firstNorm.includes(q) || lastNorm.includes(q) || company.includes(q) || ctuId.includes(q);
    })();
    
    // Status filter
    const statusMatch = (() => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'incomplete') return ojt.ojt_status === 'Incomplete' || isOverdue(ojt);
      if (statusFilter === 'ongoing') return !isUserSentToAdmin(ojt) && ojt.ojt_status !== 'Incomplete' && !isOverdue(ojt) && (ojt.ojt_status || 'Ongoing') === 'Ongoing';
      if (statusFilter === 'completed') return !isUserSentToAdmin(ojt) && ojt.ojt_status !== 'Incomplete' && (ojt.ojt_status || 'Ongoing') === 'Completed';
      return true; // 'all' - show everything
    })();
    
    return searchMatch && statusMatch;
  });

  if (loading) {
    return (
      <>
        <style>{`
          .ojt-table-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .ojt-table-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          .ojt-table-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .ojt-table-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
        <div style={styles.detailsTable}>
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading OJT data...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .ojt-table-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .ojt-table-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .ojt-table-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .ojt-table-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div>
        {/* Back Button */}
        <div style={{ marginBottom: '24px', paddingLeft: '30px' }}>
          <button 
            style={styles.backBtn} 
            onClick={onBack}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.transform = 'translateY(-2px)';
              target.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.transform = 'translateY(0)';
              target.style.backgroundColor = 'transparent';
            }}
          >
            <FaArrowLeft />
            Back
          </button>
        </div>
        <div style={styles.detailsTable}>
        {/* Header Bar with Class, Section, Search and Filter */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px 24px',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        border: '1px solid #e5e7eb',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div style={{ color: '#374151' }}>
          <h2 style={{ 
            margin: '0 0 4px 0', 
            fontSize: '24px', 
            fontWeight: '700',
            color: '#1f2937'
          }}>
            Class of {selectedYear ? `${selectedYear}-${selectedYear + 1}` : 'N/A'}
          </h2>
          <p style={{ 
            margin: '0', 
            fontSize: '16px', 
            fontWeight: '500',
            color: '#6b7280'
          }}>
            Section: {selectedSection}
          </p>
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '140px'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          >
            <option value="all" style={{ color: '#374151' }}>All Students</option>
            <option value="ongoing" style={{ color: '#374151' }}>Ongoing</option>
            <option value="completed" style={{ color: '#374151' }}>Completed</option>
            <option value="incomplete" style={{ color: '#374151' }}>Incomplete (Overdue)</option>
          </select>
          
          <input
            type="text"
            placeholder="Search by name or CTU ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              outline: 'none',
              minWidth: '250px'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>
      
      {/* Single Table with Fixed Layout */}
      <div style={styles.tableBodyContainer} className="ojt-table-scrollbar">
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '20%', textAlign: 'left' as const }}>Last Name</th>
              <th style={{ ...styles.th, width: '20%', textAlign: 'left' as const }}>First Name</th>
              <th style={{ ...styles.th, width: '40%', textAlign: 'left' as const }}>Company</th>
              <th style={{ 
                ...styles.th, 
                textAlign: 'center' as const, 
                padding: '16px 20px', 
                width: '20%',
                position: 'relative' as const,
                borderRight: 'none'
              }}>OJT Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  No OJT data found for this year.
                </td>
              </tr>
            ) : (
              filtered.map((ojt, idx) => (
                <tr
                  key={ojt.id}
                  style={idx % 2 === 1 ? styles.trEven : undefined}
                  onClick={() => setSelected(ojt)}
                >
                  <td style={{ ...styles.td, textAlign: 'left' as const, width: '20%' }}>{ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '')}</td>
                  <td style={{ ...styles.td, textAlign: 'left' as const, width: '20%' }}>{ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '')}</td>
                  <td style={{ ...styles.td, borderRight: 'none', textAlign: 'left' as const, width: '40%' }}>{ojt.company || ''}</td>
                  <td style={{ ...styles.statusCell, width: '20%' }}>
                    {isUserSentToAdmin(ojt) ? (
                      <span style={{
                        ...styles.statusText,
                        ...styles.statusPending
                      }}>
                        PENDING
                      </span>
                    ) : (ojt.ojt_status === 'Incomplete' || isOverdue(ojt)) ? (
                      // INCOMPLETE = Either marked as Incomplete OR past end date but still ongoing
                      // Check status FIRST, regardless of start date
                      <span style={{
                        ...styles.statusText,
                        ...styles.statusIncomplete
                      }}
                      title={ojt.ojt_status === 'Incomplete' ? 'Student marked as Incomplete' : 'OJT is overdue - past the end date but still ongoing'}
                      >
                        INCOMPLETE
                      </span>
                    ) : !ojt.ojt_start_date ? (
                      // NO START DATE = Status is DISABLED (First Import - personal info only)
                      // Only show NOT STARTED if status is not explicitly set to Incomplete
                      <span style={{
                        ...styles.statusText,
                        ...styles.statusNotStarted
                      }}
                      title="Status cannot be changed until student has a start date (Second Import with company info)"
                      >
                        NOT STARTED
                      </span>
                    ) : (
                      // HAS START DATE = Status is CHANGEABLE (Second Import - company info added)
                      <select
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        value={ojt.ojt_status || 'Ongoing'}
                        style={styles.statusDropdown}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          try {
                            const result = await updateOJTStatus(ojt.id, newStatus);
                            if (result.success) {
                              setOjtData((prev) => prev.map((row) => row.id === ojt.id ? { ...row, ojt_status: newStatus } : row));
                            } else {
                              toast.error(result.error || result.message || 'Failed to update status');
                            }
                          } catch (err) {
                            console.error('Failed to update status:', err);
                            toast.error('Failed to update status. Please try again.');
                          }
                        }}
                        title={ojt.ojt_status === 'Completed' ? 'To set status to Completed, coordinator must first send request to admin' : 'Status can be changed because start date exists'}
                      >
                        <option value="Completed">COMPLETED</option>
                        <option value="Ongoing">Ongoing</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.tableActions}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {(() => {
            // Get only the students who can be updated (not alumni, not completed, not incomplete, and have a start date)
            const currentSectionStudents = ojtData.filter(student => 
              !student.is_alumni && 
              student.ojt_status !== 'Completed' &&
              student.ojt_status !== 'Incomplete' && // Don't update incomplete students
              student.ojt_start_date // Only include students with a start date (skip NOT STARTED)
            );
            
            // Check if all students are NOT STARTED (no start date)
            const allNotStarted = ojtData.filter(student => 
              !student.is_alumni && 
              student.ojt_status !== 'Completed' &&
              student.ojt_status !== 'Incomplete'
            ).length > 0 && 
            ojtData.filter(student => 
              !student.is_alumni && 
              student.ojt_status !== 'Completed' &&
              student.ojt_status !== 'Incomplete'
            ).every(student => !student.ojt_start_date);
            
            return (
              <button
                style={{
                  padding: '10px 20px',
                  background: allNotStarted || currentSectionStudents.length === 0 ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (allNotStarted || currentSectionStudents.length === 0) ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  fontSize: '14px',
                  opacity: (allNotStarted || currentSectionStudents.length === 0) ? 0.6 : 1
                }}
                onClick={async () => {
                  if (allNotStarted || currentSectionStudents.length === 0) return; // Don't do anything if all are NOT STARTED or no eligible students
                  
                  setCompletingAll(true);
                  try {
                    // Update only the current section students (with start dates) to Completed status
                    for (const student of currentSectionStudents) {
                      try {
                        await updateOJTStatus(student.id, 'Completed');
                      } catch (err) {
                        console.error(`Failed to update ${student.first_name}:`, err);
                      }
                    }
                    
                    // Update local state
                    setOjtData(prev => prev.map(student => 
                      currentSectionStudents.some(s => s.id === student.id) 
                        ? { ...student, ojt_status: 'Completed' }
                        : student
                    ));
                    
                    toast.success(`Updated ${currentSectionStudents.length} student${currentSectionStudents.length !== 1 ? 's' : ''} to Completed status`);
                  } catch (err) {
                    console.error('Complete all failed:', err);
                    toast.error('Failed to complete all students');
                  } finally {
                    setCompletingAll(false);
                  }
                }}
                disabled={completingAll || allNotStarted || currentSectionStudents.length === 0}
                title={allNotStarted || currentSectionStudents.length === 0 ? 'Cannot complete students with NOT STARTED status. Students need a start date first.' : ''}
              >
                {completingAll ? 'Completing...' : 'Complete All'}
              </button>
            );
          })()}
        </div>
      </div>
      </div>

      {selected && (
        <div style={styles.modalOverlay} onClick={() => {
          setSelected(null);
          setIsEditingCompany(false);
          setEditFormData({});
        }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                OJT Student Details
              </div>
              <button 
                style={styles.modalCloseBtn} 
                onClick={() => {
                  setSelected(null);
                  setIsEditingCompany(false);
                  setEditFormData({});
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.color = '#6b7280';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={styles.modalContent}>
              <div style={styles.modalGrid}>
                {/* Personal Information Section */}
                <div style={styles.modalSection}>
                  <div style={styles.modalSectionTitle}>
                    Personal Info
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>CTU ID</div>
                    <div style={styles.modalValue}>{selected.ctu_id || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>First Name</div>
                    <div style={styles.modalValue}>{selected.first_name || (selected.name ? selected.name.split(' ')[0] : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Middle Name</div>
                    <div style={styles.modalValue}>{selected.middle_name || (selected.ctu_id === '1334003' ? 'P.' : selected.ctu_id === '1334004' ? 'R.' : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Last Name</div>
                    <div style={styles.modalValue}>{selected.last_name || (selected.name ? selected.name.split(' ').slice(-1)[0] : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Gender</div>
                    <div style={styles.modalValue}>{selected.gender || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Birthdate</div>
                    <div style={styles.modalValue}>{selected.birthdate || (selected.ctu_id === '1334003' ? '1995-11-08' : selected.ctu_id === '1334004' ? '1996-02-14' : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Phone</div>
                    <div style={styles.modalValue}>{selected.phone_number || (selected.ctu_id === '1334003' ? '9181234567' : selected.ctu_id === '1334004' ? '9181234567' : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Email</div>
                    <div style={{...styles.modalValue, wordBreak: 'break-all', whiteSpace: 'normal'}}>{selected.email || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Address</div>
                    <div style={styles.modalValue}>{selected.address || 'Not specified'}</div>
                  </div>
                </div>

                {/* Company Information Section */}
                <div style={{
                  ...styles.modalSection,
                  ...(isEditingCompany ? {
                    border: '2px solid #3b82f6',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                  } : {})
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '16px' 
                  }}>
                    <div style={styles.modalSectionTitle}>
                      Company Info
                      {isEditingCompany && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          color: '#3b82f6',
                          fontWeight: '500'
                        }}>
                          (Editing)
                        </span>
                      )}
                    </div>
                    {!isEditingCompany && (
                      <button
                        onClick={() => {
                          if (sendDatePassed && sendDateInfo) {
                            toast.error(`Cannot update company information. The send date for batch ${sendDateInfo.batchYear} has already passed (${sendDateInfo.date}).`);
                            return;
                          }
                          setIsEditingCompany(true);
                          setEditFormData({
                            company_name: selected.company || '',
                            company_address: selected.company_address || '',
                            company_email: selected.company_email || '',
                            company_contact: selected.company_contact || '',
                            contact_person: selected.contact_person || '',
                            position: selected.position || '',
                          });
                        }}
                        disabled={sendDatePassed}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: sendDatePassed ? '#f3f4f6' : 'white',
                          color: sendDatePassed ? '#9ca3af' : '#4b5563',
                          border: `1px solid ${sendDatePassed ? '#e5e7eb' : '#e5e7eb'}`,
                          borderRadius: '6px',
                          cursor: sendDatePassed ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                          opacity: sendDatePassed ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!sendDatePassed) {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                            e.currentTarget.style.borderColor = '#d1d5db';
                            e.currentTarget.style.color = '#374151';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!sendDatePassed) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.color = '#4b5563';
                          }
                        }}
                      >
                        Update
                      </button>
                    )}
                  </div>
                  {isEditingCompany ? (
                    <>
                      <div style={styles.modalField}>
                        <div style={styles.modalLabel}>Company <span style={{ color: '#ef4444' }}>*</span></div>
                        <div style={{ position: 'relative', width: '100%' }}>
                        <input
                          type="text"
                            required
                          value={editFormData.company_name || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditFormData({ ...editFormData, company_name: value });
                              fetchSuggestions('company_name', value);
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#2563eb';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.2)';
                              if (editFormData.company_name) {
                                fetchSuggestions('company_name', editFormData.company_name);
                              }
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(59, 130, 246, 0.1)';
                              // Delay hiding suggestions to allow click
                              setTimeout(() => setShowSuggestions(prev => ({ ...prev, company_name: false })), 200);
                            }}
                            placeholder="e.g. ABC Corporation"
                          style={{
                            width: '100%',
                              maxWidth: '100%',
                            padding: '8px 12px',
                            border: '2px solid #3b82f6',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1f2937',
                            background: 'white',
                            boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)',
                            transition: 'all 0.2s ease',
                            outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                          {showSuggestions.company_name && suggestions.company_name && suggestions.company_name.length > 0 && (
                            <div
                              ref={(el) => suggestionRefs.current['company_name'] = el}
                          style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 1000,
                                backgroundColor: 'white',
                                border: '1px solid #d1d5db',
                            borderRadius: '8px',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                                marginTop: '6px',
                                overflow: 'visible',
                                minWidth: '100%',
                              }}
                            >
                              {suggestions.company_name.map((suggestion, index) => (
                                <div
                                  key={index}
                                  onClick={() => handleSuggestionSelect('company_name', suggestion)}
                                  style={{
                                    padding: '12px 14px',
                                    cursor: 'pointer',
                                    borderBottom: index < suggestions.company_name.length - 1 ? '1px solid #f1f5f9' : 'none',
                            fontSize: '13px',
                            fontWeight: '400',
                            color: '#374151',
                                    transition: 'all 0.15s ease',
                                    backgroundColor: 'white',
                                    wordBreak: 'break-word' as const,
                                    overflowWrap: 'break-word' as const,
                                    whiteSpace: 'normal' as const,
                                    overflow: 'visible' as const,
                                    minWidth: 0,
                          }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f8fafc';
                                    e.currentTarget.style.color = '#1f2937';
                                    e.currentTarget.style.paddingLeft = '16px';
                          }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.color = '#374151';
                                    e.currentTarget.style.paddingLeft = '14px';
                          }}
                                >
                                  {suggestion}
                      </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {renderAutocompleteInput('company_address', 'Address', 'e.g. 123 Main St, City, Country')}
                      {renderAutocompleteInput('company_email', 'Email', 'e.g. contact@company.com', 'email')}
                      <div style={styles.modalField}>
                        <div style={styles.modalLabel}>Contact <span style={{ color: '#ef4444' }}>*</span></div>
                        <div style={{ position: 'relative', width: '100%' }}>
                        <input
                          type="text"
                            required
                          value={editFormData.company_contact || ''}
                            onChange={(e) => {
                              // Only allow numbers
                              const value = e.target.value.replace(/\D/g, '');
                              // Limit to 11 digits
                              const limitedValue = value.slice(0, 11);
                              setEditFormData({ ...editFormData, company_contact: limitedValue });
                              if (limitedValue.length >= 1) {
                                fetchSuggestions('company_contact', limitedValue);
                              }
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#2563eb';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.2)';
                              if (editFormData.company_contact) {
                                fetchSuggestions('company_contact', editFormData.company_contact);
                              }
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(59, 130, 246, 0.1)';
                              setTimeout(() => setShowSuggestions(prev => ({ ...prev, company_contact: false })), 200);
                            }}
                            placeholder="e.g. 91234567890 (11 digits)"
                            maxLength={11}
                          style={{
                            width: '100%',
                              maxWidth: '100%',
                            padding: '8px 12px',
                            border: '2px solid #3b82f6',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1f2937',
                            background: 'white',
                            boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)',
                            transition: 'all 0.2s ease',
                            outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                          {showSuggestions.company_contact && suggestions.company_contact && suggestions.company_contact.length > 0 && (
                            <div
                              ref={(el) => suggestionRefs.current['company_contact'] = el}
                          style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 1000,
                                backgroundColor: 'white',
                                border: '1px solid #d1d5db',
                            borderRadius: '8px',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                                marginTop: '6px',
                                overflow: 'visible',
                                minWidth: '100%',
                              }}
                            >
                              {suggestions.company_contact.map((suggestion, index) => (
                                <div
                                  key={index}
                                  onClick={() => {
                                    // Only allow numbers from suggestion
                                    const numericValue = String(suggestion).replace(/\D/g, '').slice(0, 11);
                                    handleSuggestionSelect('company_contact', numericValue);
                                  }}
                                  style={{
                                    padding: '12px 14px',
                                    cursor: 'pointer',
                                    borderBottom: index < suggestions.company_contact.length - 1 ? '1px solid #f1f5f9' : 'none',
                                    fontSize: '13px',
                                    fontWeight: '400',
                                    color: '#374151',
                                    transition: 'all 0.15s ease',
                                    backgroundColor: 'white',
                                    wordBreak: 'break-word' as const,
                                    overflowWrap: 'break-word' as const,
                                    whiteSpace: 'normal' as const,
                                    overflow: 'visible' as const,
                                    minWidth: 0,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f8fafc';
                                    e.currentTarget.style.color = '#1f2937';
                                    e.currentTarget.style.paddingLeft = '16px';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.color = '#374151';
                                    e.currentTarget.style.paddingLeft = '14px';
                                  }}
                                >
                                  {suggestion}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {renderAutocompleteInput('contact_person', 'Contact Person', 'e.g. John Doe')}
                      {renderAutocompleteInput('position', 'Position', 'e.g. Software Developer')}
                      <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        marginTop: '20px',
                        paddingTop: '16px',
                        borderTop: '2px solid #e5e7eb'
                      }}>
                        <button
                          onClick={async () => {
                            // Check if send date has passed - prevent updates if it has
                            if (coordinatorUsername && selectedYear) {
                              try {
                                const sendDatesResult = await getSendDates(coordinatorUsername);
                                if (sendDatesResult.success && sendDatesResult.scheduled_dates) {
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  
                                  // Find send date for this batch year
                                  const batchSendDate = sendDatesResult.scheduled_dates.find(
                                    (sd: any) => sd.batch_year === selectedYear
                                  );
                                  
                                  if (batchSendDate) {
                                    const sendDate = new Date(batchSendDate.send_date);
                                    sendDate.setHours(0, 0, 0, 0);
                                    
                                    // Check if send date has passed (is today or earlier)
                                    if (sendDate <= today) {
                                      toast.error(`Cannot update company information. The send date for batch ${selectedYear} has already passed (${batchSendDate.send_date}). Updates are no longer allowed.`);
                                      return;
                                    }
                                  }
                                }
                              } catch (error) {
                                console.error('Error checking send date:', error);
                                // Continue with update if check fails (don't block user)
                              }
                            }

                            // Validate all required fields
                            const companyName = (editFormData.company_name || '').trim();
                            const companyAddress = (editFormData.company_address || '').trim();
                            const companyEmail = (editFormData.company_email || '').trim();
                            const companyContact = (editFormData.company_contact || '').trim();
                            const contactPerson = (editFormData.contact_person || '').trim();
                            const position = (editFormData.position || '').trim();

                            if (!companyName || !companyAddress || !companyEmail || !companyContact || !contactPerson || !position) {
                              toast.error('Please fill in all required fields');
                              return;
                            }

                            // Validate email format
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(companyEmail)) {
                              toast.error('Please enter a valid email address');
                              return;
                            }

                            // Validate contact number: must be exactly 11 digits and numbers only
                            const contactRegex = /^\d{11}$/;
                            if (!contactRegex.test(companyContact)) {
                              toast.error('Contact number must be exactly 11 digits (numbers only)');
                              return;
                            }

                            setSaving(true);
                            try {
                              // Get today's date in YYYY-MM-DD format for start date
                              const today = new Date().toISOString().split('T')[0];
                              
                              const result = await updateOJTUser(selected.id, {
                                company_name: companyName,
                                company_address: companyAddress,
                                company_email: companyEmail,
                                company_contact: companyContact,
                                contact_person: contactPerson,
                                position: position,
                                coordinator: coordinatorUsername, // Save coordinator for suggestions filtering
                                // Automatically set start date to today if not already set
                                ojt_start_date: selected.ojt_start_date || selected.date_started || today,
                                // End date is managed by send date functionality, don't update it here
                              });
                              if (result.success) {
                                // Update local state
                                // Get today's date for start date
                                const today = new Date().toISOString().split('T')[0];
                                const newStartDate = selected.ojt_start_date || selected.date_started || today;
                                // Update status to "Ongoing" if it was "NOT STARTED" and start date is now being set
                                const wasNotStarted = !selected.ojt_start_date && !selected.date_started;
                                const newStatus = (wasNotStarted && newStartDate) 
                                  ? 'Ongoing' 
                                  : (selected.ojt_status || 'Ongoing');
                                
                                setOjtData(prev => prev.map(item => 
                                  item.id === selected.id 
                                    ? { 
                                        ...item, 
                                        company: companyName,
                                        company_address: companyAddress,
                                        company_email: companyEmail,
                                        company_contact: companyContact,
                                        contact_person: contactPerson,
                                        position: position,
                                        ojt_start_date: newStartDate,
                                        date_started: newStartDate,
                                        ojt_status: newStatus,
                                        // End date remains unchanged (managed by send date)
                                      }
                                    : item
                                ));
                                setSelected({
                                  ...selected,
                                  company: companyName,
                                  company_address: companyAddress,
                                  company_email: companyEmail,
                                  company_contact: companyContact,
                                  contact_person: contactPerson,
                                  position: position,
                                  ojt_start_date: newStartDate,
                                  date_started: newStartDate,
                                  ojt_status: newStatus,
                                  // End date remains unchanged (managed by send date)
                                });
                                setIsEditingCompany(false);
                                toast.success('Company information updated successfully!');
                              } else {
                                toast.error(result.error || 'Failed to update company information');
                              }
                            } catch (error: any) {
                              console.error('Error updating company info:', error);
                              toast.error('Failed to update company information. Please try again.');
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            opacity: saving ? 0.6 : 1,
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.2s ease',
                            flex: 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!saving) {
                              e.currentTarget.style.backgroundColor = '#059669';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!saving) {
                              e.currentTarget.style.backgroundColor = '#10b981';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                            }
                          }}
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingCompany(false);
                            setEditFormData({});
                          }}
                          disabled={saving}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            opacity: saving ? 0.6 : 1,
                            boxShadow: '0 2px 4px rgba(107, 114, 128, 0.3)',
                            transition: 'all 0.2s ease',
                            flex: 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!saving) {
                              e.currentTarget.style.backgroundColor = '#4b5563';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!saving) {
                              e.currentTarget.style.backgroundColor = '#6b7280';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(107, 114, 128, 0.3)';
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.modalField}>
                        <div style={styles.modalLabel}>Company</div>
                        <div style={styles.modalValue}>{selected.company || 'Not specified'}</div>
                      </div>
                      <div style={styles.modalField}>
                        <div style={styles.modalLabel}>Address</div>
                        <div style={styles.modalValue}>{selected.company_address || 'Not specified'}</div>
                      </div>
                      <div style={styles.modalField}>
                        <div style={styles.modalLabel}>Email</div>
                        <div style={styles.modalValue}>{selected.company_email || 'Not specified'}</div>
                      </div>
                      <div style={styles.modalField}>
                        <div style={styles.modalLabel}>Contact</div>
                        <div style={styles.modalValue}>{selected.company_contact || 'Not specified'}</div>
                      </div>
                      <div style={styles.modalField}>
                        <div style={styles.modalLabel}>Contact Person</div>
                        <div style={styles.modalValue}>{selected.contact_person || 'Not specified'}</div>
                      </div>
                      <div style={styles.modalField}>
                        <div style={styles.modalLabel}>Position</div>
                        <div style={styles.modalValue}>{selected.position || 'Not specified'}</div>
                      </div>
                    </>
                  )}
                </div>

                {/* OJT Information Section */}
                <div style={styles.modalSection}>
                  <div style={styles.modalSectionTitle}>
                    OJT Info
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Start Date</div>
                    <div style={styles.modalValue}>{selected.ojt_start_date || selected.date_started || (selected.ctu_id === '1334003' ? '2023-01-20' : selected.ctu_id === '1334004' ? '2023-02-01' : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>End Date</div>
                    <div style={styles.modalValue}>
                      {selected.ojt_end_date || 
                       (selected.ojt_status === 'Completed' ? 
                         (selected.ctu_id === '1334003' ? '2023-05-15' : selected.ctu_id === '1334004' ? '2023-06-20' : '2023-05-15') : 
                         selected.ojt_status === 'Ongoing' ? 'Not specified (In progress)' : 
                         'Not specified')}
                    </div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Status</div>
                    <div style={{
                      ...styles.modalValue,
                      background: !selected.ojt_start_date ? '#f3f4f6' :
                                 (selected.ojt_status === 'Incomplete' || isOverdue(selected)) ? '#fee2e2' :
                                 isUserSentToAdmin(selected) ? '#fef3c7' :
                                 selected.ojt_status === 'Completed' ? '#d1fae5' : '#f3f4f6',
                      color: !selected.ojt_start_date ? '#6b7280' :
                             (selected.ojt_status === 'Incomplete' || isOverdue(selected)) ? '#dc2626' :
                             isUserSentToAdmin(selected) ? '#d97706' :
                             selected.ojt_status === 'Completed' ? '#065f46' : '#6b7280',
                      fontWeight: '600',
                      textAlign: 'center' as const,
                      justifyContent: 'center'
                    }}
                    title={(selected.ojt_status === 'Incomplete' || isOverdue(selected)) ? 'Student marked as Incomplete or overdue' :
                           isUserSentToAdmin(selected) ? 'Sent to admin, pending approval' :
                           !selected.ojt_start_date ? 'Status is locked until second import with company info' : ''}
                    >
                      {(selected.ojt_status === 'Incomplete' || isOverdue(selected)) ? 'INCOMPLETE' :
                       isUserSentToAdmin(selected) ? 'PENDING' :
                       !selected.ojt_start_date ? 'NOT STARTED' : 
                       (selected.ojt_status || 'Ongoing')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
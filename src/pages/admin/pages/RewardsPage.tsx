import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { getEngagementLeaderboard, getInventoryItems, giveReward, getRewardRequests, approveRewardRequest, claimRewardRequest, getRewardHistory, fetchTrackerResponses, getMilestoneTasksPoints, updateMilestoneTasksPoints, getEngagementPointsSettings, updateEngagementPointsSettings } from '../../../services/api';
import { trackerApi } from '../../../services/trackerApi';
import { HiOutlineHeart, HiOutlineChatBubbleLeft, HiOutlineArrowPath, HiOutlineArrowUturnLeft, HiOutlineCamera, HiOutlineDocumentText, HiOutlineClipboardDocumentList, HiOutlineGift, HiOutlineCheckCircle, HiOutlineUser, HiOutlineTag } from 'react-icons/hi2';
import { useRealTimeNotifications } from '../../../hooks/useRealTimeNotifications';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  profile_pic: string | null;
  user_type: string;
  year_graduated: number | null;
  program: string | null;
  total_points: number;
  points_breakdown: {
    likes: { points: number; count: number };
    comments: { points: number; count: number };
    shares: { points: number; count: number };
    replies: { points: number; count: number };
    posts: { points: number; count: number };
    posts_with_photos: { points: number; count: number };
    tracker_form?: { points: number; count: number };
  };
  last_updated: string;
}

interface InventoryItem {
  id: number;
  name: string;
  type: string;
  quantity: number;
  value: string;
  created_at: string;
  updated_at: string;
}

interface RewardRequest {
  request_id: number;
  user_id: number;
  user_name: string;
  profile_pic: string | null;
  reward_id: number;
  reward_name: string;
  reward_type: string;
  reward_value: string;
  status: string;
  points_cost: number;
  voucher_code: string | null;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  expires_at: string | null;
  notes: string | null;
}

interface RewardHistoryEntry {
  id: number;
  user_id: number;
  user_name: string;
  profile_pic: string | null;
  program: string | null;
  year_graduated: number | null;
  reward_name: string;
  reward_type: string;
  reward_value: string;
  points_deducted: number;
  given_by: string;
  given_at: string;
}

const RewardsPage: React.FC = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'alumni'>('alumni');  // Only Alumni now
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedReward, setSelectedReward] = useState<number | null>(null);
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RewardRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [showPointsSettingsModal, setShowPointsSettingsModal] = useState(false);
  const [pointsSettingsLoading, setPointsSettingsLoading] = useState(false);
  const [milestoneTasksEnabled, setMilestoneTasksEnabled] = useState(true);
  const [trackerFormEnabled, setTrackerFormEnabled] = useState(true);
  const [trackerFormPoints, setTrackerFormPoints] = useState(10);
  const [trackerFormAccepting, setTrackerFormAccepting] = useState(false);
  const [milestoneTasks, setMilestoneTasks] = useState<Array<{
    task_id: number;
    task_type: string;
    title: string;
    description: string;
    points: number;
    max_points: number | null;
    icon_name: string;
    is_active: boolean;
    order: number;
    required_count?: number | null;
  }>>([]);
  const [milestoneTasksLoading, setMilestoneTasksLoading] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [approving, setApproving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [tableFilter, setTableFilter] = useState<'requests' | 'history'>('requests');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'ready_for_pickup'>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [rewardTypeFilter, setRewardTypeFilter] = useState<'all' | string>('all');
  const [showRewardTypeDropdown, setShowRewardTypeDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackerFormResponsesCount, setTrackerFormResponsesCount] = useState(0);
  const [trackerFormLoading, setTrackerFormLoading] = useState(true);

  // Use real-time notifications hook to detect new reward requests
  const { notifications: realTimeNotifications } = useRealTimeNotifications({
    enablePolling: false, // We'll use our own polling for requests
    autoConnect: true
  });

  // Refresh reward requests when a new reward request notification is received
  useEffect(() => {
    if (realTimeNotifications && realTimeNotifications.length > 0) {
      const latestNotification = realTimeNotifications[0];
      // Check if this is a reward request notification (type comes from notif_type in backend)
      if (latestNotification?.type === 'Reward Request') {
        console.log('New reward request notification detected via WebSocket, refreshing requests...');
        fetchRewardRequests(true); // Silent refresh to avoid UI flicker
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realTimeNotifications]);

  useEffect(() => {
    fetchLeaderboardData();
    fetchRewardRequests();
    fetchRewardHistory();
    fetchInventoryCount();
    fetchTrackerFormResponsesCount();
    
    // Set up polling to refresh reward requests every 5 seconds for real-time updates
    const pollInterval = setInterval(() => {
      fetchRewardRequests(true); // Silent polling to avoid UI flicker
    }, 5000); // Poll every 5 seconds
    
    // Listen for notification events that indicate a new reward request
    const handleRewardRequestNotification = (event: CustomEvent) => {
      const notification = event.detail?.notification || event.detail;
      // Check if this is a reward request notification (type comes from notif_type in backend)
      if (notification?.type === 'Reward Request') {
        console.log('New reward request notification received, refreshing requests...');
        fetchRewardRequests(true); // Silent refresh to avoid UI flicker
      }
    };
    
    // Listen for custom events from notification system
    window.addEventListener('rewardRequestCreated', handleRewardRequestNotification as EventListener);
    window.addEventListener('notificationReceived', handleRewardRequestNotification as EventListener);
    
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('rewardRequestCreated', handleRewardRequestNotification as EventListener);
      window.removeEventListener('notificationReceived', handleRewardRequestNotification as EventListener);
    };
  }, [filter]);

  // Close dropdown when clicking outside - separate useEffect to avoid triggering data refresh
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showStatusDropdown && !target.closest('[data-status-dropdown]')) {
        setShowStatusDropdown(false);
      }
      if (showRewardTypeDropdown && !target.closest('[data-reward-type-dropdown]')) {
        setShowRewardTypeDropdown(false);
      }
    };

    if (showStatusDropdown || showRewardTypeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown, showRewardTypeDropdown]);

  const fetchMilestoneTasks = async () => {
    setMilestoneTasksLoading(true);
    try {
      const response = await getMilestoneTasksPoints();
      if (response.success) {
        if (response.tasks) {
          setMilestoneTasks(response.tasks);
        }
        if (response.milestone_tasks_enabled !== undefined) {
          setMilestoneTasksEnabled(response.milestone_tasks_enabled);
        }
      }
      
      // Also fetch tracker form settings
      const pointsSettings = await getEngagementPointsSettings();
      if (pointsSettings.success && pointsSettings.settings) {
        if (pointsSettings.settings.tracker_form_enabled !== undefined) {
          setTrackerFormEnabled(pointsSettings.settings.tracker_form_enabled);
        }
        if (pointsSettings.settings.tracker_form_points !== undefined) {
          setTrackerFormPoints(pointsSettings.settings.tracker_form_points);
        }
      }
      
      // Fetch tracker form accepting status
      try {
        const activeForm = await trackerApi.getActiveForm();
        if (activeForm && activeForm.tracker_form_id) {
          const acceptingStatus = await trackerApi.getAcceptingStatus(activeForm.tracker_form_id);
          setTrackerFormAccepting(acceptingStatus.accepting_responses || false);
        }
      } catch (error) {
        console.error('Error fetching tracker form accepting status:', error);
        setTrackerFormAccepting(false);
      }
    } catch (error) {
      console.error('Error fetching milestone tasks:', error);
    } finally {
      setMilestoneTasksLoading(false);
    }
  };

  const removeNumbersFromTitle = (title: string): string => {
    // Remove numbers and extra spaces from title
    // Examples: "Make 10 posts" -> "Make posts", "Comment on 5 posts" -> "Comment on posts"
    return title.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  };

  const handleSavePointsSettings = async () => {
    setPointsSettingsLoading(true);
    try {
      // Prepare tasks array if there are any
      const tasksToUpdate = milestoneTasks.length > 0 
        ? milestoneTasks.map(task => ({
            task_id: task.task_id,
            points: task.points,
            is_active: task.is_active,
            required_count: typeof task.required_count === 'number' ? task.required_count : undefined,
          }))
        : [];
      
      const milestoneResponse = await updateMilestoneTasksPoints(tasksToUpdate, milestoneTasksEnabled);
      if (!milestoneResponse.success) {
        alert(`❌ Failed to update milestone tasks: ${milestoneResponse.message || 'Unknown error'}`);
        return;
      }

      // Update tracker form settings - fetch current settings first to preserve other values
      const currentSettings = await getEngagementPointsSettings();
      if (currentSettings.success && currentSettings.settings) {
        const trackerFormResponse = await updateEngagementPointsSettings({
          enabled: currentSettings.settings.enabled ?? true,
          like: currentSettings.settings.like_points ?? 0,
          comment: currentSettings.settings.comment_points ?? 0,
          share: currentSettings.settings.share_points ?? 0,
          reply: currentSettings.settings.reply_points ?? 0,
          post: currentSettings.settings.post_points ?? 0,
          post_with_photo: currentSettings.settings.post_with_photo_points ?? 0,
          tracker_form: trackerFormPoints,
          tracker_form_enabled: trackerFormEnabled,
        });
        
        if (!trackerFormResponse.success) {
          const errorMessage = trackerFormResponse.message || 'Unknown error';
          alert(`❌ Failed to update tracker form settings: ${errorMessage}`);
          // If the error is about accepting responses, refresh the accepting status
          if (errorMessage.includes('accepting responses')) {
            try {
              const activeForm = await trackerApi.getActiveForm();
              if (activeForm && activeForm.tracker_form_id) {
                const acceptingStatus = await trackerApi.getAcceptingStatus(activeForm.tracker_form_id);
                setTrackerFormAccepting(acceptingStatus.accepting_responses || false);
              }
            } catch (error) {
              console.error('Error refreshing tracker form status:', error);
            }
          }
          return;
        }
      } else {
        alert(`❌ Failed to fetch current settings`);
        return;
      }

      alert('✅ Settings updated successfully!');
      setShowPointsSettingsModal(false);
    } catch (error: any) {
      console.error('Error updating settings:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update settings';
      alert(`❌ Error: ${errorMessage}`);
      // If the error is about accepting responses, refresh the accepting status
      if (errorMessage.includes('accepting responses')) {
        try {
          const activeForm = await trackerApi.getActiveForm();
          if (activeForm && activeForm.tracker_form_id) {
            const acceptingStatus = await trackerApi.getAcceptingStatus(activeForm.tracker_form_id);
            setTrackerFormAccepting(acceptingStatus.accepting_responses || false);
          }
        } catch (refreshError) {
          console.error('Error refreshing tracker form status:', refreshError);
        }
      }
    } finally {
      setPointsSettingsLoading(false);
    }
  };

  const fetchRewardRequests = async (silent: boolean = false) => {
    if (!silent) {
      setRequestsLoading(true);
    }
    try {
      const response = await getRewardRequests(); // Fetch all requests without status filter
      if (response && response.success) {
        const requests = response.requests || [];
        setRewardRequests(requests);
        
        // Count pending requests and update localStorage for sidebar badge
        const pendingCount = requests.filter((req: RewardRequest) => req.status === 'pending').length;
        try {
          localStorage.setItem('rewardReqCount', String(pendingCount));
          // Dispatch custom event to notify sidebar in same tab
          window.dispatchEvent(new CustomEvent('rewardRequestCountUpdated'));
        } catch (e) {
          console.error('Error updating reward request count:', e);
        }
      } else {
        setRewardRequests([]);
        try {
          localStorage.setItem('rewardReqCount', '0');
          window.dispatchEvent(new CustomEvent('rewardRequestCountUpdated'));
        } catch (e) {
          console.error('Error updating reward request count:', e);
        }
      }
    } catch (error: any) {
      console.error('Error fetching reward requests:', error);
      setRewardRequests([]);
      try {
        localStorage.setItem('rewardReqCount', '0');
        window.dispatchEvent(new CustomEvent('rewardRequestCountUpdated'));
      } catch (e) {
        console.error('Error updating reward request count:', e);
      }
    } finally {
      if (!silent) {
        setRequestsLoading(false);
      }
    }
  };

  const fetchRewardHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await getRewardHistory(100);
      setRewardHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching reward history:', error);
      setRewardHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchInventoryCount = async () => {
    try {
      const response = await getInventoryItems();
      if (response.success) {
        setInventoryCount(response.items?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching inventory count:', error);
    }
  };

  const fetchTrackerFormResponsesCount = async () => {
    setTrackerFormLoading(true);
    try {
      const response = await fetchTrackerResponses();
      if (response && response.success && response.responses) {
        setTrackerFormResponsesCount(response.responses.length);
      } else {
        setTrackerFormResponsesCount(0);
      }
    } catch (error) {
      console.error('Error fetching tracker form responses:', error);
      setTrackerFormResponsesCount(0);
    } finally {
      setTrackerFormLoading(false);
    }
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest || approving) return;

    try {
      setApproving(true);
      const response = await approveRewardRequest(
        selectedRequest.request_id,
        voucherCode || undefined,
        instructions || undefined,
        instructions || undefined
      );
      
      if (response.success) {
        alert('Reward request approved successfully! User will receive a notification with instructions.');
        const requestId = selectedRequest.request_id;
        const status = response.status || 'approved';
        try {
          localStorage.setItem(
            'latestRewardRequestUpdate',
            JSON.stringify({
              requestId,
              status,
              timestamp: Date.now()
            })
          );
        } catch (e) {
          console.error('Error writing reward request update to localStorage:', e);
        }
        window.dispatchEvent(
          new CustomEvent('rewardRequestUpdated', {
            detail: { requestId, status }
          })
        );
        setShowApproveModal(false);
        setSelectedRequest(null);
        setInstructions('');
        setVoucherCode('');
        await fetchRewardRequests();
        await fetchRewardHistory();
      } else {
        alert(response.message || 'Failed to approve reward request');
      }
    } catch (error: any) {
      console.error('Error approving reward request:', error);
      alert(error.response?.data?.message || 'Failed to approve reward request');
    } finally {
      setApproving(false);
    }
  };

  const handleReleaseMerchandise = async (requestId: number) => {
    if (releasing) return;
    
    const request = rewardRequests.find(req => req.request_id === requestId);
    if (!request) return;

    const confirm = window.confirm(`Release "${request.reward_name}" to ${request.user_name}?\n\nPoints will be deducted and inventory will be updated.`);
    if (!confirm) return;

    try {
      setReleasing(true);
      // For merchandise, admin calls claim endpoint to release it
      const response = await claimRewardRequest(requestId);
      
      if (response.success) {
        alert('Merchandise released successfully! Points have been deducted and user has been notified.');
        const status = response.request?.status || 'claimed';
        try {
          localStorage.setItem(
            'latestRewardRequestUpdate',
            JSON.stringify({
              requestId,
              status,
              timestamp: Date.now()
            })
          );
        } catch (e) {
          console.error('Error writing reward request update to localStorage:', e);
        }
        window.dispatchEvent(
          new CustomEvent('rewardRequestUpdated', {
            detail: { requestId, status }
          })
        );
        await fetchRewardRequests();
        await fetchRewardHistory();
      } else {
        alert(response.message || 'Failed to release merchandise');
      }
    } catch (error: any) {
      console.error('Error releasing merchandise:', error);
      alert(error.response?.data?.message || 'Failed to release merchandise');
    } finally {
      setReleasing(false);
    }
  };

  const fetchLeaderboardData = async () => {
    setLoading(true);
    try {
      const data = await getEngagementLeaderboard(50, filter);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGiveRewardClick = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await getInventoryItems();
      if (response.success) {
        // Filter items that have stock available AND user can afford
        const availableItems = response.items.filter((item: InventoryItem) => {
          if (item.quantity <= 0) return false;
          
          // Extract numeric value from value string (e.g., "100pts" -> 100)
          const pointsMatch = item.value.match(/(\d+)/);
          if (pointsMatch) {
            const requiredPoints = parseInt(pointsMatch[1]);
            return selectedUser.total_points >= requiredPoints;
          }
          
          // If we can't parse points, include the item
          return true;
        });
        
        setInventoryItems(availableItems);
        setShowRewardModal(true);
      } else {
        alert('Failed to load inventory items');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      alert('Failed to load inventory items');
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await getInventoryItems();
      if (response.success) {
        setInventoryItems(response.items || []);
      } else {
        setInventoryItems([]);
      }
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      setInventoryItems([]);
    }
  };

  const handleGiveReward = async () => {
    if (!selectedReward || !selectedUser) return;

    const reward = inventoryItems.find(item => item.id === selectedReward);
    if (!reward) return;

    try {
      const response = await giveReward(selectedUser.user_id, reward.id);
      
      if (response.success) {
        const pointsDeducted = response.points_deducted || 0;
        const remainingPoints = response.user_remaining_points || 0;
        
        alert(
          `✅ ${reward.name} has been given to ${selectedUser.name}!\n\n` +
          `💰 Points Deducted: ${pointsDeducted}\n` +
          `💎 Remaining Points: ${remainingPoints}\n\n` +
          `📢 ${selectedUser.name} will receive a notification.`
        );
        
        // Close modals
        setShowRewardModal(false);
        setSelectedReward(null);
        setSelectedUser(null);
        
        // Refresh leaderboard and history
        fetchLeaderboardData();
        fetchRewardHistory();
      } else {
        alert(`❌ Failed to give reward: ${response.message}`);
      }
    } catch (error: any) {
      console.error('Error giving reward:', error);
      alert(`❌ Error: ${error.response?.data?.message || 'Failed to give reward'}`);
    }
  };

  // Sample data - in a real app, this would come from an API
  const rewardProgress = { current: 1, total: 10 };

  const rewardList = [
    { id: 1, recipient: 'John Doe', type: 'Gift Card', status: 'Email Use Available', initials: 'GC' },
    { id: 2, recipient: 'Bob Smith', type: 'Bonus Points', status: 'Free Lunch', initials: 'BP' },
    { id: 3, recipient: 'Alice Johnson', type: 'Free Lunch', status: 'Email Pending', initials: 'FL' },
    { id: 4, recipient: 'Mike Wilson', type: 'Certificate', status: 'Unanitza Logistics', initials: 'JJ' },
    { id: 5, recipient: 'Sarah Brown', type: 'Gift Card', status: 'Email Mfmt Cordova', initials: 'MA' },
    { id: 6, recipient: 'Tom Davis', type: 'Bonus Points', status: 'Email Small', initials: 'KB' },
    { id: 7, recipient: 'George Litz', type: 'Gift Card', status: 'Email Use Available', initials: 'GL' }
  ];

  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f0f4f8'
    },
    mainContent: {
      flex: 1,
      padding: '0',
      marginLeft: 'var(--sidebar-width, 220px)',
      transition: 'margin-left 0.3s ease',
      backgroundColor: '#f0f4f8'
    },
    pageHeader: {
      backgroundColor: '#ffffff',
      padding: '32px 40px',
      marginBottom: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '20px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      borderBottom: '1px solid #e5e7eb'
    },
    headerTitle: {
      fontSize: '32px',
      fontWeight: 'bold',
      margin: 0,
      color: '#1e3a5f',
      letterSpacing: '1px',
      textTransform: 'uppercase' as const,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    headerSubtitle: {
      fontSize: '14px',
      color: '#6b7280',
      marginTop: '8px',
      fontWeight: '400'
    },
    contentWrapper: {
      padding: '0 40px 40px 40px'
    },
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: '32px'
    },
    leftPanel: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '24px'
    },
    historyCard: {
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      transition: 'all 0.2s'
    },
    historyTitle: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#1e3a5f',
      margin: '0 0 6px 0',
      letterSpacing: '0.5px'
    },
    historySubtitle: {
      fontSize: '13px',
      color: '#6b7280',
      margin: '0 0 16px 0',
      fontWeight: '400'
    },
    historyList: {
      maxHeight: '500px',
      overflowY: 'auto' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px'
    },
    historyItem: {
      padding: '12px',
      backgroundColor: '#fafbfc',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
      transition: 'all 0.2s'
    },
    inventoryCard: {
      backgroundColor: '#1e3a5f',
      padding: '32px 28px',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      flex: 1,
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'center' as const,
      border: '2px solid transparent',
      position: 'relative' as const
    },
    inventoryTitle: {
      fontSize: '20px',
      fontWeight: '700',
      color: 'white',
      margin: '0 0 8px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      letterSpacing: '0.5px'
    },
    inventorySubtitle: {
      fontSize: '14px',
      color: 'rgba(255, 255, 255, 0.9)',
      margin: 0,
      fontWeight: '400'
    },
    inventoryTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '13px'
    },
    tableHeader: {
      backgroundColor: '#f9fafb',
      borderBottom: '2px solid #e5e7eb'
    },
    tableHeaderCell: {
      padding: '12px 8px',
      textAlign: 'left' as const,
      fontSize: '12px',
      fontWeight: '600',
      color: '#6b7280',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px'
    },
    tableRow: {
      borderBottom: '1px solid #f3f4f6',
      transition: 'background-color 0.2s'
    },
    tableCell: {
      padding: '12px 8px',
      color: '#374151'
    },
    itemIcon: {
      fontSize: '20px',
      display: 'inline-block',
      marginRight: '8px'
    },
    itemName: {
      fontWeight: '500',
      color: '#1f2937'
    },
    quantityBadge: {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: '#dbeafe',
      color: '#1e40af'
    },
    lowStockBadge: {
      backgroundColor: '#fee2e2',
      color: '#991b1b'
    },
    rightPanel: {
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    },
    rightPanelTitle: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#1e3a5f',
      margin: '0 0 8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      letterSpacing: '0.5px'
    },
    rightPanelSubtitle: {
      fontSize: '14px',
      color: '#6b7280',
      margin: '0 0 28px 0',
      fontWeight: '400'
    },
    rewardList: {
      maxHeight: 'calc(100vh - 200px)',
      overflowY: 'auto' as const
    },
    rewardItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 0',
      borderBottom: '1px solid #f3f4f6'
    },
    rewardType: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      margin: '0 0 4px 0'
    },
    rewardStatus: {
      fontSize: '12px',
      color: '#6b7280',
      margin: 0
    }
  };

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainContent}>
        {/* Page Header */}
        <div style={styles.pageHeader}>
          <div style={{ flex: 1 }}>
            <h1 style={styles.headerTitle}>
              REWARDS DASHBOARD
            </h1>
            <p style={styles.headerSubtitle}>Manage alumni engagement rewards and leaderboard</p>
          </div>
        </div>

        {/* Header Cards Section */}
        <div style={{ padding: '0 40px 24px 40px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px'
          }}>
            {/* Inventory Card */}
            <div 
              style={styles.inventoryCard}
              onClick={() => navigate('/inventory')}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 58, 95, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.backgroundColor = '#153e75';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.backgroundColor = '#1e3a5f';
              }}
            >
              <div style={styles.inventoryTitle}>INVENTORY</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white' }}>{inventoryCount}</div>
              <div style={styles.inventorySubtitle}>Items Available</div>
            </div>

            {/* Points Settings Card */}
            <div 
              style={styles.inventoryCard}
              onClick={() => {
                fetchMilestoneTasks();
                setShowPointsSettingsModal(true);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 58, 95, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.backgroundColor = '#153e75';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.backgroundColor = '#1e3a5f';
              }}
            >
              <div style={styles.inventoryTitle}>MILESTONE TASKS</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white' }}>
                ⚙️
              </div>
              <div style={styles.inventorySubtitle}>
                Configure Points
              </div>
            </div>

            {/* Tracker Form Responses Card */}
            <div 
              style={styles.inventoryCard}
              onClick={() => {
                navigate('/tracker-responses');
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 58, 95, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.backgroundColor = '#153e75';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.backgroundColor = '#1e3a5f';
              }}
            >
              <div style={styles.inventoryTitle}>TRACKER RESPONDENTS</div>
              {trackerFormLoading ? (
                <div style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.9)' }}>⏳</div>
              ) : trackerFormResponsesCount > 0 ? (
                <>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white' }}>
                    {trackerFormResponsesCount}
                  </div>
                  <div style={styles.inventorySubtitle}>users answered</div>
                </>
              ) : (
                <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>No responses</div>
              )}
            </div>
          </div>
                    </div>

        {/* Content Wrapper - Unified Table */}
        <div style={styles.contentWrapper}>
                      <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Header with Filter Tabs */}
            <div style={{
              padding: '20px',
              borderBottom: '2px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1e3a5f',
                    margin: 0
                  }}>
                    {tableFilter === 'requests' ? 'REWARD REQUESTS' : 'REWARD HISTORY'}
                  </h2>
                  <p style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    margin: '4px 0 0 0'
                  }}>
                    {tableFilter === 'requests' 
                      ? (() => {
                          // Filter out claimed requests for the count
                          const nonClaimedRequests = rewardRequests.filter(req => req.status !== 'claimed');
                          const filteredCount = requestStatusFilter === 'all' 
                            ? nonClaimedRequests.length 
                            : nonClaimedRequests.filter(req => 
                                requestStatusFilter === 'pending' ? req.status === 'pending' :
                                requestStatusFilter === 'approved' ? req.status === 'approved' :
                                requestStatusFilter === 'ready_for_pickup' ? req.status === 'ready_for_pickup' : true
                              ).length;
                          return `${filteredCount} ${requestStatusFilter === 'all' ? 'total' : requestStatusFilter === 'pending' ? 'pending' : requestStatusFilter === 'approved' ? 'approved' : 'ready for pickup'} requests`;
                        })()
                      : (() => {
                          const filteredHistory = rewardHistory.filter((entry) => {
                            if (rewardTypeFilter === 'all') return true;
                            return entry.reward_type === rewardTypeFilter;
                          });
                          return `${filteredHistory.length} ${rewardTypeFilter === 'all' ? 'rewards distributed' : `${rewardTypeFilter.toLowerCase()} rewards`}`;
                        })()}
                  </p>
                </div>
                
                {/* Filter Tabs */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  backgroundColor: '#f3f4f6',
                  padding: '4px',
                  borderRadius: '8px'
                }}>
                  <button
                    onClick={() => {
                      setTableFilter('requests');
                      setShowStatusDropdown(false);
                      setRewardTypeFilter('all');
                      setShowRewardTypeDropdown(false);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backgroundColor: tableFilter === 'requests' ? 'white' : 'transparent',
                      color: tableFilter === 'requests' ? '#1e3a5f' : '#6b7280',
                      boxShadow: tableFilter === 'requests' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Requests
                  </button>
                  <button
                    onClick={() => {
                      setTableFilter('history');
                      setShowStatusDropdown(false);
                      setRewardTypeFilter('all');
                      setShowRewardTypeDropdown(false);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backgroundColor: tableFilter === 'history' ? 'white' : 'transparent',
                      color: tableFilter === 'history' ? '#1e3a5f' : '#6b7280',
                      boxShadow: tableFilter === 'history' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    History
                  </button>
                </div>
              </div>
              
              {/* Status Filter Dropdown - Only show when requests tab is active */}
              {tableFilter === 'requests' && (
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  position: 'relative',
                  flexWrap: 'wrap'
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginRight: '4px'
                  }}>
                    Filter by status:
                  </span>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      role="button"
                      aria-expanded={showStatusDropdown}
                      aria-haspopup="true"
                      data-status-dropdown
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowStatusDropdown(!showStatusDropdown);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        backgroundColor: 'white',
                        color: '#1e3a5f',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        minWidth: '160px',
                        justifyContent: 'space-between',
                        transition: 'box-shadow 0.2s ease-out, border-color 0.2s ease-out',
                        boxShadow: showStatusDropdown ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        if (!showStatusDropdown) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                        }
                      }}
                    >
                      <span>
                        {requestStatusFilter === 'all' ? 'All' : 
                         requestStatusFilter === 'pending' ? 'Pending' : 
                         requestStatusFilter === 'approved' ? 'Approved' :
                         'Ready for Pickup'}
                      </span>
                      <span style={{ 
                        fontSize: '10px',
                        transform: showStatusDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}>▼</span>
                    </button>
                    {showStatusDropdown && (
                      <div 
                        data-status-dropdown
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          border: '1px solid #e5e7eb',
                          zIndex: 100,
                          marginTop: '4px',
                          overflow: 'hidden',
                          animation: 'fadeInDropdown 0.2s ease-out',
                          transformOrigin: 'top center'
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <style>{`
                          @keyframes fadeInDropdown {
                            from {
                              opacity: 0;
                              transform: translateY(-8px) scale(0.95);
                            }
                            to {
                              opacity: 1;
                              transform: translateY(0) scale(1);
                            }
                          }
                        `}</style>
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Close dropdown first, then update filter after a brief delay for smooth transition
                            setShowStatusDropdown(false);
                            setTimeout(() => {
                              setRequestStatusFilter('all');
                              setSearchTerm('');
                            }, 150);
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            backgroundColor: requestStatusFilter === 'all' ? '#f3f4f6' : 'white',
                            color: requestStatusFilter === 'all' ? '#1e3a5f' : '#374151',
                            fontSize: '13px',
                            fontWeight: requestStatusFilter === 'all' ? '600' : '400',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (requestStatusFilter !== 'all') {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (requestStatusFilter !== 'all') {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          All
                        </div>
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Close dropdown first, then update filter after a brief delay for smooth transition
                            setShowStatusDropdown(false);
                            setTimeout(() => {
                              setRequestStatusFilter('pending');
                              setSearchTerm('');
                            }, 150);
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            backgroundColor: requestStatusFilter === 'pending' ? '#f3f4f6' : 'white',
                            color: requestStatusFilter === 'pending' ? '#1e3a5f' : '#374151',
                            fontSize: '13px',
                            fontWeight: requestStatusFilter === 'pending' ? '600' : '400',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (requestStatusFilter !== 'pending') {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (requestStatusFilter !== 'pending') {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          Pending
                        </div>
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Close dropdown first, then update filter after a brief delay for smooth transition
                            setShowStatusDropdown(false);
                            setTimeout(() => {
                              setRequestStatusFilter('approved');
                              setSearchTerm('');
                            }, 150);
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            backgroundColor: requestStatusFilter === 'approved' ? '#f3f4f6' : 'white',
                            color: requestStatusFilter === 'approved' ? '#1e3a5f' : '#374151',
                            fontSize: '13px',
                            fontWeight: requestStatusFilter === 'approved' ? '600' : '400',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (requestStatusFilter !== 'approved') {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (requestStatusFilter !== 'approved') {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          Approved
                        </div>
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Close dropdown first, then update filter after a brief delay for smooth transition
                            setShowStatusDropdown(false);
                            setTimeout(() => {
                              setRequestStatusFilter('ready_for_pickup');
                            }, 150);
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            backgroundColor: requestStatusFilter === 'ready_for_pickup' ? '#f3f4f6' : 'white',
                            color: requestStatusFilter === 'ready_for_pickup' ? '#1e3a5f' : '#374151',
                            fontSize: '13px',
                            fontWeight: requestStatusFilter === 'ready_for_pickup' ? '600' : '400',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (requestStatusFilter !== 'ready_for_pickup') {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (requestStatusFilter !== 'ready_for_pickup') {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          Ready for Pickup
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Search Bar - Only show when ready_for_pickup filter is active */}
                  {requestStatusFilter === 'ready_for_pickup' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      position: 'relative',
                      flex: '1',
                      minWidth: '250px'
                    }}>
                      <input
                        type="text"
                        placeholder="Search by user name or reward..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          padding: '8px 16px 8px 40px',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          fontSize: '13px',
                          width: '100%',
                          backgroundColor: 'white',
                          color: '#374151',
                          transition: 'border-color 0.2s',
                          outline: 'none'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#3b82f6';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                      />
                      <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '16px',
                        color: '#9ca3af'
                      }}>
                        🔍
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Reward Type Filter Dropdown - Only show when history tab is active */}
              {tableFilter === 'history' && (
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  position: 'relative',
                  flexWrap: 'wrap'
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginRight: '4px'
                  }}>
                    Filter by type:
                  </span>
                  <div style={{ position: 'relative' }} data-reward-type-dropdown>
                    <button
                      type="button"
                      role="button"
                      aria-expanded={showRewardTypeDropdown}
                      aria-haspopup="true"
                      data-reward-type-dropdown
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowRewardTypeDropdown(!showRewardTypeDropdown);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        backgroundColor: 'white',
                        color: '#1e3a5f',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        minWidth: '180px',
                        justifyContent: 'space-between',
                        transition: 'box-shadow 0.2s ease-out, border-color 0.2s ease-out',
                        boxShadow: showRewardTypeDropdown ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        if (!showRewardTypeDropdown) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                        }
                      }}
                    >
                      <span>
                        {rewardTypeFilter === 'all' ? 'All' : rewardTypeFilter}
                      </span>
                      <span style={{ 
                        fontSize: '10px',
                        transform: showRewardTypeDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}>▼</span>
                    </button>
                    {showRewardTypeDropdown && (
                      <div 
                        data-reward-type-dropdown
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          border: '1px solid #e5e7eb',
                          zIndex: 100,
                          marginTop: '4px',
                          overflow: 'hidden',
                          animation: 'fadeInDropdown 0.2s ease-out',
                          transformOrigin: 'top center',
                          maxHeight: '300px',
                          overflowY: 'auto'
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <style>{`
                          @keyframes fadeInDropdown {
                            from {
                              opacity: 0;
                              transform: translateY(-8px) scale(0.95);
                            }
                            to {
                              opacity: 1;
                              transform: translateY(0) scale(1);
                            }
                          }
                        `}</style>
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowRewardTypeDropdown(false);
                            setTimeout(() => {
                              setRewardTypeFilter('all');
                            }, 150);
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            backgroundColor: rewardTypeFilter === 'all' ? '#f3f4f6' : 'white',
                            color: rewardTypeFilter === 'all' ? '#1e3a5f' : '#374151',
                            fontSize: '13px',
                            fontWeight: rewardTypeFilter === 'all' ? '600' : '400',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (rewardTypeFilter !== 'all') {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (rewardTypeFilter !== 'all') {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          All
                        </div>
                        {(() => {
                          // Get unique reward types from history
                          const uniqueTypes = Array.from(new Set(rewardHistory.map(entry => entry.reward_type))).sort();
                          return uniqueTypes.map((type) => (
                            <div
                              key={type}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowRewardTypeDropdown(false);
                                setTimeout(() => {
                                  setRewardTypeFilter(type);
                                }, 150);
                              }}
                              style={{
                                padding: '10px 16px',
                                cursor: 'pointer',
                                backgroundColor: rewardTypeFilter === type ? '#f3f4f6' : 'white',
                                color: rewardTypeFilter === type ? '#1e3a5f' : '#374151',
                                fontSize: '13px',
                                fontWeight: rewardTypeFilter === type ? '600' : '400',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                if (rewardTypeFilter !== type) {
                                  e.currentTarget.style.backgroundColor = '#f9fafb';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (rewardTypeFilter !== type) {
                                  e.currentTarget.style.backgroundColor = 'white';
                                }
                              }}
                            >
                              {type}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
                  
            {/* Unified Table Content */}
            <div style={{ 
              maxHeight: '600px', 
              overflowY: 'auto',
              transition: 'opacity 0.3s ease-in-out'
            }}>
              {tableFilter === 'requests' ? (
                <>
                  {requestsLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                      <div>Loading requests...</div>
                    </div>
                  ) : (() => {
                    // Use a key to force smooth re-render
                    const contentKey = `${requestStatusFilter}-${searchTerm}`;
                    // First filter out claimed requests (they should only appear in history)
                    let filteredRequests = rewardRequests.filter(req => req.status !== 'claimed');
                    
                    // Then filter by status
                    if (requestStatusFilter !== 'all') {
                      filteredRequests = filteredRequests.filter(req => {
                        if (requestStatusFilter === 'pending') return req.status === 'pending';
                        if (requestStatusFilter === 'approved') return req.status === 'approved';
                        if (requestStatusFilter === 'ready_for_pickup') return req.status === 'ready_for_pickup';
                        return true;
                      });
                    }
                    
                    // Then filter by search term if status is ready_for_pickup and search term exists
                    if (requestStatusFilter === 'ready_for_pickup' && searchTerm.trim()) {
                      const searchLower = searchTerm.toLowerCase().trim();
                      filteredRequests = filteredRequests.filter(req => {
                        const userName = req.user_name?.toLowerCase() || '';
                        const rewardName = req.reward_name?.toLowerCase() || '';
                        return userName.includes(searchLower) || 
                               rewardName.includes(searchLower);
                      });
                    }
                    
                    if (filteredRequests.length === 0) {
                      return (
                        <div 
                          key={`empty-${contentKey}`}
                          style={{ 
                            textAlign: 'center', 
                            padding: '40px', 
                            color: '#6b7280',
                            animation: 'fadeIn 0.3s ease-in-out'
                          }}
                        >
                          <style>{`
                            @keyframes fadeIn {
                              from {
                                opacity: 0;
                                transform: translateY(4px);
                              }
                              to {
                                opacity: 1;
                                transform: translateY(0);
                              }
                            }
                          `}</style>
                          <div style={{ fontSize: '48px', marginBottom: '8px' }}>📋</div>
                          <div>
                            {requestStatusFilter === 'ready_for_pickup' && searchTerm.trim() 
                              ? `No results found for "${searchTerm}"`
                              : `No ${requestStatusFilter === 'all' ? '' : requestStatusFilter === 'pending' ? 'pending' : requestStatusFilter === 'approved' ? 'approved' : 'ready for pickup'} requests yet`}
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={contentKey}
                        style={{
                          animation: 'fadeIn 0.3s ease-in-out',
                          opacity: 1
                        }}
                      >
                        <style>{`
                          @keyframes fadeIn {
                            from {
                              opacity: 0;
                              transform: translateY(4px);
                            }
                            to {
                              opacity: 1;
                              transform: translateY(0);
                            }
                          }
                        `}</style>
                        <div style={{
                          maxHeight: '650px',
                          overflowY: 'auto',
                          overflowX: 'auto',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}>
                        <table style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          transition: 'opacity 0.3s ease-in-out'
                        }}>
                        <thead style={{
                          backgroundColor: '#f9fafb',
                          position: 'sticky',
                          top: 0,
                          zIndex: 10
                        }}>
                          <tr>
                            <th style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              borderBottom: '2px solid #e5e7eb'
                            }}>User</th>
                            <th style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              borderBottom: '2px solid #e5e7eb'
                            }}>Reward</th>
                            <th style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              borderBottom: '2px solid #e5e7eb'
                            }}>Status</th>
                            <th style={{
                              padding: '12px 16px',
                              textAlign: 'right',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              borderBottom: '2px solid #e5e7eb'
                            }}>Points</th>
                            <th style={{
                              padding: '12px 16px',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              borderBottom: '2px solid #e5e7eb'
                            }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRequests.map((req) => {
                          const statusColors: { [key: string]: string } = {
                            'pending': '#f59e0b',
                            'approved': '#10b981',
                            'ready_for_pickup': '#3b82f6',
                            'claimed': '#6366f1',
                            'rejected': '#ef4444'
                          };
                          const statusBg: { [key: string]: string } = {
                            'pending': '#fef3c7',
                            'approved': '#d1fae5',
                            'ready_for_pickup': '#dbeafe',
                            'claimed': '#e0e7ff',
                            'rejected': '#fee2e2'
                          };
                          
                          return (
                            <tr key={req.request_id} style={{
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {req.profile_pic ? (
                                    <img 
                                      src={String(req.profile_pic).startsWith('http') ? req.profile_pic : `http://127.0.0.1:8000${req.profile_pic}`}
                                      alt={req.user_name}
                                      style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        objectFit: 'cover'
                                      }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontSize: '14px',
                                      fontWeight: 'bold'
                                    }}>
                                      {req.user_name.charAt(0)}
                                    </div>
                                  )}
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                                      {req.user_name}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                                  {req.reward_name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {req.reward_type}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: statusBg[req.status] || '#f3f4f6',
                                  color: statusColors[req.status] || '#6b7280',
                                  textTransform: 'capitalize',
                                  display: 'inline-block'
                                }}>
                                  {req.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
                                {req.points_cost}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                {req.status === 'pending' && (
                                  <button
                                    onClick={() => {
                                      setSelectedRequest(req);
                                      setInstructions('');
                                      setVoucherCode('');
                                      setShowApproveModal(true);
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Review
                                  </button>
                                )}
                                {req.status === 'ready_for_pickup' && (
                                  <button
                                    onClick={() => handleReleaseMerchandise(req.request_id)}
                                    disabled={releasing}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: releasing ? 'not-allowed' : 'pointer',
                                      opacity: releasing ? 0.6 : 1
                                    }}
                                  >
                                    Release
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                        </table>
                      </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                      <div>Loading history...</div>
                    </div>
                  ) : rewardHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>📜</div>
                      <div>No rewards given yet</div>
                    </div>
                  ) : (
                    <div style={{
                      maxHeight: '650px',
                      overflowY: 'auto',
                      overflowX: 'auto',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse'
                    }}>
                      <thead style={{
                        backgroundColor: '#f9fafb',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                      }}>
                        <tr>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            borderBottom: '2px solid #e5e7eb'
                          }}>User</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            borderBottom: '2px solid #e5e7eb'
                          }}>Reward</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            borderBottom: '2px solid #e5e7eb'
                          }}>Given By</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            borderBottom: '2px solid #e5e7eb'
                          }}>Points</th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            borderBottom: '2px solid #e5e7eb'
                          }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rewardHistory
                          .filter((entry) => {
                            if (rewardTypeFilter === 'all') return true;
                            return entry.reward_type === rewardTypeFilter;
                          })
                          .map((entry) => (
                          <tr key={entry.id} style={{
                            borderBottom: '1px solid #f3f4f6',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {entry.profile_pic ? (
                                  <img 
                                    src={String(entry.profile_pic).startsWith('http') ? entry.profile_pic : `http://127.0.0.1:8000${entry.profile_pic}`}
                                    alt={entry.user_name}
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      objectFit: 'cover'
                                    }}
                                  />
                                ) : (
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                  }}>
                                    {entry.user_name.charAt(0)}
                      </div>
                                )}
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                                    {entry.user_name}
                    </div>
                                  {(entry.program || entry.year_graduated) && (
                                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                      {entry.program || ''} {entry.year_graduated ? `• ${entry.year_graduated}` : ''}
                  </div>
              )}
            </div>
          </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                                {entry.reward_name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                {entry.reward_type}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                              {entry.given_by}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
                              {entry.points_deducted}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                              {new Date(entry.given_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Give Reward Modal */}
        {showRewardModal && selectedUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1004,
          }}
          onClick={() => setShowRewardModal(false)}
          >
            <div style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              width: '600px',
              maxWidth: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h2 style={{ 
                  margin: 0, 
                  color: '#1e3a5f', 
                  fontSize: '20px', 
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  Select Reward for {selectedUser.name}
                </h2>
                <button
                  onClick={() => {
                    setShowRewardModal(false);
                    setSelectedReward(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    color: '#6b7280',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    lineHeight: '1',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#1f2937'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                >
                  ×
                </button>
              </div>

              <div style={{
                backgroundColor: '#f8fafc',
                padding: '16px 20px',
                borderRadius: '8px',
                marginBottom: '24px',
                border: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
                    Available Points
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>
                    {selectedUser.total_points}
                  </div>
                </div>
              </div>

              {inventoryItems.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>😔</div>
                  <div style={{ fontSize: '16px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
                    No rewards available
                  </div>
                  <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                    User doesn't have enough points or no items in stock
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                    Select a reward:
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {inventoryItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedReward(item.id)}
                        style={{
                          padding: '16px',
                          border: selectedReward === item.id ? '2px solid #1e3a5f' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          marginBottom: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: selectedReward === item.id ? '#f0f4f8' : 'white',
                          boxShadow: selectedReward === item.id ? '0 2px 4px rgba(30, 58, 95, 0.1)' : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedReward !== item.id) {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedReward !== item.id) {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.backgroundColor = 'white';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                              {item.type} • Stock: {item.quantity}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#1e3a5f',
                            marginLeft: '16px'
                          }}>
                            {item.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowRewardModal(false);
                    setSelectedReward(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGiveReward}
                  disabled={!selectedReward || inventoryItems.length === 0}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: selectedReward && inventoryItems.length > 0 
                      ? '#1e3a5f' 
                      : '#e5e7eb',
                    color: selectedReward && inventoryItems.length > 0 ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: selectedReward && inventoryItems.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedReward && inventoryItems.length > 0) {
                      e.currentTarget.style.backgroundColor = '#153e75';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedReward && inventoryItems.length > 0) {
                      e.currentTarget.style.backgroundColor = '#1e3a5f';
                    }
                  }}
                >
                  Confirm Give Reward
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reward Requests Modal */}
        {showRequestsModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowRequestsModal(false)}
          >
            <div style={{
              backgroundColor: 'white',
              padding: '0',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '1000px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8f 100%)',
                padding: '28px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '3px solid #fbbf24'
              }}>
                <div>
                  <h2 style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: 'white',
                    margin: '0 0 8px 0',
                    letterSpacing: '0.5px'
                  }}>
                    Reward Requests
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#b8daf0',
                    margin: 0
                  }}>
                    {rewardRequests.length} {rewardRequests.length === 1 ? 'pending request' : 'pending requests'}
                  </p>
                </div>
                <button
                  onClick={() => setShowRequestsModal(false)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                overflowY: 'auto',
                flex: 1,
                backgroundColor: '#f8fafc',
                padding: '24px 32px'
              }}>
                {requestsLoading ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '60px 40px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '2px dashed #e5e7eb'
                  }}>
                    <div style={{
                      fontSize: '16px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>Loading reward requests...</div>
                  </div>
                ) : rewardRequests.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '80px 40px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '2px dashed #e5e7eb'
                  }}>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      marginBottom: '8px',
                      color: '#1f2937'
                    }}>No pending requests</div>
                    <div style={{ 
                      fontSize: '14px',
                      color: '#6b7280',
                      maxWidth: '400px',
                      margin: '0 auto'
                    }}>
                      All reward requests have been processed.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gap: '16px'
                  }}>
                    {rewardRequests.map((req) => (
                      <div key={req.request_id} style={{
                        padding: '24px',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e5e7eb',
                        overflow: 'hidden',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      >
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto',
                          gap: '20px',
                          alignItems: 'center',
                          marginBottom: '16px'
                        }}>
                          {/* User Profile */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ position: 'relative' }}>
                              {req.profile_pic ? (
                                <img 
                                  src={
                                    String(req.profile_pic).startsWith('http') 
                                      ? req.profile_pic 
                                      : `http://127.0.0.1:8000${req.profile_pic}`
                                  }
                                  alt={req.user_name}
                                  style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '3px solid #1e3a5f'
                                  }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.onerror = null;
                                    // Replace with fallback avatar
                                    target.style.display = 'none';
                                    const fallback = target.parentElement?.querySelector('.profile-pic-fallback') as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div 
                                className="profile-pic-fallback"
                                style={{
                                  width: '56px',
                                  height: '56px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: req.profile_pic ? 'none' : 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '22px',
                                  fontWeight: 'bold',
                                  color: 'white',
                                  border: '3px solid #1e3a5f',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0
                                }}
                              >
                                {req.user_name.charAt(0)}
                              </div>
                            </div>
                            <div>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: '700',
                                color: '#1f2937',
                                marginBottom: '4px'
                              }}>
                                {req.user_name}
                              </div>
                              <div style={{
                                fontSize: '12px',
                                color: '#6b7280'
                              }}>
                                User ID: {req.user_id}
                              </div>
                            </div>
                          </div>

                          {/* Reward Details */}
                          <div style={{
                            backgroundColor: '#f8fafc',
                            padding: '14px 16px',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '700',
                              color: '#1e3a5f',
                              marginBottom: '6px'
                            }}>
                              {req.reward_name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span style={{
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}>
                                {req.reward_type}
                              </span>
                              <span>•</span>
                              <span style={{ fontWeight: '600' }}>{req.reward_value}</span>
                              <span>•</span>
                              <span style={{ color: '#dc2626', fontWeight: '600' }}>{req.points_cost} pts</span>
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#9ca3af'
                            }}>
                              Requested: {new Date(req.requested_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>

                          {/* Approve/Release Button */}
                          <div>
                            {(() => {
                              const isMerchandise = req.reward_type?.toLowerCase().includes('merchandise') || 
                                                   req.reward_type?.toLowerCase().includes('merch') ||
                                                   req.reward_type?.toLowerCase().includes('product') ||
                                                   req.reward_type?.toLowerCase().includes('item');
                              const isReadyForPickup = req.status === 'ready_for_pickup';
                              const isClaimed = req.status === 'claimed';
                              
                              // Show Release button for merchandise that's ready for pickup
                              if (isMerchandise && isReadyForPickup && !isClaimed) {
                                return (
                                  <button
                                    onClick={() => handleReleaseMerchandise(req.request_id)}
                                    disabled={releasing}
                                    style={{
                                      padding: '12px 24px',
                                      background: releasing ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      cursor: releasing ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s',
                                      opacity: releasing ? 0.6 : 1
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!releasing) {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    {releasing ? 'Releasing...' : '✓ Release'}
                                  </button>
                                );
                              }
                              
                              // Show Approve button for pending requests
                              if (req.status === 'pending') {
                                return (
                                  <button
                                    onClick={() => {
                                      setSelectedRequest(req);
                                      setInstructions('');
                                      setVoucherCode('');
                                      setShowApproveModal(true);
                                    }}
                                    style={{
                                      padding: '12px 24px',
                                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-2px)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    Review & Approve
                                  </button>
                                );
                              }
                              
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approve Request Modal */}
        {showApproveModal && selectedRequest && (
          <>
            <style>
              {`
                @keyframes slideIn {
                  from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }
                @keyframes spin {
                  from {
                    transform: rotate(0deg);
                  }
                  to {
                    transform: rotate(360deg);
                  }
                }
              `}
            </style>
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1001,
              backdropFilter: 'blur(2px)',
            }}
            onClick={() => {
              if (!approving) {
                setShowApproveModal(false);
                setSelectedRequest(null);
                setInstructions('');
                setVoucherCode('');
              }
            }}
            >
            <div style={{
              backgroundColor: 'white',
              padding: '32px 40px',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '800px',
              maxWidth: '95%',
              position: 'relative',
              animation: 'slideIn 0.3s ease-out',
              borderTop: '4px solid #1e3a5f'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              {/* Header Section */}
              <div style={{
                marginBottom: '28px',
                paddingBottom: '20px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h2 style={{ 
                  margin: 0, 
                  color: '#1e3a5f', 
                  fontSize: '22px', 
                  fontWeight: '600',
                  letterSpacing: '-0.3px'
                }}>
                  Approve Reward Request
                </h2>
              </div>

              {/* Information Grid - Horizontal Layout */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '24px'
              }}>
                {/* User */}
                <div style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4' }}>
                    {selectedRequest.user_name}
                  </div>
                </div>

                {/* Reward */}
                <div style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reward</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4' }}>
                    {selectedRequest.reward_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {selectedRequest.reward_type}
                  </div>
                </div>

                {/* Points Cost */}
                <div style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points Cost</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#dc2626', lineHeight: '1.4' }}>
                    {selectedRequest.points_cost}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>points</div>
                </div>
              </div>

              {(selectedRequest.reward_type.toLowerCase().includes('voucher') || 
                selectedRequest.reward_type.toLowerCase().includes('gift card') || 
                selectedRequest.reward_type.toLowerCase().includes('coupon')) && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '13px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '8px'
                  }}>
                    Voucher Code <span style={{ fontWeight: '400', color: '#94a3b8' }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Enter voucher code..."
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      transition: 'all 0.15s',
                      backgroundColor: '#ffffff'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#1e3a5f';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 58, 95, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  fontWeight: '500', 
                  color: '#374151', 
                  marginBottom: '8px'
                }}>
                  Instructions for User <span style={{ color: '#dc2626', fontWeight: '600' }}>*</span>
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Enter instructions on how to claim the reward (e.g., 'Pick up at CTU office during business hours', 'Use code at checkout', etc.)"
                  rows={4}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical' as const,
                    transition: 'all 0.15s',
                    backgroundColor: '#ffffff',
                    lineHeight: '1.5'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1e3a5f';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 58, 95, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <div style={{ 
                  fontSize: '12px', 
                  color: '#64748b', 
                  marginTop: '6px'
                }}>
                  These instructions will be sent to the user via notification
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    if (!approving) {
                      setShowApproveModal(false);
                      setSelectedRequest(null);
                      setInstructions('');
                      setVoucherCode('');
                    }
                  }}
                  disabled={approving}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: '#ffffff',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: approving ? 'not-allowed' : 'pointer',
                    opacity: approving ? 0.6 : 1,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!approving) {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!approving) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveRequest}
                  disabled={approving || !instructions.trim()}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: (approving || !instructions.trim()) 
                      ? '#cbd5e1' 
                      : '#1e3a5f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: (approving || !instructions.trim()) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!approving && instructions.trim()) {
                      e.currentTarget.style.backgroundColor = '#2d5a8f';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!approving && instructions.trim()) {
                      e.currentTarget.style.backgroundColor = '#1e3a5f';
                    }
                  }}
                >
                  {approving ? 'Approving...' : 'Approve Request'}
                </button>
              </div>
            </div>
          </div>
          </>
        )}

        {/* Points Settings Modal */}
        {showPointsSettingsModal && (
          <>
          <style>{`
            .points-settings-modal-scroll {
               scrollbar-width: none;
               -ms-overflow-style: none;
             }
            .points-settings-modal-scroll::-webkit-scrollbar {
               display: none;
             }
          `}</style>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1002,
          }}
          onClick={() => setShowPointsSettingsModal(false)}
          >
            <div style={{
              backgroundColor: 'white',
              padding: '20px 28px',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              width: '900px',
              maxWidth: '95%',
              maxHeight: '75vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e3a5f' }}>
                  Points Settings
                </h2>
              </div>

              {/* Milestone Tasks Enable/Disable Toggle */}
              <div
                className="points-settings-modal-scroll"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  paddingRight: '8px',
                  marginRight: '-8px'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '10px 14px', 
                  background: milestoneTasksEnabled ? '#f0fdf4' : '#fef2f2', 
                  borderRadius: '8px', 
                  marginTop: '16px',
                  marginBottom: '16px',
                  border: `2px solid ${milestoneTasksEnabled ? '#10b981' : '#ef4444'}`
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                      Milestone Tasks Feature
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {milestoneTasksEnabled ? 'Milestone tasks are currently enabled' : 'Milestone tasks are currently disabled'}
                    </div>
                  </div>
                  <button
                    onClick={() => setMilestoneTasksEnabled(!milestoneTasksEnabled)}
                    style={{
                      width: '56px',
                      height: '32px',
                      borderRadius: '16px',
                      border: 'none',
                      background: milestoneTasksEnabled ? '#10b981' : '#9ca3af',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      boxShadow: milestoneTasksEnabled ? '0 2px 4px rgba(16, 185, 129, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'white',
                      transition: 'transform 0.3s',
                      transform: milestoneTasksEnabled ? 'translateX(24px)' : 'translateX(0)',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                    }} />
                  </button>
                </div>

                {/* Milestone Tasks Section */}
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '2px solid #e5e7eb', opacity: milestoneTasksEnabled ? 1 : 0.5, pointerEvents: milestoneTasksEnabled ? 'auto' : 'none' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f', marginBottom: '12px' }}>
                    Milestone Tasks Points
                  </h3>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                    Configure points awarded for completing milestone tasks. Points are only given when tasks are fully completed.
                  </p>
                  
                  {milestoneTasksLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                      Loading milestone tasks...
                    </div>
                  ) : milestoneTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                      No milestone tasks found.
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(1, 1fr)', 
                      gap: '8px'
                    }}>
                      {milestoneTasks.map((task) => (
                        <div 
                          key={task.task_id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '10px 12px', 
                            background: '#f9fafb', 
                            borderRadius: '6px',
                            border: task.is_active ? '1px solid #d1d5db' : '1px solid #fca5a5'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: task.is_active ? '#1f2937' : '#9ca3af' }}>
                                {removeNumbersFromTitle(task.title)}
                              </span>
                              {!task.is_active && (
                                <span style={{ fontSize: '10px', color: '#ef4444', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.description}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px' }}>
                            <input
                              type="number"
                              min="0"
                              value={task.points}
                              onChange={(e) => {
                                const newTasks = milestoneTasks.map(t => 
                                  t.task_id === task.task_id 
                                    ? { ...t, points: parseInt(e.target.value) || 0 }
                                    : t
                                );
                                setMilestoneTasks(newTasks);
                              }}
                              style={{
                                width: '70px',
                                padding: '6px 8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '13px',
                                textAlign: 'center',
                                opacity: task.is_active ? 1 : 0.5,
                                pointerEvents: task.is_active ? 'auto' : 'none'
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '40px' }}>points</span>
                            {typeof task.required_count === 'number' && (
                              <>
                                <input
                                  type="number"
                                  min="0"
                                  value={task.required_count}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    const newTasks = milestoneTasks.map(t =>
                                      t.task_id === task.task_id
                                        ? { ...t, required_count: !isNaN(value) ? value : 0 }
                                        : t
                                    );
                                    setMilestoneTasks(newTasks);
                                  }}
                                  style={{
                                    width: '70px',
                                    padding: '6px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    textAlign: 'center',
                                    opacity: task.is_active ? 1 : 0.5,
                                    pointerEvents: task.is_active ? 'auto' : 'none'
                                  }}
                                />
                                <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '60px' }}>target</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tracker Form Rewards Section */}
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '2px solid #e5e7eb' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '10px 14px', 
                    background: trackerFormEnabled ? '#f0fdf4' : '#fef2f2', 
                    borderRadius: '8px', 
                    marginBottom: '16px',
                    border: `2px solid ${trackerFormEnabled ? '#10b981' : '#ef4444'}`
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                        Tracker Form Rewards
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {trackerFormEnabled ? 'Tracker form rewards are currently enabled' : 'Tracker form rewards are currently disabled'}
                        {!trackerFormEnabled && !trackerFormAccepting && (
                          <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', fontWeight: '500' }}>
                            ⚠️ Tracker form must be accepting responses to enable rewards
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!trackerFormEnabled && !trackerFormAccepting) {
                          alert('⚠️ Cannot enable tracker form rewards. The tracker form must be accepting responses first. Please enable "Accepting Responses" in the Tracker Settings.');
                          return;
                        }
                        setTrackerFormEnabled(!trackerFormEnabled);
                      }}
                      disabled={!trackerFormEnabled && !trackerFormAccepting}
                      style={{
                        width: '56px',
                        height: '32px',
                        borderRadius: '16px',
                        border: 'none',
                        background: trackerFormEnabled ? '#10b981' : '#9ca3af',
                        cursor: (!trackerFormEnabled && !trackerFormAccepting) ? 'not-allowed' : 'pointer',
                        position: 'relative',
                        transition: 'all 0.3s',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                        boxShadow: trackerFormEnabled ? '0 2px 4px rgba(16, 185, 129, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
                        opacity: (!trackerFormEnabled && !trackerFormAccepting) ? 0.5 : 1
                      }}
                    >
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'white',
                        transition: 'transform 0.3s',
                        transform: trackerFormEnabled ? 'translateX(24px)' : 'translateX(0)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }} />
                    </button>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '10px 12px', 
                    background: '#f9fafb', 
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    opacity: trackerFormEnabled ? 1 : 0.5,
                    pointerEvents: trackerFormEnabled ? 'auto' : 'none'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: trackerFormEnabled ? '#1f2937' : '#9ca3af', marginBottom: '4px' }}>
                        Complete Tracker Form
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        Points awarded to alumni for completing the tracker form
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px' }}>
                      <input
                        type="number"
                        min="0"
                        value={trackerFormPoints}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          setTrackerFormPoints(!isNaN(value) && value >= 0 ? value : 0);
                        }}
                        style={{
                          width: '70px',
                          padding: '6px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '13px',
                          textAlign: 'center',
                          opacity: trackerFormEnabled ? 1 : 0.5,
                          pointerEvents: trackerFormEnabled ? 'auto' : 'none'
                        }}
                      />
                      <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '40px' }}>points</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button
                  onClick={() => setShowPointsSettingsModal(false)}
                  style={{
                    flex: 1,
                    padding: '9px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePointsSettings}
                  disabled={pointsSettingsLoading}
                  style={{
                    flex: 1,
                    padding: '9px',
                    background: pointsSettingsLoading ? '#d1d5db' : 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8f 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: pointsSettingsLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {pointsSettingsLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
          </>
        )}

        </div>
      </div>
    </div>
  );
};

export default RewardsPage;


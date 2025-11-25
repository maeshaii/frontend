import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { getInventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem, getInventoryAnalytics } from '../../../services/api';

type InventoryAvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

interface InventoryAvailability {
  status: InventoryAvailabilityStatus;
  label: string;
  units_available: number;
  is_available: boolean;
}

interface InventoryItem {
  id: number;
  name: string;
  type: string;
  quantity: number;
  value: string;
  icon?: string;
  availability?: InventoryAvailability;
}

interface InventoryAnalyticsItem {
  id: number;
  name: string;
  type: string;
  quantity: number;
  value: string;
  total_claims: number;
  claims_last_30_days: number;
  avg_daily_redemption: number;
  projected_run_out_days: number | null;
  demand_level: 'high' | 'medium' | 'low';
  last_claimed_at: string | null;
  stockout_risk: boolean;
}

interface InventoryAnalyticsSummary {
  total_items: number;
  total_stock: number;
  total_claims_30d: number;
  avg_daily_redemption: number;
}

interface InventoryAnalyticsResponse {
  success: boolean;
  generated_at: string;
  lookback_days: number;
  summary: InventoryAnalyticsSummary;
  items: InventoryAnalyticsItem[];
  top_movers: InventoryAnalyticsItem[];
  slow_movers: InventoryAnalyticsItem[];
}

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemValue, setNewItemValue] = useState('');

  // Inventory items - fetched from backend
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<InventoryAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [editingQuantities, setEditingQuantities] = useState<{ [key: number]: string }>({});
  const [updatingItems, setUpdatingItems] = useState<Set<number>>(new Set());

  // Show notification helper
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Update current time every second for real-time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch inventory items on component mount
  useEffect(() => {
    fetchInventoryItems();
    fetchInventoryAnalytics();
  }, []);

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getInventoryItems();
      if (response.success) {
        setInventoryItems(response.items || []);
      } else {
        setError(response.message || 'Failed to fetch inventory');
      }
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      setError(err.response?.data?.message || 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const response = await getInventoryAnalytics();
      console.log('Analytics response:', response);
      console.log('Response keys:', Object.keys(response || {}));
      console.log('Has success:', 'success' in (response || {}));
      console.log('Has summary:', 'summary' in (response || {}));
      
      if (response && response.success) {
        // Ensure response has the expected structure
        if (response.summary) {
          // Ensure all required fields exist with defaults
          const analyticsData = {
            success: true,
            generated_at: response.generated_at || new Date().toISOString(),
            lookback_days: response.lookback_days || 30,
            summary: {
              total_items: response.summary?.total_items ?? 0,
              total_stock: response.summary?.total_stock ?? 0,
              total_claims_30d: response.summary?.total_claims_30d ?? 0,
              avg_daily_redemption: response.summary?.avg_daily_redemption ?? 0,
            },
            items: response.items || [],
            top_movers: response.top_movers || [],
            slow_movers: response.slow_movers || [],
          };
          setAnalytics(analyticsData);
        } else {
          console.error('Analytics response missing summary:', response);
          setAnalytics(null);
          setAnalyticsError('Invalid analytics data structure - missing summary');
        }
      } else {
        setAnalytics(null);
        setAnalyticsError(response?.message || 'Failed to load analytics');
      }
    } catch (err: any) {
      console.error('Error fetching inventory analytics:', err);
      console.error('Error details:', err.response?.data);
      setAnalytics(null);
      setAnalyticsError(err.response?.data?.message || err.message || 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleAddInventoryItem = async () => {
    // Validate all required fields
    if (!newItemName || !newItemName.trim()) {
      showNotification('error', 'Item name is required');
      return;
    }
    
    if (!newItemType || !newItemType.trim()) {
      showNotification('error', 'Item type is required');
      return;
    }
    
    // Validate quantity
    const quantity = parseInt(newItemQuantity);
    if (isNaN(quantity) || quantity < 1) {
      showNotification('error', 'Quantity must be at least 1');
      return;
    }
    
    // Validate value
    if (!newItemValue || newItemValue.trim() === '' || newItemValue.trim() === '0') {
      showNotification('error', 'Please enter a valid value (e.g., $25, 100 pts)');
      return;
    }
    
    try {
      console.log('Adding inventory item:', { name: newItemName.trim(), type: newItemType.trim(), quantity, value: newItemValue.trim() });
      const response = await addInventoryItem({
        name: newItemName.trim(),
        type: newItemType.trim(),
        quantity: quantity,
        value: newItemValue.trim()
      });
      
      if (response.success) {
        // Add the new item to the list
        setInventoryItems([...inventoryItems, response.item]);
        
        // Reset form and close modal
        setNewItemName('');
        setNewItemType('');
        setNewItemQuantity('');
        setNewItemValue('');
        setShowAddModal(false);
        
        // Refresh inventory list to ensure consistency
        await fetchInventoryItems();
        
        showNotification('success', 'Item added successfully!');
        console.log('New item added:', response.item);
      } else {
        console.error('Failed to add item:', response);
        showNotification('error', response.message || 'Failed to add item');
      }
    } catch (err: any) {
      console.error('Error adding item:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      const errorMessage = err.response?.data?.message || err.message || 'Failed to add item';
      showNotification('error', errorMessage);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const response = await deleteInventoryItem(id);
        
        if (response.success) {
          setInventoryItems(inventoryItems.filter(item => item.id !== id));
          showNotification('success', 'Item deleted successfully!');
        } else {
          showNotification('error', response.message || 'Failed to delete item');
        }
      } catch (err: any) {
        console.error('Error deleting item:', err);
        showNotification('error', err.response?.data?.message || 'Failed to delete item');
      }
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setNewItemName(item.name);
    setNewItemType(item.type);
    setNewItemQuantity(item.quantity.toString());
    setNewItemValue(item.value);
    setShowEditModal(true);
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    // Validate quantity
    const quantity = parseInt(newItemQuantity);
    if (isNaN(quantity) || quantity < 1) {
      showNotification('error', 'Quantity must be at least 1');
      return;
    }
    
    // Validate value
    if (!newItemValue || newItemValue.trim() === '' || newItemValue.trim() === '0') {
      showNotification('error', 'Please enter a valid value (e.g., $25, 100 pts)');
      return;
    }

    try {
      const response = await updateInventoryItem(editingItem.id, {
        name: newItemName,
        type: newItemType,
        quantity: quantity,
        value: newItemValue
      });
      
      if (response.success) {
        const updatedItems = inventoryItems.map(item =>
          item.id === editingItem.id ? response.item : item
        );
        setInventoryItems(updatedItems);
        
        // Reset form and close modal
        setNewItemName('');
        setNewItemType('');
        setNewItemQuantity('');
        setNewItemValue('');
        setEditingItem(null);
        setShowEditModal(false);
        
        showNotification('success', 'Item updated successfully!');
        console.log('Item updated:', response.item);
      } else {
        showNotification('error', response.message || 'Failed to update item');
      }
    } catch (err: any) {
      console.error('Error updating item:', err);
      showNotification('error', err.response?.data?.message || 'Failed to update item');
    }
  };

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
      backgroundColor: '#b8daf0',
      padding: '32px 40px',
      marginBottom: '32px'
    },
    headerTitle: {
      fontSize: '32px',
      fontWeight: 'bold',
      margin: 0,
      color: '#1e3a5f',
      letterSpacing: '1px',
      textTransform: 'uppercase' as const
    },
    headerSubtitle: {
      fontSize: '14px',
      color: '#4a5568',
      marginTop: '8px',
      fontWeight: '400'
    },
    contentWrapper: {
      padding: '0 40px 40px 40px'
    },
    statsBar: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '24px',
      marginBottom: '32px'
    },
    statCard: {
      backgroundColor: '#1e3a5f',
      padding: '40px 32px',
      borderRadius: '16px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      textAlign: 'center' as const,
      transition: 'transform 0.2s',
      cursor: 'pointer'
    },
    statNumber: {
      fontSize: '48px',
      fontWeight: 'bold',
      color: 'white',
      margin: '0 0 16px 0',
      lineHeight: '1'
    },
    statLabel: {
      fontSize: '16px',
      color: '#b8daf0',
      margin: 0,
      fontWeight: '500'
    },
    formSection: {
      backgroundColor: 'white',
      padding: '28px',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      marginBottom: '32px'
    },
    sectionTitle: {
      fontSize: '22px',
      fontWeight: '700',
      color: '#1e3a5f',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '20px',
      marginBottom: '20px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '8px'
    },
    formLabel: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151'
    },
    formInput: {
      padding: '12px 16px',
      border: '2px solid #e2e8f0',
      borderRadius: '10px',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.2s ease',
      backgroundColor: 'white',
      fontWeight: '500',
      color: '#1e293b'
    },
    tableSection: {
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0'
    },
    inventoryTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '14px'
    },
    tableHeader: {
      backgroundColor: '#1e3a5f',
      position: 'sticky' as const,
      top: 0,
      zIndex: 10
    },
    tableHeaderCell: {
      padding: '18px 16px',
      textAlign: 'left' as const,
      fontSize: '13px',
      fontWeight: '700',
      color: 'white',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.8px'
    },
    tableRow: {
      borderBottom: '1px solid #f3f4f6',
      transition: 'background-color 0.2s'
    },
    tableCell: {
      padding: '16px 12px',
      color: '#374151'
    },
    itemIcon: {
      fontSize: '24px',
      display: 'inline-block',
      marginRight: '10px'
    },
    itemName: {
      fontWeight: '500',
      color: '#1f2937'
    },
    quantityBadge: {
      display: 'inline-block',
      padding: '6px 12px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: '600',
      backgroundColor: '#dbeafe',
      color: '#1e40af'
    },
    lowStockBadge: {
      backgroundColor: '#fee2e2',
      color: '#991b1b'
    },
    actionButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '20px',
      padding: '6px 10px',
      transition: 'transform 0.2s'
    },
    addButton: {
      backgroundColor: '#1e3a5f',
      color: 'white',
      border: 'none',
      padding: '14px 32px',
      borderRadius: '12px',
      fontSize: '15px',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 2px 6px rgba(30, 58, 95, 0.3)',
      letterSpacing: '0.5px'
    },
    modalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: '16px',
      width: '90%',
      maxWidth: '700px',
      maxHeight: '90vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      border: '1px solid #e5e7eb'
    },
    modalHeader: {
      padding: '24px 32px',
      borderBottom: '2px solid #f3f4f6',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#f9fafb'
    },
    modalTitle: {
      fontSize: '22px',
      fontWeight: '700',
      color: '#1e3a5f',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      letterSpacing: '-0.3px'
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '28px',
      cursor: 'pointer',
      color: '#6b7280',
      padding: 0,
      lineHeight: 1,
      transition: 'color 0.2s'
    },
    modalBody: {
      padding: '32px',
      overflowY: 'auto' as const,
      backgroundColor: 'white'
    },
    modalFooter: {
      padding: '24px 32px',
      borderTop: '2px solid #f3f4f6',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      backgroundColor: '#f9fafb'
    },
    cancelButton: {
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
      padding: '12px 28px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 4px rgba(107, 114, 128, 0.2)',
      letterSpacing: '0.3px'
    },
    submitButton: {
      backgroundColor: '#10b981',
      color: 'white',
      border: 'none',
      padding: '12px 28px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
      letterSpacing: '0.3px'
    },
    analyticsSection: {
      backgroundColor: 'white',
      padding: '28px',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      marginBottom: '32px',
      border: '1px solid #e2e8f0'
    },
    analyticsHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap' as const,
      gap: '8px'
    },
    analyticsCardGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    analyticsCard: {
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '16px 18px'
    },
    analyticsCardLabel: {
      fontSize: '12px',
      fontWeight: 600,
      color: '#64748b',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      marginBottom: '8px'
    },
    analyticsCardValue: {
      fontSize: '26px',
      fontWeight: 700,
      color: '#0f172a'
    },
    analyticsLists: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    },
    analyticsListCard: {
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '16px'
    },
    analyticsListTitle: {
      fontSize: '14px',
      fontWeight: 700,
      color: '#1f2937',
      marginBottom: '12px'
    },
    analyticsListItem: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '13px',
      padding: '6px 0',
      borderBottom: '1px solid #f1f5f9'
    },
    analyticsTableSection: {
      marginTop: '8px',
      borderTop: '1px solid #e2e8f0',
      paddingTop: '20px'
    },
    analyticsTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '13px'
    },
    analyticsTableHeader: {
      backgroundColor: '#f1f5f9',
      textAlign: 'left' as const
    },
    analyticsTableCell: {
      padding: '10px 12px',
      borderBottom: '1px solid #f1f5f9'
    }
  };

  const deriveAvailability = (item: InventoryItem): InventoryAvailability => {
    if (item.availability) {
      return item.availability;
    }
    const units = Math.max(item.quantity, 0);
    if (units <= 0) {
      return { status: 'out_of_stock', label: 'Out of Stock', units_available: 0, is_available: false };
    }
    if (units <= 5) {
      return { status: 'low_stock', label: `Low Stock (${units} left)`, units_available: units, is_available: true };
    }
    return { status: 'in_stock', label: 'In Stock', units_available: units, is_available: true };
  };

  const getStatusBadgeStyle = (status: InventoryAvailabilityStatus) => {
    switch (status) {
      case 'in_stock':
        return { backgroundColor: '#d1fae5', color: '#065f46' };
      case 'low_stock':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'out_of_stock':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      default:
        return { backgroundColor: '#e5e7eb', color: '#374151' };
    }
  };

  const totalItems = inventoryItems.length;
  const totalStock = inventoryItems.reduce((sum, item) => {
    const availability = deriveAvailability(item);
    return sum + availability.units_available;
  }, 0);
  const lowStockItemsList = inventoryItems.filter(item => {
    const availability = deriveAvailability(item);
    return availability.status === 'low_stock' || availability.status === 'out_of_stock';
  });
  const lowStockItems = lowStockItemsList.length;

  // Helper function to check if form is valid
  const isFormValid = () => {
    const nameValid = newItemName?.trim() && newItemName.trim().length > 0;
    const typeValid = newItemType && newItemType.length > 0 && newItemType !== '';
    
    // Quantity validation - allow 1 or more
    let quantityValid = false;
    if (newItemQuantity) {
      const qty = parseInt(newItemQuantity.toString().trim());
      quantityValid = !isNaN(qty) && qty >= 1;
    }
    
    const valueValid = newItemValue?.trim() && newItemValue.trim().length > 0 && newItemValue.trim() !== '0';
    
    const isValid = nameValid && typeValid && quantityValid && valueValid;
    return isValid;
  };

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainContent}>
        {/* Page Header */}
        <div style={styles.pageHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={styles.headerTitle}>INVENTORY MANAGEMENT</h1>
            </div>
            <button
              onClick={() => navigate('/rewards')}
              style={styles.addButton}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = '#2c5282';
                (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = '#1e3a5f';
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              Back to Rewards
            </button>
          </div>
        </div>

        {/* Content Wrapper */}
        <div style={styles.contentWrapper}>
          {/* Analytics Section */}
          <div style={styles.analyticsSection}>
            <div style={styles.analyticsHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#1e3a5f' }}>Inventory Analytics</h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Tracking redemption trends over the last {analytics?.lookback_days ?? 30} days
                </p>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {analyticsLoading
                  ? 'Loading analytics...'
                  : analytics?.generated_at
                    ? currentTime.toLocaleString()
                    : analyticsError || ''}
              </div>
            </div>
            {analyticsLoading ? (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: '#64748b',
                fontSize: '14px'
              }}>
                Loading analytics...
              </div>
            ) : analyticsError ? (
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '14px'
              }}>
                {analyticsError}
              </div>
            ) : analytics && analytics.summary ? (
              <>
                <div style={styles.analyticsCardGrid}>
                  <div style={styles.analyticsCard}>
                    <div style={styles.analyticsCardLabel}>Total Items</div>
                    <div style={styles.analyticsCardValue}>{analytics.summary.total_items ?? 0}</div>
                  </div>
                  <div style={styles.analyticsCard}>
                    <div style={styles.analyticsCardLabel}>Total Stock On-hand</div>
                    <div style={styles.analyticsCardValue}>{analytics.summary.total_stock ?? 0}</div>
                  </div>
                  <div 
                    style={{ 
                      ...styles.analyticsCard, 
                      backgroundColor: lowStockItems > 0 ? '#fef2f2' : '#f8fafc', 
                      borderColor: lowStockItems > 0 ? '#fecaca' : '#e2e8f0',
                      cursor: lowStockItems > 0 ? 'pointer' : 'default',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      if (lowStockItems > 0) {
                        // Initialize editing quantities with current values
                        const initialQuantities: { [key: number]: string } = {};
                        lowStockItemsList.forEach(item => {
                          initialQuantities[item.id] = item.quantity.toString();
                        });
                        setEditingQuantities(initialQuantities);
                        setShowLowStockModal(true);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (lowStockItems > 0) {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (lowStockItems > 0) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <div style={styles.analyticsCardLabel}>Low Stock Alerts</div>
                    <div style={{ ...styles.analyticsCardValue, color: lowStockItems > 0 ? '#b91c1c' : '#0f172a' }}>
                      {lowStockItems}
                    </div>
                  </div>
                </div>

                <div style={styles.analyticsLists}>
                  <div style={styles.analyticsListCard}>
                    <div style={styles.analyticsListTitle}>Top Redeemed Items</div>
                    {!analytics.top_movers || analytics.top_movers.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#94a3b8', padding: '12px 0' }}>No recent redemptions</div>
                    ) : (
                      analytics.top_movers.map((item) => (
                        <div key={item.id} style={styles.analyticsListItem}>
                          <span>{item.name}</span>
                          <span>{item.claims_last_30_days} claims</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={styles.analyticsListCard}>
                    <div style={styles.analyticsListTitle}>Slow Moving Items</div>
                    {!analytics.slow_movers || analytics.slow_movers.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#94a3b8', padding: '12px 0' }}>
                        {analytics.summary.total_items === 0 
                          ? 'No items in inventory yet' 
                          : 'All items moved in the last 30 days'}
                      </div>
                    ) : (
                      analytics.slow_movers.map((item) => (
                        <div key={item.id} style={styles.analyticsListItem}>
                          <span>{item.name}</span>
                          <span>0 claims</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: '#64748b',
                fontSize: '14px'
              }}>
                {analyticsError || 'No analytics data available'}
              </div>
            )}
          </div>

        {/* Inventory Table */}
        <div style={styles.tableSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>
              Current Inventory ({inventoryItems.length} items)
            </h2>
            <button
              style={styles.addButton}
              onClick={() => setShowAddModal(true)}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = '#2c5282';
                (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = '#1e3a5f';
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              Add New Item
            </button>
          </div>
          <div style={{ 
            maxHeight: '500px', 
            overflowY: 'auto', 
            overflowX: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: '8px'
          }}>
            <table style={styles.inventoryTable}>
              <thead style={styles.tableHeader}>
                <tr>
                  <th style={{ ...styles.tableHeaderCell, width: '40%' }}>Item</th>
                  <th style={{ ...styles.tableHeaderCell, width: '20%' }}>Type</th>
                  <th style={{ ...styles.tableHeaderCell, width: '20%', textAlign: 'center' }}>Availability</th>
                  <th style={{ ...styles.tableHeaderCell, width: '15%' }}>Value</th>
                  <th style={{ ...styles.tableHeaderCell, width: '10%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
                        No items in inventory
                      </div>
                      <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                        Add your first reward item using the Add New Item button
                      </div>
                    </td>
                  </tr>
                ) : (
                  inventoryItems.map((item) => (
                    <tr 
                      key={item.id} 
                      style={styles.tableRow}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={styles.tableCell}>
                        <span style={styles.itemName}>{item.name}</span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ color: '#6b7280', fontSize: '13px' }}>{item.type}</span>
                      </td>
                      <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                        {(() => {
                          const availability = deriveAvailability(item);
                          const badgeStyle = {
                            ...styles.quantityBadge,
                            ...getStatusBadgeStyle(availability.status)
                          };
                          return (
                            <div>
                              <span style={badgeStyle}>
                                {availability.label}
                              </span>
                              <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569' }}>
                                Available: {availability.units_available}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                          {item.value}
                        </span>
                      </td>
                      <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                        <button
                          style={{
                            ...styles.actionButton,
                            color: '#3b82f6',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                          title="Edit"
                          onClick={() => handleEditItem(item)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          Edit
                        </button>
                        <button
                          style={{
                            ...styles.actionButton,
                            color: '#ef4444',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginLeft: '8px'
                          }}
                          title="Remove"
                          onClick={() => handleDeleteItem(item.id)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Item Modal */}
        {showAddModal && (
          <div 
            style={{
              ...styles.modalOverlay,
              animation: 'fadeIn 0.2s ease-out',
              padding: '20px'
            }} 
            onClick={() => setShowAddModal(false)}
          >
            <div 
              style={{
                ...styles.modalContent,
                animation: 'slideInModal 0.3s ease-out',
                maxWidth: '600px'
              }} 
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8f 100%)',
                padding: '24px 32px',
                borderBottom: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                  }}>
                    ➕
                  </div>
                  <div>
                    <h2 style={{
                      margin: 0,
                      fontSize: '24px',
                      fontWeight: '700',
                      color: 'white',
                      letterSpacing: '-0.3px'
                    }}>
                      Add New Reward Item
                    </h2>
                    <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', marginTop: '4px', fontWeight: '500' }}>
                      Create a new item for the reward inventory
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    fontSize: '28px',
                    cursor: 'pointer',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                    lineHeight: 1,
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                  }}
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div style={styles.modalBody}>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Item Name *</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="e.g., Gift Card - $25"
                      style={styles.formInput}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Type *</label>
                    <select
                      value={newItemType}
                      onChange={(e) => setNewItemType(e.target.value)}
                      style={styles.formInput}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    >
                      <option value="">Select type</option>
                      <option value="voucher">Voucher</option>
                      <option value="merchandise">Merchandise</option>
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Quantity *</label>
                    <input
                      type="number"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                      placeholder="1"
                      min="1"
                      style={styles.formInput}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Value * (cannot be 0 or empty)</label>
                    <input
                      type="text"
                      value={newItemValue}
                      onChange={(e) => setNewItemValue(e.target.value)}
                      placeholder="e.g., $25, 100 pts"
                      style={styles.formInput}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                ...styles.modalFooter,
                backgroundColor: 'white',
                borderTop: '2px solid #f3f4f6'
              }}>
                <button
                  style={{
                    ...styles.cancelButton,
                    backgroundColor: '#6b7280',
                    boxShadow: '0 2px 8px rgba(107, 114, 128, 0.2)'
                  }}
                  onClick={() => setShowAddModal(false)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4b5563';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 114, 128, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#6b7280';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(107, 114, 128, 0.2)';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.submitButton,
                    backgroundColor: !isFormValid() ? '#9ca3af' : '#10b981',
                    cursor: !isFormValid() ? 'not-allowed' : 'pointer',
                    opacity: !isFormValid() ? 0.6 : 1,
                    boxShadow: !isFormValid() ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={handleAddInventoryItem}
                  disabled={!isFormValid()}
                  onMouseEnter={(e) => {
                    if (isFormValid()) {
                      e.currentTarget.style.backgroundColor = '#059669';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isFormValid()) {
                      e.currentTarget.style.backgroundColor = '#10b981';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                    }
                  }}
                >
                  <span>✓</span>
                  Add to Inventory
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {showEditModal && editingItem && (
          <div 
            style={{
              ...styles.modalOverlay,
              animation: 'fadeIn 0.2s ease-out',
              padding: '20px'
            }} 
            onClick={() => setShowEditModal(false)}
          >
            <div 
              style={{
                ...styles.modalContent,
                animation: 'slideInModal 0.3s ease-out',
                maxWidth: '600px'
              }} 
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                padding: '24px 32px',
                borderBottom: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                  }}>
                    ✏️
                  </div>
                  <div>
                    <h2 style={{
                      margin: 0,
                      fontSize: '24px',
                      fontWeight: '700',
                      color: 'white',
                      letterSpacing: '-0.3px'
                    }}>
                      Edit Reward Item
                    </h2>
                    <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', marginTop: '4px', fontWeight: '500' }}>
                      Update item details and stock quantity
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    fontSize: '28px',
                    cursor: 'pointer',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                    lineHeight: 1,
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                  }}
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                ...styles.modalBody,
                backgroundColor: '#f9fafb'
              }}>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Item Name *</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="e.g., Gift Card - $25"
                      style={styles.formInput}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Type *</label>
                    <select
                      value={newItemType}
                      onChange={(e) => setNewItemType(e.target.value)}
                      style={styles.formInput}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    >
                      <option value="">Select type</option>
                      <option value="voucher">Voucher</option>
                      <option value="merchandise">Merchandise</option>
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Quantity *</label>
                    <input
                      type="number"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                      placeholder="1"
                      min="1"
                      style={styles.formInput}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Value * (cannot be 0 or empty)</label>
                    <input
                      type="text"
                      value={newItemValue}
                      onChange={(e) => setNewItemValue(e.target.value)}
                      placeholder="e.g., $25, 100 pts"
                      style={styles.formInput}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                ...styles.modalFooter,
                backgroundColor: 'white',
                borderTop: '2px solid #f3f4f6'
              }}>
                <button
                  style={{
                    ...styles.cancelButton,
                    backgroundColor: '#6b7280',
                    boxShadow: '0 2px 8px rgba(107, 114, 128, 0.2)'
                  }}
                  onClick={() => setShowEditModal(false)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4b5563';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 114, 128, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#6b7280';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(107, 114, 128, 0.2)';
                  }}
                >
                  Cancel
                </button>
                <button
                  style={{
                    ...styles.submitButton,
                    backgroundColor: (!newItemName || !newItemType || !newItemQuantity || !newItemValue || parseInt(newItemQuantity) < 1 || newItemValue.trim() === '' || newItemValue.trim() === '0') ? '#9ca3af' : '#3b82f6',
                    cursor: (!newItemName || !newItemType || !newItemQuantity || !newItemValue || parseInt(newItemQuantity) < 1 || newItemValue.trim() === '' || newItemValue.trim() === '0') ? 'not-allowed' : 'pointer',
                    opacity: (!newItemName || !newItemType || !newItemQuantity || !newItemValue || parseInt(newItemQuantity) < 1 || newItemValue.trim() === '' || newItemValue.trim() === '0') ? 0.6 : 1,
                    boxShadow: (!newItemName || !newItemType || !newItemQuantity || !newItemValue || parseInt(newItemQuantity) < 1 || newItemValue.trim() === '' || newItemValue.trim() === '0') ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={handleUpdateItem}
                  disabled={
                    !newItemName || 
                    !newItemType || 
                    !newItemQuantity || 
                    !newItemValue || 
                    parseInt(newItemQuantity) < 1 ||
                    newItemValue.trim() === '' ||
                    newItemValue.trim() === '0'
                  }
                  onMouseEnter={(e) => {
                    if (!(e.target as HTMLButtonElement).disabled) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(e.target as HTMLButtonElement).disabled) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                    }
                  }}
                >
                  <span>✓</span>
                  Update Item
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification Modal */}
        {notification && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 10000,
              minWidth: '320px',
              maxWidth: '500px',
              backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444',
              color: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'slideIn 0.3s ease-out',
              border: `1px solid ${notification.type === 'success' ? '#059669' : '#dc2626'}`,
            }}
            onClick={() => setNotification(null)}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              {notification.type === 'success' ? '✓' : '✕'}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  marginBottom: '2px',
                }}
              >
                {notification.type === 'success' ? 'Success' : 'Error'}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  opacity: 0.95,
                  lineHeight: '1.4',
                }}
              >
                {notification.message}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotification(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ×
            </button>
            <style>{`
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
            `}</style>
          </div>
        )}

        {/* Low Stock Items Modal */}
        {showLowStockModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={() => {
              setShowLowStockModal(false);
              setEditingQuantities({});
              setUpdatingItems(new Set());
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '700px',
                maxHeight: '85vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                border: '1px solid #e5e7eb',
                animation: 'slideInModal 0.3s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                padding: '24px 32px',
                borderBottom: '2px solid #fecaca',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                  }}>
                    ⚠
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#991b1b', letterSpacing: '-0.3px' }}>
                      Low Stock Items
                    </h2>
                    <div style={{ fontSize: '14px', color: '#b91c1c', marginTop: '4px', fontWeight: '500' }}>
                      {lowStockItems} item{lowStockItems !== 1 ? 's' : ''} need{lowStockItems === 1 ? 's' : ''} restocking
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowLowStockModal(false);
                    setEditingQuantities({});
                    setUpdatingItems(new Set());
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: 'none',
                    fontSize: '28px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                    lineHeight: 1,
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                    e.currentTarget.style.color = '#6b7280';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                  }}
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                padding: '24px 32px',
                overflowY: 'auto',
                backgroundColor: '#f9fafb',
                flex: 1
              }}>
                {lowStockItemsList.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '60px 20px', 
                    color: '#6b7280' 
                  }}>
                    <div style={{ 
                      fontSize: '64px', 
                      marginBottom: '20px',
                      opacity: 0.5
                    }}>✓</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      All items are well stocked!
                    </div>
                    <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                      No items need restocking at this time.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {lowStockItemsList.map((item, index) => {
                      const availability = deriveAvailability(item);
                      const currentQuantity = editingQuantities[item.id] !== undefined 
                        ? parseInt(editingQuantities[item.id]) 
                        : item.quantity;
                      const quantityChanged = editingQuantities[item.id] !== undefined && 
                        parseInt(editingQuantities[item.id]) !== item.quantity;
                      const isUpdating = updatingItems.has(item.id);
                      
                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '20px',
                            border: `2px solid ${availability.status === 'out_of_stock' ? '#fecaca' : '#fde68a'}`,
                            borderRadius: '12px',
                            backgroundColor: 'white',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                            transition: 'all 0.2s',
                            animation: `slideInItem 0.3s ease-out ${index * 0.05}s both`
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-start', 
                            marginBottom: '16px',
                            gap: '16px'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px', 
                                marginBottom: '8px' 
                              }}>
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '10px',
                                  backgroundColor: availability.status === 'out_of_stock' ? '#fee2e2' : '#fef3c7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '20px',
                                  flexShrink: 0
                                }}>
                                  {availability.status === 'out_of_stock' ? '🚫' : '⚠️'}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontSize: '18px', 
                                    fontWeight: '700', 
                                    color: '#1e3a5f', 
                                    marginBottom: '4px',
                                    letterSpacing: '-0.2px'
                                  }}>
                                    {item.name}
                                  </div>
                                  <div style={{ 
                                    fontSize: '13px', 
                                    color: '#6b7280',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      backgroundColor: '#f3f4f6',
                                      borderRadius: '4px',
                                      textTransform: 'capitalize',
                                      fontWeight: '500'
                                    }}>
                                      {item.type}
                                    </span>
                                    <span>•</span>
                                    <span>Value: <strong style={{ color: '#1e3a5f' }}>{item.value}</strong></span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div style={{
                              padding: '6px 14px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '700',
                              backgroundColor: availability.status === 'out_of_stock' ? '#fee2e2' : '#fef3c7',
                              color: availability.status === 'out_of_stock' ? '#991b1b' : '#92400e',
                              border: `1px solid ${availability.status === 'out_of_stock' ? '#fecaca' : '#fde68a'}`,
                              whiteSpace: 'nowrap',
                              letterSpacing: '0.3px'
                            }}>
                              {availability.label}
                            </div>
                          </div>
                          
                          {/* Stock Update Section */}
                          <div style={{ 
                            padding: '16px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '10px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              gap: '16px',
                              flexWrap: 'wrap'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '250px' }}>
                                <label style={{ 
                                  fontSize: '14px', 
                                  color: '#374151', 
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600',
                                  minWidth: '80px'
                                }}>
                                  Current Stock:
                                </label>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  flex: 1
                                }}>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingQuantities[item.id] !== undefined ? editingQuantities[item.id] : item.quantity}
                                    onChange={(e) => {
                                      setEditingQuantities({
                                        ...editingQuantities,
                                        [item.id]: e.target.value
                                      });
                                    }}
                                    disabled={isUpdating}
                                    style={{
                                      flex: 1,
                                      maxWidth: '120px',
                                      padding: '10px 12px',
                                      border: `2px solid ${quantityChanged ? '#3b82f6' : '#d1d5db'}`,
                                      borderRadius: '8px',
                                      fontSize: '15px',
                                      fontWeight: '600',
                                      textAlign: 'center',
                                      backgroundColor: isUpdating ? '#f3f4f6' : 'white',
                                      color: '#1e3a5f',
                                      transition: 'all 0.2s'
                                    }}
                                    onFocus={(e) => {
                                      e.target.style.borderColor = '#3b82f6';
                                      e.target.style.outline = 'none';
                                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                      e.target.style.borderColor = quantityChanged ? '#3b82f6' : '#d1d5db';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                  />
                                  {quantityChanged && (
                                    <div style={{
                                      fontSize: '12px',
                                      color: '#3b82f6',
                                      fontWeight: '600',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      <span>→</span>
                                      <span>{currentQuantity}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                              onClick={async () => {
                                const newQuantity = editingQuantities[item.id] !== undefined 
                                  ? parseInt(editingQuantities[item.id]) 
                                  : item.quantity;
                                
                                if (isNaN(newQuantity) || newQuantity < 0) {
                                  showNotification('error', 'Please enter a valid quantity (0 or more)');
                                  return;
                                }

                                setUpdatingItems(prev => new Set(prev).add(item.id));
                                
                                try {
                                  const response = await updateInventoryItem(item.id, {
                                    name: item.name,
                                    type: item.type,
                                    quantity: newQuantity,
                                    value: item.value
                                  });
                                  
                                  if (response.success) {
                                    // Update the item in the inventory list
                                    const updatedItems = inventoryItems.map(invItem =>
                                      invItem.id === item.id ? response.item : invItem
                                    );
                                    setInventoryItems(updatedItems);
                                    
                                    // Remove from editing quantities
                                    const newEditingQuantities = { ...editingQuantities };
                                    delete newEditingQuantities[item.id];
                                    setEditingQuantities(newEditingQuantities);
                                    
                                    showNotification('success', `Stock updated for ${item.name}`);
                                    
                                    // Refresh analytics
                                    await fetchInventoryAnalytics();
                                  } else {
                                    showNotification('error', response.message || 'Failed to update stock');
                                  }
                                } catch (err: any) {
                                  console.error('Error updating stock:', err);
                                  showNotification('error', err.response?.data?.message || 'Failed to update stock');
                                } finally {
                                  setUpdatingItems(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(item.id);
                                    return newSet;
                                  });
                                }
                              }}
                              disabled={isUpdating || !quantityChanged || isNaN(currentQuantity) || currentQuantity < 0}
                              style={{
                                padding: '10px 20px',
                                backgroundColor: isUpdating 
                                  ? '#9ca3af' 
                                  : quantityChanged 
                                    ? '#10b981' 
                                    : '#d1d5db',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: (isUpdating || !quantityChanged || isNaN(currentQuantity) || currentQuantity < 0) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                boxShadow: quantityChanged && !isUpdating ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: '120px',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                if (!isUpdating && quantityChanged && !isNaN(currentQuantity) && currentQuantity >= 0) {
                                  e.currentTarget.style.backgroundColor = '#059669';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isUpdating) {
                                  e.currentTarget.style.backgroundColor = quantityChanged ? '#10b981' : '#d1d5db';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = quantityChanged ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none';
                                }
                              }}
                            >
                              {isUpdating ? (
                                <>
                                  <span style={{ 
                                    display: 'inline-block',
                                    width: '14px',
                                    height: '14px',
                                    border: '2px solid rgba(255, 255, 255, 0.3)',
                                    borderTopColor: 'white',
                                    borderRadius: '50%',
                                    animation: 'spin 0.6s linear infinite'
                                  }}></span>
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <span>✓</span>
                                  Update Stock
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>

            <style>{`
              @keyframes fadeIn {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }
              @keyframes slideInModal {
                from {
                  transform: scale(0.9) translateY(-20px);
                  opacity: 0;
                }
                to {
                  transform: scale(1) translateY(0);
                  opacity: 1;
                }
              }
              @keyframes slideInItem {
                from {
                  transform: translateX(-20px);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}</style>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;

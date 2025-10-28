import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { getInventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../../services/api';

interface InventoryItem {
  id: number;
  name: string;
  type: string;
  quantity: number;
  value: string;
  icon: string;
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

  // Fetch inventory items on component mount
  useEffect(() => {
    fetchInventoryItems();
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

  const handleAddInventoryItem = async () => {
    // Validate quantity
    const quantity = parseInt(newItemQuantity);
    if (isNaN(quantity) || quantity < 1) {
      alert('Quantity must be at least 1');
      return;
    }
    
    // Validate value
    if (!newItemValue || newItemValue.trim() === '' || newItemValue.trim() === '0') {
      alert('Please enter a valid value (e.g., $25, 100 pts)');
      return;
    }
    
    try {
      const response = await addInventoryItem({
        name: newItemName,
        type: newItemType,
        quantity: quantity,
        value: newItemValue
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
        
        alert('Item added successfully!');
        console.log('New item added:', response.item);
      } else {
        alert(response.message || 'Failed to add item');
      }
    } catch (err: any) {
      console.error('Error adding item:', err);
      alert(err.response?.data?.message || 'Failed to add item');
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const response = await deleteInventoryItem(id);
        
        if (response.success) {
          setInventoryItems(inventoryItems.filter(item => item.id !== id));
          alert('Item deleted successfully!');
        } else {
          alert(response.message || 'Failed to delete item');
        }
      } catch (err: any) {
        console.error('Error deleting item:', err);
        alert(err.response?.data?.message || 'Failed to delete item');
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
      alert('Quantity must be at least 1');
      return;
    }
    
    // Validate value
    if (!newItemValue || newItemValue.trim() === '' || newItemValue.trim() === '0') {
      alert('Please enter a valid value (e.g., $25, 100 pts)');
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
        
        alert('Item updated successfully!');
        console.log('Item updated:', response.item);
      } else {
        alert(response.message || 'Failed to update item');
      }
    } catch (err: any) {
      console.error('Error updating item:', err);
      alert(err.response?.data?.message || 'Failed to update item');
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
      marginLeft: 240,
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
      padding: '12px 14px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s'
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: '16px',
      width: '90%',
      maxWidth: '700px',
      maxHeight: '90vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const
    },
    modalHeader: {
      padding: '24px 32px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#1f2937',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
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
      overflowY: 'auto' as const
    },
    modalFooter: {
      padding: '20px 32px',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px'
    },
    cancelButton: {
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    submitButton: {
      backgroundColor: '#10b981',
      color: 'white',
      border: 'none',
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    }
  };

  const totalItems = inventoryItems.length;
  const totalStock = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockItems = inventoryItems.filter(item => item.quantity < 10).length;

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainContent}>
        {/* Page Header */}
        <div style={styles.pageHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={styles.headerTitle}>INVENTORY MANAGEMENT</h1>
              <p style={styles.headerSubtitle}>Manage reward items and stock levels</p>
            </div>
            <button
              onClick={() => navigate('/rewards')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'white',
                border: '2px solid #1e3a5f',
                color: '#1e3a5f',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '12px 24px',
                borderRadius: '10px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1e3a5f';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = '#1e3a5f';
              }}
            >
              <span style={{ fontSize: '18px' }}>←</span>
              <span>Back to Rewards</span>
            </button>
          </div>
        </div>

        {/* Content Wrapper */}
        <div style={styles.contentWrapper}>
          {/* Stats Bar */}
          <div style={styles.statsBar}>
          <div 
            style={styles.statCard}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={styles.statNumber}>{totalItems}</div>
            <div style={styles.statLabel}>Total Items</div>
          </div>
          <div 
            style={styles.statCard}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={styles.statNumber}>{totalStock}</div>
            <div style={styles.statLabel}>Total Stock</div>
          </div>
          <div 
            style={{
              ...styles.statCard,
              backgroundColor: lowStockItems > 0 ? '#dc2626' : '#1e3a5f'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={styles.statNumber}>
              {lowStockItems}
            </div>
            <div style={styles.statLabel}>Low Stock Alerts</div>
          </div>
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
                  <th style={{ ...styles.tableHeaderCell, width: '15%', textAlign: 'center' }}>Stock</th>
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
                        <span style={{
                          ...styles.quantityBadge,
                          ...(item.quantity < 10 ? styles.lowStockBadge : {})
                        }}>
                          {item.quantity}
                        </span>
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
          <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  Add New Reward Item
                </h2>
                <button
                  style={styles.closeButton}
                  onClick={() => setShowAddModal(false)}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = '#374151'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = '#6b7280'}
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
                      <option value="Gift Card">Gift Card</option>
                      <option value="Certificate">Certificate</option>
                      <option value="Voucher">Voucher</option>
                      <option value="Merchandise">Merchandise</option>
                      <option value="Ticket">Ticket</option>
                      <option value="Points">Points</option>
                      <option value="Other">Other</option>
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
              <div style={styles.modalFooter}>
                <button
                  style={styles.cancelButton}
                  onClick={() => setShowAddModal(false)}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#4b5563'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#6b7280'}
                >
                  Cancel
                </button>
                <button
                  style={styles.submitButton}
                  onClick={handleAddInventoryItem}
                  disabled={
                    !newItemName || 
                    !newItemType || 
                    !newItemQuantity || 
                    !newItemValue || 
                    parseInt(newItemQuantity) < 1 ||
                    newItemValue.trim() === '' ||
                    newItemValue.trim() === '0'
                  }
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#059669'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#10b981'}
                >
                  Add to Inventory
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {showEditModal && editingItem && (
          <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  Edit Reward Item
                </h2>
                <button
                  style={styles.closeButton}
                  onClick={() => setShowEditModal(false)}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = '#374151'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = '#6b7280'}
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
                      <option value="Gift Card">Gift Card</option>
                      <option value="Certificate">Certificate</option>
                      <option value="Voucher">Voucher</option>
                      <option value="Merchandise">Merchandise</option>
                      <option value="Ticket">Ticket</option>
                      <option value="Points">Points</option>
                      <option value="Other">Other</option>
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
              <div style={styles.modalFooter}>
                <button
                  style={styles.cancelButton}
                  onClick={() => setShowEditModal(false)}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#4b5563'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#6b7280'}
                >
                  Cancel
                </button>
                <button
                  style={styles.submitButton}
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
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#059669'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#10b981'}
                >
                  Update Item
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;


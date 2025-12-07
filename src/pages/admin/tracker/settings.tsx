import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import './Tracker.css';
import { trackerApi } from '../../../services/trackerApi';
import ctulogo from '../../../images/ctulogo.png';
import {  sendReminders, sendEmailReminders, sendSmsReminders, fetchAlumniList } from '../../../services/api';

interface AlumniUser {
  id: number;
  name: string;
  email?: string;
  course?: string;
  profile_pic?: string;
}

interface TrackerResponse {
  name: string;
  answers: Record<string, any>;
  user_id: number;
}

const fetchTrackerResponses = async () => {
  return await trackerApi.getResponsesList();
};

const Settings: React.FC = () => {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [alumni, setAlumni] = useState<AlumniUser[]>([]);
  const [responses, setResponses] = useState<TrackerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('All');
  const [selectedRespondedCourse, setSelectedRespondedCourse] = useState<string>('All');

  // Fetch alumni users and tracker responses on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch all alumni from all years
        const [alumniData, responseData] = await Promise.all([
          fetchAlumniList(), // fetch all alumni from all years
          fetchTrackerResponses(),
        ]);
        if (alumniData && alumniData.alumni) {
          // Map 'program' field from API to 'course' for frontend compatibility
          const mappedAlumni = alumniData.alumni.map((alum: any) => ({
            ...alum,
            course: alum.program || alum.course || '', // Use program field from API, fallback to course if exists
          }));
          setAlumni(mappedAlumni);
        } else {
          console.warn('No alumni data received or invalid format');
          setAlumni([]);
        }
        if (responseData && responseData.responses) {
          setResponses(responseData.responses);
        } else {
          console.warn('No response data received or invalid format');
          setResponses([]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setAlumni([]);
        setResponses([]);
        alert('Failed to load data. Please refresh the page and try again.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []); // Fetch all alumni data

  // Determine responded and not responded alumni by user_id
  const respondedIds = new Set(responses.map((r) => r.user_id));
  const responded = alumni.filter((a) => respondedIds.has(a.id));
  const notResponded = alumni.filter((a) => !respondedIds.has(a.id));

  // Filter alumni based on search term and selected course
  const filterAlumni = (alumniList: AlumniUser[]) => {
    return alumniList.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCourse = selectedCourse === 'All' || user.course === selectedCourse;
      return matchesSearch && matchesCourse;
    });
  };

  // Filter responded alumni based on selected course
  const filterRespondedAlumni = (alumniList: AlumniUser[]) => {
    return alumniList.filter((user) => {
      const matchesCourse =
        selectedRespondedCourse === 'All' || user.course === selectedRespondedCourse;
      return matchesCourse;
    });
  };

  const filteredResponded = filterRespondedAlumni(responded);
  const filteredNotResponded = filterAlumni(notResponded);

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredNotResponded.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredNotResponded.map(user => user.id));
    }
  };

  const handleToggleUser = (index: number) => {
    const user = filteredNotResponded[index];
    if (!user) return;
    
    setSelectedUserIds((prev) =>
      prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id]
    );
  };

  // Editable message and title logic with localStorage persistence
  const defaultTitle = 'Please Fill Out the Tracker Form';
  const defaultMessage = `Hi [User's Name],\n\nWe hope you're doing well! This is a gentle reminder to complete the required Tracker Form to help us keep everything on track and up to date.\n\n⚠️ IMPORTANT: Before proceeding to answer the form, kindly prepare the necessary supporting documents to ensure a smooth process and avoid delays in completing it.\n\nPlease take a few moments to fill it out by clicking the link below:\n👉 Fill Out the Tracker Form\n\nYour timely response is greatly appreciated and helps us stay aligned and organized.\nIf you have any questions or need assistance, feel free to reply to this message.\n\nThank you!\nBest regards,\nCCICT`;

  const [title, setTitle] = useState<string>(() => {
    const saved = localStorage.getItem('tracker_notification_title');
    return saved || defaultTitle;
  });
  const [editTitle, setEditTitle] = useState<string>(title);
  const [message, setMessage] = useState<string>(() => {
    const saved = localStorage.getItem('tracker_notification_message');
    return saved || defaultMessage;
  });
  const [editMessage, setEditMessage] = useState<string>(message);
  const [editing, setEditing] = useState<boolean>(false);

  const handleSend = async () => {
    try {
      // Get selected users who haven't responded
      const selectedAlumni = filteredNotResponded
        .filter(user => selectedUserIds.includes(user.id));

      if (selectedAlumni.length === 0) {
        alert('No users selected.');
        return;
      }

      let sent = 0;
      let failed = 0;

      for (const user of selectedAlumni) {
        try {
          // Generate unique link
          const trackerLink = `${window.location.origin}/alumni/tracker?user_id=${user.id}`;
          // Debug log for user name
          console.log('Sending reminder to:', user.name, 'ID:', user.id);
          // Personalize message (replace all instances)
          let personalizedMsg = message.replace(/\[User's Name\]/g, user.name);
          // Replace the '👉 Fill Out the Tracker Form' line with a clickable link with the same text
          const linkHtml = `<a href='${trackerLink}' style='color:#1e4c7a;font-weight:600;text-decoration:underline;cursor:pointer;'>👉 Fill Out the Tracker Form</a>`;
          personalizedMsg = personalizedMsg.replace('👉 Fill Out the Tracker Form', linkHtml);
          // Send reminder to this user
          const result = await sendReminders([user.id], personalizedMsg, title);
          if (result.success) {
            sent += 1;
          } else {
            failed += 1;
            console.error(`Failed to send reminder to ${user.name}:`, result.error);
          }
        } catch (error) {
          failed += 1;
          console.error(`Error sending reminder to ${user.name}:`, error);
        }
      }

      if (failed > 0) {
        alert(`Reminders sent: ${sent} of ${selectedAlumni.length}\nFailed: ${failed}`);
      } else {
        alert(`Successfully sent ${sent} reminders!`);
      }
    } catch (error) {
      console.error('Error in handleSend:', error);
      alert('An error occurred while sending reminders. Please try again.');
    }
  };

  const handleSendEmail = async () => {
    try {
      // Get selected users who haven't responded
      const selectedAlumni = filteredNotResponded
        .filter(user => selectedUserIds.includes(user.id));

      if (selectedAlumni.length === 0) {
        alert('No users selected.');
        return;
      }

      // Confirm before sending emails
      const confirmed = window.confirm(
        `Send email to ${selectedAlumni.length} selected user(s)?\n\n` +
        `Note: Only users with valid email addresses will receive the email.`
      );
      
      if (!confirmed) {
        return;
      }

      // Show loading indicator
      const userIds = selectedAlumni.map(user => user.id);
      
      console.log('Sending emails to:', userIds);
      
      // Send emails via API
      const result = await sendEmailReminders(
        userIds,
        message,
        title,
        window.location.origin
      );

      // Build detailed result message
      let resultMessage = '';
      
      if (result.sent > 0) {
        resultMessage += `✅ Successfully sent ${result.sent} email(s)\n`;
      }
      
      if (result.no_email > 0) {
        resultMessage += `⚠️ ${result.no_email} user(s) without email addresses\n`;
      }
      
      if (result.failed > 0) {
        resultMessage += `❌ ${result.failed} email(s) failed to send\n`;
      }

      // Show errors if any
      if (result.errors && result.errors.length > 0) {
        resultMessage += `\nDetails:\n`;
        result.errors.slice(0, 5).forEach((error: any) => {
          resultMessage += `- ${error.user}: ${error.reason}\n`;
        });
        
        if (result.errors.length > 5) {
          resultMessage += `... and ${result.errors.length - 5} more\n`;
        }
      }

      alert(resultMessage || 'Email sending completed');

    } catch (error: any) {
      console.error('Error in handleSendEmail:', error);
      
      // Show more specific error messages
      let errorMsg = 'An error occurred while sending emails. ';
      
      if (error.response?.data?.message) {
        errorMsg += error.response.data.message;
      } else if (error.message) {
        errorMsg += error.message;
      } else {
        errorMsg += 'Please try again.';
      }
      
      alert(errorMsg);
    }
  };

  const handleSendSms = async () => {
    try {
      const selectedAlumni = filteredNotResponded
        .filter(user => selectedUserIds.includes(user.id));

      if (selectedAlumni.length === 0) {
        alert('No users selected.');
        return;
      }

      const confirmed = window.confirm(
        `Send SMS to ${selectedAlumni.length} selected user(s)?\n\n` +
        `Note: Only users with verified or valid phone numbers will receive the message.`
      );

      if (!confirmed) {
        return;
      }

      const userIds = selectedAlumni.map(user => user.id);

      const result = await sendSmsReminders(
        userIds,
        message,
        window.location.origin
      );

      let resultMessage = '';

      if (result.sent > 0) {
        resultMessage += `✅ Successfully sent ${result.sent} SMS message(s)\n`;
      }

      if (result.no_phone > 0) {
        resultMessage += `⚠️ ${result.no_phone} user(s) without valid phone numbers\n`;
      }

      if (result.failed > 0) {
        resultMessage += `❌ ${result.failed} SMS message(s) failed to send\n`;
      }

      if (result.errors && result.errors.length > 0) {
        resultMessage += `\nDetails:\n`;
        result.errors.slice(0, 5).forEach((error: any) => {
          resultMessage += `- ${error.user}: ${error.reason}\n`;
        });
        if (result.errors.length > 5) {
          resultMessage += `... and ${result.errors.length - 5} more\n`;
        }
      }

      if (!resultMessage) {
        resultMessage = 'SMS sending completed.';
      }

      alert(resultMessage);
    } catch (error: any) {
      console.error('Error in handleSendSms:', error);
      let errorMsg = 'An error occurred while sending SMS messages. ';

      if (error.response?.data?.message) {
        errorMsg += error.response.data.message;
      } else if (error.message) {
        errorMsg += error.message;
      } else {
        errorMsg += 'Please try again.';
      }

      alert(errorMsg);
    }
  };

  const handleEdit = () => {
    setEditTitle(title);
    setEditMessage(message);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditMessage(message);
    setEditing(false);
  };

  const handleUpdate = () => {
    setTitle(editTitle);
    setMessage(editMessage);
    // Save to localStorage for persistence
    localStorage.setItem('tracker_notification_title', editTitle);
    localStorage.setItem('tracker_notification_message', editMessage);
    setEditing(false);
  };

  const handleMessageChange = () => {
    if (editTextareaRef.current) {
      const htmlContent = editTextareaRef.current.innerHTML;
      setEditMessage(htmlContent);
    }
  };

  // Rich text formatting functions
  const applyFormatting = (format: 'bold' | 'italic' | 'underline') => {
    const div = editTextareaRef.current;
    if (!div) return;

    // Get the current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (selectedText) {
      // Check if the selected text is already formatted with the same format
      const container = range.commonAncestorContainer;
      let parentElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
      
      // Walk up the DOM tree to find if we're inside the target format
      let isAlreadyFormatted = false;
      while (parentElement && parentElement !== div) {
        const tagName = parentElement.tagName.toLowerCase();
        if (
          (format === 'bold' && tagName === 'strong') ||
          (format === 'italic' && tagName === 'em') ||
          (format === 'underline' && tagName === 'u')
        ) {
          isAlreadyFormatted = true;
          break;
        }
        parentElement = parentElement.parentElement;
      }
      
      if (isAlreadyFormatted && parentElement) {
        // Remove formatting - unwrap the element
        const formattedElement = parentElement;
        const parent = formattedElement.parentNode;
        if (parent) {
          // Move all child nodes out of the formatted element
          while (formattedElement.firstChild) {
            parent.insertBefore(formattedElement.firstChild, formattedElement);
          }
          // Remove the empty formatted element
          parent.removeChild(formattedElement);
        }
      } else {
        // Add formatting - create the appropriate HTML element
        let element: HTMLElement;
        switch (format) {
          case 'bold':
            element = document.createElement('strong');
            break;
          case 'italic':
            element = document.createElement('em');
            break;
          case 'underline':
            element = document.createElement('u');
            break;
          default:
            return;
        }
        
        element.textContent = selectedText;
        
        // Delete the selected content and insert the formatted element
        range.deleteContents();
        range.insertNode(element);
      }
      
      // Update the message state
      handleMessageChange();
      
      // Clear selection and place cursor after the formatted text
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStartAfter(range.endContainer);
      newRange.setEndAfter(range.endContainer);
      selection.addRange(newRange);
    }
  };

  // Color formatting function
  const applyColor = (color: string) => {
    const div = editTextareaRef.current;
    if (!div) return;

    // Get the current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (selectedText) {
      // Create a span element with the color
      const span = document.createElement('span');
      span.style.color = color;
      span.textContent = selectedText;
      
      // Delete the selected content and insert the colored span
      range.deleteContents();
      range.insertNode(span);
      
      // Update the message state
      handleMessageChange();
      
      // Clear selection and place cursor after the colored text
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStartAfter(span);
      newRange.setEndAfter(span);
      selection.addRange(newRange);
    }
  };


  const editTextareaRef = useRef<HTMLDivElement>(null);
  const readOnlyTextareaRef = useRef<HTMLDivElement>(null);

  // Auto-resize contentEditable div for editing
  useEffect(() => {
    if (editing && editTextareaRef.current) {
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = editTextareaRef.current.scrollHeight + 'px';
    }
    if (!editing && readOnlyTextareaRef.current) {
      readOnlyTextareaRef.current.style.height = 'auto';
      readOnlyTextareaRef.current.style.height = readOnlyTextareaRef.current.scrollHeight + 'px';
    }
  }, [editMessage, message, editing]);

  // Keyboard shortcuts for formatting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editing) return;
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            applyFormatting('bold');
            break;
          case 'i':
            e.preventDefault();
            applyFormatting('italic');
            break;
          case 'u':
            e.preventDefault();
            applyFormatting('underline');
            break;
        }
      }
    };

    if (editing) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [editing, editMessage]);

  return (
    <div className="tracker-container">
      <div className="tracker-inner">
        {/* Editable Message Card */}
        <div className="card">
          <div className="message-header">
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="form-title-input"
                style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}
              />
            ) : (
              <h3>{title}</h3>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              {!editing && (
                <button className="button-edit" onClick={handleEdit}>
                  Edit
                </button>
              )}
            </div>
          </div>
          <hr />
          {editing ? (
            <>
              {/* Rich text formatting toolbar */}
              <div style={{ 
                marginBottom: '8px', 
                padding: '8px', 
                background: '#f8f9fa', 
                borderRadius: '4px',
                border: '1px solid #e9ecef',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '12px', color: '#666', marginRight: '8px' }}>Format:</span>
                <button
                  type="button"
                  onClick={() => applyFormatting('bold')}
                  style={{
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  title="Bold (Ctrl+B)"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('italic')}
                  style={{
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontStyle: 'italic'
                  }}
                  title="Italic (Ctrl+I)"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('underline')}
                  style={{
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textDecoration: 'underline'
                  }}
                  title="Underline (Ctrl+U)"
                >
                  U
                </button>
                
                <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>Colors:</span>
                <button
                  type="button"
                  onClick={() => applyColor('#000000')}
                  style={{
                    background: '#000000',
                    border: '1px solid #333333',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  title="Black"
                >
                  
                </button>
                <button
                  type="button"
                  onClick={() => applyColor('#1976d2')}
                  style={{
                    background: '#1976d2',
                    border: '1px solid #1565c0',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  title="Blue"
                >
                  
                </button>
                <button
                  type="button"
                  onClick={() => applyColor('#1e4c7a')}
                  style={{
                    background: '#1e4c7a',
                    border: '1px solid #164B87',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  title="Dark Blue"
                >
                  
                </button>
                <button
                  type="button"
                  onClick={() => applyColor('#ffeb3b')}
                  style={{
                    background: '#ffeb3b',
                    border: '1px solid #fbc02d',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: 'black',
                    fontWeight: 'bold'
                  }}
                  title="Yellow"
                >
                  
                </button>
                <button
                  type="button"
                  onClick={() => applyColor('#d32f2f')}
                  style={{
                    background: '#d32f2f',
                    border: '1px solid #b71c1c',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  title="Red"
                >
                  
                </button>
                
                <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px', flexBasis: '100%', marginTop: '4px' }}>
                  Select text and click format/color buttons
                </span>
              </div>
              <div
                ref={editTextareaRef}
                contentEditable
                onInput={handleMessageChange}
                className="message-textarea"
                style={{ 
                  resize: 'none',
                  minHeight: '200px',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}
                dangerouslySetInnerHTML={{ __html: editMessage.replace(/\n/g, '<br>') }}
              />
              <div style={{ marginTop: 8 }}>
                <button className="button-cancel" onClick={handleCancel} style={{ marginRight: 8 }}>
                  Cancel
                </button>
                <button className="button-update" onClick={handleUpdate}>
                  Update
                </button>
              </div>
            </>
          ) : (
            <div
              ref={readOnlyTextareaRef}
              className="message-textarea"
              style={{
                background: '#f7fbff',
                color: '#164B87',
                cursor: 'default',
                pointerEvents: 'none',
                resize: 'none',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                minHeight: '200px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5',
                fontFamily: 'inherit'
              }}
              dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br>') }}
            />
          )}
        </div>


        {/* Users Who Haven't Responded */}
        <div className="card">
          <div className="users-header">
            <h3>Users Who Haven't Responded ({filteredNotResponded.length})</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="border-button" onClick={handleSelectAll}>
                  {selectedUserIds.length === filteredNotResponded.length ? 'Unselect All' : 'Select All'}
                </button>
                <button className="border-button" onClick={handleSend}>
                    Send Form
                  </button>
                <button 
                  className="border-button" 
                  onClick={handleSendEmail}
                  style={{
                    background: '#1e4c7a',
                    color: '#fff',
                    fontWeight: '600'
                  }}
                  title="Send tracker form link via email to selected users"
                >
                    📧 Send via Email
                  </button>
            </div>
            </div>
          {/* Search and Filter Controls */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              marginBottom: '16px',
              marginTop: '16px',
            }}
          >
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder=" Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  backgroundColor: '#ffffff',
                  color: '#495057',
                  fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif",
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#80bdff';
                  e.target.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#ced4da';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '1rem',
                  color: '#6c757d',
                }}
              >
                🔍
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                style={{
                  padding: '10px 32px 10px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  minWidth: '120px',
                  backgroundColor: '#ffffff',
                  color: '#495057',
                  fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif",
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236c757d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  backgroundSize: '14px',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#80bdff';
                  e.target.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#ced4da';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="All">All Courses</option>
                <option value="BSIT">BSIT</option>
                <option value="BIT-CT">BIT-CT</option>
                <option value="BSIS">BSIS</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : filteredNotResponded.length === 0 ? (
            <div>All alumni have responded.</div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Course</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotResponded.map((user, index) => (
                    <tr key={index}>
                      <td>
                        <div className="user-info">
                          <img
                            src={
                              user.profile_pic
                                ? user.profile_pic.startsWith('http')
                                  ? user.profile_pic
                                  : `http://127.0.0.1:8000${user.profile_pic}`
                                : ctulogo
                            }
                            alt="avatar"
                            style={{ width: 32, height: 32, borderRadius: '50%' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = ctulogo as unknown as string;
                            }}
                          />
                          <div>
                            <strong>
                              {user.name && typeof user.name === 'object'
                                ? JSON.stringify(user.name)
                                : user.name || ''}
                            </strong>
                            <br />
                            <span>
                              {user.email && typeof user.email === 'object'
                                ? JSON.stringify(user.email)
                                : user.email || ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {user.course && typeof user.course === 'object'
                          ? JSON.stringify(user.course)
                          : user.course || ''}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => handleToggleUser(index)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#1e4c7a',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

                {/* Users Who Responded */}
                <div className="card">
          <div className="users-header">
            <h3>Users Who Responded ({filteredResponded.length})</h3>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedRespondedCourse}
                onChange={(e) => setSelectedRespondedCourse(e.target.value)}
                style={{
                  padding: '10px 32px 10px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  minWidth: '120px',
                  backgroundColor: '#ffffff',
                  color: '#495057',
                  fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif",
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236c757d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  backgroundSize: '14px',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#80bdff';
                  e.target.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#ced4da';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="All">All Courses</option>
                <option value="BSIT">BSIT</option>
                <option value="BIT-CT">BIT-CT</option>
                <option value="CSIS">BSIS</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : filteredResponded.length === 0 ? (
            <div>No alumni have responded yet.</div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Course</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResponded.map((user, index) => (
                    <tr key={index}>
                      <td>
                        <div className="user-info">
                          <img
                            src={
                              user.profile_pic
                                ? user.profile_pic.startsWith('http')
                                  ? user.profile_pic
                                  : `http://127.0.0.1:8000${user.profile_pic}`
                                : ctulogo
                            }
                            alt="avatar"
                            style={{ width: 32, height: 32, borderRadius: '50%' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = ctulogo as unknown as string;
                            }}
                          />
                          <div>
                            <strong>
                              {user.name && typeof user.name === 'object'
                                ? JSON.stringify(user.name)
                                : user.name || ''}
                            </strong>
                            <br />
                            <span>
                              {user.email && typeof user.email === 'object'
                                ? JSON.stringify(user.email)
                                : user.email || ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {user.course && typeof user.course === 'object'
                          ? JSON.stringify(user.course)
                          : user.course || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

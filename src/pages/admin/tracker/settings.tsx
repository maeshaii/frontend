import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import './Tracker.css';
import { fetchAlumniByYear, sendReminders } from '../../../services/api';

interface AlumniUser {
  id: number;
  name: string;
  email?: string;
  course?: string;
}

interface TrackerResponse {
  name: string;
  answers: Record<string, any>;
  user_id: number;
}

const fetchTrackerResponses = async () => {
  const response = await fetch('http://127.0.0.1:8000/api/tracker/list-responses/');
  return response.json();
};

const Settings: React.FC = () => {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [alumni, setAlumni] = useState<AlumniUser[]>([]);
  const [responses, setResponses] = useState<TrackerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('All');
  const [selectedRespondedCourse, setSelectedRespondedCourse] = useState<string>('All');

  // Calculate target batch year (current year - 2)
  const currentYear = new Date().getFullYear();
  const targetBatchYear = currentYear - 2;

  // Fetch alumni users and tracker responses on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [alumniData, responseData] = await Promise.all([
          fetchAlumniByYear(targetBatchYear.toString()),
          fetchTrackerResponses(),
        ]);
        
        if (alumniData && alumniData.alumni) {
          setAlumni(alumniData.alumni);
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
  }, [targetBatchYear]);

  // Determine responded and not responded alumni by user_id
  const respondedIds = new Set(responses.map(r => r.user_id));
  const responded = alumni.filter(a => respondedIds.has(a.id));
  const notResponded = alumni.filter(a => !respondedIds.has(a.id));

  // Filter alumni based on search term and selected course
  const filterAlumni = (alumniList: AlumniUser[]) => {
    return alumniList.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCourse = selectedCourse === 'All' || user.course === selectedCourse;
      return matchesSearch && matchesCourse;
    });
  };

  // Filter responded alumni based on selected course
  const filterRespondedAlumni = (alumniList: AlumniUser[]) => {
    return alumniList.filter(user => {
      const matchesCourse = selectedRespondedCourse === 'All' || user.course === selectedRespondedCourse;
      return matchesCourse;
    });
  };

  const filteredResponded = filterRespondedAlumni(responded);
  const filteredNotResponded = filterAlumni(notResponded);

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredNotResponded.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredNotResponded.map((_, idx) => idx));
    }
  };

  const handleToggleUser = (index: number) => {
    setSelectedUsers((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  // Editable message and title logic
  const [title, setTitle] = useState<string>('Please Fill Out the Tracker Form');
  const [editTitle, setEditTitle] = useState<string>(title);
  const [message, setMessage] = useState<string>(`Hi [User's Name],\n\nWe hope you're doing well! This is a gentle reminder to complete the required Tracker Form to help us keep everything on track and up to date.\n\nPlease take a few moments to fill it out by clicking the link below:\n👉 Fill Out the Tracker Form\n\nYour timely response is greatly appreciated and helps us stay aligned and organized.\nIf you have any questions or need assistance, feel free to reply to this message.\n\nThank you!\nBest regards,\nCCICT`);
  const [editMessage, setEditMessage] = useState<string>(message);
  const [editing, setEditing] = useState<boolean>(false);

  const handleSend = async () => {
    try {
      // Get selected users who haven't responded
      const selectedAlumni = filteredNotResponded
        .map((user, idx) => selectedUsers.includes(idx) ? user : null)
        .filter((user): user is AlumniUser => user !== null);

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
          personalizedMsg = personalizedMsg.replace(
            '👉 Fill Out the Tracker Form',
            linkHtml
          );
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
    setEditing(false);
  };

  const handleMessageChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setEditMessage(e.target.value);
  };

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const readOnlyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea for editing
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
                onChange={e => setEditTitle(e.target.value)}
                className="form-title-input"
                style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}
              />
            ) : (
              <h3>{title}</h3>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              {!editing && (
                <button className="button-edit" onClick={handleEdit}>Edit</button>
              )}
              <button className="border-button" onClick={handleSend}>Send Form</button>
            </div>
          </div>
          <hr />
          {editing ? (
            <>
              <textarea
                ref={editTextareaRef}
                value={editMessage}
                onChange={handleMessageChange}
                className="message-textarea"
                style={{ resize: 'none' }}
              />
              <div style={{ marginTop: 8 }}>
                <button className="button-cancel" onClick={handleCancel} style={{ marginRight: 8 }}>Cancel</button>
                <button className="button-update" onClick={handleUpdate}>Update</button>
              </div>
            </>
          ) : (
            <textarea
              ref={readOnlyTextareaRef}
              value={message}
              readOnly
              className="message-textarea"
              style={{ background: '#f7fbff', color: '#164B87', cursor: 'default', pointerEvents: 'none', resize: 'none' }}
              tabIndex={-1}
            />
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
                  backgroundSize: '14px'
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
                            src={process.env.PUBLIC_URL + '/favicon.ico'}
                            alt="avatar"
                            style={{ width: 32, height: 32, borderRadius: '50%' }}
                          />
                          <div>
                            <strong>{user.name}</strong><br />
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{user.course}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Users Who Haven't Responded */}
        <div className="card">
          <div className="users-header">
            <h3>Users Who Haven't Responded ({filteredNotResponded.length})</h3>
            <button className="border-button" onClick={handleSelectAll}>
              {selectedUsers.length === filteredNotResponded.length ? 'Unselect All' : 'Select All'}
            </button>
          </div>
          
          {/* Search and Filter Controls */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            alignItems: 'center', 
            marginBottom: '16px', 
            marginTop: '16px'
          }}>
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
                  boxSizing: 'border-box'
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
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1rem',
                color: '#6c757d'
              }}>
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
                  backgroundSize: '14px'
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
                            src={process.env.PUBLIC_URL + '/favicon.ico'}
                            alt="avatar"
                            style={{ width: 32, height: 32, borderRadius: '50%' }}
                          />
                          <div>
                            <strong>{user.name}</strong><br />
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{user.course}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(index)}
                          onChange={() => handleToggleUser(index)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#1e4c7a'
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
      </div>
    </div>
  );
};

export default Settings;

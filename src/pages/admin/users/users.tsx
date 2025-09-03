import React, { useState } from 'react';

export interface User {
  id: number;
  name: string;
  idNumber: string;
  course: string;
  batch: string;
  status: string;
  type: 'OJT' | 'ALUMNI';
  gender?: string;
  birthDate?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  jobStatus?: string;
  company?: string;
  position?: string;
  industry?: string;
  civilStatus?: string;
  socialMedia?: string;
}

interface Props {
  users: User[];
  type: 'OJT' | 'ALUMNI';
  onBack: () => void;
}

export const User: React.FC<Props> = ({ users, type, onBack }) => {
  console.log('User component rendered');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filteredUsers = users.filter(
    (user) =>
      (selectedCourse === 'All' || user.course === selectedCourse) &&
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateAge = (birthDateStr?: string) => {
    if (!birthDateStr) return 'N/A';
    const date = new Date(birthDateStr);
    if (isNaN(date.getTime())) return 'N/A';
    const diff = Date.now() - date.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const renderUserDetailModal = () => (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '600px',
        width: '100%',
      }}
    >
      <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>User Profile</h2>
      <div
        style={{
          display: 'grid',
          gap: '10px',
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        <label>Name</label>
        <input value={selectedUser?.name || ''} readOnly />
        <label>Gender</label>
        <input value={selectedUser?.gender || 'N/A'} readOnly />
        <label>Birth Date</label>
        <input value={selectedUser?.birthDate || 'N/A'} readOnly />
        <label>Age</label>
        <input value={calculateAge(selectedUser?.birthDate)} readOnly />
        <label>Civil Status</label>
        <input value={selectedUser?.civilStatus || 'N/A'} readOnly />
        <label>Email</label>
        <input value={selectedUser?.email || 'N/A'} readOnly />
        <label>Phone Number</label>
        <input value={selectedUser?.phoneNumber || 'N/A'} readOnly />
        <label>Address</label>
        <input value={selectedUser?.address || 'N/A'} readOnly />
        <label>Social Media</label>
        <input value={selectedUser?.socialMedia || 'N/A'} readOnly />
      </div>
      <h2 style={{ fontSize: '20px', margin: '20px 0 10px' }}>
        Employment Information
      </h2>
      <div
        style={{
          display: 'grid',
          gap: '10px',
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        <label>Current Job Status</label>
        <input value={selectedUser?.jobStatus || 'N/A'} readOnly />
        <label>Company</label>
        <input value={selectedUser?.company || 'N/A'} readOnly />
        <label>Position</label>
        <input value={selectedUser?.position || 'N/A'} readOnly />
        <label>Industry</label>
        <input value={selectedUser?.industry || 'N/A'} readOnly />
      </div>
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button
          onClick={() => setSelectedUser(null)}
          style={{
            padding: '10px 20px',
            borderRadius: '20px',
            background: '#f26c4f',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px 40px', position: 'relative', zIndex: 9999, pointerEvents: 'auto' }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onBack}
            style={{
              border: 'none',
              background: '#174f84',
              color: 'white',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            &lsaquo;
          </button>
          <h2 style={{ margin: 0 }}>BATCH {users[0]?.batch || 'N/A'}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="text"
            placeholder="🔍 Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '20px',
              border: '1px solid #ccc',
              fontSize: '14px',
            }}
          />
          <div>
            <label style={{ marginRight: '6px' }}>COURSE:</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '10px',
                border: '1px solid #ccc',
              }}
            >
              <option>All</option>
              <option>BSIT</option>
              <option>BSIS</option>
              <option>BIT-CT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          pointerEvents: 'auto',
          zIndex: 9999,
        }}
      >
        <thead>
          <tr style={{ background: '#174f84', color: 'white' }}>
            <th style={{ padding: '12px' }}>#</th>
            <th style={{ padding: '12px' }}>Name</th>
            <th style={{ padding: '12px' }}>ID Number</th>
            <th style={{ padding: '12px' }}>Course</th>
            <th style={{ padding: '12px' }}>Batch Graduated</th>
            <th style={{ padding: '12px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user, index) => (
            <tr
              key={user.id}
              style={{
                textAlign: 'center',
              }}
            >
              <td style={{ padding: '10px' }}>
                {String(index + 1).padStart(2, '0')}
              </td>
              <td
                style={{
                  cursor: 'pointer',
                  background: '#ffe4e1',
                  pointerEvents: 'auto',
                  zIndex: 9999,
                }}
                onClick={() => {
                  console.log('Name cell clicked', user);
                  setSelectedUser(user);
                }}
              >
                {user.name}
              </td>
              <td>{user.idNumber}</td>
              <td>{user.course}</td>
              <td>{user.batch}</td>
              <td
                style={{
                  color:
                    user.status === 'Employed'
                      ? 'teal'
                      : user.status === 'High Position'
                      ? '#e6b800'
                      : user.status === 'Absorb'
                      ? '#0093D9'
                      : 'orangered',
                  textDecoration: 'underline',
                }}
              >
                {user.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Detail Modal */}
      {selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          {renderUserDetailModal()}
        </div>
      )}

      <div
        style={{
          background: '#ffe4e1',
          padding: 20,
          marginTop: 20,
          cursor: 'pointer',
          pointerEvents: 'auto',
          zIndex: 9999,
        }}
        onClick={() => {
          console.log('DIV CLICKED');
          setSelectedUser({ id: 888, name: 'Div User', idNumber: '8888888', course: 'DIV', batch: '9999', status: 'Employed', type: 'ALUMNI' });
        }}
      >
        CLICK ME DIV
      </div>
    </div>
  );
};

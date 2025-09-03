// index.tsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../global/sidebar';
import { fetchAlumniStatistics, fetchAlumniByYear } from '../../../services/api';

const UsersIndex: React.FC = () => {
  const [batchList, setBatchList] = useState<{ year: number; count: number }[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [alumni, setAlumni] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  useEffect(() => {
    const loadBatches = async () => {
      setLoading(true);
      try {
        const data = await fetchAlumniStatistics();
        setBatchList(data.years || []);
      } catch (e) {
        setBatchList([]);
      } finally {
        setLoading(false);
      }
    };
    loadBatches();
  }, []);

  const handleBatchClick = async (year: number) => {
    setLoading(true);
    setSelectedBatch(year);
    setSearchTerm('');
    setSelectedCourse('All');
    try {
      const data = await fetchAlumniByYear(year.toString());
      setAlumni(data.alumni || []);
    } catch (e) {
      setAlumni([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedBatch(null);
    setAlumni([]);
    setSearchTerm('');
    setSelectedCourse('All');
  };

  // Get unique courses for dropdown
  const courseOptions = Array.from(new Set(alumni.map(a => a.course).filter(Boolean)));

  // Filtered alumni
  const filteredAlumni = alumni.filter((user) => {
    const matchCourse = selectedCourse === 'All' || user.course === selectedCourse;
    const matchSearch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchCourse && matchSearch;
  });

  const calculateAge = (birthDateStr?: string) => {
    if (!birthDateStr) return 'N/A';
    const date = new Date(birthDateStr);
    if (isNaN(date.getTime())) return 'N/A';
    const diff = Date.now() - date.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flexGrow: 1, padding: '20px 40px 40px', backgroundColor: '#f5f7fa', overflowY: 'auto' }}>
        {/* Header: Only show in batch card view */}
        {!selectedBatch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
            <span style={{ fontSize: '24px' }}>👥</span>
            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Users</span>
          </div>
        )}

        {/* Batch Cards View */}
        {!selectedBatch && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {batchList.length === 0 && !loading && (
              <div>No alumni batches found.</div>
            )}
            {loading && <div>Loading...</div>}
            {batchList.map((batch) => (
              <div
                key={batch.year}
                onClick={() => handleBatchClick(batch.year)}
                style={{
                  width: '220px',
                  borderRadius: '20px',
                  backgroundColor: 'white',
                  overflow: 'hidden',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08)',
                  transition: 'transform 0.2s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ height: '80px', backgroundColor: '#e3e9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#174f84' }}>
                  <span role="img" aria-label="batch">🎓</span>
                </div>
                <div style={{ backgroundColor: '#174f84', color: 'white', padding: '15px' }}>
                  <strong style={{ fontSize: '15px', display: 'block', marginBottom: '5px' }}>YEAR GRADUATED: {batch.year}</strong>
                  <div style={{ fontSize: '13px' }}>Imported: {batch.count}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alumni Table View */}
        {selectedBatch && (
          <div>
            <button
              onClick={handleBack}
              style={{
                border: 'none',
                background: '#174f84',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '18px',
                cursor: 'pointer',
                marginBottom: 20,
              }}
            >
              &lsaquo;
            </button>
            {/* Batch title and search/filter row in one flex container */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0 }}>BATCH {selectedBatch}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <input
                  type="text"
                  placeholder="🔍 Search...."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '24px',
                    border: '2px solid #222',
                    fontSize: '16px',
                    outline: 'none',
                    width: 240,
                    marginRight: 8,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    background: '#fff',
                    transition: 'border 0.2s',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ marginRight: 8, fontWeight: 500, color: '#222', fontSize: 15 }}>COURSE:</label>
                  <select
                    value={selectedCourse}
                    onChange={e => setSelectedCourse(e.target.value)}
                    style={{
                      padding: '8px 28px 8px 18px',
                      borderRadius: '20px',
                      border: 'none',
                      fontSize: '15px',
                      background: '#3b5bfe',
                      color: 'white',
                      fontWeight: 600,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      appearance: 'none',
                      outline: 'none',
                    }}
                  >
                    <option value="All">All</option>
                    {courseOptions.map((course) => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
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
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
                ) : filteredAlumni.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No alumni found for this batch.</td></tr>
                ) : (
                  filteredAlumni.map((user, index) => (
                    <tr
                      key={user.id}
                      style={{ textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                      onClick={() => setSelectedUser(user)}
                      onMouseOver={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f8ff'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                    >
                      <td style={{ padding: '10px' }}>{String(index + 1).padStart(2, '0')}</td>
                      <td>{user.name}</td>
                      <td>{user.ctu_id}</td>
                      <td>{user.course}</td>
                      <td>{user.batch}</td>
                      <td style={{ color: user.status === 'Employed' ? 'teal' : user.status === 'High Position' ? '#e6b800' : user.status === 'Absorb' ? '#0093D9' : 'orangered' }}>{user.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add modal after the table */}
        {selectedUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '16px', minWidth: '340px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: 24 }}>User Profile</h2>
              <div style={{ textAlign: 'left', marginBottom: 18 }}>
                <p><b>Name:</b> {selectedUser.name}</p>
                <p><b>ID Number:</b> {selectedUser.ctu_id}</p>
                <p><b>Course:</b> {selectedUser.course}</p>
                <p><b>Batch:</b> {selectedUser.batch}</p>
                <p><b>Status:</b> {selectedUser.status}</p>
                <p><b>Gender:</b> {selectedUser.gender || 'N/A'}</p>
                <p><b>Birthdate:</b> {selectedUser.birthdate || 'N/A'}</p>
                <p><b>Age:</b> {selectedUser.birthdate ? calculateAge(selectedUser.birthdate) : 'N/A'}</p>
                <p><b>Civil Status:</b> {selectedUser.civilStatus || 'N/A'}</p>
                <p><b>Phone Number:</b> {selectedUser.phone || 'N/A'}</p>
                <p><b>Address:</b> {selectedUser.address || 'N/A'}</p>
                <p><b>Social Media:</b> {selectedUser.socialMedia || 'N/A'}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '8px', background: '#f26c4f', color: 'white', border: 'none', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersIndex;

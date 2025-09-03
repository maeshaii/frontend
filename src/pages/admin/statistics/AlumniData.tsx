import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { fetchAlumniByYear, fetchTrackerResponsesByUser } from '../../../services/api';

const AlumniData: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();

  const [selectedCourse, setSelectedCourse] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [alumniList, setAlumniList] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAlumni, setModalAlumni] = useState<any | null>(null);
  const [trackerAnswers, setTrackerAnswers] = useState<any[]>([]);
  const [trackerQuestions, setTrackerQuestions] = useState<any[]>([]);
  const [trackerAnswersMap, setTrackerAnswersMap] = useState<Record<number, any>>({});

  useEffect(() => {
    const loadAlumni = async () => {
      try {
        if (year) {
          const data = await fetchAlumniByYear(year);
          setAlumniList(data.alumni || []);
          // Fetch tracker answers for all alumni in the list
          const trackerMap: Record<number, any> = {};
          if (data.alumni && data.alumni.length > 0) {
            const qRes = await fetch('http://127.0.0.1:8000/api/tracker/questions/');
            const qData = await qRes.json();
            const trackerQuestions = qData.categories ? qData.categories.flatMap((cat: any) => cat.questions) : [];
            // Helper to get tracker answer by label for a given answers object
            const getTrackerAnswerByLabel = (answers: any, label: string) => {
              if (!trackerQuestions || !answers) return '';
              const q = trackerQuestions.find((q: any) => q.text.toLowerCase().includes(label.toLowerCase()));
              if (!q) return '';
              const ans = answers[q.id];
              if (Array.isArray(ans)) return ans.join(', ');
              return ans || '';
            };
            await Promise.all(data.alumni.map(async (alumni: any) => {
              const userId = alumni.id || alumni.user_id;
              if (userId) {
                const res = await fetchTrackerResponsesByUser(userId);
                if (res.responses && res.responses.length > 0) {
                  trackerMap[userId] = {
                    company: getTrackerAnswerByLabel(res.responses[0].answers, 'company'),
                    position: getTrackerAnswerByLabel(res.responses[0].answers, 'position'),
                    salary: getTrackerAnswerByLabel(res.responses[0].answers, 'salary'),
                  };
                }
              }
            }));
          }
          setTrackerAnswersMap(trackerMap);
        }
      } catch (e) {
        setAlumniList([]);
        setTrackerAnswersMap({});
      }
    };
    loadAlumni();
  }, [year]);

  const filteredAlumni = alumniList.filter((alumni) => {
    const matchCourse = selectedCourse === 'All' || alumni.course === selectedCourse;
    const matchSearch = (alumni.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchCourse && matchSearch;
  });

  const openModal = async (alumni: any) => {
    setModalAlumni(alumni);
    setModalOpen(true);
    // Fetch tracker answers for this alumni
    if (alumni.id || alumni.user_id) {
      const userId = alumni.id || alumni.user_id;
      const res = await fetchTrackerResponsesByUser(userId);
      setTrackerAnswers(res.responses && res.responses.length > 0 ? res.responses[0].answers : {});
    } else {
      setTrackerAnswers([]);
    }
    // Fetch tracker questions for mapping
    const qRes = await fetch('http://127.0.0.1:8000/api/tracker/questions/');
    const qData = await qRes.json();
    setTrackerQuestions(qData.categories ? qData.categories.flatMap((cat: any) => cat.questions) : []);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAlumni(null);
  };

  // Helper to get tracker answer by question text
  const getTrackerAnswerByLabel = (label: string) => {
    if (!trackerQuestions || !trackerAnswers) return '';
    // Try to match by question text containing the label (case-insensitive)
    const q = trackerQuestions.find((q: any) => q.text.toLowerCase().includes(label.toLowerCase()));
    if (!q) return '';
    const ans = trackerAnswers[q.id];
    if (Array.isArray(ans)) return ans.join(', ');
    return ans || '';
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <Sidebar />

      <div style={{ flex: 1, overflowY: 'auto' }}>
       {/* Header */}
<div
  style={{
    position: 'relative',
    backgroundColor: '#17406a',
    color: 'white',
    padding: '15px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }}
>
  {/* Back Button */}
  <button
              onClick={() => navigate(-1)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginBottom: '20px',
              }}
            >
              &lt; Back
            </button>

  {/* Centered Title */}
  <h2
    style={{
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      margin: 0,
      color:"white"
    }}
  >
    Alumni Data
  </h2>

  {/* Search Bar */}
  <input
    type="text"
    placeholder="🔍 Search..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    style={{
      padding: '6px 12px',
      borderRadius: '6px',
      border: 'none',
      fontSize: '14px',
      width: '200px',
      zIndex: 2
    }}
  />
</div>


       {/* Batch and Course Filter in the Same Row */}
<div style={{
  padding: '20px 30px 0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}}>
  {/* Batch Label */}
  <strong style={{ fontSize: '16px' }}>BATCH {year}</strong>

  {/* Course Dropdown */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <span style={{ fontSize: '14px' }}>COURSE:</span>
    <select
      value={selectedCourse}
      onChange={(e) => setSelectedCourse(e.target.value)}
      style={{
        padding: '6px 12px',
        borderRadius: '20px',
        backgroundColor: '#4f46e5',
        color: 'white',
        border: 'none',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '14px'
      }}
    >
      <option value="All">All</option>
      <option value="BSIT">BSIT</option>
      <option value="BSIS">BSIS</option>
      <option value="BSCT">BIT-CT</option>
    </select>
  </div>
</div>


        {/* Table Section */}
        <div style={{ padding: '30px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}
          >
            <thead style={{ backgroundColor: '#6a74f0', color: 'white' }}>
              <tr>
                <th style={headerCell}>#</th>
                <th style={headerCell}>Program Name</th>
                <th style={headerCell}>Last Name</th>
                <th style={headerCell}>First Name</th>
                <th style={headerCell}>Status</th>
                <th style={headerCell}>Current Job</th>
                <th style={headerCell}>Current Position</th>
                <th style={headerCell}>Salary Current</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlumni.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    No alumni found.
                  </td>
                </tr>
              ) : (
                filteredAlumni.map((alumni, index) => {
                  const userId = alumni.id || alumni.user_id;
                  const tracker = trackerAnswersMap[userId] || {};
                  return (
                    <tr
                      key={alumni.id || index}
                      style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                      onClick={() => openModal(alumni)}
                    >
                      <td style={bodyCell}>{String(index + 1).padStart(2, '0')}</td>
                      <td style={bodyCell}>{alumni.program || alumni.Program_Name || alumni.course || ''}</td>
                      <td style={bodyCell}>{alumni.lastName || alumni.Last_Name || (alumni.name ? alumni.name.split(' ').slice(-1)[0] : '') || ''}</td>
                      <td style={bodyCell}>{alumni.firstName || alumni.First_Name || (alumni.name ? alumni.name.split(' ')[0] : '') || ''}</td>
                      <td style={bodyCell}>{alumni.status || alumni.Status || alumni.user_status || ''}</td>
                      <td style={bodyCell}>{alumni.company_name_current || alumni['Company name current'] || alumni.company || tracker.company || ''}</td>
                      <td style={bodyCell}>{alumni.position_current || alumni['Position current'] || tracker.position || ''}</td>
                      <td style={bodyCell}>{alumni.salary_current || alumni['Salary current'] || tracker.salary || ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Modal for full details */}
        {modalOpen && modalAlumni && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', minWidth: '400px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
              {/* Back Button */}
              <button onClick={closeModal} style={{ position: 'absolute', top: 16, left: 16, background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: 16, cursor: 'pointer', fontWeight: 600 }}>&lt; Back</button>
              <h2 style={{ marginBottom: 16, marginTop: 40, textAlign: 'center' }}>Alumni Details</h2>
              <table style={{ width: '100%', fontSize: 14 }}>
                <tbody>
                  {Object.entries({
                    'CTU ID': modalAlumni.ctu_id || modalAlumni.CTU_ID || getTrackerAnswerByLabel('ctu id'),
                    'First Name': modalAlumni.firstName || modalAlumni.First_Name || modalAlumni.first_name || (modalAlumni.name ? modalAlumni.name.split(' ')[0] : '') || getTrackerAnswerByLabel('first name'),
                    'Middle Name': modalAlumni.middleName || modalAlumni.Middle_Name || modalAlumni.middle_name || (modalAlumni.name && modalAlumni.name.split(' ').length > 2 ? modalAlumni.name.split(' ').slice(1, -1).join(' ') : '') || getTrackerAnswerByLabel('middle name'),
                    'Last Name': modalAlumni.lastName || modalAlumni.Last_Name || modalAlumni.last_name || (modalAlumni.name ? modalAlumni.name.split(' ').slice(-1)[0] : '') || getTrackerAnswerByLabel('last name'),
                    'Gender': modalAlumni.gender || modalAlumni.Gender || getTrackerAnswerByLabel('gender'),
                    'Birthdate': modalAlumni.birthdate || modalAlumni.Birthdate || modalAlumni.birth_date || getTrackerAnswerByLabel('birthdate'),
                    'Phone Number': modalAlumni.phone_num || modalAlumni.Phone_Number || modalAlumni.phone || getTrackerAnswerByLabel('phone'),
                    'Address': modalAlumni.address || modalAlumni.Address || getTrackerAnswerByLabel('address'),
                    'Social Media': modalAlumni.social_media || modalAlumni.Social_Media || getTrackerAnswerByLabel('social'),
                    'Civil Status': modalAlumni.civil_status || modalAlumni.Civil_Status || getTrackerAnswerByLabel('civil status'),
                    'Age': modalAlumni.age || modalAlumni.Age || getTrackerAnswerByLabel('age'),
                    'Email': modalAlumni.email || modalAlumni.Email || getTrackerAnswerByLabel('email'),
                    'Program Name': modalAlumni.program || modalAlumni.Program_Name || modalAlumni.course || getTrackerAnswerByLabel('program'),
                    'Status': modalAlumni.status || modalAlumni.Status || modalAlumni.user_status || getTrackerAnswerByLabel('status'),
                    'Company name current': modalAlumni.company_name_current || modalAlumni['Company name current'] || modalAlumni.company || getTrackerAnswerByLabel('company') || getTrackerAnswerByLabel('employer') || getTrackerAnswerByLabel('current company'),
                    'Position current': modalAlumni.position_current || modalAlumni['Position current'] || getTrackerAnswerByLabel('position'),
                    'Sector current': modalAlumni.sector_current || modalAlumni['Sector current'] || getTrackerAnswerByLabel('sector'),
                    'Employment duration current': modalAlumni.employment_duration_current || modalAlumni['Employment duration current'] || modalAlumni.employment_duration || getTrackerAnswerByLabel('employment duration') || getTrackerAnswerByLabel('how long') || getTrackerAnswerByLabel('duration'),
                    'Salary current': modalAlumni.salary_current || modalAlumni['Salary current'] || getTrackerAnswerByLabel('salary'),
                    'Supporting document current': modalAlumni.supporting_document_current || modalAlumni['Supporting document current'] || getTrackerAnswerByLabel('supporting document'),
                    'Awards recognition current': modalAlumni.awards_recognition_current || modalAlumni['Awards recognition current'] || getTrackerAnswerByLabel('awards'),
                    'Supporting document awards recognition': modalAlumni.supporting_document_awards_recognition || modalAlumni['Supporting document awards recognition'] || getTrackerAnswerByLabel('awards'),
                    'Unemployment reason': modalAlumni.unemployment_reason || modalAlumni['Unemployment reason'] || getTrackerAnswerByLabel('unemployment'),
                    'Pursue further study': modalAlumni.pursue_further_study || modalAlumni['Pursue further study'] || getTrackerAnswerByLabel('further study'),
                    'Date started': modalAlumni.date_started || modalAlumni['Date started'] || getTrackerAnswerByLabel('date started'),
                    'School name': modalAlumni.school_name || modalAlumni['School name'] || modalAlumni.institution || modalAlumni.university || getTrackerAnswerByLabel('school') || getTrackerAnswerByLabel('institution') || getTrackerAnswerByLabel('university'),
                  }).map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ fontWeight: 'bold', padding: '6px 12px', textAlign: 'right', width: '40%' }}>{label}:</td>
                      <td style={{ padding: '6px 12px' }}>{value || <em>No answer</em>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const headerCell: React.CSSProperties = {
  padding: '10px',
  textAlign: 'left',
  fontWeight: 'bold'
};

const bodyCell: React.CSSProperties = {
  padding: '10px',
  textAlign: 'left'
};

export default AlumniData;

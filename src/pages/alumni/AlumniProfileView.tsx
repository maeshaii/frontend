import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ctulogo from '../../images/ctulogo.png';

const AlumniProfileView = () => {
  const { id } = useParams();
  const [alumni, setAlumni] = useState<any>(null);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/alumni/${id}/`)
      .then((res) => res.json())
      .then((data) => setAlumni(data));
  }, [id]);

  if (!alumni) return <div>Loading profile...</div>;

  return (
    <div style={{ padding: 32 }}>
      <img
        src={alumni.profile_pic ? `http://127.0.0.1:8000${alumni.profile_pic}` : ctulogo}
        alt=""
        style={{ width: 100, height: 100, borderRadius: '50%' }}
      />
      <h2>{alumni.name}</h2>
      <p>
        <strong>Course:</strong> {alumni.course}
      </p>
      <p>
        <strong>Class of:</strong> {alumni.year_graduated}
      </p>
      <p>
        <strong>Bio:</strong> {alumni && alumni.profile_bio ? alumni.profile_bio : ''}
      </p>
    </div>
  );
};

export default AlumniProfileView;

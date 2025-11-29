import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import './Tracker.css';
import { fetchTrackerResponses, fetchAlumniList } from '../../../services/api';
import { trackerApi, trackerUtils } from '../../../services/trackerApi';

// Helper function to normalize file URLs returned by the backend
// Uses environment variable for backend URL (matches api.ts pattern)
const getBackendBaseUrl = (): string => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl) {
    // Remove /api/ suffix if present, since file URLs don't need it
    return envUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  // Fallback to default development URL
  return 'http://127.0.0.1:8000';
};

const getFileUrl = (fileUrl: string | null | undefined): string => {
  if (!fileUrl) return '';
  // If already absolute URL, return as is
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  // If relative URL, prepend backend base URL
  const baseUrl = getBackendBaseUrl();
  return `${baseUrl}${fileUrl}`;
};

const IMAGE_FILE_REGEX = /\.(png|jpe?g|gif|bmp|webp|svg|tiff?)$/i;
const isImageFile = (filename?: string | null) => !!filename && IMAGE_FILE_REGEX.test(filename);

const getFileTypeLabel = (filename?: string | null) => {
  if (!filename || !filename.includes('.')) return 'File';
  return filename.split('.').pop()?.toUpperCase() || 'File';
};

const getImageFormat = (filename?: string | null): 'JPEG' | 'PNG' => {
  if (!filename) return 'JPEG';
  return filename.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
};

// Helper to check if a question is image-only (questions 20, 31, 32)
const isImageOnlyQuestion = (questionText: string): boolean => {
  const lowerText = questionText.toLowerCase();
  const isFirstEmploymentDoc = lowerText.includes('first employment supporting document');
  const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                 (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
  const isCurrentEmploymentDoc = lowerText.includes('employment supporting document') && lowerText.includes('current');
  return isFirstEmploymentDoc || isAwardSupportingDocs || isCurrentEmploymentDoc;
};

const Responses: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'view' | 'files'>(() => {
    // Get the saved tab from localStorage, default to 'summary' if not found
    const savedTab = localStorage.getItem('trackerResponsesActiveTab');
    return (savedTab as 'summary' | 'view' | 'files') || 'summary';
  });
  const [accepting, setAccepting] = useState<boolean>(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [alumniUsers, setAlumniUsers] = useState<any[]>([]);
  const [trackerFormId, setTrackerFormId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fileStats, setFileStats] = useState<any[]>([]);
  const [selectedFileCategory, setSelectedFileCategory] = useState<string>('all');
  // Remove currentIndex state

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('trackerResponsesActiveTab', activeTab);
  }, [activeTab]);

  const queryClient = useQueryClient();
  const activeFormQuery = useQuery({
    queryKey: ['tracker', 'activeForm'],
    queryFn: async () => trackerApi.getActiveForm(),
  });
  useEffect(() => {
    if (activeFormQuery.data?.tracker_form_id)
      setTrackerFormId(activeFormQuery.data.tracker_form_id);
  }, [activeFormQuery.data]);

  // Fetch categories (questions), responses, and accepting state from backend
  const questionsQuery = useQuery({
    queryKey: ['tracker', 'questions'],
    queryFn: async () => trackerApi.getQuestions(),
    enabled: !!trackerFormId,
  });
  const responsesQuery = useQuery({
    queryKey: ['tracker', 'responses', 'all'],
    queryFn: async () => fetchTrackerResponses(),
    enabled: !!trackerFormId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Refetch every time component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
  const alumniQuery = useQuery({
    queryKey: ['users', 'alumni', 'all'],
    queryFn: async () => fetchAlumniList(),
    enabled: !!trackerFormId,
  });
  const acceptingQuery = useQuery({
    queryKey: ['tracker', 'accepting', trackerFormId],
    queryFn: async () => trackerApi.getAcceptingStatus(trackerFormId as number),
    enabled: !!trackerFormId,
  });
  const fileStatsQuery = useQuery({
    queryKey: ['tracker', 'fileStats'],
    queryFn: async () => trackerApi.getFileStats(),
    enabled: !!trackerFormId,
    staleTime: 0, // Always fetch fresh file stats
    refetchOnMount: 'always', // Refetch every time
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  useEffect(() => {
    if (questionsQuery.data?.categories) setCategories(questionsQuery.data.categories);
    if (responsesQuery.data?.responses) setResponses(responsesQuery.data.responses);
    if (alumniQuery.data?.alumni) setAlumniUsers(alumniQuery.data.alumni);
    if (typeof acceptingQuery.data?.accepting_responses === 'boolean')
      setAccepting(acceptingQuery.data.accepting_responses);
    if (fileStatsQuery.data?.success && fileStatsQuery.data.stats)
      setFileStats(fileStatsQuery.data.stats);
  }, [
    questionsQuery.data,
    responsesQuery.data,
    alumniQuery.data,
    acceptingQuery.data,
    fileStatsQuery.data,
  ]);

  // Flatten all questions for summary
  const allQuestions = categories.flatMap((cat: any) => cat.questions);

  // Calculate summary data for each question (except text questions)
  const getSummaryData = () => {
    return allQuestions
      .filter((q: any) => q.type !== 'text')
      .map((q: any) => {
        const counts: Record<string, number> = {};

        // Handle file upload questions
        if (q.type === 'file') {
          let filesUploaded = 0;
          let noFiles = 0;

          responses.forEach((res) => {
            const ans = res.answers[String(q.id)];
            if (ans && typeof ans === 'object' && ans.type === 'file') {
              filesUploaded++;
            } else {
              noFiles++;
            }
          });

          return {
            question: q.text,
            type: 'file',
            options: [
              {
                label: 'Files Uploaded',
                percent: responses.length
                  ? Math.round((filesUploaded / responses.length) * 100)
                  : 0,
                count: filesUploaded,
              },
              {
                label: 'No Files',
                percent: responses.length ? Math.round((noFiles / responses.length) * 100) : 0,
                count: noFiles,
              },
            ],
          };
        }

        // Handle regular questions (radio, checkbox, multiple)
        responses.forEach((res) => {
          const ans = res.answers[String(q.id)];
          if (ans) {
            if (Array.isArray(ans)) {
              ans.forEach((a: string) => {
                counts[a] = (counts[a] || 0) + 1;
              });
            } else {
              counts[ans] = (counts[ans] || 0) + 1;
            }
          }
        });
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return {
          question: q.text,
          type: q.type,
          options: (q.options || []).map((opt: string, idx: number) => ({
            label: opt,
            percent: total ? Math.round(((counts[opt] || 0) / total) * 100) : 0,
            count: counts[opt] || 0,
          })),
        };
      });
  };
  const summaryData = getSummaryData();

  // Calculate quarterly response data
  const getQuarterlyData = () => {
    const quarterlyData: Record<
      string,
      { BSIT: number; BSIS: number; 'BIT-CT': number; total: number }
    > = {
      Q1: { BSIT: 0, BSIS: 0, 'BIT-CT': 0, total: 0 },
      Q2: { BSIT: 0, BSIS: 0, 'BIT-CT': 0, total: 0 },
      Q3: { BSIT: 0, BSIS: 0, 'BIT-CT': 0, total: 0 },
      Q4: { BSIT: 0, BSIS: 0, 'BIT-CT': 0, total: 0 },
    };

    responses.forEach((res) => {
      const responseDate = new Date(res.created_at || res.submitted_at || Date.now());
      const month = responseDate.getMonth();

      // 🔧 FIX: Get course/program directly from response answers (not from alumniUsers lookup)
      // Backend includes 'Program Name' in the answers object
      const course = res.answers?.['Program Name'] || 'Unknown';

      console.log('Response user_id:', res.user_id);
      console.log('Program from response:', course);
      console.log('Response answers:', res.answers);

      // Determine quarter
      let quarter: string;
      if (month >= 0 && month <= 2) quarter = 'Q1';
      else if (month >= 3 && month <= 5) quarter = 'Q2';
      else if (month >= 6 && month <= 8) quarter = 'Q3';
      else quarter = 'Q4';

      // Update counts with course from alumni user record
      if (quarterlyData[quarter]) {
        const courseUpper = course.toString().toUpperCase();
        if (
          courseUpper.includes('BSIT') ||
          courseUpper.includes('BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY')
        ) {
          quarterlyData[quarter].BSIT++;
          console.log('Counted as BSIT:', course);
        } else if (
          courseUpper.includes('BSIS') ||
          courseUpper.includes('BACHELOR OF SCIENCE IN INFORMATION SYSTEMS')
        ) {
          quarterlyData[quarter].BSIS++;
          console.log('Counted as BSIS:', course);
        } else if (
          courseUpper.includes('BIT-CT') ||
          courseUpper.includes('BACHELOR OF INDUSTRIAL TECHNOLOGY') ||
          courseUpper.includes('COMPUTER TECHNOLOGY')
        ) {
          quarterlyData[quarter]['BIT-CT']++;
          console.log('Counted as BIT-CT:', course);
        } else {
          console.log('Unknown course:', course);
        }
        quarterlyData[quarter].total++;
      }
    });

    return quarterlyData;
  };

  const quarterlyData = getQuarterlyData();

  // Debug: Log all available answer fields from responses
  useEffect(() => {
    if (responses.length > 0) {
      console.log('Available answer fields in responses:');
      const firstResponse = responses[0];
      console.log('First response answers:', firstResponse.answers);
      console.log('All answer keys:', Object.keys(firstResponse.answers || {}));
    }
  }, [responses]);

  return (
    <div className="tracker-container">
      <div className="tracker-inner">
        {/* Header */}
        <div className="card response-header-card">
          <div className="response-header">
            <h3>
              No. of Responses: {responses.length} 
            </h3>
            <button
              className={`toggle-button ${accepting ? 'active' : 'inactive'}`}
              onClick={async () => {
                if (!trackerFormId) return;
                try {
                  const newAccepting = !accepting;
                  setAccepting(newAccepting);
                  const data = await trackerApi.updateAcceptingStatus(
                    trackerFormId as number,
                    newAccepting
                  );
                  if (data.success) {
                    await Promise.all([
                      queryClient.invalidateQueries({
                        queryKey: ['tracker', 'accepting', trackerFormId],
                      }),
                      queryClient.invalidateQueries({
                        queryKey: ['tracker', 'responses', 'all'],
                      }),
                    ]);
                  } else {
                    throw new Error(data.message || 'Failed to update accepting state');
                  }
                } catch (error) {
                  console.error('Error updating accepting state:', error);
                  alert('Failed to update accepting state. Please try again.');
                  // Revert the state change on error
                  setAccepting(accepting);
                }
              }}
            >
              {accepting ? 'Accepting Responses' : 'Not Accepting'}
            </button>
          </div>

          {/* Tabs */}
          <div className="response-tabs">
            <button
              className={activeTab === 'summary' ? 'active' : ''}
              onClick={() => setActiveTab('summary')}
            >
              Summary
            </button>
            <button
              className={activeTab === 'view' ? 'active' : ''}
              onClick={() => setActiveTab('view')}
            >
              View Responses
            </button>
            <button
              className={activeTab === 'files' ? 'active' : ''}
              onClick={() => setActiveTab('files')}
            >
              File Documents
            </button>
          </div>
        </div>

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <>
            {/* Quarterly Tracker */}
            <div className="card">
              <h3>Quarterly Response Tracker (All Alumni)</h3>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginTop: '12px',
                    fontSize: '1rem',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#f8f9fa',
                        borderBottom: '2px solid #dee2e6',
                      }}
                    >
                      <th
                        style={{
                          padding: '12px 8px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#1e4c7a',
                        }}
                      >
                        Quarter
                      </th>
                      <th
                        style={{
                          padding: '12px 8px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#1e4c7a',
                        }}
                      >
                        BSIT
                      </th>
                      <th
                        style={{
                          padding: '12px 8px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#1e4c7a',
                        }}
                      >
                        BSIS
                      </th>
                      <th
                        style={{
                          padding: '12px 8px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#1e4c7a',
                        }}
                      >
                        BIT-CT
                      </th>
                      <th
                        style={{
                          padding: '12px 8px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#1e4c7a',
                        }}
                      >
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(quarterlyData).map(([quarter, data]) => (
                      <tr
                        key={quarter}
                        style={{
                          borderBottom: '1px solid #dee2e6',
                          backgroundColor: data.total > 0 ? '#f8f9ff' : 'transparent',
                        }}
                      >
                        <td
                          style={{
                            padding: '12px 8px',
                            fontWeight: '500',
                            color: '#164B87',
                          }}
                        >
                          {quarter}
                        </td>
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            color: data.BSIT > 0 ? '#28a745' : '#6c757d',
                          }}
                        >
                          {data.BSIT}
                        </td>
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            color: data.BSIS > 0 ? '#28a745' : '#6c757d',
                          }}
                        >
                          {data.BSIS}
                        </td>
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            color: data['BIT-CT'] > 0 ? '#28a745' : '#6c757d',
                          }}
                        >
                          {data['BIT-CT']}
                        </td>
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: data.total > 0 ? '#1e4c7a' : '#6c757d',
                          }}
                        >
                          {data.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  color: '#1565c0',
                }}
              >
                <strong>Total Responses:</strong> {responses.length} |<strong> BSIT:</strong>{' '}
                {Object.values(quarterlyData).reduce((sum, q) => sum + q.BSIT, 0)} |
                <strong> BSIS:</strong>{' '}
                {Object.values(quarterlyData).reduce((sum, q) => sum + q.BSIS, 0)} |
                <strong> BIT-CT:</strong>{' '}
                {Object.values(quarterlyData).reduce((sum, q) => sum + q['BIT-CT'], 0)}
              </div>
            </div>

            {/* Question Summaries */}
            {summaryData.map((q, index) => (
              <div key={index} className="card">
                <h3>
                  {q.question}
                  {q.type === 'file' && (
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '14px',
                        color: '#1e4c7a',
                        backgroundColor: '#e3f2fd',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 'normal',
                      }}
                    >
                      📎 File Upload
                    </span>
                  )}
                </h3>
                {q.options.map(
                  (opt: { label: string; count: number; percent: number }, idx: number) => (
                    <div key={idx} className="bar-group">
                      <span>
                        {opt.label}: {opt.count} ({opt.percent}%)
                      </span>
                      <div className="bar-container">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${opt.percent}%`,
                            backgroundColor:
                              q.type === 'file' && opt.label === 'Files Uploaded'
                                ? '#28a745'
                                : undefined,
                          }}
                        ></div>
                      </div>
                    </div>
                  )
                )}
              </div>
            ))}
          </>
        )}

        {/* View Responses Tab (book style) */}
        {activeTab === 'view' && responses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <button
                className="action-button"
                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                disabled={currentIndex === 0}
                style={{ marginRight: 16 }}
              >
                &#8592; Prev
              </button>
              <span style={{ fontWeight: 500 }}>
                Response {currentIndex + 1} of {responses.length}
              </span>
              <button
                className="action-button"
                onClick={() => setCurrentIndex((i) => Math.min(i + 1, responses.length - 1))}
                disabled={currentIndex === responses.length - 1}
                style={{ marginLeft: 16 }}
              >
                Next &#8594;
              </button>
            </div>
            <div className="card">
              {(() => {
                const res = responses[currentIndex];
                const allAnswerKeys = Object.keys(res.answers || {});
                const userFieldKeys = allAnswerKeys.filter((k) =>
                  [
                    'First Name',
                    'Middle Name',
                    'Last Name',
                    'Gender',
                    'Birthdate',
                    'Phone Number',
                    'Address',
                    'Social Media',
                    'Civil Status',
                    'Age',
                    'Email',
                    'Program Name',
                    'Status',
                  ].includes(k)
                );
                const otherKeys = allAnswerKeys.filter((k) => !userFieldKeys.includes(k));
                return (
                  <div>
                    {/* Show user fields first */}
                    {userFieldKeys.map((k, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '1rem' }}>
                        <strong>{k}:</strong> {res.answers[k] ? res.answers[k] : <em>No answer</em>}
                      </div>
                    ))}
                    {/* Then show tracker question answers (by question text if available) */}
                    {otherKeys.map((k, i) => {
                      const questionObj = allQuestions.find((q: any) => String(q.id) === k);
                      const label = questionObj ? questionObj.text : k;
                      const answer = res.answers[k];

                      // Handle file uploads
                      if (answer && typeof answer === 'object' && answer.type === 'file') {
                        // 🔧 FIX: Handle broken file references (old bug before fix)
                        if (!answer.filename || !answer.file_size) {
                          return (
                            <div
                              key={userFieldKeys.length + i}
                              style={{ marginBottom: '12px', fontSize: '1rem' }}
                            >
                              <strong>{label}:</strong>
                              <div style={{ color: '#999', fontStyle: 'italic', marginLeft: '8px' }}>
                                No file uploaded (please re-upload if needed)
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div
                            key={userFieldKeys.length + i}
                            style={{ marginBottom: '12px', fontSize: '1rem' }}
                          >
                            <strong>{label}:</strong>
                            <div className="file-display">
                              <div className="file-header">
                                <span style={{ fontSize: '16px' }}>📎</span>
                                <a
                                  href={getFileUrl(answer.file_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="file-link"
                                >
                                  {answer.filename}
                                </a>
                                <span className="file-size">
                                  ({(answer.file_size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                              <div className="file-date">Uploaded: {answer.uploaded_at}</div>
                            </div>
                          </div>
                        );
                      }

                      // Handle regular answers
                      return (
                        <div
                          key={userFieldKeys.length + i}
                          style={{ marginBottom: '12px', fontSize: '1rem' }}
                        >
                          <strong>{label}:</strong>{' '}
                          {Array.isArray(answer) ? (
                            answer.join(', ')
                          ) : answer ? (
                            answer
                          ) : (
                            <em>No answer</em>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {activeTab === 'view' && responses.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 32, color: '#888' }}>No responses yet.</div>
        )}

        {/* File Documents Tab */}
        {activeTab === 'files' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>File Documents Management</h3>
              <button
                onClick={async () => {
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['tracker', 'responses', 'all'] }),
                    queryClient.invalidateQueries({ queryKey: ['tracker', 'fileStats'] })
                  ]);
                  // Force immediate refetch
                  responsesQuery.refetch();
                  fileStatsQuery.refetch();
                }}
                disabled={responsesQuery.isFetching || fileStatsQuery.isFetching}
                style={{
                  padding: '8px 16px',
                  backgroundColor: (responsesQuery.isFetching || fileStatsQuery.isFetching) ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (responsesQuery.isFetching || fileStatsQuery.isFetching) ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!responsesQuery.isFetching && !fileStatsQuery.isFetching) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!responsesQuery.isFetching && !fileStatsQuery.isFetching) {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                  }
                }}
              >
                {(responsesQuery.isFetching || fileStatsQuery.isFetching) ? '⏳ Refreshing...' : '🔄 Refresh Files'}
              </button>
            </div>

            {/* Category Filter */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 500, marginRight: 12 }}>Filter by Document Type:</label>
              <select
                value={selectedFileCategory}
                onChange={(e) => setSelectedFileCategory(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="all">All Document Types</option>
                {fileStats.map((stat, index) => (
                  <option key={index} value={stat.question_text}>
                    {stat.question_text} ({stat.total_files} files)
                  </option>
                ))}
              </select>
            </div>

            {/* File Statistics Summary */}
            <div
              style={{
                marginBottom: 20,
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
              }}
            >
              <h4>Document Summary</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                }}
              >
                {fileStats.map((stat, index) => {
                  const isImageOnly = isImageOnlyQuestion(stat.question_text);
                  const nonImageFiles = stat.files.filter((f: any) => !isImageFile(f.filename));
                  const hasNonImageFiles = nonImageFiles.length > 0;
                  
                  return (
                    <div
                      key={index}
                      style={{
                        padding: '8px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6',
                        position: 'relative',
                      }}
                    >
                      <strong>{stat.question_text}</strong>
                      {isImageOnly && (
                        <div style={{ fontSize: '11px', color: '#28a745', marginTop: '2px', fontStyle: 'italic' }}>
                          📷 Image files only
                        </div>
                      )}
                      {isImageOnly && hasNonImageFiles && (
                        <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '2px', fontWeight: 'bold' }}>
                          ⚠️ {nonImageFiles.length} non-image file(s) from previous uploads
                        </div>
                      )}
                      <div>Files: {stat.total_files}</div>
                      <div>Size: {stat.total_size_mb} MB</div>
                      <div>Users: {stat.unique_users}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* File List */}
            <div>
              <h4>Document Files</h4>
              <div
                style={{
                  maxHeight: '600px',
                  overflowY: 'auto',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                }}
              >
                {fileStats
                  .filter(
                    (stat) =>
                      selectedFileCategory === 'all' || stat.question_text === selectedFileCategory
                  )
                  .map((stat, statIndex) => (
                    <div key={statIndex} style={{ marginBottom: 24, padding: '16px' }}>
                      <h5
                        style={{
                          color: '#1e4c7a',
                          borderBottom: '2px solid #1e4c7a',
                          paddingBottom: '4px',
                          marginBottom: '12px',
                        }}
                      >
                        {stat.question_text}
                        {isImageOnlyQuestion(stat.question_text) && (
                          <span style={{ fontSize: '14px', color: '#28a745', marginLeft: '8px', fontWeight: 'normal' }}>
                            📷 (Image files only)
                          </span>
                        )}
                      </h5>
                      {isImageOnlyQuestion(stat.question_text) && stat.files.some((f: any) => !isImageFile(f.filename)) && (
                        <div style={{
                          padding: '8px 12px',
                          backgroundColor: '#fff3cd',
                          border: '1px solid #ffc107',
                          borderRadius: '4px',
                          marginBottom: '12px',
                          fontSize: '13px',
                          color: '#856404'
                        }}>
                          ⚠️ <strong>Note:</strong> This question now only accepts image files (JPEG, PNG, SVG, GIF, WEBP, BMP, TIFF). 
                          The non-image files shown below are from previous uploads and will remain in the system.
                        </div>
                      )}

                      {/* Print Button for this category */}
                      <button
                        className="action-button"
                        onClick={async () => {
                          try {
                            // Import jsPDF dynamically
                            const { default: jsPDF } = await import('jspdf');
                            const doc = new jsPDF();

                            // Set up the document header
                            doc.setFontSize(16);
                            doc.setFont('helvetica', 'bold');
                            doc.text(stat.question_text, 20, 30);

                            // Add files with images
                            let yPosition = 50;
                            let processedFiles = 0;

                            const processNextFile = (index: number) => {
                              if (index >= stat.files.length) {
                                // All files processed, save the PDF
                                const filename = `${stat.question_text.replace(/[^a-zA-Z0-9]/g, '_')}_All_Alumni.pdf`;
                                doc.save(filename);
                                return;
                              }

                              const file = stat.files[index];
                              const fileUrl = getFileUrl(file.file_url);

                              // Check if we need a new page
                              if (yPosition > 250) {
                                doc.addPage();
                                yPosition = 30;
                              }

                              // Add alumni name
                              doc.setFontSize(12);
                              doc.setFont('helvetica', 'bold');
                              doc.text(`${index + 1}. ${file.user}`, 20, yPosition);

                              if (isImageFile(file.filename)) {
                                if (!fileUrl) {
                                  doc.setFontSize(10);
                                  doc.setFont('helvetica', 'italic');
                                  doc.text('[File URL missing]', 25, yPosition + 15);
                                  yPosition += 60;
                                  processNextFile(index + 1);
                                  return;
                                }
                                try {
                                  const img = new Image();
                                  img.crossOrigin = 'anonymous';

                                  img.onload = () => {
                                    // Calculate image dimensions to fit on page
                                    const maxWidth = 160;
                                    const maxHeight = 120;
                                    let imgWidth = img.width;
                                    let imgHeight = img.height;

                                    if (imgWidth > maxWidth) {
                                      const ratio = maxWidth / imgWidth;
                                      imgWidth = maxWidth;
                                      imgHeight = imgHeight * ratio;
                                    }

                                    if (imgHeight > maxHeight) {
                                      const ratio = maxHeight / imgHeight;
                                      imgHeight = maxHeight;
                                      imgWidth = imgWidth * ratio;
                                    }

                                    if (yPosition + 15 + imgHeight > 270) {
                                      doc.addPage();
                                      yPosition = 30;
                                    }

                                    doc.addImage(
                                      img,
                                      getImageFormat(file.filename),
                                      25,
                                      yPosition + 15,
                                      imgWidth,
                                      imgHeight
                                    );

                                    yPosition += 15 + imgHeight + 40;
                                    processNextFile(index + 1);
                                  };

                                  img.onerror = () => {
                                    doc.setFontSize(10);
                                    doc.setFont('helvetica', 'italic');
                                    doc.text('[Image could not be loaded]', 25, yPosition + 15);
                                    yPosition += 60;
                                    processNextFile(index + 1);
                                  };

                                  img.src = fileUrl || '';
                                } catch (error) {
                                  console.error('Error loading image:', error);
                                  doc.setFontSize(10);
                                  doc.setFont('helvetica', 'italic');
                                  doc.text('[Image could not be loaded]', 25, yPosition + 15);
                                  yPosition += 60;
                                  processNextFile(index + 1);
                                }
                              } else {
                                doc.setFontSize(10);
                                doc.setFont('helvetica', 'italic');
                                doc.text(
                                  `[${getFileTypeLabel(file.filename)} preview not supported in PDF]`,
                                  25,
                                  yPosition + 15
                                );
                                if (fileUrl) {
                                  doc.setFont('helvetica', 'normal');
                                  doc.textWithLink(
                                    'Download original file',
                                    25,
                                    yPosition + 30,
                                    { url: fileUrl }
                                  );
                                }
                                yPosition += 60;
                                processNextFile(index + 1);
                              }
                            };

                            // Start processing files
                            processNextFile(0);
                          } catch (error) {
                            console.error('Error generating PDF:', error);
                            alert('Error generating PDF. Please try again.');
                          }
                        }}
                        style={{ marginBottom: 12 }}
                      >
                        💾 Save {stat.question_text} as PDF ({stat.total_files} files)
                      </button>

                      {/* File List */}
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {stat.files.map((file: any, fileIndex: number) => (
                          <div
                            key={fileIndex}
                            style={{
                              padding: '12px',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              marginBottom: '8px',
                              backgroundColor: 'white',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <strong>{file.filename}</strong>
                                  {isImageOnlyQuestion(stat.question_text) && !isImageFile(file.filename) && (
                                    <span style={{
                                      fontSize: '11px',
                                      padding: '2px 6px',
                                      backgroundColor: '#ffc107',
                                      color: '#856404',
                                      borderRadius: '3px',
                                      fontWeight: 'bold'
                                    }}>
                                      ⚠️ Non-Image
                                    </span>
                                  )}
                                  {isImageOnlyQuestion(stat.question_text) && isImageFile(file.filename) && (
                                    <span style={{
                                      fontSize: '11px',
                                      padding: '2px 6px',
                                      backgroundColor: '#28a745',
                                      color: 'white',
                                      borderRadius: '3px',
                                      fontWeight: 'bold'
                                    }}>
                                      ✓ Image
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                                  Uploaded by: {file.user} | Size: {file.file_size_mb} MB | Date:{' '}
                                  {file.uploaded_at}
                                </div>
                              </div>
                              <div>
                                <a
                                  href={getFileUrl(file.file_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="file-link"
                                  style={{ marginRight: '8px' }}
                                >
                                  📄 View
                                </a>
                                <button
                                  onClick={async () => {
                                    try {
                                      // Import jsPDF dynamically
                                      const { default: jsPDF } = await import('jspdf');
                                      const doc = new jsPDF();

                                      // Set up the document header
                                      doc.setFontSize(16);
                                      doc.setFont('helvetica', 'bold');
                                      doc.text(stat.question_text, 20, 30);

                                      // Add alumni name and file info
                                      doc.setFontSize(12);
                                      doc.setFont('helvetica', 'bold');
                                      doc.text(`1. ${file.user}`, 20, 50);

                                      const fileUrl = getFileUrl(file.file_url);
                                      const safeFilename = (file.filename || 'file').replace(
                                        /[^a-zA-Z0-9.]/g,
                                        '_'
                                      );
                                      if (isImageFile(file.filename)) {
                                        if (!fileUrl) {
                                          doc.setFontSize(10);
                                          doc.setFont('helvetica', 'italic');
                                          doc.text('[File URL missing]', 25, 65);
                                          doc.save(`${safeFilename}_info.pdf`);
                                          return;
                                        }
                                        const img = new Image();
                                        img.crossOrigin = 'anonymous';

                                        img.onload = () => {
                                          const maxWidth = 160;
                                          const maxHeight = 150;
                                          let imgWidth = img.width;
                                          let imgHeight = img.height;

                                          if (imgWidth > maxWidth) {
                                            const ratio = maxWidth / imgWidth;
                                            imgWidth = maxWidth;
                                            imgHeight = imgHeight * ratio;
                                          }

                                          if (imgHeight > maxHeight) {
                                            const ratio = maxHeight / imgHeight;
                                            imgHeight = maxHeight;
                                            imgWidth = imgWidth * ratio;
                                          }

                                          if (65 + imgHeight > 270) {
                                            doc.addPage();
                                            doc.setFontSize(16);
                                            doc.setFont('helvetica', 'bold');
                                            doc.text(stat.question_text, 20, 30);
                                            doc.setFontSize(12);
                                            doc.setFont('helvetica', 'bold');
                                            doc.text(`1. ${file.user}`, 20, 50);
                                          }

                                          doc.addImage(
                                            img,
                                            getImageFormat(file.filename),
                                            25,
                                            65,
                                            imgWidth,
                                            imgHeight
                                          );
                                          doc.save(`${safeFilename}.pdf`);
                                        };

                                        img.onerror = () => {
                                          doc.setFontSize(10);
                                          doc.setFont('helvetica', 'italic');
                                          doc.text('[Image could not be loaded]', 25, 65);
                                          doc.save(`${safeFilename}_info.pdf`);
                                        };

                                        img.src = fileUrl || '';
                                      } else {
                                        doc.setFontSize(10);
                                        doc.setFont('helvetica', 'italic');
                                        doc.text(
                                          `[${getFileTypeLabel(file.filename)} preview not supported in PDF output]`,
                                          25,
                                          65,
                                          { maxWidth: 160 }
                                        );
                                        if (fileUrl) {
                                          doc.setFont('helvetica', 'normal');
                                          doc.textWithLink(
                                            'Download original file',
                                            25,
                                            80,
                                            { url: fileUrl }
                                          );
                                        }
                                        doc.save(`${safeFilename}_info.pdf`);
                                      }
                                    } catch (error) {
                                      console.error('Error generating PDF:', error);
                                      alert('Error generating PDF. Please try again.');
                                    }
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  💾 Save as PDF
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Responses;

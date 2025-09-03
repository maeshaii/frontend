import React, { useState, useEffect, ChangeEvent } from 'react';
import './Tracker.css';
import { fetchAlumniDetails } from '../../../services/api';
import { useNavigate } from 'react-router-dom';

const QUESTION_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'radio', label: 'Radio Button' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'multiple', label: 'Multiple Choice' },
  { value: 'file', label: 'File Upload' }, 
];

interface QuestionItem {
  id: number;
  text: string;
  type: string;
  options?: string[];
}

interface CategoryItem {
  id: number;
  title: string;
  description: string;
  questions: QuestionItem[];
}

interface QuestionProps {
  previewModeFromParent?: boolean;
  userId?: string | null;
}

const Question: React.FC<QuestionProps> = ({ previewModeFromParent, userId }) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editCategoryDraft, setEditCategoryDraft] = useState<Partial<CategoryItem>>({});
  // const [newQuestion, setNewQuestion] = useState<Partial<QuestionItem>>({ text: '', type: 'text', options: [''] });
  // const [questionCatIdx, setQuestionCatIdx] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(!!previewModeFromParent);
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});
  const [userDetails, setUserDetails] = useState<Record<string, any> | null>(null);

  // Add validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Conditional rendering logic
  const shouldShowCategory = (category: CategoryItem) => {
    // Check if this is "PART III: EMPLOYMENT STATUS" category
    if (category.title.toLowerCase().includes('employment status')) {
      // Show if "Are you PRESENTLY employed?" is answered "Yes"
      const employmentQuestion = categories.find(cat => 
        cat.questions.some(q => q.text.toLowerCase().includes('presently employed'))
      );
      if (employmentQuestion) {
        const employmentQuestionId = employmentQuestion.questions.find(q => 
          q.text.toLowerCase().includes('presently employed')
        )?.id;
        return formResponses[employmentQuestionId!] === 'Yes';
      }
    }
    
    // Check if this is "IF UNEMPLOYED" category
    if (category.title.toLowerCase().includes('unemployed')) {
      // Show if "Are you PRESENTLY employed?" is answered "No"
      const employmentQuestion = categories.find(cat => 
        cat.questions.some(q => q.text.toLowerCase().includes('presently employed'))
      );
      if (employmentQuestion) {
        const employmentQuestionId = employmentQuestion.questions.find(q => 
          q.text.toLowerCase().includes('presently employed')
        )?.id;
        return formResponses[employmentQuestionId!] === 'No';
      }
    }
    
    // Check if this is "PART IV: FURTHER STUDY" category
    if (category.title.toLowerCase().includes('further study')) {
      // Show if "Did you pursue further study?" is answered "Yes"
      const studyQuestion = categories.find(cat => 
        cat.questions.some(q => q.text.toLowerCase().includes('pursue further study'))
      );
      if (studyQuestion) {
        const studyQuestionId = studyQuestion.questions.find(q => 
          q.text.toLowerCase().includes('pursue further study')
        )?.id;
        return formResponses[studyQuestionId!] === 'Yes';
      }
    }
    
    // Show all other categories by default
    return true;
  };

  // New state for editing category
  const handleEditCategoryChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditCategoryDraft({ ...editCategoryDraft, [e.target.name]: e.target.value });
  };

  const cancelEditCategory = () => {
    setEditCategoryDraft({});
    setEditingCategoryIndex(null);
  };

  const handleUpdateCategory = async (catIdx: number) => {
    try {
      const categoryId = categories[catIdx].id;
      const res = await fetch(`http://127.0.0.1:8000/api/tracker/update-category/${categoryId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editCategoryDraft.title,
          description: editCategoryDraft.description || ''
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setCategories(cats => cats.map((cat, i) =>
          i === catIdx ? { ...cat, ...data.category } : cat
        ));
        setEditingCategoryIndex(null);
        setEditCategoryDraft({});
      } else {
        alert(data.message || 'Failed to update category');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category. Please try again.');
    }
  };

  // Add back the handleDeleteCategory function
  const handleDeleteCategory = async (catIdx: number) => {
    try {
      const categoryId = categories[catIdx].id;
      const res = await fetch(`http://127.0.0.1:8000/api/tracker/delete-category/${categoryId}/`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setCategories(cats => cats.filter((_, i) => i !== catIdx));
      } else {
        alert(data.message || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category. Please try again.');
    }
  };

  // Add state for adding category
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryDraft, setNewCategoryDraft] = useState<Partial<CategoryItem>>({ title: '', description: '' });

  const handleAddCategoryChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewCategoryDraft({ ...newCategoryDraft, [e.target.name]: e.target.value });
  };
  const handleSaveNewCategory = async () => {
    if (!newCategoryDraft.title) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/tracker/add-category/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCategoryDraft.title,
          description: newCategoryDraft.description || ''
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setCategories(cats => [...cats, data.category]);
        setAddingCategory(false);
        setNewCategoryDraft({ title: '', description: '' });
      } else {
        alert(data.message || 'Failed to add category');
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category. Please try again.');
    }
  };
  const cancelAddCategory = () => {
    setAddingCategory(false);
    setNewCategoryDraft({ title: '', description: '' });
  };

  // Add state for adding question
  const [addingQuestionCatIdx, setAddingQuestionCatIdx] = useState<number | null>(null);
  const [newQuestionDraft, setNewQuestionDraft] = useState<Partial<QuestionItem>>({ text: '', type: 'text', options: [''] });

  const handleAddQuestionChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewQuestionDraft({ ...newQuestionDraft, [e.target.name]: e.target.value });
  };
  const handleAddQuestionOptionChange = (idx: number, value: string) => {
    if (!newQuestionDraft.options) return;
    const updated = [...newQuestionDraft.options];
    updated[idx] = value;
    setNewQuestionDraft({ ...newQuestionDraft, options: updated });
  };
  const addNewQuestionOption = () => setNewQuestionDraft({ ...newQuestionDraft, options: [...(newQuestionDraft.options || []), ''] });
  const removeNewQuestionOption = (idx: number) => {
    if (!newQuestionDraft.options) return;
    const updated = newQuestionDraft.options.filter((_, i) => i !== idx);
    setNewQuestionDraft({ ...newQuestionDraft, options: updated });
  };
  const handleSaveNewQuestion = async (catIdx: number) => {
    if (!newQuestionDraft.text || !newQuestionDraft.type) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/tracker/add-question/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categories[catIdx].id,
          text: newQuestionDraft.text,
          type: newQuestionDraft.type,
          options: newQuestionDraft.type !== 'text' ? newQuestionDraft.options?.filter(opt => opt) : []
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setCategories(cats => cats.map((cat, i) =>
          i === catIdx
            ? { ...cat, questions: [...cat.questions, data.question] }
            : cat
        ));
        setAddingQuestionCatIdx(null);
        setNewQuestionDraft({ text: '', type: 'text', options: [''] });
      } else {
        alert(data.message || 'Failed to add question');
      }
    } catch (error) {
      console.error('Error adding question:', error);
      alert('Failed to add question. Please try again.');
    }
  };
  const cancelAddQuestion = () => {
    setAddingQuestionCatIdx(null);
    setNewQuestionDraft({ text: '', type: 'text', options: [''] });
  };

  // Add state for editing a question inline
  const [editingQuestion, setEditingQuestion] = useState<{catIdx: number, qIdx: number} | null>(null);
  const [editQuestionDraft, setEditQuestionDraft] = useState<Partial<QuestionItem>>({});

  const openEditQuestionInline = (catIdx: number, qIdx: number) => {
    setEditingQuestion({ catIdx, qIdx });
    setEditQuestionDraft({ ...categories[catIdx].questions[qIdx] });
  };
  const handleEditQuestionChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditQuestionDraft({ ...editQuestionDraft, [e.target.name]: e.target.value });
  };
  const handleEditQuestionOptionChange = (idx: number, value: string) => {
    if (!editQuestionDraft.options) return;
    const updated = [...editQuestionDraft.options];
    updated[idx] = value;
    setEditQuestionDraft({ ...editQuestionDraft, options: updated });
  };
  const addEditQuestionOption = () => setEditQuestionDraft({ ...editQuestionDraft, options: [...(editQuestionDraft.options || []), ''] });
  const removeEditQuestionOption = (idx: number) => {
    if (!editQuestionDraft.options) return;
    const updated = editQuestionDraft.options.filter((_, i) => i !== idx);
    setEditQuestionDraft({ ...editQuestionDraft, options: updated });
  };
  const handleUpdateQuestion = async (catIdx: number, qIdx: number) => {
    try {
      const questionId = categories[catIdx].questions[qIdx].id;
      const res = await fetch(`http://127.0.0.1:8000/api/tracker/update-question/${questionId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editQuestionDraft.text,
          type: editQuestionDraft.type,
          options: editQuestionDraft.type !== 'text' ? editQuestionDraft.options?.filter(opt => opt) : []
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setCategories(cats => cats.map((cat, i) =>
          i === catIdx
            ? { ...cat, questions: cat.questions.map((q, idx) => idx === qIdx ? data.question : q) }
            : cat
        ));
        setEditingQuestion(null);
        setEditQuestionDraft({});
      } else {
        alert(data.message || 'Failed to update question');
      }
    } catch (error) {
      console.error('Error updating question:', error);
      alert('Failed to update question. Please try again.');
    }
  };
  const cancelEditQuestion = () => {
    setEditingQuestion(null);
    setEditQuestionDraft({});
  };

  // Preview/fill-out mode handlers
  const handleResponseChange = (catId: number, qId: number, value: any) => {
    setFormResponses(prev => ({
      ...prev,
      [qId]: value
    }));
  };

  // Add back the handleDeleteQuestion function
  const handleDeleteQuestion = async (catIdx: number, qIdx: number) => {
    try {
      const questionId = categories[catIdx].questions[qIdx].id;
      const res = await fetch(`http://127.0.0.1:8000/api/tracker/delete-question/${questionId}/`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setCategories(cats => cats.map((cat, i) =>
          i === catIdx
            ? { ...cat, questions: cat.questions.filter((_, idx) => idx !== qIdx) }
            : cat
        ));
      } else {
        alert(data.message || 'Failed to delete question');
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question. Please try again.');
    }
  };

  // Helper: get flat list of all questions with their number
  const getFlatQuestions = () => {
    const flat: { catIdx: number; qIdx: number; number: number }[] = [];
    let num = 1;
    categories.forEach((cat, catIdx) => {
      cat.questions.forEach((_, qIdx) => {
        flat.push({ catIdx, qIdx, number: num++ });
      });
    });
    return flat;
  };
  const flatQuestions = getFlatQuestions();
  const getQuestionNumber = (catIdx: number, qIdx: number) => {
    const found = flatQuestions.find(fq => fq.catIdx === catIdx && fq.qIdx === qIdx);
    return found ? found.number : '';
  };

  // Helper: get input type and validation for special text questions
  const getInputProps = (q: QuestionItem) => {
    const text = q.text.toLowerCase();
    if (text.includes('phone') || text.includes('contact')) {
      return { type: 'tel', pattern: '^(09|\+639)\d{9}$|^\d{7}$', placeholder: 'e.g. 09123456789 or 1234567', validate: (v: string) => /^(09|\+639)\d{9}$|^\d{7}$/.test(v) ? '' : 'Invalid Philippine phone/landline number.' };
    }
    if (text.includes('email')) {
      return { type: 'email', placeholder: 'e.g. user@email.com', validate: (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'Invalid email address.' };
    }
    if (text.includes('birth') || text.includes('bday')) {
      return { type: 'date', placeholder: 'YYYY-MM-DD', validate: (v: string) => v ? '' : 'Birthday required.' };
    }
    if (text.includes('facebook') || text.includes('twitter') || text.includes('instagram') || text.includes('linkedin') || text.includes('social')) {
      return { type: 'url', placeholder: 'https://socialmedia.com/yourprofile', validate: (v: string) => /^https?:\/\//.test(v) ? '' : 'Invalid URL.' };
    }
    return { type: 'text', placeholder: '', validate: (_: string) => '' };
  };

  // Fetch questions from backend
  const fetchQuestions = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/tracker/questions/');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data && data.categories) {
        setCategories(data.categories);
      } else {
        console.warn('No categories data received or invalid format');
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Failed to load questions. Please refresh the page and try again.');
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Use previewModeFromParent to force preview mode if provided
  useEffect(() => {
    if (previewModeFromParent) setPreviewMode(true);
  }, [previewModeFromParent]);

  // Fetch user details for prefill
  useEffect(() => {
    if (userId) {
      fetchAlumniDetails(userId).then(res => {
        if (res.success) setUserDetails(res.alumni);
      });
    }
  }, [userId]);

  const navigate = useNavigate();

  // Add this function inside the Question component
  const handleSubmit = async () => {
    try {
      // Create FormData for file uploads
      const formData = new FormData();
      
      // Add user_id and answers
      if (userId) formData.append('user_id', userId);
      
      // Process answers and handle file uploads
      const processedAnswers: Record<string, any> = {};
      
      for (const [questionId, answer] of Object.entries(formResponses)) {
        if (answer instanceof File) {
          // This is a file upload
          processedAnswers[questionId] = { type: 'file' };
          formData.append(`file_${questionId}`, answer);
        } else {
          // This is a regular answer
          processedAnswers[questionId] = answer;
        }
      }
      
      formData.append('answers', JSON.stringify(processedAnswers));
      
      const res = await fetch('http://127.0.0.1:8000/api/tracker/responses/', {
        method: 'POST',
        body: formData, // Don't set Content-Type header, let browser set it with boundary
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        const fileMessage = data.files_uploaded > 0 ? ` and ${data.files_uploaded} file(s) uploaded` : '';
        alert(`Form submitted successfully!${fileMessage}`);
        navigate('/alumni/dashboard');
      } else {
        alert('Submission failed: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Submission failed. Please check your connection and try again.');
    }
  };

  // Helper to map question text to user field name
  function userFieldForQuestion(text: string): string {
    const map: Record<string, string> = {
      'first name': 'first_name',
      'middle name': 'middle_name',
      'last name': 'last_name',
      'ctu id': 'ctu_id',
      'course': 'course',
      'program': 'program',
      'batch': 'batch',
      'status': 'status',
      'gender': 'gender',
      'birthdate': 'birthdate',
      'phone': 'phone',
      'address': 'address',
      'email': 'email',
      'civil status': 'civil_status',
      'age': 'age',
      'social media': 'social_media',
      'school name': 'school_name',
    };
    const key = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    for (const label in map) {
      if (key.includes(label)) return map[label];
    }
    return '';
  }

  // Helper to ensure date is always in YYYY-MM-DD format
  function toYYYYMMDD(dateStr: string) {
    if (!dateStr) return '';
    dateStr = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    // Try to parse with Date if possible
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return '';
  }

  function getPrefilledValue(q: QuestionItem): any {
    const text = q.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Always use User model for course, batch, birthdate, phone
    if (userDetails) {
      if (text.includes('course')) return userDetails['course'] || '';
      if (text.includes('yeargraduated') || text.includes('batch')) return userDetails['batch'] || '';
      if (
        text.includes('birth') ||
        text.includes('bday') ||
        text.includes('dateofbirth') ||
        text.includes('dob') ||
        text.includes('birthday') ||
        text.includes('birthdate')
      ) return toYYYYMMDD(userDetails['birthdate'] || '');
      if (
        text.includes('phone') ||
        text.includes('contact') ||
        text.includes('mobile')
      ) return userDetails['phone'] || '';
    }
    
    // For company address question, don't autofill but allow user input
    if (text.includes('companyaddress') && text.includes('employer') && text.includes('graduation')) {
      return formResponses[q.id] !== undefined ? formResponses[q.id] : '';
    }
    
    // Otherwise, use tracker answer if present, else user model fallback
    return formResponses[q.id] !== undefined ? formResponses[q.id] : (userDetails ? userDetails[userFieldForQuestion(q.text)] || '' : '');
  }
  function isReadOnlyField(q: QuestionItem): boolean {
    const text = q.text.toLowerCase();
    return text.includes('course') || text.includes('year graduated') || text.includes('batch');
  }

  return (
    <div className="tracker-container">
      <div className="tracker-inner">
        {previewModeFromParent ? null : (
          <button className="action-button" onClick={() => setPreviewMode(!previewMode)} style={{ marginBottom: 16 }}>
            {previewMode ? 'Back to Edit' : 'Preview/Fill Out Form'}
          </button>
        )}
        {previewMode ? (
          <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
            {categories.length === 0 && <p style={{ color: '#888' }}>No categories/questions to display.</p>}
            {categories.filter(cat => shouldShowCategory(cat)).map((cat, catIdx) => (
              <div key={cat.id} style={{ marginBottom: 32 }}>
                <h2>{cat.title}</h2>
                <p>{cat.description}</p>
                {/* Show conditional indicator for employment and study sections */}
                {(cat.title.toLowerCase().includes('employment status') || 
                  cat.title.toLowerCase().includes('unemployed') || 
                  cat.title.toLowerCase().includes('further study'))}
                {cat.questions.map((q, qIdx) => (
                  <div key={q.id} style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 500 }}>{getQuestionNumber(catIdx, qIdx)}. {q.text}</label>
                    <div>
                      {q.type === 'text' && (() => {
                        const inputProps = getInputProps(q);
                        return (
                          <>
                            <input
                              type={inputProps.type}
                              value={getPrefilledValue(q)}
                              readOnly={isReadOnlyField(q)}
                              placeholder={inputProps.placeholder}
                              pattern={inputProps.pattern}
                              onChange={e => {
                                handleResponseChange(cat.id, q.id, e.target.value);
                                // Validate on change
                                const err = inputProps.validate(e.target.value);
                                setValidationErrors(prev => ({ ...prev, [`${q.id}`]: err }));
                              }}
                              style={{ width: '100%', marginTop: 4 }}
                            />
                            {validationErrors[`${q.id}`] && (
                              <div style={{ color: 'red', fontSize: 12 }}>{validationErrors[`${q.id}`]}</div>
                            )}
                          </>
                        );
                      })()}
                      {q.type === 'file' && (
                        <div className="file-upload-container">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                            onChange={e => {
                              const file = e.target.files && e.target.files[0];
                              if (file) {
                                // Validate file size (10MB)
                                if (file.size > 10 * 1024 * 1024) {
                                  alert('File size must be less than 10MB');
                                  e.target.value = '';
                                  return;
                                }
                                
                                // Validate file type
                                const allowedTypes = [
                                  'application/pdf',
                                  'application/msword',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'image/jpeg',
                                  'image/jpg',
                                  'image/png',
                                  'image/gif'
                                ];
                                
                                if (!allowedTypes.includes(file.type)) {
                                  alert('Please select a valid file type: PDF, DOC, DOCX, JPG, PNG, or GIF');
                                  e.target.value = '';
                                  return;
                                }
                              }
                              handleResponseChange(cat.id, q.id, file);
                            }}
                          />
                          {formResponses[q.id] && (
                            <div className="file-info">
                              <strong>Selected file:</strong> {formResponses[q.id].name} 
                              ({(formResponses[q.id].size / 1024 / 1024).toFixed(2)} MB)
                            </div>
                          )}
                        </div>
                      )}
                      {q.type === 'radio' && q.options && q.options.map(opt => (
                        <label key={opt} style={{ marginRight: 12 }}>
                          <input
                            type="radio"
                            name={`${cat.id}_${q.id}`}
                            value={opt}
                            checked={formResponses[q.id] === opt}
                            onChange={e => handleResponseChange(cat.id, q.id, opt)}
                          />{' '}{opt}
                        </label>
                      ))}
                      {q.type === 'checkbox' && q.options && q.options.map(opt => (
                        <label key={opt} style={{ marginRight: 12 }}>
                          <input
                            type="checkbox"
                            value={opt}
                            checked={Array.isArray(formResponses[q.id]) && formResponses[q.id].includes(opt)}
                            onChange={e => {
                              const prev = Array.isArray(formResponses[q.id]) ? formResponses[q.id] : [];
                              if (e.target.checked) {
                                handleResponseChange(cat.id, q.id, [...prev, opt]);
                              } else {
                                handleResponseChange(cat.id, q.id, prev.filter((v: string) => v !== opt));
                              }
                            }}
                          />{' '}{opt}
                        </label>
                      ))}
                      {q.type === 'multiple' && q.options && (
                        <select
                          value={formResponses[q.id] || ''}
                          onChange={e => handleResponseChange(cat.id, q.id, e.target.value)}
                          style={{ width: '100%', marginTop: 4 }}
                        >
                          <option value="">Select...</option>
                          {q.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {/* Only one submit button at the end of the form */}
            {categories.length > 0 && (
              <button type="submit" className="action-button">Submit</button>
            )}
          </form>
        ) : (
          <>
            {categories.map((cat, catIdx) => (
              <div className="card" key={cat.id} style={{ marginBottom: 24 }}>
                {editingCategoryIndex === catIdx ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginRight: 8 }}>
                      <label style={{ fontWeight: 500, marginBottom: 2 }}>Category Title</label>
                      <input
                        type="text"
                        name="title"
                        value={editCategoryDraft.title || ''}
                        onChange={handleEditCategoryChange}
                        placeholder="Enter category title"
                        style={{ width: '100%', marginBottom: 8 }}
                      />
                      <label style={{ fontWeight: 500, marginBottom: 2 }}>Category Description</label>
                      <textarea
                        name="description"
                        value={editCategoryDraft.description || ''}
                        onChange={handleEditCategoryChange}
                        placeholder="Enter category description"
                        style={{ width: '100%', marginBottom: 8 }}
                        rows={2}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <button className="button-cancel" onClick={cancelEditCategory}>Cancel</button>
                      <button className="button-update" onClick={() => handleUpdateCategory(catIdx)}>Update</button>
                    </div>
                    {/* The rest of the card (questions, add question, etc.) remains visible below */}
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2>{cat.title}</h2>
                        <p>{cat.description}</p>
                      </div>
                      <div>
                        <button className="button-edit" onClick={() => { setEditingCategoryIndex(catIdx); setEditCategoryDraft({ ...categories[catIdx] }); }} style={{ marginRight: 8 }}>Edit</button>
                        <button className="button-delete" onClick={() => handleDeleteCategory(catIdx)}>Delete</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      {addingQuestionCatIdx === catIdx ? (
                        <div className="card question-box" style={{ marginBottom: 8, background: '#f5f5f5' }}>
                          <input
                            type="text"
                            name="text"
                            placeholder="Question text"
                            value={newQuestionDraft.text || ''}
                            onChange={handleAddQuestionChange}
                            style={{ width: '100%', marginBottom: 8 }}
                          />
                          <select name="type" value={newQuestionDraft.type} onChange={handleAddQuestionChange} style={{ width: '100%', marginBottom: 8 }}>
                            {QUESTION_TYPES.map(qt => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                          </select>
                          {newQuestionDraft.type !== 'text' && (
                            <div style={{ marginBottom: 8 }}>
                              <label>Options:</label>
                              {(newQuestionDraft.options || []).map((opt, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={e => handleAddQuestionOptionChange(i, e.target.value)}
                                    style={{ flex: 1, marginRight: 4 }}
                                  />
                                  <button onClick={() => removeNewQuestionOption(i)} disabled={newQuestionDraft.options!.length <= 1}>Remove</button>
                                </div>
                              ))}
                              <button onClick={addNewQuestionOption}>Add Option</button>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="button-cancel" onClick={cancelAddQuestion} style={{ marginRight: 8 }}>Cancel</button>
                            <button className="button-add" onClick={() => handleSaveNewQuestion(catIdx)}>Add</button>
                          </div>
                        </div>
                      ) : (
                        <button className="action-button" onClick={() => setAddingQuestionCatIdx(catIdx)} style={{ marginBottom: 8 }}>Add Question</button>
                      )}
                      {cat.questions.length === 0 && <p style={{ color: '#888' }}>No questions yet.</p>}
                      {cat.questions.map((q, qIdx) => (
                        <div className="card question-box" key={q.id} style={{ marginBottom: 8 }}>
                          {editingQuestion && editingQuestion.catIdx === catIdx && editingQuestion.qIdx === qIdx ? (
                            <>
                              <div style={{ marginBottom: 8, fontWeight: 600 }}>
                                Editing Question {getQuestionNumber(catIdx, qIdx)}: "{categories[catIdx].questions[qIdx].text}"
                              </div>
                              <input
                                type="text"
                                name="text"
                                value={editQuestionDraft.text || ''}
                                onChange={handleEditQuestionChange}
                                style={{ width: '100%', marginBottom: 8 }}
                              />
                              <select name="type" value={editQuestionDraft.type} onChange={handleEditQuestionChange} style={{ width: '100%', marginBottom: 8 }}>
                                {QUESTION_TYPES.map(qt => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                              </select>
                              {editQuestionDraft.type !== 'text' && (
                                <div style={{ marginBottom: 8 }}>
                                  <label>Options:</label>
                                  {(editQuestionDraft.options || []).map((opt, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={e => handleEditQuestionOptionChange(i, e.target.value)}
                                        style={{ flex: 1, marginRight: 4 }}
                                      />
                                      <button onClick={() => removeEditQuestionOption(i)} disabled={editQuestionDraft.options!.length <= 1}>Remove</button>
                                    </div>
                                  ))}
                                  <button onClick={addEditQuestionOption}>Add Option</button>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="button-cancel" onClick={cancelEditQuestion} style={{ marginRight: 8 }}>Cancel</button>
                                <button className="button-update" onClick={() => handleUpdateQuestion(catIdx, qIdx)}>Update</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <h3>{getQuestionNumber(catIdx, qIdx)}. {q.text}</h3>
                              <p>Type: {QUESTION_TYPES.find(t => t.value === q.type)?.label}</p>
                              {q.options && q.options.length > 0 && (
                                <ul>
                                  {q.options.map((opt, i) => <li key={i}>{opt}</li>)}
                                </ul>
                              )}
                              <button className="button-edit" onClick={() => openEditQuestionInline(catIdx, qIdx)} style={{ marginRight: 8 }}>Edit</button>
                              <button className="button-delete" onClick={() => handleDeleteQuestion(catIdx, qIdx)}>Delete</button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
            {addingCategory ? (
              <div className="card" style={{ marginBottom: 24, background: '#f5f5f5' }}>
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginRight: 8 }}>
                  <label style={{ fontWeight: 500, marginBottom: 2 }}>Category Title</label>
          <input
            type="text"
                    name="title"
                    value={newCategoryDraft.title || ''}
                    onChange={handleAddCategoryChange}
                    placeholder="Enter category title"
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                  <label style={{ fontWeight: 500, marginBottom: 2 }}>Category Description</label>
          <textarea
                    name="description"
                    value={newCategoryDraft.description || ''}
                    onChange={handleAddCategoryChange}
                    placeholder="Enter category description"
                    style={{ width: '100%', marginBottom: 8 }}
                    rows={2}
          />
        </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <button className="button-cancel" onClick={cancelAddCategory}>Cancel</button>
                  <button className="button-add" onClick={handleSaveNewCategory}>Add</button>
        </div>
        </div>
            ) : (
              <button className="action-button" onClick={() => setAddingCategory(true)} style={{ marginTop: 16 }}>Add Category</button>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default Question;

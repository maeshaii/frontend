import React, { useState, useEffect, ChangeEvent, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import './Tracker.css';
import { trackerApi } from '../../../services/trackerApi';
import { fetchAlumniDetails } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import allJobs from '../../../all_jobs.json';
import JobTitleAutocomplete from '../../../components/JobTitleAutocomplete';

interface JobRaw {
  [key: string]: any;
}

interface JobItem {
  title: string;
  code: string;
}

const jobList: JobItem[] = (allJobs as JobRaw[]).map((j) => {
  // Try both normal and weirdly encoded keys
  const title =
    j['Job Title'] || j['\u0000J\u0000o\u0000b\u0000 \u0000T\u0000i\u0000t\u0000l\u0000e\u0000'];
  const code = j['Job Code'] || j['\u0000J\u0000o\u0000b\u0000 \u0000C\u0000o\u0000d\u0000e\u0000'];
  return { title, code };
});

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
  required?: boolean;
  order?: number;
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
  const queryClient = useQueryClient();
  const questionsQuery = useQuery({
    queryKey: ['tracker', 'questions'],
    queryFn: async () => {
      const data = await trackerApi.getQuestions();
      return data && data.categories ? data.categories : [];
    },
  });
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editCategoryDraft, setEditCategoryDraft] = useState<Partial<CategoryItem>>({});
  // const [newQuestion, setNewQuestion] = useState<Partial<QuestionItem>>({ text: '', type: 'text', options: [''] });
  // const [questionCatIdx, setQuestionCatIdx] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(!!previewModeFromParent);
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});
  const [userDetails, setUserDetails] = useState<Record<string, any> | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const newCategoryRef = useRef<HTMLDivElement>(null);
  
  // Auto-save states
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | null>(null);
  const [draftCheckComplete, setDraftCheckComplete] = useState(false); // Whether we checked for draft
  const [hasDraftData, setHasDraftData] = useState(false); // Whether draft had data
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (questionsQuery.data) {
      // Handle both direct array and object with categories property
      let categoriesData;
      if (Array.isArray(questionsQuery.data)) {
        categoriesData = questionsQuery.data as CategoryItem[];
      } else if (questionsQuery.data.categories) {
        categoriesData = questionsQuery.data.categories as CategoryItem[];
      }
      
      if (categoriesData) {
        // Sort questions within each category by order
        const sortedCategories = categoriesData.map(cat => ({
          ...cat,
          questions: cat.questions.sort((a, b) => (a.order || 0) - (b.order || 0))
        }));
        setCategories(sortedCategories);
      }
    }
  }, [questionsQuery.data]);

  // Debug: Log when categories state changes
  useEffect(() => {
    console.log('🔍 Categories state updated:', categories);
  }, [categories]);

  // Helper function to sanitize loaded draft data
  // IMPORTANT: Preserve file upload markers ({ type: 'file', uploaded: true, ... })
  const sanitizeDraftData = (answers: Record<string, any>): Record<string, any> => {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(answers)) {
      // Skip null, undefined
      if (value === null || value === undefined) continue;
      
      // PRESERVE file markers (indicate files were uploaded but lost after refresh)
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Check if it's a file marker (has 'type' and 'uploaded' keys)
        if (value.type === 'file' && value.uploaded === true) {
          // This is a file marker - PRESERVE IT
          sanitized[key] = value;
          console.log(`✅ Web: Preserved file marker for question ${key}:`, value);
          continue;
        }
        // Skip empty objects (but file markers are not empty)
        if (Object.keys(value).length === 0) {
          console.warn(`⚠️ Skipping empty object for question ${key}`);
          continue;
        }
      }
      
      // Skip empty strings (but keep "0", spaces, etc.)
      if (typeof value === 'string' && value.trim() === '') continue;
      
      // Keep valid values (strings, numbers, booleans, arrays, non-empty objects)
      sanitized[key] = value;
    }
    
    return sanitized;
  };

  // Load saved draft on mount (only in preview mode with userId)
  useEffect(() => {
    if (previewMode && userId && !draftCheckComplete && categories.length > 0) {
      const loadDraft = async () => {
        try {
          console.log('🔄 Checking for saved draft for user:', userId);
          const response = await trackerApi.loadDraft(userId);
          
          if (response.success && response.has_draft && Object.keys(response.answers).length > 0) {
            console.log('✅ Web: Draft found with', Object.keys(response.answers).length, 'answers - loading...');
            console.log('📋 Web: Draft answers:', JSON.stringify(response.answers, null, 2));
            
            // SANITIZE: Clean any invalid values before setting state
            const sanitizedAnswers = sanitizeDraftData(response.answers);
            console.log(`🧹 Web: Sanitized ${Object.keys(response.answers).length - Object.keys(sanitizedAnswers).length} invalid values`);
            
            // Restore award documents state from file markers if needed
            const restoredAwardDocs: { [questionId: number]: File[] } = {};
            for (const [key, value] of Object.entries(sanitizedAnswers)) {
              if (value && typeof value === 'object' && !Array.isArray(value) && value.type === 'file' && value.multiple === true && value.uploaded === true) {
                const questionId = parseInt(key);
                const question = categories.flatMap(cat => cat.questions).find(q => q.id === questionId);
                const lowerText = question?.text.toLowerCase() || '';
                const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                              (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
                if (isAwardSupportingDocs) {
                  // Create empty slots for files that were uploaded but lost
                  restoredAwardDocs[questionId] = Array(value.count || 1).fill(null);
                  console.log(`📋 Web: Restored award documents state for question ${key} (${value.count} files were uploaded)`);
                }
              }
            }
            if (Object.keys(restoredAwardDocs).length > 0) {
              setAwardDocuments(prev => ({ ...prev, ...restoredAwardDocs }));
            }
            
            setFormResponses(sanitizedAnswers);
            setSaveStatus('saved');
            setHasDraftData(true); // Prevents user data from overwriting
            console.log('✅ Web: Draft loaded with file markers preserved');
          } else {
            console.log('ℹ️ No saved draft found');
            setHasDraftData(false); // Will allow user data to load
          }
          setDraftCheckComplete(true); // Mark check as complete
        } catch (error) {
          console.error('❌ Error loading draft:', error);
          setHasDraftData(false);
          setDraftCheckComplete(true); // Mark check as complete even on error
        }
      };
      
      loadDraft();
    }
  }, [previewMode, userId, draftCheckComplete, categories]);

  // Auto-save formResponses (debounced - saves 3 seconds after last change)
  useEffect(() => {
    if (!previewMode || !userId || !draftCheckComplete) {
      return; // Don't auto-save in edit mode or before draft check is complete
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Don't auto-save if there are no responses
    if (Object.keys(formResponses).length === 0) {
      return;
    }

    // Set status to unsaved
    setSaveStatus('unsaved');

    // Debounce: save 3 seconds after last change
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        console.log('💾 Web: Auto-saving draft...');
        console.log('📋 Web: Total responses to save:', Object.keys(formResponses).length);
        
        // Save draft responses - INCLUDING file markers (file markers indicate files were uploaded)
        // Note: Actual File objects can't be saved, but markers can be saved to remember uploads after refresh
        const draftResponses: Record<string, any> = {};
        let fileMarkerCount = 0;
        
        for (const [key, value] of Object.entries(formResponses)) {
          // Skip actual File objects (can't be serialized to JSON)
          if (value instanceof File) {
            // This is an actual File object - skip it but save a marker
            draftResponses[key] = { type: 'file', uploaded: true, filename: value.name };
            fileMarkerCount++;
            console.log(`✅ Web: Saving file marker for question ${key}:`, { type: 'file', uploaded: true, filename: value.name });
            continue;
          }
          
          // Check if it's an array of Files (for multiple file uploads)
          if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
            const validFiles = value.filter(f => f instanceof File);
            if (validFiles.length > 0) {
              draftResponses[key] = { type: 'file', multiple: true, uploaded: true, count: validFiles.length };
              fileMarkerCount++;
              console.log(`✅ Web: Saving multiple file marker for question ${key}:`, { type: 'file', multiple: true, uploaded: true, count: validFiles.length });
              continue;
            }
          }
          
          // Keep file markers (already in marker format)
          if (value && typeof value === 'object' && !Array.isArray(value) && value.type === 'file' && value.uploaded === true) {
            draftResponses[key] = value;
            fileMarkerCount++;
            console.log(`✅ Web: Keeping existing file marker for question ${key}:`, value);
            continue;
          }
          
          // Save all other responses (including file markers)
          draftResponses[key] = value;
        }
        
        console.log(`💾 Web: Saving ${Object.keys(draftResponses).length} responses (${fileMarkerCount} file markers)`);
        await trackerApi.saveDraft(userId, draftResponses);
        
        setSaveStatus('saved');
        console.log('✅ Web: Draft auto-saved successfully');
        
        // Reset to null after 2 seconds
        setTimeout(() => {
          setSaveStatus(null);
        }, 2000);
      } catch (error) {
        console.error('❌ Web: Auto-save failed:', error);
        setSaveStatus('unsaved');
      }
    }, 3000); // 3 second debounce

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formResponses, previewMode, userId, draftCheckComplete]);

  // Load existing user data into formResponses when userId is available
  // BUT: Don't overwrite if draft data was found!
  useEffect(() => {
    if (userId && userDetails && categories.length > 0 && draftCheckComplete && !hasDraftData) {
      console.log('🔍 No draft found, loading user profile data into form for user:', userId);
      
      const initialResponses: Record<string, any> = {};
      
      // Map user data to question IDs
      for (const category of categories) {
        for (const question of category.questions) {
          const questionText = question.text.toLowerCase();
          
          // Map basic user info
          if (questionText.includes('first name')) {
            initialResponses[question.id] = userDetails.first_name || userDetails.f_name || '';
          } else if (questionText.includes('last name')) {
            initialResponses[question.id] = userDetails.last_name || userDetails.l_name || '';
          } else if (questionText.includes('middle name')) {
            initialResponses[question.id] = userDetails.middle_name || userDetails.m_name || '';
          } else if (questionText.includes('email')) {
            initialResponses[question.id] = userDetails.email || 'N/A';
          } else if (questionText.includes('birthdate') || questionText.includes('birth date')) {
            // Format birthdate properly for input field
            if (userDetails.birthdate) {
              const date = new Date(userDetails.birthdate);
              const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
              initialResponses[question.id] = formattedDate;
            } else {
              initialResponses[question.id] = '';
            }
          } else if (questionText.includes('age')) {
            // Calculate age from birthdate if not provided
            if (userDetails.age) {
              initialResponses[question.id] = userDetails.age;
            } else if (userDetails.birthdate) {
              const birthDate = new Date(userDetails.birthdate);
              const today = new Date();
              const age = today.getFullYear() - birthDate.getFullYear() - 
                ((today.getMonth() < birthDate.getMonth()) ? 1 : 0) - 
                ((today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
              initialResponses[question.id] = age.toString();
            } else {
              initialResponses[question.id] = '';
            }
          } else if (questionText.includes('phone') || questionText.includes('mobile') || questionText.includes('landline')) {
            initialResponses[question.id] = userDetails.phone || userDetails.phone_num || '';
          } else if (questionText.includes('address') && !questionText.includes('company')) {
            initialResponses[question.id] = userDetails.address || '';
          } else if (questionText.includes('civil status')) {
            initialResponses[question.id] = userDetails.civil_status || 'N/A';
          } else if (questionText.includes('social media')) {
            initialResponses[question.id] = userDetails.social_media || 'N/A';
          } else if (questionText.includes('program graduated')) {
            initialResponses[question.id] = userDetails.program || '';
          } else if (questionText.includes('year graduated') || questionText.includes('graduated')) {
            initialResponses[question.id] = userDetails.year_graduated || userDetails.batch || '';
          } else if (questionText.includes('current position')) {
            // Don't pre-fill position - let user answer
            // This prevents OJT data from affecting current employment
            initialResponses[question.id] = '';
          } else if (questionText.includes('current company')) {
            // Don't pre-fill company name - let user answer
            // This prevents OJT data from affecting current employment
            initialResponses[question.id] = '';
          } else if (questionText.includes('employment sector')) {
            initialResponses[question.id] = userDetails.sector_current || 'N/A';
          } else if (questionText.includes('scope') && questionText.includes('job')) {
            initialResponses[question.id] = userDetails.scope_current || 'N/A';
          } else if (questionText.includes('salary')) {
            initialResponses[question.id] = userDetails.salary_current || 'N/A';
          } else if (questionText.includes('presently employed')) {
            // Don't pre-fill employment status - let user answer
            // This prevents OJT data from affecting employment status
            initialResponses[question.id] = '';
          } else if (questionText.includes('self employed')) {
            initialResponses[question.id] = userDetails.self_employed ? 'Yes' : 'No';
          }
        }
      }
      
      console.log('🔍 User profile data loaded:', Object.keys(initialResponses).length, 'fields');      
      setFormResponses(initialResponses);
    }
  }, [userId, userDetails, categories, draftCheckComplete, hasDraftData]);

  // Show privacy modal when component loads in preview mode
  useEffect(() => {
    if (previewMode && !privacyAccepted) {
      setShowPrivacyModal(true);
    }
  }, [previewMode, privacyAccepted]);


  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (showPrivacyModal) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Disable scrolling
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Re-enable scrolling
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showPrivacyModal]);

  // Add validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // New state for job alignment question
  const [customJobInputs, setCustomJobInputs] = useState<{ [questionId: string]: boolean }>({});
  const [jobInputValues, setJobInputValues] = useState<{ [questionId: string]: string }>({});
  const [jobAlignment, setJobAlignment] = useState<Record<string, string>>({});
  
  // State for multiple award documents (question 31)
  const [awardDocuments, setAwardDocuments] = useState<{ [questionId: number]: File[] }>({});

  // Conditional rendering logic
  const shouldShowCategory = (category: CategoryItem) => {
    // Check if this is "PART III: EMPLOYMENT STATUS" category
    if (category.title.toLowerCase().includes('employment status')) {
      // Show if "Are you PRESENTLY employed?" is answered "Yes"
      const employmentQuestion = categories.find((cat) =>
        cat.questions.some((q) => q.text.toLowerCase().includes('presently employed'))
      );
      if (employmentQuestion) {
        const employmentQuestionId = employmentQuestion.questions.find((q) =>
          q.text.toLowerCase().includes('presently employed')
        )?.id;
        return formResponses[employmentQuestionId!] === 'Yes';
      }
    }

    // Check if this is "IF UNEMPLOYED" category
    if (category.title.toLowerCase().includes('unemployed')) {
      // Show if "Are you PRESENTLY employed?" is answered "No"
      const employmentQuestion = categories.find((cat) =>
        cat.questions.some((q) => q.text.toLowerCase().includes('presently employed'))
      );
      if (employmentQuestion) {
        const employmentQuestionId = employmentQuestion.questions.find((q) =>
          q.text.toLowerCase().includes('presently employed')
        )?.id;
        return formResponses[employmentQuestionId!] === 'No';
      }
    }

    // Check if this is "PART IV: FURTHER STUDY" category
    if (category.title.toLowerCase().includes('further study')) {
      // Show if "Did you pursue futher study?" is answered "Yes"
      const studyQuestion = categories.find((cat) =>
        cat.questions.some((q) => {
          const t = q.text.toLowerCase();
          return t.includes('pursue') && t.includes('study');
        })
      );
      if (studyQuestion) {
        const studyQuestionId = studyQuestion.questions.find((q) => {
          const t = q.text.toLowerCase();
          return t.includes('pursue') && t.includes('study');
        })?.id;
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
      const data = await trackerApi.updateCategory(categoryId, {
        title: editCategoryDraft.title,
        description: editCategoryDraft.description || '',
      });

      if (data.success) {
        setCategories((cats) =>
          cats.map((cat, i) => (i === catIdx ? { ...cat, ...data.category } : cat))
        );
        setEditingCategoryIndex(null);
        setEditCategoryDraft({});
        await queryClient.invalidateQueries({ queryKey: ['tracker', 'questions'] });
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
      const data = await trackerApi.deleteCategory(categoryId);

      if (data.success) {
        setCategories((cats) => cats.filter((_, i) => i !== catIdx));
        await queryClient.invalidateQueries({ queryKey: ['tracker', 'questions'] });
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
  const [newCategoryDraft, setNewCategoryDraft] = useState<Partial<CategoryItem>>({
    title: '',
    description: '',
  });

  // Auto-scroll to new category when adding
  useEffect(() => {
    if (addingCategory && newCategoryRef.current) {
      newCategoryRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [addingCategory]);

  const handleAddCategoryChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewCategoryDraft({ ...newCategoryDraft, [e.target.name]: e.target.value });
  };
  const handleSaveNewCategory = async () => {
    if (!newCategoryDraft.title) return;
    try {
      const data = await trackerApi.addCategory({
        title: newCategoryDraft.title,
        description: newCategoryDraft.description || '',
      });

      if (data.success) {
        setCategories((cats) => [...cats, data.category]);
        setAddingCategory(false);
        setNewCategoryDraft({ title: '', description: '' });
        await queryClient.invalidateQueries({ queryKey: ['tracker', 'questions'] });
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
    // Scroll to top when canceling - try multiple methods
    setTimeout(() => {
      // Try scrolling the main container first
      const container = document.querySelector('.tracker-container');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Fallback to window scroll
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  // Add state for adding question
  const [addingQuestionCatIdx, setAddingQuestionCatIdx] = useState<number | null>(null);
  const [newQuestionDraft, setNewQuestionDraft] = useState<Partial<QuestionItem>>({
    text: '',
    type: 'text',
    options: [''],
    required: false,
  });

  const handleAddQuestionChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setNewQuestionDraft({ ...newQuestionDraft, [name]: checked });
    } else {
      setNewQuestionDraft({ ...newQuestionDraft, [name]: value });
    }
  };
  const handleAddQuestionOptionChange = (idx: number, value: string) => {
    if (!newQuestionDraft.options) return;
    const updated = [...newQuestionDraft.options];
    updated[idx] = value;
    setNewQuestionDraft({ ...newQuestionDraft, options: updated });
  };
  const addNewQuestionOption = () =>
    setNewQuestionDraft({
      ...newQuestionDraft,
      options: [...(newQuestionDraft.options || []), ''],
    });
  const removeNewQuestionOption = (idx: number) => {
    if (!newQuestionDraft.options) return;
    const updated = newQuestionDraft.options.filter((_, i) => i !== idx);
    setNewQuestionDraft({ ...newQuestionDraft, options: updated });
  };
  const handleSaveNewQuestion = async (catIdx: number) => {
    if (!newQuestionDraft.text || !newQuestionDraft.type) return;
    try {
      const questionData = {
        category_id: categories[catIdx].id,
        text: newQuestionDraft.text,
        type: newQuestionDraft.type,
        options:
          newQuestionDraft.type !== 'text' ? newQuestionDraft.options?.filter((opt) => opt) : [],
        required: newQuestionDraft.required || false,
        order: categories[catIdx].questions.length, // Set order to end of current questions
      };
      console.log('Sending question data:', questionData);  // Debug print
      const data = await trackerApi.addQuestion(questionData);
      console.log('Received response:', data);  // Debug print

      if (data.success) {
        setCategories((cats) =>
          cats.map((cat, i) =>
            i === catIdx ? { ...cat, questions: [...cat.questions, data.question] } : cat
          )
        );
        setAddingQuestionCatIdx(null);
        setNewQuestionDraft({ text: '', type: 'text', options: [''], required: false });
        await queryClient.invalidateQueries({ queryKey: ['tracker', 'questions'] });
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
    setNewQuestionDraft({ text: '', type: 'text', options: [''], required: false });
  };

  // Add state for editing a question inline
  const [editingQuestion, setEditingQuestion] = useState<{ catIdx: number; qIdx: number } | null>(
    null
  );
  const [editQuestionDraft, setEditQuestionDraft] = useState<Partial<QuestionItem>>({});

  const openEditQuestionInline = (catIdx: number, qIdx: number) => {
    const question = categories[catIdx].questions[qIdx];
    console.log('🔍 Opening edit for question:', question);
    setEditingQuestion({ catIdx, qIdx });
    setEditQuestionDraft({ ...question });
  };
  const handleEditQuestionChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      console.log('🔍 Checkbox change:', name, checked);
      setEditQuestionDraft({ ...editQuestionDraft, [name]: checked });
    } else {
      setEditQuestionDraft({ ...editQuestionDraft, [name]: value });
    }
  };
  const handleEditQuestionOptionChange = (idx: number, value: string) => {
    if (!editQuestionDraft.options) return;
    const updated = [...editQuestionDraft.options];
    updated[idx] = value;
    setEditQuestionDraft({ ...editQuestionDraft, options: updated });
  };
  const addEditQuestionOption = () =>
    setEditQuestionDraft({
      ...editQuestionDraft,
      options: [...(editQuestionDraft.options || []), ''],
    });
  const removeEditQuestionOption = (idx: number) => {
    if (!editQuestionDraft.options) return;
    const updated = editQuestionDraft.options.filter((_, i) => i !== idx);
    setEditQuestionDraft({ ...editQuestionDraft, options: updated });
  };
  const handleUpdateQuestion = async (catIdx: number, qIdx: number) => {
    try {
      const questionId = categories[catIdx].questions[qIdx].id;
      // Build payload defensively: only include fields that are intentionally set/changed
      const updateData: any = {
        text: editQuestionDraft.text,
        type: editQuestionDraft.type,
      };
      if (editQuestionDraft.type && editQuestionDraft.type !== 'text') {
        updateData.options = (editQuestionDraft.options || []).filter((opt) => !!opt);
      } else if ('options' in editQuestionDraft) {
        // If text type and options present in draft, clear them explicitly
        updateData.options = [];
      }
      if (typeof editQuestionDraft.required === 'boolean') {
        updateData.required = editQuestionDraft.required;
      }
      console.log('🔍 Updating question with data:', updateData);
      
      const data = await trackerApi.updateQuestion(questionId, updateData);
      console.log('🔍 API response:', data);

      if (data.success) {
        console.log('🔍 Updating local state with question:', data.question);
        setCategories((cats) =>
          cats.map((cat, i) => {
            if (i !== catIdx) return cat;
            const currentQuestion = cat.questions[qIdx];
            const merged: any = { ...currentQuestion, ...data.question };
            if (typeof merged.required === 'undefined') {
              // Fallback to the edited value so UI reflects immediately
              merged.required = editQuestionDraft.required || false;
              console.log('🔍 Required missing in API response, using edited value:', merged.required);
            }
            console.log('🔍 Final merged question for UI:', merged);
            const updatedQuestions = cat.questions.map((q, idx) => (idx === qIdx ? merged : q));
            // Sort questions by order after update
            return {
              ...cat,
              questions: updatedQuestions.sort((a, b) => (a.order || 0) - (b.order || 0)),
            };
          })
        );
        setEditingQuestion(null);
        setEditQuestionDraft({});
        // Ensure cache is refreshed so the value persists across reloads
        await queryClient.invalidateQueries({ queryKey: ['tracker', 'questions'] });
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
  const handleResponseChange = (catId: number, qId: number | string, value: any) => {
    setFormResponses((prev) => ({
      ...prev,
      [qId]: value,
    }));

    // Find the question that was just answered
    const currentQuestion = categories
      .flatMap(cat => cat.questions)
      .find(q => q.id === qId);
    
    if (currentQuestion) {
      const questionText = currentQuestion.text.toLowerCase();
      
      // Check if this is the awards/recognition question (question 30)
      const isAwardsQuestion = 
        currentQuestion.type === 'radio' && 
        (questionText.includes('award') || questionText.includes('recognition')) &&
        (questionText.includes('received') || questionText.includes('during') || questionText.includes('employment'));
      
      if (isAwardsQuestion) {
        // Find the award documents question (question 31)
        const awardDocsQuestion = categories
          .flatMap(cat => cat.questions)
          .find(q => {
            const qt = q.text.toLowerCase();
            return q.type === 'file' && 
                   (qt.includes('supporting document') || qt.includes('supporting documents')) &&
                   (qt.includes('award') || qt.includes('recognition'));
          });
        
        if (awardDocsQuestion) {
          // Auto-add first award document when "Yes" is selected
          if (value === 'Yes') {
            setAwardDocuments((prev) => {
              const currentFiles = prev[awardDocsQuestion.id] || [];
              if (currentFiles.length === 0) {
                return { ...prev, [awardDocsQuestion.id]: [null as any] };
              }
              return prev;
            });
          } 
          // Clear award documents when "No" is selected
          else if (value === 'No') {
            setAwardDocuments((prev) => {
              const newState = { ...prev };
              delete newState[awardDocsQuestion.id];
              return newState;
            });
          }
        }
      }
    }
  };

  // Add back the handleDeleteQuestion function
  const handleDeleteQuestion = async (catIdx: number, qIdx: number) => {
    try {
      const questionId = categories[catIdx].questions[qIdx].id;
      const data = await trackerApi.deleteQuestion(questionId);

      if (data.success) {
        setCategories((cats) =>
          cats.map((cat, i) =>
            i === catIdx
              ? { ...cat, questions: cat.questions.filter((_, idx) => idx !== qIdx) }
              : cat
          )
        );
        await queryClient.invalidateQueries({ queryKey: ['tracker', 'questions'] });
      } else {
        alert(data.message || 'Failed to delete question');
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question. Please try again.');
    }
  };

  // Helper: get flat list of all questions with their number
  const isAwardSupportingDocsQuestion = (q: QuestionItem) => {
    const lowerText = (q.text || '').toLowerCase();
    return (
      (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) &&
      (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'))
    );
  };

  const awardDocsVisible = useMemo(() => {
    const awardQuestion = categories
      .flatMap(cat => cat.questions)
      .find(ques => {
        const qt = (ques.text || '').toLowerCase();
        return (
          ques.type === 'radio' &&
          (qt.includes('awards') || qt.includes('award') || qt.includes('recognition')) &&
          (qt.includes('received') || qt.includes('during') || qt.includes('employment'))
        );
      });
    if (!awardQuestion) return false;
    return formResponses[awardQuestion.id] === 'Yes';
  }, [categories, formResponses]);

  const flatQuestions = useMemo(() => {
    const flat: { catIdx: number; qIdx: number; number: number }[] = [];
    let num = 1;

    categories.forEach((cat, catIdx) => {
      if (!shouldShowCategory(cat)) return;

      const sortedQuestions = [...cat.questions].sort((a, b) => (a.order || 0) - (b.order || 0));

      sortedQuestions.forEach((q, qIdx) => {
        if (shouldHideQuestionText(q.text)) return;
        if (isAwardSupportingDocsQuestion(q) && !awardDocsVisible) return;
        flat.push({ catIdx, qIdx, number: num++ });
      });
    });

    return flat;
  }, [categories, awardDocsVisible, formResponses]);

  const getQuestionNumber = (catIdx: number, qIdx: number) => {
    const found = flatQuestions.find((fq) => fq.catIdx === catIdx && fq.qIdx === qIdx);
    return found ? found.number : '';
  };

  // Helper: get input type and validation for special text questions
  const getInputProps = (q: QuestionItem) => {
    const text = q.text.toLowerCase();
    if (text.includes('phone') || text.includes('contact')) {
      return {
        type: 'tel',
        pattern: '^(09|\+639)\d{9}$|^\d{7}$',
        placeholder: 'e.g. 09123456789 or 1234567',
        validate: (v: string) =>
          /^(09|\+639)\d{9}$|^\d{7}$/.test(v) ? '' : 'Invalid Philippine phone/landline number.',
        options: undefined,
      };
    }
    if (text.includes('email')) {
      return {
        type: 'email',
        placeholder: 'e.g. user@email.com',
        validate: (v: string) =>
          /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'Invalid email address.',
        options: undefined,
      };
    }
    if (text.includes('birth') || text.includes('bday')) {
      return {
        type: 'date',
        placeholder: 'YYYY-MM-DD',
        validate: (v: string) => (v ? '' : 'Birthday required.'),
        options: undefined,
      };
    }
    if (text.includes('date hired') || (text.includes('hired') && text.includes('date'))) {
      return {
        type: 'date',
        placeholder: 'YYYY-MM-DD',
        validate: (v: string) => (v ? '' : 'Date hired required.'),
        options: undefined,
      };
    }
    if (text.includes('date started') || (text.includes('started') && text.includes('date'))) {
      return {
        type: 'date',
        placeholder: 'YYYY-MM-DD',
        validate: (v: string) => (v ? '' : 'Date started required.'),
        options: undefined,
      };
    }
    if (
      text.includes('facebook') ||
      text.includes('twitter') ||
      text.includes('instagram') ||
      text.includes('linkedin') ||
      text.includes('social')
    ) {
      return {
        type: 'url',
        placeholder: 'https://socialmedia.com/yourprofile',
        validate: (v: string) => (/^https?:\/\//.test(v) ? '' : 'Invalid URL.'),
        options: undefined,
      };
    }
    // Handle salary fields as select dropdowns
    if (text.includes('salary') || text.includes('salary range')) {
      return {
        type: 'select',
        options: [
          { value: 'below_5000', label: '5,000 below' },
          { value: '5001_10000', label: '5,001 to 10,000' },
          { value: '10001_20000', label: '10,001 to 20,000' },
          { value: '20001_30000', label: '20,001 to 30,000' },
          { value: 'above_30000', label: '30,000 above' }
        ],
        placeholder: 'Select salary range',
        validate: (v: string) => {
          if (!v) return ''; // Allow empty for optional fields
          return '';
        }
      };
    }
    // Handle employment duration as select dropdown
    if (text.includes('how long') && text.includes('employed')) {
      return {
        type: 'select',
        options: [
          { value: 'less_than_6_months', label: 'Less than 6 months' },
          { value: '6_months_1_year', label: '6 months – 1 year' },
          { value: '1_2_years', label: '1 – 2 years' },
          { value: '3_5_years', label: '3 – 5 years' },
          { value: 'more_than_5_years', label: 'More than 5 years' }
        ],
        placeholder: 'Select employment duration',
        validate: (v: string) => {
          if (!v) return ''; // Allow empty for optional fields
          return '';
        }
      };
    }
    
    // Add numerical validation for age, income, and other numerical fields (excluding salary)
    if (text.includes('age') || text.includes('income') || text.includes('amount') || text.includes('number') || text.includes('monthly') || text.includes('annual') || text.includes('yearly')) {
      return { 
        type: 'number', 
        placeholder: 'Enter numbers only', 
        validate: (v: string) => {
          if (!v) return ''; // Allow empty for optional fields
          if (/^\d+$/.test(v)) return ''; // Only digits allowed
          return 'This field only accepts numbers (0-9)';
        },
        options: undefined,
      };
    }
    return { type: 'text', placeholder: '', validate: (_: string) => '', options: undefined };
  };

  // Initial load handled by React Query above

  // Use previewModeFromParent to force preview mode if provided
  useEffect(() => {
    if (previewModeFromParent) setPreviewMode(true);
  }, [previewModeFromParent]);

  // Fetch user details for prefill
  useEffect(() => {
    if (userId) {
      fetchAlumniDetails(userId).then((res) => {
        if (res.success) setUserDetails(res.alumni);
      });
    }
  }, [userId]);

  const navigate = useNavigate();

  // Add this function inside the Question component
  const handleSubmit = async () => {
    try {
      console.log('🔍 Form Submit Debug - Starting form submission...');
      
      // Validate required questions
      const missingRequiredQuestions = [];
      for (const category of categories) {
        // Skip validation for hidden categories
        if (!shouldShowCategory(category)) {
          continue;
        }
        
        for (const question of category.questions) {
          // Skip validation for hidden questions (like "Current Scope of your Job")
          if (shouldHideQuestionText(question.text)) {
            continue;
          }
          
          if (question.required) {
            const answer = formResponses[question.id];
            // Check if question 31 (award supporting docs) - needs at least one file
            const lowerText = question.text.toLowerCase();
            const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                           (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
            
            if (isAwardSupportingDocs) {
              // Only validate if the parent award question is answered "Yes"
              const awardQuestion = categories
                .flatMap(cat => cat.questions)
                .find((ques: any) => {
                  const qt = ques.text.toLowerCase();
                  return ques.type === 'radio' && 
                         (qt.includes('awards') || qt.includes('award') || qt.includes('recognition')) &&
                         (qt.includes('received') || qt.includes('during') || qt.includes('employment'));
                });
              
              // Only validate if parent question exists and is answered "Yes"
              if (!awardQuestion || formResponses[awardQuestion.id] !== 'Yes') {
                continue; // Skip validation - question shouldn't be shown
              }
              
              // For award documents, check both actual files AND file markers (for draft persistence)
              const files = awardDocuments[question.id] || [];
              const hasValidFile = Array.isArray(files) && files.some(file => file !== null && file !== undefined);
              
              // Check if there's a file marker indicating files were uploaded (even if lost after refresh)
              const hasFileMarker = answer && 
                typeof answer === 'object' && 
                !Array.isArray(answer) &&
                answer.type === 'file' && 
                answer.uploaded === true &&
                answer.multiple === true;
              
              // For FINAL SUBMISSION, require actual files (not just markers)
              // File markers are only for draft persistence, not for submission
              if (!hasValidFile) {
                missingRequiredQuestions.push({
                  questionNumber: getQuestionNumber(categories.indexOf(category), category.questions.indexOf(question)),
                  questionText: question.text + (hasFileMarker ? ' (Files were uploaded but need to be re-uploaded after page refresh)' : '')
                });
              }
            } else if (answer instanceof File) {
              // File object exists - valid
              // Do nothing, continue to next question
            } else if (answer && typeof answer === 'object' && !Array.isArray(answer) && 
                       answer.type === 'file' && answer.uploaded === true) {
              // File marker exists but actual file is missing (lost after refresh)
              // For FINAL SUBMISSION, we need actual files, not just markers
              // Markers are only for draft persistence, not for submission
              missingRequiredQuestions.push({
                questionNumber: getQuestionNumber(categories.indexOf(category), category.questions.indexOf(question)),
                questionText: question.text + ' (Please re-upload the file)'
              });
            } else if (!answer || (typeof answer === 'string' && answer.trim() === '') || 
                     (Array.isArray(answer) && answer.length === 0)) {
              missingRequiredQuestions.push({
                questionNumber: getQuestionNumber(categories.indexOf(category), category.questions.indexOf(question)),
                questionText: question.text
              });
            }
          }
        }
      }
      
      if (missingRequiredQuestions.length > 0) {
        const missingQuestionsList = missingRequiredQuestions
          .map(q => `${q.questionNumber}. ${q.questionText}`)
          .join('\n');
        alert(`Please answer the following required questions:\n\n${missingQuestionsList}`);
        return;
      }
      
      // Create FormData for file uploads
      const formData = new FormData();

      // Add user_id and answers
      if (userId) {
        formData.append('user_id', userId);
        console.log('🔍 Form Submit Debug - User ID:', userId);
      }

      // Process answers and handle file uploads
      const processedAnswers: Record<string, any> = {};

      for (const [questionId, answer] of Object.entries(formResponses)) {
        // Check if this is question 31 (award supporting docs) with multiple files
        const question = categories
          .flatMap(cat => cat.questions)
          .find(q => q.id.toString() === questionId.toString());
        
        const lowerText = question?.text.toLowerCase() || '';
        const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                       (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
        
        if (isAwardSupportingDocs && Array.isArray(answer)) {
          // Handle multiple award documents (question 31)
          const files = awardDocuments[parseInt(questionId)] || [];
          const validFiles = files.filter(file => file !== null && file !== undefined);
          
          processedAnswers[questionId] = { type: 'file', multiple: true, count: validFiles.length };
          
          // Append each file with index
          validFiles.forEach((file, index) => {
            formData.append(`file_${questionId}_${index}`, file);
            console.log(`🔍 Form Submit Debug - Award document ${index + 1} for question ${questionId}:`, file.name);
          });
        } else if (answer instanceof File) {
          // This is a single file upload
          processedAnswers[questionId] = { type: 'file' };
          formData.append(`file_${questionId}`, answer);
          console.log(`🔍 Form Submit Debug - File upload for question ${questionId}:`, answer.name);
        } else {
          // This is a regular answer
          processedAnswers[questionId] = answer;
        }
      }

      formData.append('answers', JSON.stringify(processedAnswers));
      console.log('🔍 Form Submit Debug - Processed answers:', processedAnswers);

      // Use the authenticated API service instead of direct fetch
      console.log('🔍 Form Submit Debug - Calling trackerApi.submitResponse...');
      const data = await trackerApi.submitResponse(formData);
      console.log('🔍 Form Submit Debug - API response:', data);

      if (data.success) {
        const fileMessage =
          data.files_uploaded > 0 ? ` and ${data.files_uploaded} file(s) uploaded` : '';
        alert(`Form submitted successfully!${fileMessage}`);
        
        // Refresh points after tracker form submission (for Alumni users only - OJT can't submit tracker)
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const userObj = JSON.parse(userStr);
            if (userObj.account_type && userObj.account_type.user) {
              const userId = userObj.user_id || userObj.id;
              if (userId) {
                // Import getUserPoints dynamically to avoid circular dependencies
                const { getUserPoints } = await import('../../../services/api');
                const points = await getUserPoints(userId);
                // Dispatch event to notify Profile component
                window.dispatchEvent(new CustomEvent('pointsUpdated', { 
                  detail: { userId, points } 
                }));
              }
            }
          } catch (error) {
            console.error('Error refreshing points after tracker submission:', error);
          }
        }
        
        if (userStr) {
          const userObj = JSON.parse(userStr);
          const userId = userObj.user_id || userObj.id;
          if (userId) {
            navigate(`/dashboard/${userId}`);
          }
        }
      } else {
        alert('Submission failed: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('🔍 Form Submit Debug - Error submitting form:', error);
      
      // Check if it's an authentication error
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as any).message;
        console.log('🔍 Form Submit Debug - Error message:', errorMessage);
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          alert('Authentication error. Please log in again to submit the form.');
          navigate('/login');
        } else {
          alert('Submission failed. Please check your connection and try again.');
        }
      } else {
        alert('Submission failed. Please check your connection and try again.');
      }
    }
  };

  // Helper to map question text to user field name
  function userFieldForQuestion(text: string): string {
    const map: Record<string, string> = {
      'first name': 'first_name',
      'middle name': 'middle_name',
      'last name': 'last_name',
      'ctu id': 'ctu_id',
      course: 'course',
      program: 'program',
      batch: 'batch',
      status: 'status',
      gender: 'gender',
      birthdate: 'birthdate',
      phone: 'phone',
      address: 'address',
      email: 'email',
      'civil status': 'civil_status',
      age: 'age',
      'social media': 'social_media',
      'school name': 'school_name',
    };
    const key = text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
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
      if (text.includes('yeargraduated') || text.includes('batch'))
        return userDetails['batch'] || '';
      if (
        text.includes('birth') ||
        text.includes('bday') ||
        text.includes('dateofbirth') ||
        text.includes('dob') ||
        text.includes('birthday') ||
        text.includes('birthdate')
      )
        return toYYYYMMDD(userDetails['birthdate'] || '');
      if (text.includes('phone') || text.includes('contact') || text.includes('mobile'))
        return userDetails['phone'] || '';
    }

    // For company address question, don't autofill but allow user input
    if (
      text.includes('companyaddress') &&
      text.includes('employer') &&
      text.includes('graduation')
    ) {
      return formResponses[q.id] !== undefined ? formResponses[q.id] : '';
    }

    // Otherwise, use tracker answer if present, else user model fallback
    return formResponses[q.id] !== undefined
      ? formResponses[q.id]
      : userDetails
        ? userDetails[userFieldForQuestion(q.text)] || ''
        : '';
  }
  function isReadOnlyField(q: QuestionItem): boolean {
    const text = q.text.toLowerCase();
    return text.includes('program') || text.includes('year graduated') || text.includes('batch');
  }

  // New handler for job change
  const handleJobChange = (catId: number, qId: number | string, value: any) => {
    // This is called when a value is selected from dropdown or entered
    const isCustom = typeof value === 'string' && !jobList.some(j => j.title === value);
    setCustomJobInputs(prev => ({ ...prev, [qId]: isCustom }));
    handleResponseChange(catId, qId, value);
    if (!isCustom) {
      setJobAlignment(prev => ({ ...prev, [qId]: '' }));
    }
  };

  const handleJobInputChange = (qId: number | string, value: string) => {
    setJobInputValues(prev => ({ ...prev, [qId]: value }));
    // Show radio if not in jobList and not empty
    const isCustom = !!value && !jobList.some(j => j.title.toLowerCase() === value.toLowerCase());
    setCustomJobInputs(prev => ({ ...prev, [qId]: Boolean(isCustom) }));
  };

  // Senior-level customization for specific questions
  function shouldHideQuestionText(text: string): boolean {
    const t = (text || '').toLowerCase();
    // Remove "Current Scope of your Job"
    return t.includes('current scope of your job');
  }

  function getDisplayOptions(q: any): string[] | undefined {
    if (!q?.options) return q?.options;
    const t = (q.text || '').toLowerCase();
    // Rename Public -> Government for sector question
    if (t.includes('current sector of your job')) {
      return q.options.map((o: string) => (String(o).toLowerCase() === 'public' ? 'Government' : o));
    }
    return q.options;
  }

  return (
    <div className={`tracker-container ${previewMode ? 'preview-mode' : ''}`}>
      <div className={`tracker-inner ${previewMode ? 'preview-mode' : ''}`}>
        {previewModeFromParent ? null : (
          <>
            <button
              className="action-button"
              onClick={() => setPreviewMode(!previewMode)}
              style={{ marginBottom: 16, marginRight: 16 }}
            >
              {previewMode ? 'Back to Edit' : 'Preview/Fill Out Form'}
            </button>
            {!previewMode && (
              <button
                className="action-button"
                onClick={() => setAddingCategory(true)}
                style={{ marginBottom: 16 }}
              >
                Add Category
              </button>
            )}
          </>
        )}
        {previewMode ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {/* Auto-save status indicator */}
            {userId && saveStatus && (
              <div style={{
                position: 'fixed',
                top: '80px',
                right: '20px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: saveStatus === 'saved' ? '#4CAF50' : saveStatus === 'saving' ? '#2196F3' : '#FF9800',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'fadeIn 0.2s ease-in'
              }}>
                {saveStatus === 'saved' && '✓ Saved'}
                {saveStatus === 'saving' && (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                    Saving...
                  </>
                )}
                {saveStatus === 'unsaved' && '● Unsaved changes'}
              </div>
            )}
            {categories.length === 0 && (
              <p style={{ color: '#888' }}>No categories/questions to display.</p>
            )}
            {categories.map((cat, catIdx) => {
              if (!shouldShowCategory(cat)) return null;
                const sortedQuestions = [...cat.questions].sort(
                  (a, b) => (a.order || 0) - (b.order || 0)
                );
                return (
                <div key={cat.id} style={{ marginBottom: 32 }}>
                  <h2>{cat.title}</h2>
                  <p>{cat.description}</p>
                  {/* Show conditional indicator for employment and study sections */}
                  {cat.title.toLowerCase().includes('employment status') ||
                    cat.title.toLowerCase().includes('unemployed') ||
                    cat.title.toLowerCase().includes('further study')}
                  {sortedQuestions.map((q, qIdx) => {
                    if (shouldHideQuestionText(q.text)) return null;
                    
                    // Check if this is question 31 (Supporting Documents for awards/recognition)
                    // Only show if question 30 (awards/recognition) is answered "Yes"
                    if (isAwardSupportingDocsQuestion(q) && !awardDocsVisible) {
                      return null;
                    }
                    
                    if (q.text.toLowerCase().includes('current position')) {
                      return (
                        <div key={q.id} className="preview-question" style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: 500 }}>
                            {getQuestionNumber(catIdx, qIdx)}. {q.text}
                            {q.required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
                          </label>
                          <JobTitleAutocomplete
                            userId={userId ? parseInt(userId) : 0}
                            value={formResponses[q.id] || ''}
                            onChange={(value) => {
                              handleResponseChange(cat.id, q.id, value);
                            }}
                            onAlignmentComplete={(status) => {
                              console.log(`Job alignment status: ${status}`);
                            }}
                            placeholder="Select or type Job Title"
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={q.id} className="preview-question" style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: 500 }}>
                          {getQuestionNumber(catIdx, qIdx)}. {q.text}
                          {q.required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
                        </label>
                        <div>
                          {q.type === 'text' &&
                            (() => {
                              const inputProps = getInputProps(q);
                              const lower = q.text.toLowerCase();
                              const isAge = lower.includes('age');
                              const isBirth = lower.includes('birth') || lower.includes('bday') || lower.includes('date of birth');
                              const isDateHired = lower.includes('date hired') || (lower.includes('hired') && lower.includes('date'));
                              const isDateStarted = lower.includes('date started') || (lower.includes('started') && lower.includes('date'));
                              const isPhone = lower.includes('phone') || lower.includes('mobile') || lower.includes('contact');
                              const isSalary = lower.includes('salary') || lower.includes('salary range');
                              const type = isAge ? 'number' : isBirth ? 'date' : isDateHired ? 'date' : isDateStarted ? 'date' : isPhone ? 'tel' : inputProps.type;
                              const placeholder = isBirth || isDateHired || isDateStarted ? 'YYYY-MM-DD' : inputProps.placeholder;
                              
                              // Handle select dropdown for special fields (salary, employment duration, etc.)
                              if (inputProps.type === 'select' && inputProps.options) {
                                return (
                                  <>
                                    <select
                                      value={getPrefilledValue(q)}
                                      onChange={(e) => {
                                        handleResponseChange(cat.id, q.id, e.target.value);
                                        const err = inputProps.validate(e.target.value);
                                        setValidationErrors((prev) => ({
                                          ...prev,
                                          [`${q.id}`]: err,
                                        }));
                                      }}
                                      style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                                    >
                                      <option value="">{inputProps.placeholder}</option>
                                      {inputProps.options.map((option: any) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    {validationErrors[`${q.id}`] && (
                                      <div style={{ color: 'red', fontSize: 12 }}>
                                        {validationErrors[`${q.id}`]}
                                      </div>
                                    )}
                                  </>
                                );
                              }
                              
                              return (
                                <>
                                  <input
                                    type={type}
                                    value={getPrefilledValue(q)}
                                    readOnly={isReadOnlyField(q)}
                                    placeholder={placeholder}
                                    pattern={inputProps.pattern}
                                    onKeyDown={(e) => {
                                      if ((isAge || isPhone) && !(['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key) || /[0-9]/.test(e.key))) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) => {
                                      handleResponseChange(cat.id, q.id, e.target.value);
                                      const err = inputProps.validate(e.target.value);
                                      setValidationErrors((prev) => ({
                                        ...prev,
                                        [`${q.id}`]: err,
                                      }));
                                    }}
                                    style={{ width: '100%', marginTop: 4 }}
                                  />
                                  {validationErrors[`${q.id}`] && (
                                    <div style={{ color: 'red', fontSize: 12 }}>
                                      {validationErrors[`${q.id}`]}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          {q.type === 'file' && (() => {
                            const lowerText = q.text.toLowerCase();
                            const isAwardSupportingDocs = (lowerText.includes('supporting documents') || lowerText.includes('supporting document')) && 
                                                           (lowerText.includes('awards') || lowerText.includes('award') || lowerText.includes('recognition'));
                            
                            // Handle multiple award documents (question 31)
                            if (isAwardSupportingDocs) {
                              const currentFiles = awardDocuments[q.id] || [];
                              
                              const handleFileChange = (index: number, file: File | null) => {
                                if (!file) return;
                                
                                // Validate file size (10MB)
                                if (file.size > 10 * 1024 * 1024) {
                                  alert('File size must be less than 10MB');
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
                                  'image/gif',
                                ];

                                if (!allowedTypes.includes(file.type)) {
                                  alert('Please select a valid file type: PDF, DOC, DOCX, JPG, PNG, or GIF');
                                  return;
                                }

                                const updatedFiles = [...currentFiles];
                                updatedFiles[index] = file;
                                setAwardDocuments({ ...awardDocuments, [q.id]: updatedFiles });
                                
                                // Also save file marker in formResponses for draft persistence
                                const validFiles = updatedFiles.filter(f => f !== null);
                                handleResponseChange(cat.id, q.id, { type: 'file', multiple: true, uploaded: true, count: validFiles.length });
                                
                                // Keep the actual files array in a separate state (awardDocuments) for submission
                                // The marker in formResponses will persist after refresh
                              };

                              const addAnotherAward = () => {
                                const updatedFiles = currentFiles.length > 0 ? [...currentFiles, null as any] : [null as any];
                                setAwardDocuments({ ...awardDocuments, [q.id]: updatedFiles });
                                // Initialize form response if empty
                                if (!formResponses[q.id] || !Array.isArray(formResponses[q.id])) {
                                  handleResponseChange(cat.id, q.id, updatedFiles);
                                }
                              };

                              const removeAward = (index: number) => {
                                const updatedFiles = currentFiles.filter((_, i) => i !== index);
                                setAwardDocuments({ ...awardDocuments, [q.id]: updatedFiles });
                                handleResponseChange(cat.id, q.id, updatedFiles);
                              };

                              return (
                                <div>
                                  {currentFiles.map((file, index) => (
                                    <div key={index} style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <label style={{ fontWeight: 500, fontSize: 14 }}>
                                          Award Document {index + 1}
                                        </label>
                                        {currentFiles.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => removeAward(index)}
                                            style={{
                                              backgroundColor: '#ff3b3b',
                                              color: 'white',
                                              border: 'none',
                                              padding: '4px 12px',
                                              borderRadius: 4,
                                              cursor: 'pointer',
                                              fontSize: 12
                                            }}
                                          >
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                      <div className="file-upload-container">
                                        <input
                                          type="file"
                                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                                          onChange={(e) => {
                                            const file = e.target.files && e.target.files[0];
                                            if (file) {
                                              handleFileChange(index, file);
                                            }
                                            e.target.value = '';
                                          }}
                                        />
                                        {file && (
                                          <div className="file-info">
                                            <strong>Selected file:</strong> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={addAnotherAward}
                                    style={{
                                      backgroundColor: '#1e4c7a',
                                      color: 'white',
                                      border: 'none',
                                      padding: '10px 20px',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                      fontSize: 14,
                                      fontWeight: 500,
                                      marginTop: 8
                                    }}
                                  >
                                    + Add Another Award
                                  </button>
                                  {currentFiles.length === 0 && !(formResponses[q.id] && typeof formResponses[q.id] === 'object' && !Array.isArray(formResponses[q.id]) && formResponses[q.id].type === 'file' && formResponses[q.id].multiple === true && formResponses[q.id].uploaded === true) && (
                                    <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                                      Click the button above to add your first award document.
                                    </div>
                                  )}
                                  {currentFiles.length === 0 && formResponses[q.id] && typeof formResponses[q.id] === 'object' && !Array.isArray(formResponses[q.id]) && formResponses[q.id].type === 'file' && formResponses[q.id].multiple === true && formResponses[q.id].uploaded === true && (
                                    <div style={{ marginTop: 8, padding: 12, backgroundColor: '#fff3cd', borderRadius: 6, border: '1px solid #ffc107' }}>
                                      <strong style={{ color: '#856404', fontSize: 12 }}>⚠️ Files were uploaded but need to be re-uploaded after page refresh. Please select your files again.</strong>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // Regular single file upload for other questions
                            return (
                              <div className="file-upload-container">
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                                  onChange={(e) => {
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
                                        'image/gif',
                                      ];

                                      if (!allowedTypes.includes(file.type)) {
                                        alert(
                                          'Please select a valid file type: PDF, DOC, DOCX, JPG, PNG, or GIF'
                                        );
                                        e.target.value = '';
                                        return;
                                      }
                                    }
                                    
                                    // Save actual file for submission
                                    handleResponseChange(cat.id, q.id, file);
                                  }}
                                />
                                {(formResponses[q.id] instanceof File) && (
                                  <div className="file-info">
                                    <strong>Selected file:</strong> {formResponses[q.id].name} (
                                    {(formResponses[q.id].size / 1024 / 1024).toFixed(2)} MB)
                                  </div>
                                )}
                                {formResponses[q.id] && typeof formResponses[q.id] === 'object' && 
                                 !(formResponses[q.id] instanceof File) && 
                                 formResponses[q.id].type === 'file' && 
                                 formResponses[q.id].uploaded === true && 
                                 !formResponses[q.id].multiple && (
                                  <div className="file-info" style={{ padding: 12, backgroundColor: '#fff3cd', borderRadius: 6, border: '1px solid #ffc107', marginTop: 8 }}>
                                    <strong style={{ color: '#856404' }}>⚠️ File was uploaded but needs to be re-uploaded after page refresh. Please select your file again.</strong>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {q.type === 'radio' &&
                            getDisplayOptions(q) &&
                            getDisplayOptions(q)!.map((opt) => (
                              <label key={opt} style={{ marginRight: 12 }}>
                                <input
                                  type="radio"
                                  name={`${cat.id}_${q.id}`}
                                  value={opt}
                                  checked={formResponses[q.id] === opt}
                                  onChange={(e) => handleResponseChange(cat.id, q.id, opt)}
                                />{' '}
                                {opt}
                              </label>
                            ))}
                          {q.type === 'checkbox' &&
                            q.options && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {q.options.map((opt) => (
                                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                      type="checkbox"
                                      value={opt}
                                      checked={
                                        Array.isArray(formResponses[q.id]) &&
                                        formResponses[q.id].includes(opt)
                                      }
                                      onChange={(e) => {
                                        const prev = Array.isArray(formResponses[q.id])
                                          ? formResponses[q.id]
                                          : [];
                                        if (e.target.checked) {
                                          handleResponseChange(cat.id, q.id, [...prev, opt]);
                                        } else {
                                          handleResponseChange(
                                            cat.id,
                                            q.id,
                                            prev.filter((v: string) => v !== opt)
                                          );
                                        }
                                      }}
                                    />{' '}
                                    {opt}
                                  </label>
                                ))}
                              </div>
                            )}
                          {q.type === 'multiple' && q.options && (
                            <select
                              value={formResponses[q.id] || ''}
                              onChange={(e) => handleResponseChange(cat.id, q.id, e.target.value)}
                              style={{ width: '100%', marginTop: 4 }}
                            >
                              <option value="">Select...</option>
                              {q.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* Only one submit button at the end of the form */}
            {categories.length > 0 && (
              <button type="submit" className="action-button">
                Submit
              </button>
            )}
          </form>
        ) : (
          <>
            {categories.map((cat, catIdx) => (
              <div className="card" key={cat.id} style={{ marginBottom: 24 }}>
                {editingCategoryIndex === catIdx ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        marginRight: 8,
                      }}
                    >
                      <label style={{ fontWeight: 500, marginBottom: 2 }}>Category Title</label>
                      <input
                        type="text"
                        name="title"
                        value={editCategoryDraft.title || ''}
                        onChange={handleEditCategoryChange}
                        placeholder="Enter category title"
                        style={{ width: '100%', marginBottom: 8 }}
                      />
                      <label style={{ fontWeight: 500, marginBottom: 2 }}>
                        Category Description
                      </label>
                      <textarea
                        name="description"
                        value={editCategoryDraft.description || ''}
                        onChange={handleEditCategoryChange}
                        placeholder="Enter category description"
                        style={{ width: '100%', marginBottom: 8 }}
                        rows={2}
                      />
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}
                    >
                      <button className="button-cancel" onClick={cancelEditCategory}>
                        Cancel
                      </button>
                      <button
                        className="button-update"
                        onClick={() => handleUpdateCategory(catIdx)}
                      >
                        Update
                      </button>
                    </div>
                    {/* The rest of the card (questions, add question, etc.) remains visible below */}
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <h2>{cat.title}</h2>
                        <p>{cat.description}</p>
                      </div>
                      <div>
                        <button
                          className="button-edit"
                          onClick={() => {
                            setEditingCategoryIndex(catIdx);
                            setEditCategoryDraft({ ...categories[catIdx] });
                          }}
                          style={{ marginRight: 8 }}
                        >
                          Edit
                        </button>
                        <button
                          className="button-delete"
                          onClick={() => handleDeleteCategory(catIdx)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      {addingQuestionCatIdx === catIdx ? (
                        <div
                          className="card question-box"
                          style={{ marginBottom: 8, background: '#f5f5f5' }}
                        >
                          <input
                            type="text"
                            name="text"
                            placeholder="Question text"
                            value={newQuestionDraft.text || ''}
                            onChange={handleAddQuestionChange}
                            style={{ width: '100%', marginBottom: 8 }}
                          />
                          <select
                            name="type"
                            value={newQuestionDraft.type}
                            onChange={handleAddQuestionChange}
                            style={{ width: '100%', marginBottom: 8 }}
                          >
                            {QUESTION_TYPES.map((qt) => (
                              <option key={qt.value} value={qt.value}>
                                {qt.label}
                              </option>
                            ))}
                          </select>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                name="required"
                                checked={newQuestionDraft.required || false}
                                onChange={handleAddQuestionChange}
                              />
                              Required
                            </label>
                          </div>
                          {newQuestionDraft.type !== 'text' && (
                            <div style={{ marginBottom: 8 }}>
                              <label>Options:</label>
                              {(newQuestionDraft.options || []).map((opt, i) => (
                                <div
                                  key={i}
                                  style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}
                                >
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) =>
                                      handleAddQuestionOptionChange(i, e.target.value)
                                    }
                                    style={{ flex: 1, marginRight: 4 }}
                                  />
                                  <button
                                    onClick={() => removeNewQuestionOption(i)}
                                    disabled={newQuestionDraft.options!.length <= 1}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                              <button onClick={addNewQuestionOption}>Add Option</button>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="button-cancel"
                              onClick={cancelAddQuestion}
                              style={{ marginRight: 8 }}
                            >
                              Cancel
                            </button>
                            <button
                              className="button-add"
                              onClick={() => handleSaveNewQuestion(catIdx)}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="action-button"
                          onClick={() => setAddingQuestionCatIdx(catIdx)}
                          style={{ marginBottom: 8 }}
                        >
                          Add Question
                        </button>
                      )}
                      {cat.questions.length === 0 && (
                        <p style={{ color: '#888' }}>No questions yet.</p>
                      )}
                      {[...cat.questions].sort((a, b) => (a.order || 0) - (b.order || 0)).map((q, qIdx) => (
                        <div className="card question-box" key={q.id} style={{ marginBottom: 8 }}>
                          {editingQuestion &&
                          editingQuestion.catIdx === catIdx &&
                          editingQuestion.qIdx === qIdx ? (
                            <>
                              <div style={{ marginBottom: 8, fontWeight: 600 }}>
                                Editing Question {getQuestionNumber(catIdx, qIdx)}: "
                                {categories[catIdx].questions[qIdx].text}"
                              </div>
                              <input
                                type="text"
                                name="text"
                                value={editQuestionDraft.text || ''}
                                onChange={handleEditQuestionChange}
                                style={{ width: '100%', marginBottom: 8 }}
                              />
                              <select
                                name="type"
                                value={editQuestionDraft.type}
                                onChange={handleEditQuestionChange}
                                style={{ width: '100%', marginBottom: 8 }}
                              >
                                {QUESTION_TYPES.map((qt) => (
                                  <option key={qt.value} value={qt.value}>
                                    {qt.label}
                                  </option>
                                ))}
                              </select>
                              <div style={{ marginBottom: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input
                                    type="checkbox"
                                    name="required"
                                    checked={editQuestionDraft.required || false}
                                    onChange={handleEditQuestionChange}
                                  />
                                  Required
                                </label>
                              </div>
                              {editQuestionDraft.type !== 'text' && (
                                <div style={{ marginBottom: 8 }}>
                                  <label>Options:</label>
                                  {(editQuestionDraft.options || []).map((opt, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginBottom: 4,
                                      }}
                                    >
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) =>
                                          handleEditQuestionOptionChange(i, e.target.value)
                                        }
                                        style={{ flex: 1, marginRight: 4 }}
                                      />
                                      <button
                                        onClick={() => removeEditQuestionOption(i)}
                                        disabled={editQuestionDraft.options!.length <= 1}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                  <button onClick={addEditQuestionOption}>Add Option</button>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                  className="button-cancel"
                                  onClick={cancelEditQuestion}
                                  style={{ marginRight: 8 }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="button-update"
                                  onClick={() => handleUpdateQuestion(catIdx, qIdx)}
                                >
                                  Update
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <h3>
                                {getQuestionNumber(catIdx, qIdx)}. {q.text}
                                {q.required && <span style={{ color: 'red', marginLeft: 8 }}>*</span>}
                              </h3>
                              <p>Type: {QUESTION_TYPES.find((t) => t.value === q.type)?.label}</p>
                              {q.required && <p style={{ color: 'red', fontSize: '0.9em', margin: 0 }}>Required</p>}
                              {q.options && q.options.length > 0 && (
                                <ul>
                                  {q.options.map((opt, i) => (
                                    <li key={i}>{opt}</li>
                                  ))}
                                </ul>
                              )}
                              <button
                                className="button-edit"
                                onClick={() => openEditQuestionInline(catIdx, qIdx)}
                                style={{ marginRight: 8 }}
                              >
                                Edit
                              </button>
                              <button
                                className="button-delete"
                                onClick={() => handleDeleteQuestion(catIdx, qIdx)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
            {addingCategory && (
              <div ref={newCategoryRef} className="card" style={{ marginBottom: 24, background: '#f5f5f5' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    marginRight: 8,
                  }}
                >
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
                  <button className="button-cancel" onClick={cancelAddCategory}>
                    Cancel
                  </button>
                  <button className="button-add" onClick={handleSaveNewCategory}>
                    Add
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Privacy Notice Modal */}
      {showPrivacyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >

            <div style={{ padding: '30px' }}>
              <h2 style={{ 
                color: '#174f84', 
                marginBottom: '20px', 
                fontSize: '24px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                Privacy Notice
              </h2>
              <p style={{ 
                color: '#333', 
                marginBottom: '15px', 
                fontSize: '16px',
                lineHeight: '1.6'
              }}>
                Republic Act No. 10173 - Data Privacy Act of 2012
              </p>
              <div style={{ 
                background: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid #e9ecef'
              }}>
                <p style={{ 
                  color: '#555', 
                  marginBottom: '15px', 
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}>
                  We are committed to protecting your personal data in accordance with the Data Privacy Act of 2012. 
                  The information you provide in this Tracer Form will be used solely for academic and institutional purposes.
                </p>
                <p style={{ 
                  color: '#555', 
                  marginBottom: '15px', 
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}>
                  Your personal data will be:
                </p>
                <ul style={{ 
                  color: '#555', 
                  marginBottom: '15px', 
                  fontSize: '14px',
                  lineHeight: '1.6',
                  paddingLeft: '20px'
                }}>
                  <li>Collected and processed lawfully and fairly</li>
                  <li>Used only for the stated purposes</li>
                  <li>Kept accurate and up-to-date</li>
                  <li>Stored securely and confidentially</li>
                  <li>Not shared with unauthorized parties</li>
                </ul>
                <p style={{ 
                  color: '#555', 
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}>
                  By proceeding with the Tracer Form, you acknowledge that you have read and understood this privacy notice.
                </p>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '10px', 
                  cursor: 'pointer',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    style={{ 
                      marginTop: '2px',
                      transform: 'scale(1.2)'
                    }}
                  />
                  <span style={{ color: '#333' }}>
                    I have read and understood the Privacy Notice and I voluntarily consent to the collection and use of my personal data for Tracer Form.
                  </span>
                </label>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'center',
                marginTop: '20px'
              }}>
                <button
                  onClick={() => {
                    setShowPrivacyModal(false);
                    setPrivacyAccepted(false);
                    // Navigate back to notifications page
                    navigate('/alumni/notifications');
                  }}
                  style={{
                    background: '#6c757d',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    minWidth: '120px'
                  }}
                >
                  I Don't Accept
                </button>
                <button
                  onClick={() => {
                    if (privacyAccepted) {
                      setShowPrivacyModal(false);
                    }
                  }}
                  disabled={!privacyAccepted}
                  style={{
                    background: privacyAccepted ? '#174f84' : '#ccc',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: privacyAccepted ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '14px',
                    minWidth: '120px'
                  }}
                >
                  Proceed to Form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Question;

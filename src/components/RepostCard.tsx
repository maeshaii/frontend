import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  likeRepost,
  unlikeRepost,
  commentOnRepost,
  getRepostLikes,
  editRepostComment,
  deleteRepostComment,
  editRepost,
  deleteRepost,
  editPost,
  deletePost,
  getCommentReplies,
  deleteDonationRequest,
  deleteForumPost,
  updateDonationRequest,
  editForumPost,
  searchAlumni,
  getFollowingForMentions,
} from '../services/api';
import { getProfilePicUrl, handleProfilePicError, getImageUrl } from '../utils/profilePicUtils';
import RepostButton from './RepostButton';
import ReplyInput from './ReplyInput';
import Reply from './Reply';
import PostStatsRow from './PostStatsRow';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbsUp } from '@fortawesome/free-solid-svg-icons';
import { faThumbsUp as faThumbsUpReg, faComment as faCommentReg } from '@fortawesome/free-regular-svg-icons';
import { HiOutlineChevronRight } from 'react-icons/hi2';
import { IoSend } from 'react-icons/io5';
import ctulogo from '../images/ctulogo.png';
import './postFooterActions.css';

// Minimal, reusable types for the repost card
interface UserLite {
  user_id: number;
  f_name?: string;
  m_name?: string;
  l_name?: string;
  profile_pic?: string;
}

export interface PostItemLite {
  post_id?: number; // original post id
  donation_id?: number; // for donation reposts
  created_at?: string | null;
  post_content?: string;
  post_images?: Array<{ image_id: number; image_url: string; order: number }>;
  user?: UserLite;
  // Optional interaction fields for embedded originals
  likes?: Array<any>;
  comments?: Array<any>;
  likes_count?: number;
  comments_count?: number;
}

interface CommentLite {
  comment_id: number;
  comment_content: string;
  date_created?: string;
  user: UserLite;
  replies_count?: number;
}

interface RepostLite {
  repost_id: number;
  repost_date: string;
  repost_caption?: string;
  user: UserLite;
  likes?: Array<{ user_id: number }>;
  likes_count?: number;
  comments?: CommentLite[];
  comments_count?: number;
  original_post?: PostItemLite;
}

type RepostContext = 'post' | 'forum' | 'donation';

interface RepostCardProps {
  repost: RepostLite;
  currentUserId: number | null;
  formatTime: (iso?: string | null) => string;
  onRefresh?: () => void;
  context?: RepostContext;
  showOptions?: { [key: string | number]: boolean };
  setShowOptions?: (fn: (prev: { [key: string | number]: boolean }) => { [key: string | number]: boolean }) => void;
  editingRepost?: { [key: string | number]: boolean };
  setEditingRepost?: (fn: (prev: { [key: string | number]: boolean }) => { [key: string | number]: boolean }) => void;
  editRepostContent?: { [key: string | number]: string };
  setEditRepostContent?: (fn: (prev: { [key: string | number]: string }) => { [key: string | number]: string }) => void;
  onViewOriginalPost?: (original: PostItemLite) => void;
  currentUserAvatar?: string;
  autoOpenComments?: boolean;
  highlightCommentId?: string;
  highlightReplyId?: string;
  highlightDurationMs?: number;
}

// Photo gallery helpers - same as PostCard
const getImagesFromPost = (post: PostItemLite): string[] => {
  const images: string[] = [];
  
  console.log('=== REPOST CARD IMAGE DEBUG ===');
  console.log('Original post data:', post);
  console.log('Post images array:', post.post_images);
  console.log('Post image field:', (post as any).post_image);
  console.log('Post images type:', typeof post.post_images);
  console.log('Post images length:', post.post_images?.length);
  
  // Add multiple images if available (for regular posts)
  if (post.post_images && post.post_images.length > 0) {
    console.log('Adding post_images array:', post.post_images);
    // Sort by order and extract URLs
    const sortedImages = [...post.post_images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    images.push(...sortedImages.map(img => img.image_url));
  }
  
  // Add donation images if available (for donation posts)
  if (images.length === 0 && (post as any).images && (post as any).images.length > 0) {
    console.log('Adding donation images:', (post as any).images);
    // Sort by order and extract URLs
    const sortedImages = [...(post as any).images].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    images.push(...sortedImages.map((img: any) => img.image_url));
  }
  
  // Add single image if no multiple images and single image exists
  if (images.length === 0 && (post as any).post_image) {
    console.log('Adding single post_image:', (post as any).post_image);
    images.push((post as any).post_image);
  }
  
  // Remove duplicate URLs while preserving order
  const uniqueImages = Array.from(new Set(images));
  
  console.log('Final images array (before dedup):', images);
  console.log('Final images array (after dedup):', uniqueImages);
  console.log('=== END REPOST CARD IMAGE DEBUG ===');
  
  return uniqueImages;
};

const RepostCard: React.FC<RepostCardProps> = ({ 
  repost, 
  currentUserId, 
  formatTime, 
  onRefresh, 
  context = 'post',
  showOptions = {},
  setShowOptions,
  editingRepost = {},
  setEditingRepost,
  editRepostContent = {},
  setEditRepostContent,
  onViewOriginalPost,
  currentUserAvatar,
  autoOpenComments = false,
  highlightCommentId,
  highlightReplyId,
  highlightDurationMs
}) => {
  // Render name: {f_name} {m_name} {l_name} if m_name exists, else {f_name} {l_name}
  const renderName = (obj: { f_name: string; m_name?: string; l_name: string }) =>
    `${obj.f_name} ${obj.m_name || ''} ${obj.l_name}`.trim();

  const reposterName = repost.user?.f_name && repost.user?.l_name
    ? renderName({ f_name: repost.user.f_name, m_name: repost.user.m_name, l_name: repost.user.l_name })
    : `${repost.user?.f_name || ''} ${repost.user?.m_name || ''} ${repost.user?.l_name || ''}`.trim();
  const reposterAvatar = getProfilePicUrl(repost.user.profile_pic);

  const original = repost.original_post || {};
  const originalPosterName = original.user?.f_name && original.user?.l_name
    ? renderName({ f_name: original.user.f_name, m_name: original.user.m_name, l_name: original.user.l_name })
    : `${original.user?.f_name || ''} ${original.user?.m_name || ''} ${original.user?.l_name || ''}`.trim();
  const originalPosterAvatar = getProfilePicUrl(original.user?.profile_pic);

  const [liked, setLiked] = useState<boolean>(!!repost.likes?.some(l => l.user_id === currentUserId));
  const [likesCount, setLikesCount] = useState<number>(repost.likes_count || repost.likes?.length || 0);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const [fetchedLikes, setFetchedLikes] = useState<any[]>(repost.likes || []);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  
  // @mention functionality for comments
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  
  // Load following users for @mentions
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const response = await getFollowingForMentions();
        if (response.success) {
          setFollowingUsers(response.following);
        }
      } catch (error) {
        console.error('Error loading following users:', error);
      }
    };
    loadFollowing();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (showMentionSuggestions) {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          commentInputRef.current &&
          !commentInputRef.current.closest('div')?.contains(e.target as Node)
        ) {
          // Check if click is outside the comment input area
          const commentContainer = commentInputRef.current?.closest('div[style*="padding"]');
          if (commentContainer && !commentContainer.contains(e.target as Node)) {
            setShowMentionSuggestions(false);
          }
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMentionSuggestions]);
  
  // Local state for options menu (internal state management)
  const [localShowRepostOptions, setLocalShowRepostOptions] = useState(false);
  const [localShowOriginalOptions, setLocalShowOriginalOptions] = useState(false);
  const [localEditingRepost, setLocalEditingRepost] = useState(false);
  const [localEditingOriginal, setLocalEditingOriginal] = useState(false);
  const [localEditRepostContent, setLocalEditRepostContent] = useState('');
  const [localEditOriginalContent, setLocalEditOriginalContent] = useState('');
  
  // Comments state
  const [comments, setComments] = useState<CommentLite[]>(repost.comments || []);
  const [showAllComments, setShowAllComments] = useState(false);
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editCommentContent, setEditCommentContent] = useState<{ [key: number]: string }>({});
  const [showCommentOptions, setShowCommentOptions] = useState<{ [key: number]: boolean }>({});
  const [showReplyInput, setShowReplyInput] = useState<{ [key: number]: boolean }>({});
  const [commentReplies, setCommentReplies] = useState<{ [key: number]: any[] }>({});
  const [showReplies, setShowReplies] = useState<{ [key: number]: boolean }>({});
  
  // State to control whether comments section is visible (hidden by default)
  const [showCommentsSection, setShowCommentsSection] = useState<boolean>(false);
 
   const optionsMenuRef = useRef<HTMLDivElement>(null);
   const commentOptionsRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
   const commentRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
   const replyRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
   const requestedReplyLoadsRef = useRef<Set<number>>(new Set());
   const processedCommentHighlightRef = useRef<string | null>(null);
   const processedReplyHighlightRef = useRef<string | null>(null);
   const highlightTimerRef = useRef<number | null>(null);
   const [activeCommentHighlight, setActiveCommentHighlight] = useState<number | null>(null);
   const [activeReplyHighlight, setActiveReplyHighlight] = useState<number | null>(null);
   const highlightColor = '#fff2e6';
   const highlightDuration = highlightDurationMs ?? 3000;
 
  const isOwn = repost.user.user_id === currentUserId;

  const getCurrentUserInfo = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        return {
          user_id: userObj.user_id || userObj.id,
          f_name: userObj.f_name || '',
          m_name: userObj.m_name || '',
          l_name: userObj.l_name || '',
          profile_pic: userObj.profile_pic || ''
        };
      }
    } catch (e) {
      console.error('Error getting current user info:', e);
    }
    return null;
  };

  const handleLike = async () => {
    if (!currentUserId) {
      console.warn('Cannot like: No current user');
      return;
    }

    const currentUserInfo = getCurrentUserInfo();
    if (!currentUserInfo) {
      console.warn('Cannot like: No current user info found');
      return;
    }

    try {
      setLiked(true);
      setLikesCount(c => c + 1);
      setFetchedLikes(prev => [...prev, {
        user_id: currentUserId,
        user: {
          user_id: currentUserInfo.user_id,
          f_name: currentUserInfo.f_name,
          m_name: currentUserInfo.m_name,
          l_name: currentUserInfo.l_name,
          profile_pic: currentUserInfo.profile_pic
        }
      }]);

      await likeRepost(repost.repost_id);
    } catch (e) {
      console.error('Error liking repost:', e);
      setLiked(false);
      setLikesCount(c => Math.max(0, c - 1));
      setFetchedLikes(prev => prev.filter(like => {
        const likeUser = like.user || like;
        return likeUser.user_id !== currentUserId;
      }));
      alert('Failed to update like. Please try again.');
    }
  };

  const handleUnlike = async () => {
    if (!currentUserId) {
      console.warn('Cannot unlike: No current user');
      return;
    }

    const currentUserInfo = getCurrentUserInfo();

    try {
      setLiked(false);
      setLikesCount(c => Math.max(0, c - 1));
      setFetchedLikes(prev => prev.filter(like => {
        const likeUser = like.user || like;
        return likeUser.user_id !== currentUserId;
      }));

      await unlikeRepost(repost.repost_id);
    } catch (e) {
      console.error('Error unliking repost:', e);
      setLiked(true);
      setLikesCount(c => c + 1);
      if (currentUserInfo) {
        setFetchedLikes(prev => [...prev, {
          user_id: currentUserId,
          user: {
            user_id: currentUserInfo.user_id,
            f_name: currentUserInfo.f_name,
            m_name: currentUserInfo.m_name,
            l_name: currentUserInfo.l_name,
            profile_pic: currentUserInfo.profile_pic
          }
        }]);
      }
      alert('Failed to update like. Please try again.');
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentValue.trim()) return;
    if (!currentUserId) {
      console.warn('Cannot comment: No current user');
      alert('Please log in to comment');
      return;
    }

    try {
      await commentOnRepost(repost.repost_id, commentValue.trim());
      setCommentValue('');
      setShowCommentInput(false);
      setShowCommentsSection(true);
      setShowMentionSuggestions(false);
      setMentionStart(-1);
      await loadComments();
      onRefresh?.();
    } catch (e) {
      console.error('Error submitting comment:', e);
      alert('Failed to submit comment. Please try again.');
    }
  };

  // @mention functionality for comments
  const handleCommentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCommentValue(newValue);

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    
    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's no space after @ (meaning we're typing a mention)
      if (!textAfterAt.includes(' ')) {
        setMentionStart(lastAtIndex);
        setShowMentionSuggestions(true);
        
        // Filter suggestions based on what's typed after @
        const filteredSuggestions = followingUsers.filter(user =>
          user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.f_name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.l_name.toLowerCase().includes(textAfterAt.toLowerCase())
        );
        setMentionSuggestions(filteredSuggestions);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const selectMention = (user: any) => {
    if (mentionStart === -1) return;

    // Get the text after the @ symbol
    const textAfterAt = commentValue.substring(mentionStart + 1);
    // Find where the current partial mention ends (at space or end of string)
    const spaceIndex = textAfterAt.indexOf(' ');
    const mentionEnd = spaceIndex !== -1 
      ? mentionStart + 1 + spaceIndex
      : commentValue.length;
    
    const beforeMention = commentValue.substring(0, mentionStart);
    const afterMention = commentValue.substring(mentionEnd);
    
    const newValue = beforeMention + `@${user.name} ` + afterMention;
    setCommentValue(newValue);
    
    setShowMentionSuggestions(false);
    setMentionStart(-1);
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentionSuggestions) {
      if (e.key === 'Enter' && commentValue.trim()) {
        e.preventDefault();
        handleCommentSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (mentionSuggestions[selectedMentionIndex]) {
          selectMention(mentionSuggestions[selectedMentionIndex]);
        }
        break;
      case 'Escape':
        setShowMentionSuggestions(false);
        break;
    }
  };

  const scrollIntoViewSmooth = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const startHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setActiveCommentHighlight(null);
      setActiveReplyHighlight(null);
    }, highlightDuration);
  }, [highlightDuration]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoOpenComments && comments.length > 0) {
      setShowCommentsSection(true);
    }
  }, [autoOpenComments, comments]);

  useEffect(() => {
    processedCommentHighlightRef.current = null;
  }, [highlightCommentId]);

  useEffect(() => {
    if (!highlightCommentId) return;
    if (processedCommentHighlightRef.current === highlightCommentId) return;

    const commentIdNum = Number(highlightCommentId);
    if (Number.isNaN(commentIdNum)) return;
    if (comments.length === 0) return;

    const commentExists = comments.some(comment => Number(comment.comment_id) === commentIdNum);
    if (!commentExists) return;

    processedCommentHighlightRef.current = highlightCommentId;
    setShowCommentsSection(true);
    setShowAllComments(true);
    setActiveCommentHighlight(commentIdNum);
    startHighlightTimer();
    requestAnimationFrame(() => {
      scrollIntoViewSmooth(commentRefs.current[commentIdNum]);
    });
  }, [highlightCommentId, comments, startHighlightTimer, scrollIntoViewSmooth]);

  const loadComments = async () => {
    // Repost comments are included in the repost data itself
    // Just refresh the parent to get updated comments
    onRefresh?.();
  };

  const handleEditComment = (commentId: number) => {
    const comment = comments.find(c => c.comment_id === commentId);
    if (comment) {
      setEditCommentContent(prev => ({ ...prev, [commentId]: comment.comment_content }));
      setEditingComment(prev => ({ ...prev, [commentId]: true }));
      setShowCommentOptions(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleSaveEditComment = async (commentId: number) => {
    const newContent = editCommentContent[commentId];
    if (!newContent?.trim()) return;

    try {
      await editRepostComment(repost.repost_id, commentId, { comment_content: newContent.trim() });
      setEditingComment(prev => ({ ...prev, [commentId]: false }));
      setEditCommentContent(prev => ({ ...prev, [commentId]: '' }));
      await loadComments();
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to edit comment');
    }
  };

  const handleCancelEditComment = (commentId: number) => {
    setEditingComment(prev => ({ ...prev, [commentId]: false }));
    setEditCommentContent(prev => ({ ...prev, [commentId]: '' }));
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await deleteRepostComment(repost.repost_id, commentId);
      await loadComments();
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    }
  };

  const handleReplyAdded = async (commentId: number) => {
    setShowReplyInput(prev => ({ ...prev, [commentId]: false }));
    await loadReplies(commentId);
  };

  const loadReplies = useCallback(async (commentId: number) => {
    try {
      const response = await getCommentReplies(commentId);
      if (response && response.replies) {
        setCommentReplies(prev => ({ ...prev, [commentId]: response.replies }));
      }
    } catch (error) {
      console.error('Error loading replies:', error);
      setCommentReplies(prev => ({ ...prev, [commentId]: [] }));
    }
  }, []);

  useEffect(() => {
    if (!highlightReplyId) return;
    if (processedReplyHighlightRef.current === highlightReplyId) return;

    const replyIdNum = Number(highlightReplyId);
    if (Number.isNaN(replyIdNum)) return;
    if (comments.length === 0) return;

    const entry = Object.entries(commentReplies).find(([, replies]) =>
      replies?.some(reply => Number(reply.reply_id) === replyIdNum)
    );

    if (entry) {
      processedReplyHighlightRef.current = highlightReplyId;
      const commentIdNum = Number(entry[0]);
      setShowCommentsSection(true);
      setShowAllComments(true);
      setShowReplies(prev => ({ ...prev, [commentIdNum]: true }));
      setActiveCommentHighlight(commentIdNum);
      setActiveReplyHighlight(replyIdNum);
      startHighlightTimer();
      requestAnimationFrame(() => {
        scrollIntoViewSmooth(replyRefs.current[replyIdNum] || commentRefs.current[commentIdNum]);
      });
    } else {
      comments.forEach(comment => {
        if (!commentReplies[comment.comment_id] && !requestedReplyLoadsRef.current.has(comment.comment_id)) {
          requestedReplyLoadsRef.current.add(comment.comment_id);
          loadReplies(comment.comment_id);
        }
      });
    }
  }, [highlightReplyId, comments, commentReplies, loadReplies, scrollIntoViewSmooth, startHighlightTimer]);

  // Auto-load replies for comments that have replies_count > 0
  useEffect(() => {
    if (comments && comments.length > 0) {
      (async () => {
        for (const comment of comments) {
          if (comment.replies_count && comment.replies_count > 0) {
            // Only load if not already loaded
            if (!commentReplies[comment.comment_id]) {
              await loadReplies(comment.comment_id);
            }
            // Replies remain collapsed by default - user must click "View more replies" to expand
          }
        }
      })();
    }
  }, [comments, loadReplies]);

  const getProfilePath = (userId: number) => {
    const path = window.location.pathname;
    if (path.startsWith('/peso')) {
      return `/peso/profile/${userId}`;
    } else if (path.startsWith('/ccict')) {
      return `/ccict/profile/${userId}`;
    } else {
      return `/profile/${userId}`;
    }
  };

  const handleUserSearch = async (searchTerm: string) => {
    try {
      const response = await searchAlumni(searchTerm);
      if (response.results && response.results.length > 0) {
        // Take the first result (most relevant match)
        const user = response.results[0];
        const currentPath = window.location.pathname;
        
        // Navigate based on user account type - unified profile route
        if (user.account_type?.peso) {
          window.location.href = `/peso/profile/${user.id}`;
        } else if (user.account_type?.admin) {
          window.location.href = `/ccict/profile/${user.id}`;
        } else if (currentPath.startsWith('/peso')) {
          window.location.href = `/peso/profile/${user.id}`;
        } else if (currentPath.startsWith('/ccict')) {
          window.location.href = `/ccict/profile/${user.id}`;
        } else {
          // Unified profile route for alumni, OJT, and other users
          window.location.href = `/profile/${user.id}`;
        }
      } else {
        alert(`No user found with name "${searchTerm}"`);
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      alert(`Error searching for user "${searchTerm}"`);
    }
  };

  // Helper function to check if a mention matches a known user
  const checkMentionMatch = (mentionText: string): { matched: boolean; user?: any } => {
    const normalizedMention = mentionText.toLowerCase().replace(/\s+/g, '');
    
    // Check repost author
    if (repost.user) {
      const repostAuthorName = `${repost.user.f_name} ${repost.user.m_name || ''} ${repost.user.l_name}`.trim();
      const normalizedRepostAuthor = repostAuthorName.toLowerCase().replace(/\s+/g, '');
      if (normalizedMention === normalizedRepostAuthor) {
        return { matched: true, user: repost.user };
      }
    }
    
    // Check original post author
    if (repost.original_post?.user) {
      const originalAuthorName = `${repost.original_post.user.f_name} ${repost.original_post.user.m_name || ''} ${repost.original_post.user.l_name}`.trim();
      const normalizedOriginalAuthor = originalAuthorName.toLowerCase().replace(/\s+/g, '');
      if (normalizedMention === normalizedOriginalAuthor) {
        return { matched: true, user: repost.original_post.user };
      }
    }
    
    // Check following users
    for (const user of followingUsers) {
      const userName = `${user.f_name} ${user.m_name || ''} ${user.l_name}`.trim();
      const normalizedUserName = userName.toLowerCase().replace(/\s+/g, '');
      if (normalizedMention === normalizedUserName) {
        return { matched: true, user };
      }
    }
    
    return { matched: false };
  };

  // Helper function to process mentions in a text segment with partial match support
  const processMentionsInText = (textSegment: string, keyPrefix: string): React.ReactNode[] => {
    const mentionRegex = /@([A-Za-z0-9_.]+(?:\s+[A-Za-z0-9_.]+)*)/g;
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyCounter = 0;
    mentionRegex.lastIndex = 0;
    
    while ((match = mentionRegex.exec(textSegment)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        result.push(<span key={`${keyPrefix}-text-${keyCounter++}`}>{textSegment.substring(lastIndex, match.index)}</span>);
      }
      
      const mentionText = match[1]; // Don't trim yet, we need the original spacing
      if (mentionText) {
        const normalizedMention = mentionText.toLowerCase().replace(/\s+/g, '');
        const matchResult = checkMentionMatch(mentionText);
        
        if (matchResult.matched && matchResult.user) {
          const matchedUserName = `${matchResult.user.f_name} ${matchResult.user.m_name || ''} ${matchResult.user.l_name}`.trim();
          const normalizedMatchedName = matchedUserName.toLowerCase().replace(/\s+/g, '');
          const isExactMatch = normalizedMention === normalizedMatchedName;
          const startsWithName = normalizedMention.startsWith(normalizedMatchedName);
          
          if (isExactMatch) {
            // Exact match - highlight the entire mention
            const matchedUser = matchResult.user;
            result.push(
              <button
                key={`${keyPrefix}-mention-${keyCounter++}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const userId = matchedUser.user_id || matchedUser.id;
                  if (userId) {
                    const currentPath = window.location.pathname;
                    if (currentPath.startsWith('/peso')) {
                      window.location.href = `/peso/profile/${userId}`;
                    } else if (currentPath.startsWith('/ccict')) {
                      window.location.href = `/ccict/profile/${userId}`;
                    } else {
                      window.location.href = `/profile/${userId}`;
                    }
                  } else {
                    handleUserSearch(mentionText);
                  }
                }}
                style={{ 
                  color: '#007bff', 
                  fontWeight: '600',
                  background: 'none',
                  border: 'none',
                  padding: '0',
                  cursor: 'pointer',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                @{mentionText}
              </button>
            );
          } else if (startsWithName) {
            // Partial match - find where the user's name ends in the mention text
            const mentionWords = mentionText.split(/\s+/);
            const nameWords = matchedUserName.split(/\s+/);
            
            let matchedWordCount = 0;
            for (let i = 0; i < Math.min(mentionWords.length, nameWords.length); i++) {
              if (mentionWords[i].toLowerCase() === nameWords[i].toLowerCase()) {
                matchedWordCount++;
              } else {
                break;
              }
            }
            
            if (matchedWordCount > 0 && matchedWordCount <= mentionWords.length) {
              // Build a regex pattern to match the exact name at the start of mentionText
              // Escape special regex characters in the name
              const escapedName = matchedUserName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              // Create a pattern that matches the name followed by optional whitespace and more text
              const namePattern = new RegExp(`^(${escapedName})(\\s+.*)?$`, 'i');
              const nameMatch = mentionText.match(namePattern);
              
              if (nameMatch && nameMatch[1]) {
                // Found exact match of the name at the start
                const matchedPart = nameMatch[1];
                const remainingPart = mentionText.substring(matchedPart.length);
                const matchedUser = matchResult.user;
                
                result.push(
                  <button
                    key={`${keyPrefix}-mention-${keyCounter++}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const userId = matchedUser.user_id || matchedUser.id;
                      if (userId) {
                        const currentPath = window.location.pathname;
                        if (currentPath.startsWith('/peso')) {
                          window.location.href = `/peso/profile/${userId}`;
                        } else if (currentPath.startsWith('/ccict')) {
                          window.location.href = `/ccict/profile/${userId}`;
                        } else {
                          window.location.href = `/profile/${userId}`;
                        }
                      } else {
                        handleUserSearch(matchedPart.trim());
                      }
                    }}
                    style={{ 
                      color: '#007bff', 
                      fontWeight: '600',
                      background: 'none',
                      border: 'none',
                      padding: '0',
                      cursor: 'pointer',
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                  >
                    @{matchedPart}
                  </button>
                );
                
                // Add remaining text as normal text
                if (remainingPart.trim()) {
                  result.push(<span key={`${keyPrefix}-text-${keyCounter++}`}>{remainingPart}</span>);
                }
              } else {
                // Fallback: use word-based matching
                const matchedWords = mentionWords.slice(0, matchedWordCount);
                // Find the position where these words end in the original text
                let searchPos = 0;
                for (let i = 0; i < matchedWords.length; i++) {
                  const wordPos = mentionText.indexOf(matchedWords[i], searchPos);
                  if (wordPos !== -1) {
                    searchPos = wordPos + matchedWords[i].length;
                  } else {
                    break;
                  }
                }
                
                const matchedPart = mentionText.substring(0, searchPos);
                const remainingPart = mentionText.substring(searchPos);
                const matchedUser = matchResult.user;
                
                result.push(
                  <button
                    key={`${keyPrefix}-mention-${keyCounter++}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const userId = matchedUser.user_id || matchedUser.id;
                      if (userId) {
                        const currentPath = window.location.pathname;
                        if (currentPath.startsWith('/peso')) {
                          window.location.href = `/peso/profile/${userId}`;
                        } else if (currentPath.startsWith('/ccict')) {
                          window.location.href = `/ccict/profile/${userId}`;
                        } else {
                          window.location.href = `/profile/${userId}`;
                        }
                      } else {
                        handleUserSearch(matchedPart.trim());
                      }
                    }}
                    style={{ 
                      color: '#007bff', 
                      fontWeight: '600',
                      background: 'none',
                      border: 'none',
                      padding: '0',
                      cursor: 'pointer',
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                  >
                    @{matchedPart}
                  </button>
                );
                
                if (remainingPart.trim()) {
                  result.push(<span key={`${keyPrefix}-text-${keyCounter++}`}>{remainingPart}</span>);
                }
              }
            } else {
              // No match found - render as normal text
              result.push(<span key={`${keyPrefix}-text-${keyCounter++}`}>@{mentionText}</span>);
            }
          } else {
            // No match found - render as normal text
            result.push(<span key={`${keyPrefix}-text-${keyCounter++}`}>@{mentionText}</span>);
          }
        } else {
          // No match found - render as normal text
          result.push(<span key={`${keyPrefix}-text-${keyCounter++}`}>@{mentionText}</span>);
        }
      }
      
      lastIndex = mentionRegex.lastIndex;
    }
    
    // Add remaining text after the last mention
    if (lastIndex < textSegment.length) {
      result.push(<span key={`${keyPrefix}-text-${keyCounter++}`}>{textSegment.substring(lastIndex)}</span>);
    }
    
    return result;
  };

  const renderTextWithLinks = (text: string | undefined | null) => {
    if (!text) return null;
    
    // Enhanced URL regex that matches:
    // - http:// or https:// URLs
    // - www. URLs
    // - plain domains (like fb.com, example.com, etc.)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})([^\s]*)?)/gi;
    const mentionRegex = /@([A-Za-z0-9_.]+(?:\s+[A-Za-z0-9_.]+)*)/g;
    // Note: We intentionally do NOT auto-detect regular names anymore to avoid
    // over-highlighting common words. Only URLs and @mentions are interactive.
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    
    // Reset regex for global search
    urlRegex.lastIndex = 0;
    
    // First, find all URLs
    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        // Process mentions in the text before URL
        const mentionParts = processMentionsInText(textBefore, `before-url-${key}`);
        parts.push(...mentionParts);
      }
      
      // Create clickable link
      let url = match[0];
      
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      parts.push(
        <a
          key={`link-${key++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#174f84',
            textDecoration: 'underline',
            cursor: 'pointer',
            wordBreak: 'break-all'
          }}
          onClick={(e) => {
            e.stopPropagation();
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
        >
          {match[0]}
        </a>
      );
      
      lastIndex = urlRegex.lastIndex;
    }
    
    // Add remaining text after the last URL
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      // Process mentions in remaining text
      const mentionParts = processMentionsInText(remainingText, `remaining-${key}`);
      parts.push(...mentionParts);
    }
    
    // If no URLs or mentions found, return the original text
    if (parts.length === 0) {
      return text;
    }
    
    return parts;
  };

  const handleEditRepost = () => {
    if (!isOwn) {
      alert('You can only edit your own reposts');
      return;
    }
    setLocalEditRepostContent(repost.repost_caption || '');
    setLocalEditingRepost(true);
    setLocalShowRepostOptions(false);
  };

  const handleDeleteRepost = async () => {
    if (!isOwn) {
      alert('You can only delete your own reposts');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this repost?')) {
      try {
        await deleteRepost(repost.repost_id);
        onRefresh?.();
        alert('Repost deleted successfully');
      } catch (error) {
        console.error('Error deleting repost:', error);
        alert('Failed to delete repost');
      }
    }
    setLocalShowRepostOptions(false);
  };

  const handleSaveEditRepost = async () => {
    const newContent = localEditRepostContent;
    
    if (!newContent?.trim()) {
      alert('Repost caption cannot be empty');
      return;
    }

    try {
      await editRepost(repost.repost_id, { caption: newContent.trim() });
      setLocalEditingRepost(false);
      setLocalEditRepostContent('');
      onRefresh?.();
    } catch (error) {
      console.error('Error editing repost:', error);
      alert('Failed to edit repost');
    }
  };

  const handleCancelEditRepost = () => {
    setLocalEditingRepost(false);
    setLocalEditRepostContent('');
  };

  const handleEditOriginalPost = () => {
    if (original.user?.user_id !== currentUserId) {
      alert('You can only edit your own posts');
      return;
    }

    const donationId =
      original.donation_id ??
      (original as any)?.donation_id ??
      (original as any)?.donation?.donation_id ??
      null;
    const contextType: RepostContext = context || (donationId ? 'donation' : 'post');
    const originalContent =
      (contextType === 'donation'
        ? (original.post_content ?? (original as any)?.description)
        : original.post_content) || '';

    setLocalEditOriginalContent(originalContent);
    setLocalEditingOriginal(true);
    setLocalShowOriginalOptions(false);
    
    // Also update props if provided
    if (setEditRepostContent && setEditingRepost) {
      setEditRepostContent(prev => ({ ...prev, [`original_${original.post_id}`]: originalContent }));
      setEditingRepost(prev => ({ ...prev, [`original_${original.post_id}`]: true }));
      setShowOptions?.(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
    }
  };

  const handleDeleteOriginalPost = async () => {
    if (original.user?.user_id !== currentUserId) {
      alert('You can only delete your own posts');
      return;
    }

    const donationId =
      original.donation_id ??
      (original as any)?.donation_id ??
      (original as any)?.donation?.donation_id ??
      null;
    const postId =
      original.post_id ??
      (original as any)?.post_id ??
      (original as any)?.id ??
      null;
    const contextType: RepostContext = context || (donationId ? 'donation' : 'post');

    const confirmMessage =
      contextType === 'donation'
        ? 'Are you sure you want to delete this donation request?'
        : 'Are you sure you want to delete this original post?';

    try {
      if (!window.confirm(confirmMessage)) {
        return;
      }

      if (contextType === 'donation') {
        const targetDonationId = donationId ?? postId;
        if (!targetDonationId) {
          alert('Missing donation identifier. Please refresh and try again.');
          return;
        }
        await deleteDonationRequest(targetDonationId);
        alert('Donation request deleted successfully');
      } else if (contextType === 'forum') {
        if (!postId) {
          alert('Missing forum post identifier. Please refresh and try again.');
          return;
        }
        await deleteForumPost(postId);
        alert('Forum post deleted successfully');
      } else {
        if (!postId) {
          alert('Missing post identifier. Please refresh and try again.');
          return;
        }
        await deletePost(postId);
        alert('Original post deleted successfully');
      }

      onRefresh?.();
    } catch (error) {
      console.error('Error deleting original post:', error);
      alert('Failed to delete original content');
    } finally {
      setLocalShowOriginalOptions(false);
      setShowOptions?.(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
    }
  };

  const handleSaveEditOriginalPost = async () => {
    const newContent = localEditOriginalContent;
    
    if (!newContent?.trim()) {
      alert('Post content cannot be empty');
      return;
    }

    const donationId =
      original.donation_id ??
      (original as any)?.donation_id ??
      (original as any)?.donation?.donation_id ??
      null;
    const postId =
      original.post_id ??
      (original as any)?.post_id ??
      (original as any)?.id ??
      null;
    const contextType: RepostContext = context || (donationId ? 'donation' : 'post');

    try {
      if (contextType === 'donation') {
        const targetDonationId = donationId ?? postId;
        if (!targetDonationId) {
          alert('Missing donation identifier. Please refresh and try again.');
          return;
        }
        await updateDonationRequest(targetDonationId, { description: newContent.trim() });
      } else if (contextType === 'forum') {
        if (!postId) {
          alert('Missing forum post identifier. Please refresh and try again.');
          return;
        }
        await editForumPost(postId, { content: newContent.trim() });
      } else {
        if (!postId) {
          alert('Missing post identifier. Please refresh and try again.');
          return;
        }
        await editPost(postId, { post_content: newContent.trim() });
      }

      setLocalEditingOriginal(false);
      setLocalEditOriginalContent('');
      
      // Also update props if provided
      if (setEditingRepost && setEditRepostContent) {
        setEditingRepost(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
        setEditRepostContent(prev => ({ ...prev, [`original_${original.post_id}`]: '' }));
      }
      
      onRefresh?.();
    } catch (error) {
      console.error('Error editing original post:', error);
      alert('Failed to edit original post');
    }
  };

  // Load likes data once on mount to display usernames in summary
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getRepostLikes(repost.repost_id);
        if (mounted) {
          setFetchedLikes(data?.likes || []);
        }
      } catch {
        if (mounted) setFetchedLikes([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [repost.repost_id]);

  // Sync comments from prop
  useEffect(() => {
    setComments(repost.comments || []);
  }, [repost.comments, repost.comments_count, repost.repost_id]);

  // Handle clicking outside the options menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on Edit or Delete button
      if (target.tagName === 'BUTTON' && target.textContent && 
          (target.textContent.trim() === 'Edit' || target.textContent.trim() === 'Delete')) {
        return;
      }
      
      // Check main options menu
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        if (localShowRepostOptions) {
          setLocalShowRepostOptions(false);
        }
        if (localShowOriginalOptions) {
          setLocalShowOriginalOptions(false);
        }
      }
      
      // Check comment options menus
      Object.keys(showCommentOptions).forEach((commentId) => {
        const ref = commentOptionsRefs.current[Number(commentId)];
        if (ref && !ref.contains(target) && showCommentOptions[Number(commentId)]) {
          setShowCommentOptions(prev => ({ ...prev, [Number(commentId)]: false }));
        }
      });
    };

    const hasOpenMenu = localShowRepostOptions || localShowOriginalOptions || Object.values(showCommentOptions).some(v => v);
    
    if (hasOpenMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [localShowRepostOptions, localShowOriginalOptions, showCommentOptions]);

  useEffect(() => {
    if (!showLikesModal) return;
    let mounted = true;
    (async () => {
      setLikesLoading(true);
      try {
        const data = await getRepostLikes(repost.repost_id);
        if (mounted) setFetchedLikes(data?.likes || []);
      } catch {
        if (mounted) setFetchedLikes([]);
      } finally {
        if (mounted) setLikesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showLikesModal, repost.repost_id]);

  const goToOriginal = () => {
    const id = original.post_id;
    if (!id) return;
    localStorage.setItem('pendingPostView', String(id));
    const path = window.location.pathname;
    if (path.startsWith('/peso')) {
      window.location.href = `/peso/dashboard/${id}`;
    } else if (path.startsWith('/ccict')) {
      window.location.href = `/ccict/dashboard/${id}`;
    } else {
      window.location.href = `/dashboard/${id}`;
    }
  };

  return (
    <div className="post-feed-card" style={{ 
      marginBottom: '16px', 
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      overflow: showMentionSuggestions ? 'visible' : 'hidden'
    }}>
      {/* Repost header */}
      <div className="post-header">
        <div className="post-header-left">
          <img
            src={reposterAvatar}
            alt={reposterName}
            className="post-header-profile-image"
            style={{ cursor: 'pointer' }}
            onError={handleProfilePicError}
            onClick={() => {
              if (repost.user.user_id) {
                window.location.href = getProfilePath(repost.user.user_id);
              }
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                className="post-author-info"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (repost.user.user_id) {
                    window.location.href = getProfilePath(repost.user.user_id);
                  }
                }}
              >
                {reposterName || 'User'}
              </div>
              {context === 'donation' && (
                <span style={{
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: '600',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  Donation
                </span>
              )}
            </div>
            <div className="post-author-details" style={{ color: '#666', fontSize: '12px' }}>
              <span>{formatTime(repost.repost_date)}</span>
            </div>
          </div>
        </div>
        
        {/* Three dots menu - only show for owned reposts */}
        {isOwn && (
          <div className="post-header-right" style={{ position: 'relative' }} ref={optionsMenuRef}>
            <button
              onClick={() => {
                setLocalShowRepostOptions(!localShowRepostOptions);
                // Also update props if provided
                setShowOptions?.(prev => ({ ...prev, [repost.repost_id]: !prev[repost.repost_id] }));
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#666'
              }}
            >
              ⋯
            </button>
            
            {localShowRepostOptions && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  minWidth: '120px',
                  overflow: 'hidden'
                }}
              >
                <button
                  onClick={handleEditRepost}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#333'
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteRepost}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#dc3545'
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit repost caption */}
      {localEditingRepost && (
        <div style={{ marginBottom: 12 }}>
          <textarea
            value={localEditRepostContent}
            onChange={(e) => {
              setLocalEditRepostContent(e.target.value);
              // Also update props if provided
              setEditRepostContent?.(prev => ({ ...prev, [repost.repost_id]: e.target.value }));
            }}
            placeholder="Edit your repost caption..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancelEditRepost}
              style={{
                padding: '6px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: '#fff',
                color: '#666',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditRepost}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                background: '#007bff',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Repost caption (if not editing) */}
      {!localEditingRepost && repost.repost_caption && repost.repost_caption.trim() && (
        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 12 }}>
          {renderTextWithLinks(repost.repost_caption)}
        </div>
      )}

      {/* Nested original preview */}
      <div className="post-content" style={{ background: '#fff' }}>
        <div
          role="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!original || localEditingOriginal) return;
            // If onViewOriginalPost is provided, use it to open modal (same as donation)
            if (onViewOriginalPost) {
              onViewOriginalPost(original);
            } else {
              // Fallback: navigate to original post (for contexts without modal handler)
              goToOriginal();
            }
          }}
          onMouseDown={(e) => {
            if (localEditingOriginal) {
              e.stopPropagation();
              return;
            }
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            border: '1px solid #e9ecef',
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#f8f9fa',
            cursor: !localEditingOriginal && original.post_id ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
            marginBottom: 12
          }}
          onMouseEnter={(e) => {
            if (localEditingOriginal) return;
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
          }}
        >
          <div style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src={originalPosterAvatar}
                alt={originalPosterName}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                onError={handleProfilePicError}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 13, color: '#333' }}>{originalPosterName || 'Original Post'}</div>
                  {original.donation_id && (
                    <span style={{
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: '600',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      Donation
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#666' }}>{formatTime(original.created_at)}</div>
              </div>
            </div>
            
            {/* Three dots menu for original post owner */}
            {original.user?.user_id === currentUserId && (
              <div style={{ position: 'relative' }} ref={optionsMenuRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering the goToOriginal function
                    setLocalShowOriginalOptions(!localShowOriginalOptions);
                    // Also update props if provided
                    setShowOptions?.(prev => ({ ...prev, [`original_${original.post_id}`]: !prev[`original_${original.post_id}`] }));
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: '#666',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f0f0')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                >
                  ⋯
                </button>
                
                {localShowOriginalOptions && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      background: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      zIndex: 1000,
                      minWidth: '120px',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditOriginalPost();
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#333'
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOriginalPost();
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#dc3545'
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ padding: '0 12px 12px 12px' }}>
            {/* Edit original post content */}
            {localEditingOriginal ? (
              <div>
                <textarea
                  value={localEditOriginalContent}
                  onChange={(e) => {
                    setLocalEditOriginalContent(e.target.value);
                    // Also update props if provided
                    setEditRepostContent?.(prev => ({ ...prev, [`original_${original.post_id}`]: e.target.value }));
                  }}
                  placeholder="Edit your post content..."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: '12px'
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocalEditingOriginal(false);
                      setLocalEditOriginalContent('');
                      // Also update props if provided
                      setEditingRepost?.(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
                      setEditRepostContent?.(prev => ({ ...prev, [`original_${original.post_id}`]: '' }));
                    }}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveEditOriginalPost();
                    }}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#007bff',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              original.post_content && (
                <div 
                  style={{ fontSize: 13, color: '#333', lineHeight: 1.5, marginBottom: 8 }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {renderTextWithLinks(original.post_content)}
                </div>
              )
            )}
            {(() => {
              const originalImages = getImagesFromPost(original);
              if (originalImages.length === 0) return null;

              return (
                <div style={{ marginTop: 8 }}>
                  {originalImages.length === 1 ? (
                    // Single image - centered
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <img
                        src={getImageUrl(originalImages[0])}
                        alt="original post"
                        style={{ 
                          cursor: 'pointer',
                          width: 'auto',
                          height: 'auto',
                          maxWidth: '100%',
                          maxHeight: '40vh',
                          borderRadius: '8px',
                          objectFit: 'contain'
                        }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        console.error('Failed to load original post image:', originalImages[0]);
                      }}
                    />
                    </div>
                  ) : (
                    // Multiple images grid for original post - Facebook style (smaller)
                    <div style={{
                      display: 'grid',
                      gap: 2,
                      borderRadius: 8,
                      overflow: 'hidden',
                      ...(originalImages.length === 2 ? {
                        gridTemplateColumns: '1fr 1fr',
                        height: '300px'
                      } : originalImages.length === 3 ? {
                        gridTemplateColumns: '2fr 1fr',
                        gridTemplateRows: '1fr 1fr',
                        height: '300px'
                      } : originalImages.length === 4 ? {
                        gridTemplateColumns: '1fr 1fr',
                        gridTemplateRows: '1fr 1fr',
                        height: '300px'
                      } : {
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gridTemplateRows: '1fr 1fr',
                        height: '300px'
                      })
                    }}>
                      {originalImages.slice(0, originalImages.length <= 6 ? originalImages.length : 6).map((image, index) => {
                        let gridArea = '';
                        if (originalImages.length === 3) {
                          // Facebook 3-image layout: large left, two stacked right
                          gridArea = index === 0 ? '1 / 1 / 3 / 2' : `1 / 2 / 2 / 3`;
                          if (index === 2) gridArea = '2 / 2 / 3 / 3';
                        }
                        
                        return (
                          <div key={index} style={{ 
                            position: 'relative',
                            gridArea: gridArea,
                            overflow: 'hidden'
                          }}>
                            <img
                              src={getImageUrl(image)}
                              alt={`original post ${index + 1}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                minHeight: '120px',
                                objectFit: 'contain',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease',
                                backgroundColor: '#f8f9fa'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.02)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                console.error('Failed to load original post image:', image);
                              }}
                            />
                            {/* Show "+X more" overlay for the 6th image if there are more than 6 */}
                            {index === 5 && originalImages.length > 6 && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: 'rgba(0, 0, 0, 0.75)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: 14,
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  borderRadius: 6
                                }}
                              >
                                +{originalImages.length - 6}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Facebook-style likes and comments display */}
      <PostStatsRow
        likes={fetchedLikes}
        comments={comments}
        onLikesClick={() => setShowLikesModal(true)}
        onCommentsClick={() => {
          // Toggle comments section visibility
          setShowCommentsSection(prev => !prev);
        }}
        animate={true}
      />

      {/* Actions */}
      <div className="post-footer-actions">
          <button
            onClick={() => liked ? handleUnlike() : handleLike()}
            type="button"
            className={`post-footer-action${liked ? ' active' : ''}`}
            aria-pressed={!!liked}
          >
            <span className="post-footer-icon">
              <FontAwesomeIcon 
                icon={liked ? faThumbsUp : faThumbsUpReg} 
                size="lg" 
                style={{ color: liked ? '#1e3a8a' : '#555', fontSize: '18px' }} 
              />
            </span>
            <span className="post-footer-label">Like</span>
          </button>
          <button
            onClick={() => setShowCommentInput(v => !v)}
            type="button"
            className={`post-footer-action${showCommentInput ? ' active' : ''}`}
            aria-expanded={!!showCommentInput}
          >
            <span className="post-footer-icon">
              <FontAwesomeIcon icon={faCommentReg} size="lg" style={{ fontSize: '20px', color: '#555' }} />
            </span>
            <span className="post-footer-label">Comment</span>
          </button>
          <RepostButton
            originalPost={{
              post_id: original.post_id || 0,
              post_content: original.post_content || '',
              post_image: undefined,
              post_images: getImagesFromPost(original).map((url, index) => ({
                image_id: index + 1,
                image_url: url,
                order: index
              })),
              user: {
                user_id: original.user?.user_id || 0,
                f_name: original.user?.f_name || '',
                m_name: original.user?.m_name || '',
                l_name: original.user?.l_name || '',
                profile_pic: original.user?.profile_pic
              },
              created_at: (original.created_at as any) || ''
            }}
            currentUser={{ name: reposterName, profile_pic: reposterAvatar }}
            onRepost={onRefresh}
            formatTime={formatTime}
            isForum={context === 'forum'}
            isDonation={context === 'donation'}
          />
      </div>

      {/* Comment input */}
      {showCommentInput && (
          <div className="comment-input-container" style={{ 
            position: 'relative', 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: '1px solid #f0f0f0'
          }}>
            <img 
              src={currentUserAvatar || getProfilePicUrl(null)} 
              alt="Profile" 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '2px solid #e0e0e0',
                objectFit: 'cover',
                flexShrink: 0
              }}
              onError={handleProfilePicError}
            />
            <input
              ref={commentInputRef}
              type="text"
              placeholder="Type your comment..."
              value={commentValue}
              onChange={handleCommentInputChange}
              onKeyDown={handleCommentKeyDown}
              style={{
                flex: 1,
                border: '1px solid #ddd',
                borderRadius: '20px',
                padding: '10px 16px',
                fontSize: '14px'
              }}
              autoFocus
            />
            <button 
              onClick={handleCommentSubmit}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#007bff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.2s',
                padding: 0
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#0056b3'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#007bff'; }}
            >
              <IoSend size={18} color="#fff" />
            </button>
            
            {/* @mention suggestions dropdown */}
            {showMentionSuggestions && mentionSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '44px',
                right: '48px',
                backgroundColor: 'white',
                border: '1px solid #e4e6ea',
                borderRadius: '8px',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto',
                marginTop: '4px'
              }}>
                <div style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #e4e6ea',
                  backgroundColor: '#f8f9fa',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#65676b'
                }}>
                  Mention someone
                </div>
                {mentionSuggestions.map((user, index) => (
                  <div
                    key={user.user_id}
                    onClick={() => selectMention(user)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: index === selectedMentionIndex ? '#e3f2fd' : 'transparent',
                      borderBottom: index < mentionSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background-color 0.1s ease'
                    }}
                    onMouseEnter={() => setSelectedMentionIndex(index)}
                  >
                    <img
                      src={getProfilePicUrl(user.profile_pic)}
                      alt={user.name}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid #e4e6ea'
                      }}
                      onError={handleProfilePicError}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: '#1c1e21',
                        marginBottom: '2px'
                      }}>
                        {user.f_name} {user.m_name || ''} {user.l_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      )}


      {/* Comments section */}
      {((comments && comments.length > 0) || (repost.comments_count && repost.comments_count > 0)) && showCommentsSection ? (
          <div className="comments-section" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
            {comments && comments.length > 0 ? (
              (showAllComments ? comments : comments.slice(0, 5)).map((comment) => {
                const isCommentHighlighted = activeCommentHighlight === comment.comment_id;
                return (
                  <div
                    key={comment.comment_id}
                    className="comment-item"
                    ref={(el) => {
                      if (el) {
                        commentRefs.current[comment.comment_id] = el;
                      } else {
                        delete commentRefs.current[comment.comment_id];
                      }
                    }}
                    style={{ 
                      display: 'flex', 
                      gap: '8px', 
                      marginBottom: '6px', 
                      marginLeft: '12px',
                      marginRight: '12px',
                      scrollMarginTop: '96px'
                    }}
                  >
                    <img
                      src={getProfilePicUrl(comment.user.profile_pic)}
                      alt="Profile"
                      className="comment-profile-image"
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                      onError={handleProfilePicError}
                      onClick={() => {
                        const profilePath = window.location.pathname.startsWith('/peso') 
                          ? `/peso/profile/${comment.user.user_id}` 
                          : window.location.pathname.startsWith('/ccict')
                          ? `/ccict/profile/${comment.user.user_id}`
                          : `/profile/${comment.user.user_id}`;
                        window.location.href = profilePath;
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      {/* Comment bubble container */}
                      <div style={{
                        backgroundColor: isCommentHighlighted ? highlightColor : '#f0f2f5',
                        boxShadow: isCommentHighlighted ? '0 0 0 2px rgba(255,137,33,0.25)' : 'none',
                        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                        borderRadius: '18px',
                        padding: '6px 10px',
                        display: 'inline-block',
                        maxWidth: '100%',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <button
                            onClick={() => window.location.href = getProfilePath(comment.user.user_id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '13px',
                              color: '#050505',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {`${comment.user.f_name} ${comment.user.m_name || ''} ${comment.user.l_name}`.trim()}
                          </button>
                        {((Number(currentUserId) === Number(comment.user.user_id)) || isOwn) && !editingComment[comment.comment_id] && (
                          <div style={{ position: 'relative' }} ref={(el) => { commentOptionsRefs.current[comment.comment_id] = el; }}>
                            <button
                              onClick={() => setShowCommentOptions(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#65676b',
                                padding: '0 4px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#050505';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#65676b';
                              }}
                            >
                              ⋯
                            </button>
                            {showCommentOptions[comment.comment_id] && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  marginTop: '4px',
                                  background: '#fff',
                                  border: '1px solid #e4e6eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                  zIndex: 1000,
                                  minWidth: '120px',
                                  overflow: 'hidden'
                                }}
                              >
                                {(String(currentUserId) === String(comment.user.user_id)) && (
                                  <button
                                    onClick={() => handleEditComment(comment.comment_id)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      color: '#050505',
                                      fontWeight: '400'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f2f3f5';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                  >
                                    Edit
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteComment(comment.comment_id)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    color: '#050505',
                                    fontWeight: '400'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f2f3f5';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        </div>
                        
                        {/* Comment Content */}
                        {editingComment[comment.comment_id] ? (
                          <textarea
                            value={editCommentContent[comment.comment_id] || ''}
                            onChange={(e) => setEditCommentContent(prev => ({ ...prev, [comment.comment_id]: e.target.value }))}
                            style={{
                              width: '100%',
                              minHeight: '50px',
                              padding: '8px 12px',
                              border: '1px solid #ccd0d5',
                              borderRadius: '18px',
                              fontSize: '13px',
                              resize: 'vertical',
                              backgroundColor: '#ffffff',
                              fontFamily: 'inherit'
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEditComment(comment.comment_id);
                              } else if (e.key === 'Escape') {
                                handleCancelEditComment(comment.comment_id);
                              }
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: '13px', color: '#050505', lineHeight: '1.38', wordBreak: 'break-word' }}>
                            {renderTextWithLinks(comment.comment_content)}
                          </div>
                        )}
                      </div>
                      
                      {/* Actions below bubble */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1px', marginLeft: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#65676b', fontWeight: '400' }}>
                          {formatTime(comment.date_created)}
                        </span>
                        
                        {!editingComment[comment.comment_id] && (
                          <button
                            onClick={() => {
                              setShowReplyInput(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }));
                              if (!showReplyInput[comment.comment_id]) {
                                loadReplies(comment.comment_id);
                              }
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#65676b',
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '0',
                              fontWeight: '600'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            Reply
                          </button>
                        )}
                        
                        {editingComment[comment.comment_id] && (
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                              onClick={() => handleSaveEditComment(comment.comment_id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0866ff',
                                cursor: 'pointer',
                                fontSize: '12px',
                                padding: '0',
                                fontWeight: '600'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.textDecoration = 'underline';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.textDecoration = 'none';
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => handleCancelEditComment(comment.comment_id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#65676b',
                                cursor: 'pointer',
                                fontSize: '12px',
                                padding: '0',
                                fontWeight: '600'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.textDecoration = 'underline';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.textDecoration = 'none';
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Reply Input */}
                      {showReplyInput[comment.comment_id] && (
                        <ReplyInput
                          commentId={comment.comment_id}
                          currentUserId={currentUserId || undefined}
                          displayName={reposterName}
                          displayAvatar={reposterAvatar}
                          onReplyAdded={() => handleReplyAdded(comment.comment_id)}
                          commentAuthor={{
                            user_id: comment.user.user_id,
                            f_name: comment.user.f_name || '',
                            m_name: comment.user.m_name || '',
                            l_name: comment.user.l_name || '',
                            name: `${comment.user.f_name || ''} ${comment.user.m_name || ''} ${comment.user.l_name || ''}`.trim()
                          }}
                        />
                      )}
                      
                      {/* Replies */}
                      {commentReplies[comment.comment_id] && commentReplies[comment.comment_id].length > 0 && (
                        <div style={{ marginTop: '4px' }}>
                          {/* Show all replies if less than 3, otherwise show first 3 with toggle */}
                          {commentReplies[comment.comment_id].slice(0, 
                            commentReplies[comment.comment_id].length < 3 ? 
                              commentReplies[comment.comment_id].length : 
                              (showReplies[comment.comment_id] ? commentReplies[comment.comment_id].length : 3)
                          ).map((reply) => (
                            <Reply
                              key={reply.reply_id}
                              reply={reply}
                              commentId={comment.comment_id}
                              currentUserId={currentUserId || undefined}
                              formatTime={formatTime}
                              onReplyUpdate={() => loadReplies(comment.comment_id)}
                              displayName={reposterName}
                              displayAvatar={reposterAvatar}
                              registerHighlightRef={(replyId, element) => {
                                if (element) {
                                  replyRefs.current[replyId] = element;
                                } else {
                                  delete replyRefs.current[replyId];
                                }
                              }}
                              isHighlighted={activeReplyHighlight === reply.reply_id}
                              highlightColor={highlightColor}
                            />
                          ))}
                          
                          {/* Show more/less replies button */}
                          {commentReplies[comment.comment_id].length > 3 && (
                            <button
                              onClick={() => setShowReplies(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#007bff',
                                cursor: 'pointer',
                                fontSize: '11px',
                                padding: '2px 0',
                                marginTop: '2px',
                                marginLeft: '42px'
                              }}
                            >
                              {showReplies[comment.comment_id] 
                                ? 'Hide replies' 
                                : `View ${commentReplies[comment.comment_id].length - 3} more ${commentReplies[comment.comment_id].length - 3 === 1 ? 'reply' : 'replies'}`
                              }
                            </button>
                          )}
                        </div>
                      )}
                      
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '12px 16px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                {repost.comments_count} comment{repost.comments_count === 1 ? '' : 's'} - Click to refresh
                <button 
                  onClick={() => onRefresh?.()} 
                  style={{ 
                    marginLeft: '8px', 
                    padding: '4px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid #007bff', 
                    background: '#fff', 
                    color: '#007bff', 
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Refresh
                </button>
              </div>
            )}
            {comments && comments.length > 5 && !showAllComments && (
              <button
                className="view-all-comments-btn"
                style={{ fontSize: '12px', color: '#1C4E80', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px', marginLeft: '8px' }}
                onClick={() => setShowAllComments(true)}
              >
                View all comments ({comments.length})
              </button>
            )}
            {comments && comments.length > 5 && showAllComments && (
              <button
                className="hide-comments-btn"
                style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px', marginLeft: '8px' }}
                onClick={() => setShowAllComments(false)}
              >
                Hide comments
              </button>
            )}
          </div>
        ) : null}

      {/* Likes modal */}
      {showLikesModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease-out',
            margin: 0,
            padding: 0,
            overflow: 'auto'
          }}
          onClick={() => setShowLikesModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1)',
              maxWidth: 400,
              width: '90%',
              padding: 20,
              position: 'relative',
              border: '1px solid rgba(255,255,255,0.2)',
              animation: 'slideUp 0.3s ease-out',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLikesModal(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                fontSize: 14,
                cursor: 'pointer',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
                e.currentTarget.style.color = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                e.currentTarget.style.color = '#666';
              }}
            >
              ×
            </button>

            <h2 style={{
              margin: '0 0 16px 0',
              fontSize: 18,
              fontWeight: '700',
              color: '#1e4c7a',
              textAlign: 'center',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: 10,
            }}>
              👍 People who liked this
            </h2>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {likesLoading ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#6c757d',
                  fontSize: '14px',
                }}>
                  Loading likes...
                </div>
              ) : fetchedLikes && fetchedLikes.length > 0 ? (
                fetchedLikes.map((like: any, index: number) => {
                  const likeUser = like.user || like;
                  const userName = `${likeUser.f_name || ''} ${likeUser.m_name || ''} ${likeUser.l_name || ''}`.trim();
                  const userProfilePic = getProfilePicUrl(likeUser.profile_pic);

                  return (
                    <div
                      key={index}
                      onClick={() => {
                        if (likeUser.user_id) {
                          const currentPath = window.location.pathname;
                          if (currentPath.startsWith('/peso')) {
                            window.location.href = `/peso/profile/${likeUser.user_id}`;
                          } else if (currentPath.startsWith('/ccict')) {
                            window.location.href = `/ccict/profile/${likeUser.user_id}`;
                          } else {
                            window.location.href = `/profile/${likeUser.user_id}`;
                          }
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        borderBottom: index < (fetchedLikes?.length || 0) - 1 ? '1px solid #f0f0f0' : 'none',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <img
                        src={userProfilePic}
                        alt="Profile"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          marginRight: 12,
                          border: '2px solid #e5e7eb',
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = ctulogo;
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: '600', fontSize: 15, color: '#333' }}>
                          {userName || 'Unknown User'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#6c757d',
                  fontSize: '14px',
                }}>
                  No likes yet
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default RepostCard;
  
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { api, likePost, unlikePost, commentOnPost, deletePost, editPost, deleteComment, editComment, likeDonation, unlikeDonation, commentOnDonation, deleteDonationComment, editDonationComment, repostDonation, deleteDonationRequest, updateDonationRequest, createReply, getCommentReplies, editReply, deleteReply, searchAlumni, getFollowingForMentions, likeRepost, unlikeRepost, getPostLikes, getRepostLikes, getDonationLikes, getForumLikes, getUserPoints, getPostDetail } from '../services/api';
import { 
  commentOnForumPost, 
  deleteForumComment, 
  editForumComment,
  deleteForumPost,
  editForumPost,
  likeForumPost,
  unlikeForumPost,
  repostForumPost,
  // Removed old repost functions - now using unified Like and Comment models
  deleteRepostComment,
  editRepostComment,
  editRepost,
  deleteRepost
} from '../services/api';
import ctulogo from '../images/ctulogo.png';
import { getProfilePicUrl, handleProfilePicError, getImageUrl } from '../utils/profilePicUtils';
import PhotoGalleryModal from './PhotoGalleryModal';
import Reply from './Reply';
import ReplyInput from './ReplyInput';
import RepostButton from './RepostButton';
import PostStatsRow from './PostStatsRow';
import RepostsModal from './RepostsModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbsUp, faRetweet } from '@fortawesome/free-solid-svg-icons';
import { faThumbsUp as faThumbsUpReg, faComment as faCommentReg } from '@fortawesome/free-regular-svg-icons';
import { IoSend } from 'react-icons/io5';
import ConfirmModal from './ConfirmModal';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import './postFooterActions.css';

interface RepostItem {
  repost_id: number;
  repost_date: string;
  repost_caption?: string;
  user: {
    m_name?: string;
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
  likes?: LikeItem[];
  comments?: CommentItem[];
  likes_count?: number;
  comments_count?: number;
  original_post?: PostItem;
}

interface CommentItem {
  comment_id: number;
  comment_content: string;
  date_created: string;
  replies_count?: number;
  user: {
    user_id: number;
    f_name: string;
    m_name?: string;
    l_name: string;
    profile_pic?: string;
  };
}

interface LikeItem {
  user_id: number;
  f_name: string;
  m_name?: string;
  l_name: string;
  profile_pic?: string;
  initials?: string;
}

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null; // Backward compatibility
  post_images?: Array<{ // Multiple images
    image_id: number;
    image_url: string;
    order: number;
  }>;
  created_at?: string | null;
  likes_count?: number;
  comments_count?: number;
  user?: {
    user_id?: number;
    f_name?: string;
    m_name?: string;
    l_name?: string;
    profile_pic?: string;
    name?: string;
  };
  comments?: CommentItem[];
  reposts?: RepostItem[];
  likes?: LikeItem[];
  liked_by_user?: boolean;
  reposts_count?: number;
  // Event fields
  is_event?: boolean;
  event_date?: string;
  event_time?: string;
}

interface PostCardProps {
  post: PostItem;
  currentUserId: number | null;
  isOwn: boolean;
  displayName: string;
  displayAvatar: string;
  formatTime: (iso?: string | null) => string;
  onPostUpdate?: () => void;
  showOptions?: { [key: string | number]: boolean };
  setShowOptions?: (fn: (prev: { [key: string | number]: boolean }) => { [key: string | number]: boolean }) => void;
  editingPost?: { [key: number]: boolean };
  setEditingPost?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  editPostContent?: { [key: number]: string };
  setEditPostContent?: (fn: (prev: { [key: number]: string }) => { [key: number]: string }) => void;
  likedPosts?: { [key: number]: boolean };
  setLikedPosts?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  repostedPosts?: { [key: number]: boolean };
  setRepostedPosts?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  showCommentInput?: { [key: number]: boolean };
  setShowCommentInput?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  showAllComments?: { [key: number]: boolean };
  setShowAllComments?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  commentInput?: { [key: number]: string };
  setCommentInput?: (fn: (prev: { [key: number]: string }) => { [key: number]: string }) => void;
  editingComment?: { [key: number]: boolean };
  setEditingComment?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  editCommentContent?: { [key: number]: string };
  setEditCommentContent?: (fn: (prev: { [key: number]: string }) => { [key: number]: string }) => void;
  isForum?: boolean; // New prop to indicate forum context
  isDonation?: boolean; // New prop to indicate donation context
  // Repost props removed
  onViewOriginalPost?: (originalPost: PostItem) => void; // Callback to view original post in modal
  highlightCommentId?: string; // Comment ID to highlight when post is opened
  highlightReplyId?: string; // Reply ID to highlight when post is opened
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  isOwn,
  displayName,
  displayAvatar,
  formatTime,
  onPostUpdate,
  showOptions = {},
  setShowOptions,
  editingPost = {},
  setEditingPost,
  editPostContent = {},
  setEditPostContent,
  likedPosts = {},
  setLikedPosts,
  // Repost state removed
  showCommentInput = {},
  setShowCommentInput,
  showAllComments = {},
  setShowAllComments,
  commentInput = {},
  setCommentInput,
  editingComment = {},
  setEditingComment,
  editCommentContent = {},
  setEditCommentContent,
  isForum = false, // Default to false for backward compatibility
  isDonation = false, // Default to false for backward compatibility
  // Repost flags removed
  onViewOriginalPost, // Optional callback to view original post
  highlightCommentId, // Optional comment ID to highlight
  highlightReplyId, // Optional reply ID to highlight
}) => {
  console.log('PostCard currentUserId:', currentUserId);
  // Repost removed on web
  const isRepost = false;
  const repostData: any = null;
  const [showRepostLikesModal, _setShowRepostLikesModal] = useState(false);
  const [showDonationRepostLikesModal, _setShowDonationRepostLikesModal] = useState(false);
  const setShowRepostLikesModal = (_: any) => {};
  const setShowDonationRepostLikesModal = (_: any) => {};
  const repostedPosts: { [key: number]: boolean } = {};
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [inlineImageIndex, setInlineImageIndex] = useState<{ [key: number]: number }>({}); // For inline carousel display per post
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showRepostsModal, setShowRepostsModal] = useState(false);
  const [showDeleteRepostModal, setShowDeleteRepostModal] = useState(false);
  const [showDeletePostModal, setShowDeletePostModal] = useState(false);
  const [showDeleteCommentModal, setShowDeleteCommentModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  // Repost likes modals removed on web
  const [fetchedLikes, setFetchedLikes] = useState<any[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [fetchedReposts, setFetchedReposts] = useState<any[]>(post.reposts || []);
  const [repostsLoading, setRepostsLoading] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // If this item represents a reposted donation (original_post embedded), render a clickable inner card
  const originalEmbedded: any = (post as any).original_post;

  // Debug useEffect for showLikesModal
  useEffect(() => {
    console.log('showLikesModal state changed:', showLikesModal);
  }, [showLikesModal]);

  // Fetch likes when modal opens
  useEffect(() => {
    if (showLikesModal) {
      fetchLikes();
    }
  }, [showLikesModal]);

  useEffect(() => {
    if (showRepostsModal) {
      fetchReposts();
    }
  }, [showRepostsModal]);

  useEffect(() => {
    if (post.reposts && post.reposts.length > 0) {
      setFetchedReposts(post.reposts);
    }
  }, [post.reposts]);

  // Repost likes modals removed
  const commentOptionsRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [showCommentOptions, setShowCommentOptions] = useState<{ [key: number]: boolean }>({});
  // Highlighting refs and state
  const commentRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const replyRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const processedCommentHighlightRef = useRef<string | null>(null);
  const processedReplyHighlightRef = useRef<string | null>(null);
  const requestedReplyLoadsRef = useRef<Set<number>>(new Set());
  const [activeCommentHighlight, setActiveCommentHighlight] = useState<number | null>(null);
  const [activeReplyHighlight, setActiveReplyHighlight] = useState<number | null>(null);
  const [editingRepostCaption, setEditingRepostCaption] = useState<{ [key: number]: boolean }>({});
  const [editRepostCaptionContent, setEditRepostCaptionContent] = useState<{ [key: number]: string }>({});
  
  // Reply state management
  const [showReplyInput, setShowReplyInput] = useState<{ [key: number]: boolean }>({});
  const [showReplies, setShowReplies] = useState<{ [key: number]: boolean }>({});
  const [commentReplies, setCommentReplies] = useState<{ [key: number]: any[] }>({});
  
  // State to control whether comments section is visible (hidden by default)
  const [showCommentsSection, setShowCommentsSection] = useState<{ [key: number]: boolean }>({});

  type EmojiPickerLayout = {
    position: 'above' | 'below';
    top: number;
    left: number;
    width: number;
  };

  // Emoji picker state for comments
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ [key: number]: boolean }>({});
  const [emojiPickerLayouts, setEmojiPickerLayouts] = useState<{ [key: number]: EmojiPickerLayout }>({});
  const emojiPickerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const commentInputRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // @mention functionality for comments
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState<{ [key: number]: boolean }>({});
  const [mentionSuggestions, setMentionSuggestions] = useState<{ [key: number]: any[] }>({});
  const [mentionStart, setMentionStart] = useState<{ [key: number]: number }>({});
  const [selectedMentionIndex, setSelectedMentionIndex] = useState<{ [key: number]: number }>({});

  const updateEmojiPickerLayout = useCallback((postId: number) => {
    const inputElement = commentInputRefs.current[postId];
    if (!inputElement) {
      return;
    }
    const rect = inputElement.getBoundingClientRect();
    const pickerHeight = 320;
    const gap = 8;
    const pickerWidth = Math.min(320, window.innerWidth - gap * 2);
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const position =
      spaceAbove > spaceBelow && spaceAbove >= pickerHeight + gap ? 'above' : 'below';
    const top =
      position === 'above'
        ? Math.max(gap, rect.top - pickerHeight - gap)
        : Math.min(window.innerHeight - pickerHeight - gap, rect.bottom + gap);
    const left = Math.min(
      Math.max(rect.right - pickerWidth, gap),
      window.innerWidth - pickerWidth - gap
    );

    setEmojiPickerLayouts(prev => ({
      ...prev,
      [postId]: { position, top, left, width: pickerWidth },
    }));
  }, []);

  // Calculate emoji picker position (above or below) based on available space
  useEffect(() => {
    Object.keys(showEmojiPicker).forEach((postIdStr) => {
      const postId = Number(postIdStr);
      if (showEmojiPicker[postId]) {
        updateEmojiPickerLayout(postId);
      }
    });
  }, [showEmojiPicker, updateEmojiPickerLayout]);

  useEffect(() => {
    const hasOpenPickers = Object.values(showEmojiPicker).some(Boolean);
    if (!hasOpenPickers) return;

    const handleWindowChange = () => {
      Object.keys(showEmojiPicker).forEach((postIdStr) => {
        const postId = Number(postIdStr);
        if (showEmojiPicker[postId]) {
          updateEmojiPickerLayout(postId);
        }
      });
    };

    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [showEmojiPicker, updateEmojiPickerLayout]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      Object.keys(showEmojiPicker).forEach((postIdStr) => {
        const postId = Number(postIdStr);
        if (showEmojiPicker[postId] && emojiPickerRefs.current[postId] && !emojiPickerRefs.current[postId]?.contains(target)) {
          setShowEmojiPicker(prev => ({
            ...prev,
            [postId]: false
          }));
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

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

  // Helper function to get the correct profile path
  const getProfilePath = (userId: number) => {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/peso')) {
      return `/peso/profile/${userId}`;
    } else if (currentPath.startsWith('/ccict')) {
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
      alert('Error searching for user. Please try again.');
    }
  };

  // Helper function to get proper singular/plural form
  const getPluralForm = (count: number, singular: string, plural: string) => {
    return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
  };

  // Reply helper functions
  const loadReplies = useCallback(async (commentId: number) => {
    try {
      console.log(`PostCard: Loading replies for comment ${commentId}`);
      const response = await getCommentReplies(commentId);
      console.log(`PostCard: Replies response for comment ${commentId}:`, response);
      setCommentReplies(prev => ({ ...prev, [commentId]: response.replies || [] }));
    } catch (error) {
      console.error('PostCard: Error loading replies:', error);
    }
  }, []);

  const handleReplyAdded = (commentId: number) => {
    loadReplies(commentId);
    setShowReplyInput(prev => ({ ...prev, [commentId]: false }));
    // Automatically show replies after creating one
    setShowReplies(prev => ({ ...prev, [commentId]: true }));
    // Update the post to refresh replies_count
    onPostUpdate?.();
  };

  const toggleReplies = (commentId: number) => {
    if (!showReplies[commentId]) {
      loadReplies(commentId);
    }
    setShowReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Auto-load replies for comments that have replies_count > 0
  useEffect(() => {
    if (post.comments && post.comments.length > 0) {
      (async () => {
        for (const comment of post.comments!) {
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
  }, [post.comments, loadReplies]);

  // Highlighting functionality
  const highlightTimerRef = useRef<number | null>(null);
  const highlightDuration = 3000; // 3 seconds for bright highlight, then transitions to subtle permanent highlight
  const [isHighlightActive, setIsHighlightActive] = useState(false); // Bright highlight state
  const [permanentCommentHighlight, setPermanentCommentHighlight] = useState<number | null>(null);
  const [permanentReplyHighlight, setPermanentReplyHighlight] = useState<number | null>(null);

  const scrollIntoViewSmooth = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const startHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    setIsHighlightActive(true); // Start with bright highlight
    highlightTimerRef.current = window.setTimeout(() => {
      setIsHighlightActive(false); // Transition to subtle permanent highlight
      // Don't clear the highlight IDs - keep them permanent
    }, highlightDuration);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // Handle comment highlighting
  useEffect(() => {
    processedCommentHighlightRef.current = null;
  }, [highlightCommentId]);

  useEffect(() => {
    if (!highlightCommentId) return;
    if (processedCommentHighlightRef.current === highlightCommentId) return;

    const commentIdNum = Number(highlightCommentId);
    if (Number.isNaN(commentIdNum)) return;
    if (!post.comments || post.comments.length === 0) return;

    const commentExists = post.comments.some(comment => Number(comment.comment_id) === commentIdNum);
    if (!commentExists) return;

    processedCommentHighlightRef.current = highlightCommentId;
    if (setShowCommentsSection) {
      setShowCommentsSection(prev => ({ ...prev, [post.post_id]: true }));
    }
    if (setShowAllComments) {
      setShowAllComments(prev => ({ ...prev, [post.post_id]: true }));
    }
    setActiveCommentHighlight(commentIdNum);
    setPermanentCommentHighlight(commentIdNum); // Set permanent highlight
    startHighlightTimer();
    requestAnimationFrame(() => {
      scrollIntoViewSmooth(commentRefs.current[commentIdNum]);
    });
  }, [highlightCommentId, post.comments, post.post_id, startHighlightTimer, scrollIntoViewSmooth, setShowCommentsSection, setShowAllComments]);

  // Handle reply highlighting
  useEffect(() => {
    if (!highlightReplyId) return;
    if (processedReplyHighlightRef.current === highlightReplyId) return;

    const replyIdNum = Number(highlightReplyId);
    if (Number.isNaN(replyIdNum)) return;
    if (!post.comments || post.comments.length === 0) return;

    const entry = Object.entries(commentReplies).find(([, replies]) =>
      replies?.some(reply => Number(reply.reply_id) === replyIdNum)
    );

    if (entry) {
      processedReplyHighlightRef.current = highlightReplyId;
      const commentIdNum = Number(entry[0]);
      if (setShowCommentsSection) {
        setShowCommentsSection(prev => ({ ...prev, [post.post_id]: true }));
      }
      if (setShowAllComments) {
        setShowAllComments(prev => ({ ...prev, [post.post_id]: true }));
      }
      setShowReplies(prev => ({ ...prev, [commentIdNum]: true }));
      setActiveCommentHighlight(commentIdNum);
      setActiveReplyHighlight(replyIdNum);
      setPermanentCommentHighlight(commentIdNum); // Set permanent highlight for parent comment
      setPermanentReplyHighlight(replyIdNum); // Set permanent highlight for reply
      startHighlightTimer();
      requestAnimationFrame(() => {
        scrollIntoViewSmooth(replyRefs.current[replyIdNum] || commentRefs.current[commentIdNum]);
      });
    } else {
      // Load replies for all comments to find the one containing the reply
      post.comments.forEach(comment => {
        if (!commentReplies[comment.comment_id] && !requestedReplyLoadsRef.current.has(comment.comment_id)) {
          requestedReplyLoadsRef.current.add(comment.comment_id);
          loadReplies(comment.comment_id);
        }
      });
    }
  }, [highlightReplyId, post.comments, post.post_id, commentReplies, loadReplies, startHighlightTimer, scrollIntoViewSmooth]);

  // Photo gallery helpers
  const getImagesFromPost = (post: PostItem): string[] => {
    const images: string[] = [];
    
    console.log('=== WEB POST CARD IMAGE DEBUG ===');
    console.log('Post ID:', post.post_id);
    console.log('Post images array:', post.post_images);
    console.log('Post image field:', post.post_image);
    console.log('User type:', post.user);
    
    // Add multiple images if available (for regular posts)
    if (post.post_images && post.post_images.length > 0) {
      console.log('Adding post_images array:', post.post_images);
      // Sort by order and extract URLs
      const sortedImages = [...post.post_images].sort((a, b) => a.order - b.order);
      images.push(...sortedImages.map(img => img.image_url));
    }
    
    // Add donation images if available (for donation posts)
    if (images.length === 0 && (post as any).images && (post as any).images.length > 0) {
      console.log('Adding donation images:', (post as any).images);
      // Sort by order and extract URLs
      const sortedImages = [...(post as any).images].sort((a: any, b: any) => a.order - b.order);
      images.push(...sortedImages.map((img: any) => img.image_url));
    }
    
    // Add single image if no multiple images and single image exists
    if (images.length === 0 && post.post_image) {
      console.log('Adding single post_image:', post.post_image);
      images.push(post.post_image);
    }
    
    // Remove duplicate URLs while preserving order
    const uniqueImages = Array.from(new Set(images));
    
    console.log('Final images array (before dedup):', images);
    console.log('Final images array (after dedup):', uniqueImages);
    console.log('=== END WEB POST CARD IMAGE DEBUG ===');
    
    return uniqueImages;
  };

  const handleImageClick = (index: number) => {
    setCurrentPhotoIndex(index);
    setShowPhotoGallery(true);
  };

  const handlePreviousPhoto = () => {
    const images = getImagesFromPost(post);
    setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
  };

  const handleNextPhoto = () => {
    const images = getImagesFromPost(post);
    setCurrentPhotoIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
  };

  // Helper function to check if a mention matches a known user
  const checkMentionMatch = (mentionText: string): { matched: boolean; user?: any } => {
    const normalizedMention = mentionText.toLowerCase().replace(/\s+/g, '');
    
    // Check post author
    if (post.user) {
      const postAuthorName = `${post.user.f_name} ${post.user.m_name || ''} ${post.user.l_name}`.trim();
      const normalizedPostAuthor = postAuthorName.toLowerCase().replace(/\s+/g, '');
      if (normalizedMention === normalizedPostAuthor) {
        return { matched: true, user: post.user };
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
                    window.location.href = getProfilePath(userId);
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
                        window.location.href = getProfilePath(userId);
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
                        window.location.href = getProfilePath(userId);
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
            // No match found - but still highlight in blue and make clickable
            result.push(
              <button
                key={`${keyPrefix}-mention-${keyCounter++}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleUserSearch(mentionText);
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
          }
        } else {
          // No match found - but still highlight in blue and make clickable
          result.push(
            <button
              key={`${keyPrefix}-mention-${keyCounter++}`}
              onClick={(e) => {
                e.stopPropagation();
                handleUserSearch(mentionText);
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

  // Helper function to detect and make URLs and names clickable
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

  // Handle clicking outside the options menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check post options menu
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        if (showOptions[post.post_id] && setShowOptions) {
          setShowOptions(prev => ({ ...prev, [post.post_id]: false }));
        }
      }

      // Check comment options menus
      if (post.comments) {
        post.comments.forEach(comment => {
          const commentRef = commentOptionsRefs.current[comment.comment_id];
          if (commentRef && !commentRef.contains(event.target as Node)) {
            if (showCommentOptions[comment.comment_id]) {
              setShowCommentOptions(prev => ({ ...prev, [comment.comment_id]: false }));
            }
          }
        });
      }
    };

    // Check if any options menu is open
    const hasOpenMenu = showOptions[post.post_id] || 
      (post.comments && post.comments.some(comment => showCommentOptions[comment.comment_id]));

    if (hasOpenMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptions, post.post_id, post.comments, setShowOptions, showCommentOptions]);

  // Helper function to refresh and dispatch points update
  const refreshPointsAndDispatch = useCallback(async () => {
    if (!currentUserId) return;
    try {
      // Add a small delay to ensure backend has processed points update
      setTimeout(async () => {
        try {
          const points = await getUserPoints(currentUserId);
          // Dispatch event to notify Profile component
          window.dispatchEvent(new CustomEvent('pointsUpdated', { 
            detail: { userId: currentUserId, points } 
          }));
        } catch (error) {
          console.error('Error refreshing points after action:', error);
        }
      }, 500); // 500ms delay to ensure backend has processed
    } catch (error) {
      console.error('Error in refreshPointsAndDispatch:', error);
    }
  }, [currentUserId]);

  const handleLike = async () => {
    if (!setLikedPosts) return;
    console.log('handleLike called for post:', post.post_id, 'isForum:', isForum, 'isDonation:', isDonation, 'isRepostPost:', isRepostPost);
    try {
      if (isRepostPost) {
        // Use unified like API with repost_id for ALL reposts (donation, forum, and regular post reposts)
        const repostId = repostData?.repost_id;
        console.log('🔍 DEBUG: Liking repost:', {
          repostId,
          isDonation,
          currentLikedPosts: likedPosts,
          willSetTo: true
        });
        
        // Optimistic update first (like mobile behavior)
        setLikedPosts(prev => {
          const newState = { ...prev, [repostId]: true };
          console.log('🔍 DEBUG: Updated likedPosts state:', newState);
          return newState;
        });
        
        // Immediately update local state for repost likes
        post.likes_count = (post.likes_count || 0) + 1;
        post.liked_by_user = true;
        
        // Then make API call
        await likeRepost(repostId);
        console.log('🔍 DEBUG: likeRepost API call successful for:', repostId);
      } else if (isForum) {
        // Use forum like API
        console.log('Liking forum post:', post.post_id);
        await likeForumPost(post.post_id);
        setLikedPosts(prev => ({ ...prev, [post.post_id]: true }));
        console.log('Forum post liked successfully');
      } else if (isDonation) {
        // Use donation like API
        console.log('Liking donation post:', post.post_id);
        await likeDonation(post.post_id);
        setLikedPosts(prev => ({ ...prev, [post.post_id]: true }));
        console.log('Donation post liked successfully');
      } else {
        // Use regular post like API
        console.log('Liking regular post:', post.post_id);
        await likePost(post.post_id);
        setLikedPosts(prev => ({ ...prev, [post.post_id]: true }));
      }
      
      // Refresh points after successful like
      refreshPointsAndDispatch();
      
      onPostUpdate?.();
    } catch (error) {
      console.error('Error liking post:', error);
      
      // Rollback optimistic update for reposts (like mobile behavior)
      if (isRepostPost) {
        const repostId = repostData?.repost_id;
        setLikedPosts(prev => {
          const newState = { ...prev, [repostId]: false };
          console.log('🔍 DEBUG: Rolled back likedPosts state:', newState);
          return newState;
        });
        
        // Rollback local state
        post.likes_count = Math.max((post.likes_count || 0) - 1, 0);
        post.liked_by_user = false;
      }
    }
  };

  const handleUnlike = async () => {
    if (!setLikedPosts) return;
    console.log('handleUnlike called for post:', post.post_id, 'isForum:', isForum, 'isDonation:', isDonation);
    try {
      if (isRepostPost) {
        // Use unified unlike API with repost_id for ALL reposts (donation, forum, and regular post reposts)
        const repostId = repostData?.repost_id;
        console.log('Unliking repost:', repostId, 'isDonation:', isDonation);
        
        // Optimistic update first (like mobile behavior)
        setLikedPosts(prev => ({ ...prev, [repostId]: false }));
        
        // Immediately update local state for repost likes
        post.likes_count = Math.max((post.likes_count || 0) - 1, 0);
        post.liked_by_user = false;
        
        // Then make API call
        await unlikeRepost(repostId);
        console.log('🔍 DEBUG: unlikeRepost API call successful for:', repostId);
      } else if (isForum) {
        // Use forum unlike API
        console.log('Unliking forum post:', post.post_id);
        await unlikeForumPost(post.post_id);
        setLikedPosts(prev => ({ ...prev, [post.post_id]: false }));
        console.log('Forum post unliked successfully');
      } else if (isDonation) {
        // Use donation unlike API
        console.log('Unliking donation post:', post.post_id);
        await unlikeDonation(post.post_id);
        setLikedPosts(prev => ({ ...prev, [post.post_id]: false }));
        console.log('Donation post unliked successfully');
      } else {
        // Use regular post unlike API
        console.log('Unliking regular post:', post.post_id);
        await unlikePost(post.post_id);
        setLikedPosts(prev => ({ ...prev, [post.post_id]: false }));
      }
      onPostUpdate?.();
    } catch (error) {
      console.error('Error unliking post:', error);
      
      // Rollback optimistic update for reposts (like mobile behavior)
      if (isRepostPost) {
        const repostId = repostData?.repost_id;
        setLikedPosts(prev => {
          const newState = { ...prev, [repostId]: true };
          console.log('🔍 DEBUG: Rolled back unlikedPosts state:', newState);
          return newState;
        });
        
        // Rollback local state
        post.likes_count = (post.likes_count || 0) + 1;
        post.liked_by_user = true;
      }
    }
  };

  const handleCommentSubmit = async () => {
    // Determine if this is a repost
    const isRepostPost = isRepost && repostData;
    
    // Use the correct ID for reposts vs regular posts
    const itemId = isRepostPost ? (repostData?.repost_id || post.post_id) : post.post_id;
    if (!commentInput[itemId] || !setCommentInput) return;
    
    const commentContent = commentInput[itemId];
    
    try {
      let result;
      if (isRepostPost) {
        // Use unified repost comment API (works for both forum and regular reposts)
        const repostId = repostData?.repost_id || post.post_id;
        result = await api.post(`reposts/${repostId}/comments/`, {
          comment_content: commentContent
        });
        
        // Immediately update local state for repost comments
        if (result.data && result.data.success && result.data.comment) {
          // Add the new comment to the local post.comments array
          const newComment = {
            comment_id: result.data.comment.comment_id,
            comment_content: commentContent,
            date_created: new Date().toISOString(),
            user: {
              user_id: currentUserId || 0,
              f_name: displayName.split(' ')[0] || '',
              l_name: displayName.split(' ').slice(1).join(' ') || '',
              profile_pic: displayAvatar
            }
          };
          
          // Update the post object with the new comment
          post.comments = [...(post.comments || []), newComment as any];
          post.comments_count = (post.comments_count || 0) + 1;
          
          // Also update the repostData comments if it exists
          if (repostData) {
            repostData.comments = [...(repostData.comments || []), newComment as any];
            repostData.comments_count = (repostData.comments_count || 0) + 1;
            console.log('🔍 DEBUG: Updated repostData comments:', repostData.comments);
          }
        }
      } else if (isForum) {
        // Use forum comment API
        result = await commentOnForumPost(post.post_id, commentContent);
        
        // Immediately update local state for forum comments
        if (result && result.success && result.comment) {
          // Add the new comment to the local post.comments array
          const newComment = {
            comment_id: result.comment.comment_id,
            comment_content: commentContent,
            date_created: new Date().toISOString(),
            user: {
              user_id: currentUserId || 0,
              f_name: displayName.split(' ')[0] || '',
              l_name: displayName.split(' ').slice(1).join(' ') || '',
              profile_pic: displayAvatar
            }
          };
          
          // Update the post object with the new comment
          post.comments = [...(post.comments || []), newComment as any];
          post.comments_count = (post.comments_count || 0) + 1;
        }
      } else if (isDonation) {
        // Use donation comment API
        result = await commentOnDonation(post.post_id, commentContent);
        
        // Immediately update local state for donation comments
        if (result && result.success && result.comment) {
          // Add the new comment to the local post.comments array
          const newComment = {
            comment_id: result.comment.comment_id,
            comment_content: commentContent,
            date_created: new Date().toISOString(),
            user: {
              user_id: currentUserId || 0,
              f_name: displayName.split(' ')[0] || '',
              l_name: displayName.split(' ').slice(1).join(' ') || '',
              profile_pic: displayAvatar
            }
          };
          
          // Update the post object with the new comment
          post.comments = [...(post.comments || []), newComment as any];
          post.comments_count = (post.comments_count || 0) + 1;
        }
      } else {
        // Use regular post comment API
        result = await commentOnPost(post.post_id, commentContent);
        
        // Immediately update local state for regular post comments
        if (result && result.success && result.comment) {
          // Add the new comment to the local post.comments array
          const newComment = {
            comment_id: result.comment.comment_id,
            comment_content: commentContent,
            date_created: new Date().toISOString(),
            user: {
              user_id: currentUserId || 0,
              f_name: displayName.split(' ')[0] || '',
              l_name: displayName.split(' ').slice(1).join(' ') || '',
              profile_pic: displayAvatar
            }
          };
          
          // Update the post object with the new comment
          post.comments = [...(post.comments || []), newComment as any];
          post.comments_count = (post.comments_count || 0) + 1;
        }
      }
      
      if ((result && result.success) || (result.data && result.data.success)) {
        console.log('🔍 DEBUG: Comment submitted successfully for itemId:', itemId);
        setCommentInput(prev => ({ ...prev, [itemId]: '' }));
        setShowCommentInput?.(prev => ({ ...prev, [itemId]: false }));
        // Automatically show comments section when a comment is added
        setShowCommentsSection(prev => ({ ...prev, [itemId]: true }));
        
        // Refresh points after successful comment
        refreshPointsAndDispatch();
        
        onPostUpdate?.();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  // @mention functionality for comments
  const handleCommentInputChange = (e: React.ChangeEvent<HTMLInputElement>, itemId: number) => {
    const newValue = e.target.value;
    setCommentInput?.(prev => ({ ...prev, [itemId]: newValue }));

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    
    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's no space after @ (meaning we're typing a mention)
      if (!textAfterAt.includes(' ')) {
        setMentionStart(prev => ({ ...prev, [itemId]: lastAtIndex }));
        setShowMentionSuggestions(prev => ({ ...prev, [itemId]: true }));
        
        // Filter suggestions based on what's typed after @
        const filteredSuggestions = followingUsers.filter(user =>
          user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.f_name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.l_name.toLowerCase().includes(textAfterAt.toLowerCase())
        );
        setMentionSuggestions(prev => ({ ...prev, [itemId]: filteredSuggestions }));
        setSelectedMentionIndex(prev => ({ ...prev, [itemId]: 0 }));
      } else {
        setShowMentionSuggestions(prev => ({ ...prev, [itemId]: false }));
      }
    } else {
      setShowMentionSuggestions(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const selectMention = (user: any, itemId: number) => {
    const mentionStartPos = mentionStart[itemId];
    if (mentionStartPos === undefined) return;

    const currentValue = commentInput[itemId] || '';
    const beforeMention = currentValue.substring(0, mentionStartPos);
    const afterMention = currentValue.substring(currentValue.length);
    
    const newValue = beforeMention + `@${user.name} ` + afterMention;
    setCommentInput?.(prev => ({ ...prev, [itemId]: newValue }));
    
    setShowMentionSuggestions(prev => ({ ...prev, [itemId]: false }));
    setMentionStart(prev => ({ ...prev, [itemId]: -1 }));
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: number) => {
    if (!showMentionSuggestions[itemId]) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCommentSubmit();
      }
      return;
    }

    const suggestions = mentionSuggestions[itemId] || [];
    const selectedIndex = selectedMentionIndex[itemId] || 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prev => ({ 
          ...prev, 
          [itemId]: selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0 
        }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => ({ 
          ...prev, 
          [itemId]: selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1 
        }));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          selectMention(suggestions[selectedIndex], itemId);
        }
        break;
      case 'Escape':
        setShowMentionSuggestions(prev => ({ ...prev, [itemId]: false }));
        break;
    }
  };


  const handleEditPost = () => {
    console.log('Edit clicked - isOwn:', isOwn, 'currentUserId:', currentUserId, 'post.user.user_id:', post.user?.user_id);
    if (!setEditPostContent || !setEditingPost) return;
    if (!isOwn) {
      alert('You can only edit your own posts');
      return;
    }
    setEditPostContent(prev => ({ ...prev, [post.post_id]: post.post_content }));
    setEditingPost(prev => ({ ...prev, [post.post_id]: true }));
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
  };

  const handleDeletePost = () => {
    if (!isOwn) {
      alert('You can only delete your own posts');
      return;
    }
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
    setShowDeletePostModal(true);
  };

  const confirmDeletePost = async () => {
    try {
      if (isForum) {
        // Use forum post API
        await deleteForumPost(post.post_id);
      } else if (isDonation) {
        // Use donation API
        await deleteDonationRequest(post.post_id);
      } else {
        // Use regular post API
        await deletePost(post.post_id);
      }
      onPostUpdate?.();
      alert('Post deleted successfully');
      setShowDeletePostModal(false);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
      setShowDeletePostModal(false);
    }
  };

  const handleSaveEditPost = async () => {
    console.log('Save edit clicked - editPostContent:', editPostContent[post.post_id], 'isOwn:', isOwn);
    if (!editPostContent[post.post_id]?.trim() || !setEditingPost) return;
    if (!isOwn) {
      alert('You can only edit your own posts');
      return;
    }
    
    try {
      console.log('Calling editPost with:', post.post_id, { post_content: editPostContent[post.post_id] });
      if (isForum) {
        // Use forum post API
        await editForumPost(post.post_id, { content: editPostContent[post.post_id] });
      } else if (isDonation) {
        // Use donation API
        await updateDonationRequest(post.post_id, { description: editPostContent[post.post_id] });
      } else {
        // Use regular post API
        await editPost(post.post_id, { post_content: editPostContent[post.post_id] });
      }
      setEditingPost(prev => ({ ...prev, [post.post_id]: false }));
      console.log('Calling onPostUpdate');
      onPostUpdate?.();
    } catch (error) {
      console.error('Error editing post:', error);
      alert('Failed to update post');
    }
  };

  const handleCancelEditPost = () => {
    if (!setEditingPost || !setEditPostContent) return;
    setEditingPost(prev => ({ ...prev, [post.post_id]: false }));
    setEditPostContent(prev => ({ ...prev, [post.post_id]: post.post_content }));
  };

  const handleEditComment = (commentId: number) => {
    if (!setEditCommentContent || !setEditingComment) return;
    const comment = post.comments?.find(c => c.comment_id === commentId);
    if (comment) {
      // Check if current user owns this comment
      if (Number(currentUserId) !== Number(comment.user.user_id)) {
        alert('You can only edit your own comments');
        return;
      }
      setEditCommentContent(prev => ({ ...prev, [commentId]: comment.comment_content }));
      setEditingComment(prev => ({ ...prev, [commentId]: true }));
      setShowCommentOptions(prev => ({ ...prev, [commentId]: false })); // Close the menu
    }
  };

  const handleDeleteComment = (commentId: number) => {
    const comment = post.comments?.find(c => c.comment_id === commentId);
    if (!comment) return;
    
    // Check if current user owns this comment OR owns the post
    const canDelete = Number(currentUserId) === Number(comment.user.user_id) || isOwn;
    if (!canDelete) {
      alert('You can only delete your own comments or comments on your posts');
      return;
    }
    
    setCommentToDelete(commentId);
    setShowDeleteCommentModal(true);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    
    try {
      if (isRepostPost) {
        // Use repost comment API with correct repost_id
        await deleteRepostComment(repostData?.repost_id || post.post_id, commentToDelete);
      } else if (isForum) {
        // Use forum comment API
        await deleteForumComment(post.post_id, commentToDelete);
      } else if (isDonation) {
        // Use donation comment API
        await deleteDonationComment(post.post_id, commentToDelete);
      } else {
        // Use regular post comment API
        await deleteComment(post.post_id, commentToDelete);
      }
      onPostUpdate?.();
      alert('Comment deleted successfully');
      setShowDeleteCommentModal(false);
      setCommentToDelete(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
      setShowDeleteCommentModal(false);
      setCommentToDelete(null);
    }
  };

  const handleSaveEditComment = async (commentId: number) => {
    if (!editCommentContent[commentId]?.trim() || !setEditingComment) return;
    
    const comment = post.comments?.find(c => c.comment_id === commentId);
    if (!comment) return;
    
    // Check if current user owns this comment
    if (Number(currentUserId) !== Number(comment.user.user_id)) {
      alert('You can only edit your own comments');
      return;
    }
    
    try {
      if (isRepostPost) {
        // Use repost comment API with correct repost_id
        await editRepostComment(repostData?.repost_id || post.post_id, commentId, { comment_content: editCommentContent[commentId] });
      } else if (isForum) {
        // Use forum comment API
        await editForumComment(post.post_id, commentId, { comment_content: editCommentContent[commentId] });
      } else if (isDonation) {
        // Use donation comment API
        await editDonationComment(post.post_id, commentId, { comment_content: editCommentContent[commentId] });
      } else {
        // Use regular post comment API
        await editComment(post.post_id, commentId, { comment_content: editCommentContent[commentId] });
      }
      setEditingComment?.(prev => ({ ...prev, [commentId]: false }));
      setEditCommentContent?.(prev => ({ ...prev, [commentId]: '' }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to update comment');
    }
  };

  const handleCancelEditComment = (commentId: number) => {
    if (!setEditingComment || !setEditCommentContent) return;
    setEditingComment(prev => ({ ...prev, [commentId]: false }));
    setEditCommentContent(prev => ({ ...prev, [commentId]: '' }));
  };

  const handleEditRepostCaption = () => {
    if (!isOwn) {
      alert('You can only edit your own repost captions');
      return;
    }
    setEditRepostCaptionContent(prev => ({ ...prev, [post.post_id]: repostData?.repost_caption || '' }));
    setEditingRepostCaption(prev => ({ ...prev, [post.post_id]: true }));
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
  };

  const handleSaveEditRepostCaption = async () => {
    if (!repostData?.repost_id) return;
    if (!editRepostCaptionContent[post.post_id]?.trim()) return;
    if (!isOwn) {
      alert('You can only edit your own repost captions');
      return;
    }
    
    try {
      // Use repost edit API with correct repost_id
      await editRepost(repostData.repost_id, { caption: editRepostCaptionContent[post.post_id] });
      setEditingRepostCaption(prev => ({ ...prev, [post.post_id]: false }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error editing repost caption:', error);
      alert('Failed to update repost caption');
    }
  };

  const handleCancelEditRepostCaption = () => {
    setEditingRepostCaption(prev => ({ ...prev, [post.post_id]: false }));
    setEditRepostCaptionContent(prev => ({ ...prev, [post.post_id]: repostData?.repost_caption || '' }));
  };

  // Fetch likes for the modal
  const fetchLikes = async () => {
    if (likesLoading) return;
    
    setLikesLoading(true);
    try {
      let likesData;
      if (isRepostPost && repostData?.repost_id) {
        // Fetch likes for repost
        likesData = await getRepostLikes(repostData.repost_id);
      } else if (isDonation) {
        // Fetch likes for donation post
        const donationId = (post as any).donation_id || post.post_id;
        likesData = await getDonationLikes(donationId);
      } else if (isForum) {
        // Fetch likes for forum post
        likesData = await getForumLikes(post.post_id);
      } else {
        // Fetch likes for regular post
        likesData = await getPostLikes(post.post_id);
      }
      
      if (likesData && likesData.likes) {
        setFetchedLikes(likesData.likes);
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
      setFetchedLikes([]);
    } finally {
      setLikesLoading(false);
    }
  };

  const fetchReposts = async () => {
    setRepostsLoading(true);
    try {
      if (post.reposts && post.reposts.length > 0) {
        setFetchedReposts(post.reposts);
      } else {
        const detail = await getPostDetail(post.post_id);
        setFetchedReposts(detail?.reposts || []);
      }
    } catch (error) {
      console.error('Error fetching reposts:', error);
      setFetchedReposts([]);
    } finally {
      setRepostsLoading(false);
    }
  };

  const handleDeleteRepost = () => {
    if (!repostData?.repost_id) return;
    if (!isOwn) {
      alert('You can only delete your own reposts');
      return;
    }
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
    setShowDeleteRepostModal(true);
  };

  const confirmDeleteRepost = async () => {
    try {
      // Use repost delete API with correct repost_id
      await deleteRepost(repostData.repost_id);
      onPostUpdate?.();
      alert('Repost deleted successfully');
      setShowDeleteRepostModal(false);
    } catch (error) {
      console.error('Error deleting repost:', error);
      alert('Failed to delete repost');
      setShowDeleteRepostModal(false);
    }
  };

  // Determine if this is a repost and get the appropriate data
  const isRepostPost = isRepost && repostData;
  const displayUser = isRepostPost ? repostData.user : post.user;
  // Render name: {f_name} {m_name} {l_name} if m_name exists, else {f_name} {l_name}
  const renderName = (obj: { f_name: string; m_name?: string; l_name: string }) =>
    `${obj.f_name} ${obj.m_name || ''} ${obj.l_name}`.trim();

  const repostDisplayName = isRepostPost
    ? renderName({ f_name: repostData.user.f_name, m_name: repostData.user.m_name, l_name: repostData.user.l_name })
    : (post.user?.f_name && post.user?.l_name 
        ? renderName({ f_name: post.user.f_name, m_name: post.user.m_name, l_name: post.user.l_name })
        : displayName);
  const repostDisplayAvatar = isRepostPost 
    ? getProfilePicUrl(repostData.user.profile_pic)
    : displayAvatar;

  // Debug repost data
  if (isRepostPost) {
    console.log('🔍 DEBUG: PostCard rendering repost:', {
      repostData,
      repostId: repostData?.repost_id,
      postId: post.post_id,
      likedPosts,
      isLiked: likedPosts[repostData?.repost_id],
      likes: post.likes,
      likesCount: post.likes_count,
      currentUserId: currentUserId
    });
  }

  return (
    <>
      {isRepostPost ? (
        // Repost structure
        <>
          {/* Main Repost Card */}
          <div className="profile-repost-card">
            {/* Reposter's header */}
            <div className="profile-repost-header">
              <div className="profile-repost-header-left">
                <img
                  src={repostDisplayAvatar}
                  alt="Profile"
                  className="profile-repost-profile-image"
                  onError={handleProfilePicError}
                  onClick={() => {
                    if (displayUser?.user_id) {
                      const currentPath = window.location.pathname;
                      if (currentPath.startsWith('/peso')) {
                        window.location.href = `/peso/profile/${displayUser.user_id}`;
                      } else if (currentPath.startsWith('/ccict')) {
                        window.location.href = `/ccict/profile/${displayUser.user_id}`;
                      } else {
                        window.location.href = `/profile/${displayUser.user_id}`;
                      }
                    }
                  }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                      className="post-author-info"
                      onClick={() => {
                        if (displayUser?.user_id) {
                          const currentPath = window.location.pathname;
                          if (currentPath.startsWith('/peso')) {
                            window.location.href = `/peso/profile/${displayUser.user_id}`;
                          } else if (currentPath.startsWith('/ccict')) {
                            window.location.href = `/ccict/profile/${displayUser.user_id}`;
                          } else {
                            window.location.href = `/profile/${displayUser.user_id}`;
                          }
                        }
                      }}
                    >
                      {repostDisplayName || 'User'}
                    </div>
                    {isDonation && (
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
                  <div className="profile-repost-author-details">
                    <span>{formatTime(repostData.repost_date)}</span>
                  </div>
                </div>
              </div>
              {/* Three dots menu for repost owner */}
              {isOwn && setShowOptions && (
                <div className="profile-repost-header-right" style={{ position: 'relative' }} ref={optionsMenuRef}>
              <button
                    onClick={() => setShowOptions(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
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
                  {showOptions[post.post_id] && (
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
                        width: '140px'
                      }}
                    >
                      <button
                        onClick={handleEditRepostCaption}
                        style={{
                  display: 'flex',
                  alignItems: 'center',
                          width: '100%',
                          padding: '10px 16px',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          gap: '10px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease',
                          color: '#374151'
                }}
                onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                          e.currentTarget.style.color = '#1f2937';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#374151';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
              </button>
              <button
                        onClick={handleDeleteRepost}
                style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                          textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                          color: '#dc2626',
                          gap: '10px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                          e.currentTarget.style.color = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#dc2626';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3,6 5,6 21,6"/>
                          <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        Delete
              </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Repost caption */}
            {editingRepostCaption[post.post_id] ? (
              <div style={{ marginTop: 8 }}>
                <textarea
                  value={editRepostCaptionContent[post.post_id] || ''}
                  onChange={(e) => setEditRepostCaptionContent(prev => ({ ...prev, [post.post_id]: e.target.value }))}
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="Add a caption..."
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={handleSaveEditRepostCaption}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      gap: '6px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17,21 17,13 7,13 7,21"/>
                      <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditRepostCaption}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      gap: '6px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(107, 114, 128, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(107, 114, 128, 0.3)';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Cancel
                  </button>
            </div>
          </div>
            ) : (
              repostData.repost_caption && (
                <div className="profile-repost-caption">
                  {renderTextWithLinks(repostData.repost_caption)}
                </div>
              )
            )}

          {/* Inner Card - Original post without interactions */}
          {repostData.original_post && (
              <div 
                className="profile-repost-original"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onViewOriginalPost && repostData.original_post) {
                    onViewOriginalPost(repostData.original_post);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
              {/* Original post header */}
                <div className="profile-repost-original-header">
                  <div className="profile-repost-original-header-left">
                  <img
                    src={getProfilePicUrl(repostData.original_post.user?.profile_pic)}
                    alt="Profile"
                      className="profile-repost-original-profile-image"
                    onClick={() => {
                      if (repostData.original_post?.user?.user_id) {
                        const currentPath = window.location.pathname;
                        if (currentPath.startsWith('/peso')) {
                          window.location.href = `/peso/profile/${repostData.original_post.user.user_id}`;
                        } else if (currentPath.startsWith('/ccict')) {
                          window.location.href = `/ccict/profile/${repostData.original_post.user.user_id}`;
                        } else {
                          window.location.href = `/profile/${repostData.original_post.user.user_id}`;
                        }
                      }
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = ctulogo as unknown as string;
                    }}
                  />
                  <div>
                    <div 
                        className="profile-repost-original-author-info"
                      onClick={() => {
                        if (repostData.original_post?.user?.user_id) {
                          const currentPath = window.location.pathname;
                          if (currentPath.startsWith('/peso')) {
                            window.location.href = `/peso/profile/${repostData.original_post.user.user_id}`;
                          } else if (currentPath.startsWith('/ccict')) {
                            window.location.href = `/ccict/profile/${repostData.original_post.user.user_id}`;
                          } else {
                            window.location.href = `/profile/${repostData.original_post.user.user_id}`;
                          }
                        }
                      }}
                    >
                      {repostData.original_post.user?.f_name && repostData.original_post.user?.l_name
                        ? renderName({ 
                            f_name: repostData.original_post.user.f_name, 
                            m_name: repostData.original_post.user.m_name, 
                            l_name: repostData.original_post.user.l_name 
                          })
                        : repostData.original_post.user?.f_name || 'Original Post'}
                    </div>
                      <div className="profile-repost-original-author-details">
                      <span>{formatTime(repostData.original_post.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Original post content */}
              {repostData.original_post.post_content && (
                  <div className="profile-repost-original-content">
                  {renderTextWithLinks(repostData.original_post.post_content)}
                </div>
              )}

              {/* Original post images */}
              {(() => {
                const originalImages = getImagesFromPost(repostData.original_post);
                if (originalImages.length === 0) return null;

                return (
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', width: '100%' }}>
                    {originalImages.length === 1 ? (
                      // Single image
                      <img
                        src={getImageUrl(originalImages[0])}
                        alt="original post"
                        className="profile-repost-original-image"
                        style={{ 
                          cursor: 'pointer',
                          width: 'auto',
                          height: 'auto',
                          maxWidth: '100%',
                          maxHeight: '40vh',
                          borderRadius: '8px',
                          objectFit: 'contain'
                        }}
                        onClick={() => handleImageClick(0)}
                        onLoad={(e) => {
                          const img = e.target as HTMLImageElement;
                          const naturalWidth = img.naturalWidth;
                          const naturalHeight = img.naturalHeight;
                          
                          // Portrait images (tall): More height, less width
                          if (naturalHeight > naturalWidth * 1.5) {
                            img.style.maxHeight = '50vh';
                            img.style.maxWidth = '50vw';
                          }
                          // Landscape images (wide): More width, less height  
                          else if (naturalWidth > naturalHeight * 1.5) {
                            img.style.maxWidth = '70vw';
                            img.style.maxHeight = '35vh';
                          }
                          // Square images: Balanced constraints
                          else {
                            img.style.maxWidth = '60vw';
                            img.style.maxHeight = '45vh';
                          }
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          console.error('Failed to load original post image:', originalImages[0]);
                        }}
                      />
                    ) : (
                      // Multiple images grid for original post - Facebook style (smaller)
                      <div style={{
                        display: 'grid',
                        gap: 2,
                        borderRadius: 8,
                        overflow: 'hidden',
                        width: '100%',
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
                                  backgroundColor: '#ffffff'
                                }}
                                onClick={() => handleImageClick(index)}
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
                                  onClick={() => handleImageClick(5)}
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
          )}

            {/* Facebook-style likes and comments display for repost - Only show when there are likes or comments */}
            {((repostData.likes && repostData.likes.length > 0) || (post.comments && post.comments.length > 0)) && (
              <div style={{ 
                marginTop: 8, 
                padding: '8px 12px', 
                borderRadius: 8,
                color: '#6c757d',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Likes text */}
                  {repostData.likes && repostData.likes.length > 0 ? (
                  <span
                    onClick={() => {
                      console.log('Repost like summary clicked, setting showRepostLikesModal to true');
                      setShowRepostLikesModal(true);
                    }}
                    style={{ 
                      fontSize: '12px',
                      fontWeight: '500',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      color: '#6b7280',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >👍
                    {repostData.likes.length === 1 
                      ? (() => {
                          const likeUser = repostData.likes[0].user || repostData.likes[0];
                          return renderName({ 
                            f_name: likeUser.f_name || '', 
                            m_name: likeUser.m_name, 
                            l_name: likeUser.l_name || '' 
                          }) + ' liked this';
                        })()
                      : repostData.likes.length === 2
                      ? (() => {
                          const likeUser0 = repostData.likes[0].user || repostData.likes[0];
                          const likeUser1 = repostData.likes[1].user || repostData.likes[1];
                          return renderName({ 
                            f_name: likeUser0.f_name || '', 
                            m_name: likeUser0.m_name, 
                            l_name: likeUser0.l_name || '' 
                          }) + ` and ${renderName({ 
                            f_name: likeUser1.f_name || '', 
                            m_name: likeUser1.m_name, 
                            l_name: likeUser1.l_name || '' 
                          })} liked this`;
                        })()
                      : (() => {
                          const likeUser = repostData.likes[0].user || repostData.likes[0];
                          return renderName({ 
                            f_name: likeUser.f_name || '', 
                            m_name: likeUser.m_name, 
                            l_name: likeUser.l_name || '' 
                          }) + ` and ${repostData.likes.length - 1} others liked this`;
                        })()
                    }
                  </span>
                ) : null}
                  
                  {/* Comments count */}
                  {post.comments && post.comments.length > 0 && (
                    <span
                      onClick={() => {
                        // Toggle comments section visibility
                        setShowCommentsSection(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }));
                      }}
                      style={{ 
                        cursor: 'pointer', 
                        fontSize: '12px',
                        color: '#6c757d',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {getPluralForm(post.comments.length, 'comment', 'comments')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Repost Actions - Same as regular post actions */}
            <div className="post-footer-actions">
              <button
                onClick={() => {
                  console.log('Like button clicked for repost:', repostData?.repost_id, 'likedPosts:', likedPosts[repostData?.repost_id]);
                  likedPosts[repostData?.repost_id] ? handleUnlike() : handleLike();
                }}
                type="button"
                className={`post-footer-action${likedPosts[repostData?.repost_id] ? ' active' : ''}`}
                aria-pressed={!!likedPosts[repostData?.repost_id]}
              >
                <span className="post-footer-icon">
                  <FontAwesomeIcon 
                    icon={likedPosts[repostData?.repost_id] ? faThumbsUp : faThumbsUpReg} 
                    size="lg" 
                    style={{ color: likedPosts[repostData?.repost_id] ? '#1e3a8a' : '#555', fontSize: '18px' }} 
                  />
                </span>
                <span className="post-footer-label">Like</span>
              </button>
              <button
                onClick={() => setShowCommentInput?.(prev => ({ ...prev, [repostData?.repost_id || post.post_id]: !prev[repostData?.repost_id || post.post_id] }))}
                type="button"
                className={`post-footer-action${showCommentInput?.[repostData?.repost_id || post.post_id] ? ' active' : ''}`}
                aria-expanded={!!showCommentInput?.[repostData?.repost_id || post.post_id]}
              >
                <span className="post-footer-icon">
                  <FontAwesomeIcon icon={faCommentReg} size="lg" style={{ fontSize: '20px', color: '#555' }} />
                </span>
                <span className="post-footer-label">Comment</span>
              </button>
              <RepostButton
                originalPost={{
                  post_id: post.post_id,
                  post_content: post.post_content,
                  post_image: post.post_image,
                  post_images: post.post_images,
                  user: {
                    user_id: post.user?.user_id || 0,
                    f_name: post.user?.f_name || '',
                    l_name: post.user?.l_name || '',
                    profile_pic: post.user?.profile_pic
                  },
                  created_at: post.created_at || ''
                }}
                currentUser={{
                  name: `${displayName}`,
                  profile_pic: displayAvatar
                }}
                isReposted={repostedPosts[post.post_id] || false}
                onRepost={onPostUpdate}
                formatTime={formatTime}
                isForum={isForum}
                isDonation={isDonation}
              />
            </div>

            {/* Comment input for repost */}
            {showCommentInput[repostData?.repost_id || post.post_id] && (
              <div className="comment-input-container" style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <img 
                  src={(() => {
                    try {
                      const raw = localStorage.getItem('user');
                      if (raw) {
                        const u = JSON.parse(raw);
                        return getProfilePicUrl(u?.profile_pic) || displayAvatar;
                      }
                    } catch (_) {}
                    return displayAvatar;
                  })()}
                  alt="Profile" 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: '2px solid #e0e0e0',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                  onError={(e) => handleProfilePicError(e)}
                />
          <div
            ref={(el) => {
              commentInputRefs.current[post.post_id] = el;
            }}
            style={{ flex: 1, position: 'relative' }}
          >
                  <input
                    type="text"
                    placeholder="Type your comment..."
                    value={commentInput[repostData?.repost_id || post.post_id] || ''}
                    onChange={(e) => handleCommentInputChange(e, repostData?.repost_id || post.post_id)}
                    onKeyDown={(e) => handleCommentKeyDown(e, repostData?.repost_id || post.post_id)}
                    style={{
                      width: '100%',
                      border: '1px solid #ddd',
                      borderRadius: '20px',
                      padding: '10px 28px 10px 16px',
                      fontSize: '14px'
                    }}
                  />
                </div>
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
                  <span style={{ color: 'white', fontSize: '18px', lineHeight: 1 }}>➡️</span>
                </button>
                
                {/* @mention suggestions dropdown */}
                {showMentionSuggestions[repostData?.repost_id || post.post_id] && mentionSuggestions[repostData?.repost_id || post.post_id]?.length > 0 && (
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
                    {mentionSuggestions[repostData?.repost_id || post.post_id]?.map((user, index) => (
                      <div
                        key={user.user_id}
                        onClick={() => selectMention(user, repostData?.repost_id || post.post_id)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          backgroundColor: index === selectedMentionIndex[repostData?.repost_id || post.post_id] ? '#e3f2fd' : 'transparent',
                          borderBottom: index < (mentionSuggestions[repostData?.repost_id || post.post_id]?.length - 1) ? '1px solid #f0f0f0' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'background-color 0.1s ease'
                        }}
                        onMouseEnter={() => setSelectedMentionIndex(prev => ({ ...prev, [repostData?.repost_id || post.post_id]: index }))}
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
                          onError={(e) => handleProfilePicError(e)}
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

            {/* Repost Comments Section */}
            {repostData?.comments && showCommentsSection[repostData?.repost_id || post.post_id] && (
              <div className="comments-section" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                {(() => {
                  console.log('🔍 DEBUG: Comments display - repostData.comments:', repostData.comments, 'comments_count:', repostData.comments_count, 'showAllComments:', showAllComments[repostData?.repost_id || post.post_id]);
                  return null;
                })()}
                {repostData.comments.length === 0 ? (
                  <div style={{ color: '#6c757d', fontSize: '14px', fontStyle: 'italic' }}>
                    No comments yet
                  </div>
                ) : (
                  (showAllComments[repostData?.repost_id || post.post_id] ? repostData.comments : repostData.comments.slice(0, 2)).map((comment: any) => {
                  return (
                    <div key={comment.comment_id} className="comment-item" style={{ 
                      display: 'flex', 
                      gap: '8px', 
                      marginBottom: '8px', 
                      padding: '12px', 
                      backgroundColor: '#f8f9fa', 
                      borderRadius: '12px',
                      border: '1px solid #e9ecef',
                      marginLeft: '8px',
                      marginRight: '8px'
                    }}>
                      <img
                        src={getProfilePicUrl(comment.user.profile_pic)}
                        alt="Profile"
                        className="comment-profile-image"
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                        onError={handleProfilePicError}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            onClick={() => window.location.href = getProfilePath(comment.user.user_id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              color: '#333',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#007bff';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#333';
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {comment.user.f_name} {comment.user.m_name} {comment.user.l_name}
                          </button>
                          <div style={{ fontSize: '10px', color: '#666' }}>
                            {formatTime(comment.date_created)}
                          </div>
                        </div>
                        <div style={{ fontSize: '14px', color: '#1c1e21', marginTop: '4px' }}>
                          {comment.comment_content}
                        </div>
                      </div>
                    </div>
                  );
                })
                )}
                {repostData?.comments && repostData.comments.length > 2 && !showAllComments[repostData?.repost_id || post.post_id] && (
                  <button
                    className="view-all-comments-btn"
                    style={{ fontSize: '12px', color: '#1C4E80', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
                    onClick={() => setShowAllComments?.(prev => ({ ...prev, [repostData?.repost_id || post.post_id]: true }))}
                  >
                    View all comments ({repostData.comments.length})
                  </button>
                )}
                {repostData?.comments && repostData.comments.length > 2 && showAllComments[repostData?.repost_id || post.post_id] && (
                  <button
                    className="hide-comments-btn"
                    style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
                    onClick={() => setShowAllComments?.(prev => ({ ...prev, [repostData?.repost_id || post.post_id]: false }))}
                  >
                    Hide comments
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        // Regular post structure
        <div className="post-feed-card">
      <div className="post-header">
        <div className="post-header-left">
          <img
            src={repostDisplayAvatar}
            alt="Profile"
            className="post-header-profile-image"
            style={{ cursor: 'pointer' }}
            onError={handleProfilePicError}
            onClick={() => {
              if (displayUser?.user_id) {
                // Navigate to user profile based on current path
                const currentPath = window.location.pathname;
                if (currentPath.startsWith('/peso')) {
                  window.location.href = `/peso/profile/${displayUser.user_id}`;
                } else if (currentPath.startsWith('/ccict')) {
                  window.location.href = `/ccict/profile/${displayUser.user_id}`;
                } else {
                            window.location.href = `/profile/${displayUser.user_id}`;
                }
              }
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                className="post-author-info"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (displayUser?.user_id) {
                    // Navigate to user profile based on current path
                    const currentPath = window.location.pathname;
                    if (currentPath.startsWith('/peso')) {
                      window.location.href = `/peso/profile/${displayUser.user_id}`;
                    } else if (currentPath.startsWith('/ccict')) {
                      window.location.href = `/ccict/profile/${displayUser.user_id}`;
                    } else {
                            window.location.href = `/profile/${displayUser.user_id}`;
                    }
                  }
                }}
              >
                {repostDisplayName || 'User'}
              </div>
              {isDonation && (
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
              {post.is_event && (
                <>
                  <span style={{
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '600',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}>
                    Event
                  </span>
                  {(() => {
                    if (!post.event_date) return null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const eventDate = new Date(post.event_date);
                    eventDate.setHours(0, 0, 0, 0);
                    const isEventPast = eventDate < today;
                    
                    return isEventPast ? (
                      <span style={{
                        backgroundColor: '#9ca3af',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        marginLeft: '4px'
                      }}>
                        ENDED
                      </span>
                    ) : null;
                  })()}
                </>
              )}
            </div>
            <div className="post-author-details" style={{ color: '#666', fontSize: '12px' }}>
              <span>{formatTime(post.created_at) || 'Unknown time'}</span>
              {post.is_event && post.event_date && (
                <>
                  <span style={{ margin: '0 4px' }}>•</span>
                  <span style={{ color: '#1e40af', fontWeight: 500 }}>
                    {new Date(post.event_date).toLocaleDateString('en-US', { 
                      weekday: 'short',
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                  {post.event_time && (
                    <>
                      <span style={{ margin: '0 4px' }}>•</span>
                      <span style={{ color: '#475569' }}>🕐 {post.event_time}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        {isOwn && setShowOptions && (
          <div className="post-header-right" style={{ position: 'relative' }} ref={optionsMenuRef}>
            <button
              onClick={() => {
                console.log('Three dots clicked - post_id:', post.post_id);
                setShowOptions(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }));
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
            {showOptions[post.post_id] && (
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
                  width: '140px'
                }}
              >
                <button
                  onClick={handleEditPost}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    gap: '10px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    color: '#374151'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#1f2937';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#374151';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button
                  onClick={handleDeletePost}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#dc2626',
                    gap: '10px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                    e.currentTarget.style.color = '#b91c1c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editingPost[post.post_id] ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={editPostContent[post.post_id] || ''}
            onChange={(e) => setEditPostContent?.(prev => ({ ...prev, [post.post_id]: e.target.value }))}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={handleSaveEditPost}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '12px',
                gap: '6px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
              Save
            </button>
            <button
              onClick={handleCancelEditPost}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '12px',
                gap: '6px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(107, 114, 128, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(107, 114, 128, 0.3)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div 
            className="post-content"
            style={{
              wordWrap: 'break-word',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              maxWidth: '100%',
              fontSize: '14px',
              lineHeight: '1.5',
              color: '#333',
              marginBottom: '8px'
            }}
          >
            {renderTextWithLinks(post.post_content)}
          </div>
      )}

      {/* Multiple Images Display */}
      {(() => {
        const images = getImagesFromPost(post);
        if (images.length === 0) return null;

        return (
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', width: '100%' }}>
            {images.length === 1 ? (
              // Single image
          <img
            src={getImageUrl(images[0])}
            alt="post"
                style={{ 
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '100%', 
                  maxHeight: '85vh',
                  borderRadius: 8, 
                  objectFit: 'contain',
                  cursor: 'pointer'
                }}
                onClick={() => handleImageClick(0)}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  const naturalWidth = img.naturalWidth;
                  const naturalHeight = img.naturalHeight;
                  
                  // Portrait images (tall): More height, less width
                  if (naturalHeight > naturalWidth * 1.5) {
                    img.style.maxHeight = '50vh';
                    img.style.maxWidth = '50vw';
                  }
                  // Landscape images (wide): More width, less height  
                  else if (naturalWidth > naturalHeight * 1.5) {
                    img.style.maxWidth = '70vw';
                    img.style.maxHeight = '35vh';
                  }
                  // Square images: Balanced constraints
                  else {
                    img.style.maxWidth = '60vw';
                    img.style.maxHeight = '45vh';
                  }
                }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
                  console.error('Failed to load post image:', images[0]);
            }}
              />
            ) : (
              // Multiple images - Facebook-style grid layout (like forum posts)
              <div style={{
                display: 'grid',
                gap: 2,
                borderRadius: 8,
                overflow: 'hidden',
                width: '100%',
                ...(images.length === 2 ? {
                  gridTemplateColumns: '1fr 1fr',
                  height: '300px'
                } : images.length === 3 ? {
                  gridTemplateColumns: '2fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  height: '300px'
                } : images.length === 4 ? {
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  height: '300px'
                } : {
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  height: '300px'
                })
              }}>
                {images.slice(0, images.length <= 6 ? images.length : 6).map((image, index) => {
                  let gridArea = '';
                  if (images.length === 3) {
                    gridArea = index === 0 ? '1 / 1 / 3 / 2' : `1 / 2 / 2 / 3`;
                    if (index === 2) gridArea = '2 / 2 / 3 / 3';
                  }
                  
                  return (
                    <div key={index} style={{ 
                      position: 'relative',
                      gridArea: gridArea,
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleImageClick(index)}
                    >
                      <img
                        src={getImageUrl(image)}
                        alt={`post ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '120px',
                          objectFit: 'contain',
                          transition: 'transform 0.2s ease',
                          backgroundColor: '#ffffff'
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
                          console.error('Failed to load post image:', image);
                        }}
                      />
                      {index === 5 && images.length > 6 && (
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
                          onClick={() => handleImageClick(5)}
                        >
                          +{images.length - 6}
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

      {/* Inner Card for Donation Repost (clickable) */}
      {originalEmbedded && (
        <div 
          className="profile-repost-original"
          onClick={(e) => {
            e.stopPropagation();
            if (onViewOriginalPost && originalEmbedded) {
              onViewOriginalPost(originalEmbedded);
            }
          }}
          style={{ cursor: 'pointer', marginTop: 8 }}
        >
          {/* Original donation header */}
          <div className="profile-repost-original-header">
            <div className="profile-repost-original-header-left">
              <img
                src={getProfilePicUrl(originalEmbedded.user?.profile_pic)}
                alt="Profile"
                className="profile-repost-original-profile-image"
                onClick={() => {
                  if (originalEmbedded?.user?.user_id) {
                    const currentPath = window.location.pathname;
                    if (currentPath.startsWith('/peso')) {
                      window.location.href = `/peso/profile/${originalEmbedded.user.user_id}`;
                    } else if (currentPath.startsWith('/ccict')) {
                      window.location.href = `/ccict/profile/${originalEmbedded.user.user_id}`;
                    } else {
                      window.location.href = `/profile/${originalEmbedded.user.user_id}`;
                    }
                  }
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = ctulogo as unknown as string;
                }}
              />
              <div>
                <div 
                  className="profile-repost-original-author-info"
                  onClick={() => {
                    if (originalEmbedded?.user?.user_id) {
                      const currentPath = window.location.pathname;
                      if (currentPath.startsWith('/peso')) {
                        window.location.href = `/peso/profile/${originalEmbedded.user.user_id}`;
                      } else if (currentPath.startsWith('/ccict')) {
                        window.location.href = `/ccict/profile/${originalEmbedded.user.user_id}`;
                      } else {
                        window.location.href = `/profile/${originalEmbedded.user.user_id}`;
                      }
                    }
                  }}
                >
                  {originalEmbedded.user?.f_name && originalEmbedded.user?.l_name
                    ? renderName({ 
                        f_name: originalEmbedded.user.f_name, 
                        m_name: originalEmbedded.user.m_name, 
                        l_name: originalEmbedded.user.l_name 
                      })
                    : originalEmbedded.user?.f_name || 'Original Post'}
                </div>
                <div className="profile-repost-original-author-details">
                  <span>{formatTime(originalEmbedded.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Original donation content */}
          {originalEmbedded.post_content && (
            <div className="profile-repost-original-content">
              {renderTextWithLinks(originalEmbedded.post_content)}
            </div>
          )}

          {/* Original donation image preview */}
          {(() => {
            const originalImages = getImagesFromPost(originalEmbedded as any);
            if (!originalImages || originalImages.length === 0) return null;
            return (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', width: '100%' }}>
                <img
                  src={getImageUrl(originalImages[0])}
                  alt="original post"
                  className="profile-repost-original-image"
                  style={{ 
                    cursor: 'pointer',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '40vh',
                    borderRadius: '8px',
                    objectFit: 'contain'
                  }}
                  onError={handleProfilePicError}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* Facebook-style likes and comments display */}
      <PostStatsRow
        likes={post.likes}
        comments={post.comments}
        reposts={post.reposts}
        repostCount={post.reposts_count}
        onLikesClick={() => {
          console.log('Like summary clicked (regular post), setting showLikesModal to true');
          setShowLikesModal(true);
        }}
        onCommentsClick={() => {
          // Toggle comments section visibility
          setShowCommentsSection(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }));
        }}
        onRepostsClick={() => setShowRepostsModal(true)}
        animate={true}
      />

      <div className="post-footer-actions">
        <button
          onClick={() => {
            console.log('Like button clicked for post:', post.post_id, 'likedPosts:', likedPosts[post.post_id]);
            console.log('Calling like/unlike handler');
            likedPosts[post.post_id] ? handleUnlike() : handleLike();
          }}
          type="button"
          className={`post-footer-action${likedPosts[post.post_id] ? ' active' : ''}`}
          aria-pressed={!!likedPosts[post.post_id]}
        >
          <span className="post-footer-icon">
            <FontAwesomeIcon 
              icon={likedPosts[post.post_id] ? faThumbsUp : faThumbsUpReg} 
              size="lg" 
              style={{ color: likedPosts[post.post_id] ? '#1e3a8a' : '#555', fontSize: '18px' }} 
            />
          </span>
          <span className="post-footer-label">Like</span>
        </button>
        <button
          onClick={() => setShowCommentInput?.(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
          type="button"
          className={`post-footer-action${showCommentInput?.[post.post_id] ? ' active' : ''}`}
          aria-expanded={!!showCommentInput?.[post.post_id]}
        >
          <span className="post-footer-icon">
            <FontAwesomeIcon icon={faCommentReg} size="lg" style={{ fontSize: '20px', color: '#555' }} />
          </span>
          <span className="post-footer-label">Comment</span>
        </button>
        <RepostButton
          originalPost={{
            post_id: post.post_id,
            post_content: post.post_content,
            post_image: post.post_image,
            post_images: post.post_images,
            user: {
              user_id: post.user?.user_id || 0,
              f_name: post.user?.f_name || '',
              l_name: post.user?.l_name || '',
              profile_pic: post.user?.profile_pic
            },
            created_at: post.created_at || ''
          }}
          currentUser={{
            name: `${displayName}`,
            profile_pic: displayAvatar
          }}
          isReposted={repostedPosts[post.post_id] || false}
          onRepost={onPostUpdate}
          formatTime={formatTime}
          isForum={isForum}
          isDonation={isDonation}
        />
      </div>

      {showCommentInput[post.post_id] && (
        <div className="comment-input-container" style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <img 
            src={(() => {
              try {
                const raw = localStorage.getItem('user');
                if (raw) {
                  const u = JSON.parse(raw);
                  return getProfilePicUrl(u?.profile_pic) || displayAvatar;
                }
              } catch (_) {}
              return displayAvatar;
            })()}
            alt="Profile" 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '2px solid #e0e0e0',
              objectFit: 'cover',
              flexShrink: 0
            }}
            onError={(e) => handleProfilePicError(e)}
          />
          <div 
            ref={(el) => {
              if (el) {
                commentInputRefs.current[post.post_id] = el;
              }
            }}
            style={{ flex: 1, position: 'relative' }}
          >
            <input
              type="text"
              placeholder="Type your comment..."
              value={commentInput[post.post_id] || ''}
              onChange={(e) => handleCommentInputChange(e, post.post_id)}
              onKeyDown={(e) => handleCommentKeyDown(e, post.post_id)}
              style={{
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '20px',
                padding: '10px 0px 10px 5px',
                fontSize: '14px'
              }}
            />
            {/* Emoji Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEmojiPicker(prev => ({
                  ...prev,
                  [post.post_id]: !prev[post.post_id]
                }));
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#65676b',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#65676b';
              }}
              title="Add emoji"
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
                <circle cx="15.5" cy="9.5" r="1.5" fill="currentColor" />
                <path d="M8 14c1.5 2.5 4.5 2.5 6 0" />
              </svg>
            </button>
            {/* Emoji Picker */}
            {showEmojiPicker[post.post_id] && emojiPickerLayouts[post.post_id] &&
              ReactDOM.createPortal(
                <div
                  ref={(el) => {
                    emojiPickerRefs.current[post.post_id] = el;
                  }}
                  style={{
                    position: 'fixed',
                    top: emojiPickerLayouts[post.post_id].top,
                    left: emojiPickerLayouts[post.post_id].left,
                    width: emojiPickerLayouts[post.post_id].width,
                    zIndex: 4000,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#fff',
                    border: '1px solid #e0e0e0',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData: EmojiClickData) => {
                      setCommentInput?.(prev => ({
                        ...prev,
                        [post.post_id]: (prev[post.post_id] || '') + emojiData.emoji
                      }));
                    }}
                    width={emojiPickerLayouts[post.post_id].width}
                    height={320}
                    previewConfig={{ showPreview: false }}
                    skinTonesDisabled
                  />
                </div>,
                document.body
              )
            }
          </div>
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
          {showMentionSuggestions[post.post_id] && mentionSuggestions[post.post_id]?.length > 0 && (
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
              {mentionSuggestions[post.post_id]?.map((user, index) => (
                <div
                  key={user.user_id}
                  onClick={() => selectMention(user, post.post_id)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    backgroundColor: index === selectedMentionIndex[post.post_id] ? '#e3f2fd' : 'transparent',
                    borderBottom: index < (mentionSuggestions[post.post_id]?.length - 1) ? '1px solid #f0f0f0' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'background-color 0.1s ease'
                  }}
                  onMouseEnter={() => setSelectedMentionIndex(prev => ({ ...prev, [post.post_id]: index }))}
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
                    onError={(e) => handleProfilePicError(e)}
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

      {post.comments && post.comments.length > 0 && showCommentsSection[post.post_id] && (
        <div className="comments-section" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                  {(showAllComments[post.post_id] ? post.comments : post.comments.slice(0, 5)).map((comment) => {
                    console.log('PostCard comment user_id:', comment.user.user_id);
                    const isCommentHighlighted = activeCommentHighlight === comment.comment_id && isHighlightActive;
                    const isPermanentlyHighlighted = permanentCommentHighlight === comment.comment_id;
                    const highlightColor = '#fff3e0'; // Light orange for bright highlight
                    const permanentHighlightColor = '#fff8e1'; // Very light yellow for permanent subtle highlight
                    const permanentBorderColor = '#ffb74d'; // Light orange border for permanent highlight
                    
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
                          onClick={() => window.location.href = getProfilePath(comment.user.user_id)}
                        />
                        <div style={{ flex: 1 }}>
                          {/* Comment bubble container */}
                          <div style={{
                            backgroundColor: isCommentHighlighted 
                              ? highlightColor 
                              : isPermanentlyHighlighted 
                                ? permanentHighlightColor 
                                : '#f0f2f5',
                            boxShadow: isCommentHighlighted 
                              ? '0 0 0 2px rgba(255,137,33,0.25)' 
                              : isPermanentlyHighlighted 
                                ? `0 0 0 1px ${permanentBorderColor}` 
                                : 'none',
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
                            {((Number(currentUserId) === Number(comment.user.user_id) && setEditingComment && setEditCommentContent) || isOwn) && !editingComment[comment.comment_id] && (
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
                                    {(String(currentUserId) === String(comment.user.user_id) && setEditingComment) && (
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
                                onChange={(e) => setEditCommentContent?.(prev => ({ ...prev, [comment.comment_id]: e.target.value }))}
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
                                onClick={() => setShowReplyInput(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
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
                              displayName={displayName}
                              displayAvatar={(() => {
                                try {
                                  const raw = localStorage.getItem('user');
                                  if (raw) {
                                    const u = JSON.parse(raw);
                                    return getProfilePicUrl(u?.profile_pic) || displayAvatar;
                                  }
                                } catch (_) {}
                                return displayAvatar;
                              })()}
                              onReplyAdded={() => handleReplyAdded(comment.comment_id)}
                              commentAuthor={{
                                user_id: comment.user.user_id,
                                f_name: comment.user.f_name,
                                m_name: comment.user.m_name,
                                l_name: comment.user.l_name,
                                name: `${comment.user.f_name} ${comment.user.m_name || ''} ${comment.user.l_name}`.trim()
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
                              ).map((reply) => {
                                const isReplyHighlighted = activeReplyHighlight === reply.reply_id && isHighlightActive;
                                const isPermanentlyHighlighted = permanentReplyHighlight === reply.reply_id;
                                const highlightColor = '#fff3e0'; // Light orange for bright highlight
                                const permanentHighlightColor = '#fff8e1'; // Very light yellow for permanent subtle highlight
                                
                                return (
                                  <Reply
                                    key={reply.reply_id}
                                    reply={reply}
                                    commentId={comment.comment_id}
                                    currentUserId={currentUserId || undefined}
                                    formatTime={formatTime}
                                    onReplyUpdate={() => loadReplies(comment.comment_id)}
                                    displayName={displayName}
                                    displayAvatar={displayAvatar}
                                    registerHighlightRef={(replyId, element) => {
                                      if (element) {
                                        replyRefs.current[replyId] = element;
                                      } else {
                                        delete replyRefs.current[replyId];
                                      }
                                    }}
                                    isHighlighted={isReplyHighlighted || isPermanentlyHighlighted}
                                    highlightColor={isReplyHighlighted ? highlightColor : isPermanentlyHighlighted ? permanentHighlightColor : undefined}
                                  />
                                );
                              })}
                              
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
                  })}
          {post.comments.length > 5 && !showAllComments[post.post_id] && (
            <button
              className="view-all-comments-btn"
              style={{ fontSize: '12px', color: '#1C4E80', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
              onClick={() => setShowAllComments?.(prev => ({ ...prev, [post.post_id]: true }))}
            >
              View all comments ({post.comments.length})
            </button>
          )}
          {post.comments.length > 5 && showAllComments[post.post_id] && (
            <button
              className="hide-comments-btn"
              style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
              onClick={() => setShowAllComments?.(prev => ({ ...prev, [post.post_id]: false }))}
            >
              Hide comments
            </button>
          )}
        </div>
      )}

        </div>
      )}



      {/* Likes Modal */}
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

      {/* Reposts Modal */}
      {showRepostsModal && ReactDOM.createPortal(
        <RepostsModal
          isOpen={showRepostsModal}
          onClose={() => setShowRepostsModal(false)}
          reposts={fetchedReposts}
          isLoading={repostsLoading}
        />,
        document.body
      )}

      {/* Repost Likes Modal */}
      {showRepostLikesModal && repostData && repostData.original_post && ReactDOM.createPortal(
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
          onClick={() => setShowRepostLikesModal(false)}
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
              onClick={() => setShowRepostLikesModal(false)}
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
              👍 People who liked this repost
            </h2>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {repostData.likes && repostData.likes.length > 0 ? (
                repostData.likes.map((like: any, index: number) => {
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
                        borderBottom: index < (repostData?.likes?.length || 0) - 1 ? '1px solid #f0f0f0' : 'none',
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

      {/* Donation Repost Likes Modal */}
      {showDonationRepostLikesModal && repostData && repostData.original_post && ReactDOM.createPortal((
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
          onClick={() => setShowDonationRepostLikesModal(false)}
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
              onClick={() => setShowDonationRepostLikesModal(false)}
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
              💝 People who liked this repost
            </h2>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {repostData.likes && repostData.likes.length > 0 ? (
                repostData.likes.map((like: any, index: number) => {
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
                        borderBottom: index < (repostData?.likes?.length || 0) - 1 ? '1px solid #f0f0f0' : 'none',
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
        </div>),
        document.body
      )}


      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        isOpen={showPhotoGallery}
        onClose={() => setShowPhotoGallery(false)}
        images={getImagesFromPost(post)}
        currentIndex={currentPhotoIndex}
        onPrevious={handlePreviousPhoto}
        onNext={handleNextPhoto}
        onImageClick={(index) => setCurrentPhotoIndex(index)}
      />

      {/* Delete Repost Confirmation Modal */}
      <ConfirmModal
        open={showDeleteRepostModal}
        title="Delete Repost"
        message="Are you sure you want to delete this repost?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteRepost}
        onCancel={() => setShowDeleteRepostModal(false)}
      />

      {/* Delete Post Confirmation Modal */}
      <ConfirmModal
        open={showDeletePostModal}
        title={isForum ? "Delete Forum Post" : isDonation ? "Delete Donation Request" : "Delete Post"}
        message={
          isForum 
            ? "Are you sure you want to delete this forum post?"
            : isDonation
            ? "Are you sure you want to delete this donation request?"
            : "Are you sure you want to delete this post?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeletePost}
        onCancel={() => setShowDeletePostModal(false)}
      />

      {/* Delete Comment Confirmation Modal */}
      <ConfirmModal
        open={showDeleteCommentModal}
        title="Delete Comment"
        message="Are you sure you want to delete this comment?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteComment}
        onCancel={() => {
          setShowDeleteCommentModal(false);
          setCommentToDelete(null);
        }}
      />
    </>
  );
};

export default PostCard;


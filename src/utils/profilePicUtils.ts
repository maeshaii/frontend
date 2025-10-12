import ctulogo from '../images/ctulogo.png';

/**
 * Utility function to get the proper profile picture URL with fallback
 * @param profilePic - The profile picture URL from the backend
 * @param fallback - Optional fallback image (defaults to ctulogo)
 * @returns Properly formatted profile picture URL
 */
export const getProfilePicUrl = (profilePic: string | null | undefined, fallback: string = ctulogo): string => {
  if (!profilePic || profilePic.trim() === '') {
    console.log('ProfilePicUtils: No profile pic, using fallback:', fallback);
    return fallback;
  }
  
  // If it's already an absolute URL, return as-is
  if (String(profilePic).startsWith('http')) {
    console.log('ProfilePicUtils: Absolute URL:', profilePic);
    return profilePic;
  }
  
  // If it's a relative URL, prepend the backend URL
  const fullUrl = `http://127.0.0.1:8000${profilePic}`;
  console.log('ProfilePicUtils: Relative URL converted to:', fullUrl);
  return fullUrl;
};

/**
 * Utility function to handle profile picture onError events
 * @param event - The error event from the image element
 * @param fallback - Optional fallback image (defaults to ctulogo)
 */
export const handleProfilePicError = (event: React.SyntheticEvent<HTMLImageElement, Event>, fallback: string = ctulogo) => {
  const target = event.target as HTMLImageElement;
  target.onerror = null; // Prevent infinite loop
  target.src = fallback;
};

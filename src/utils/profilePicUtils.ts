import ctulogo from '../images/ctulogo.png';

// Get API base URL from environment or use default
const getApiBaseUrl = (): string => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, ''); // Remove /api suffix if present
  }
  return 'http://127.0.0.1:8000'; // Default fallback
};

/**
 * Utility function to get the proper image URL with fallback
 * @param imageUrl - The image URL from the backend
 * @param fallback - Optional fallback image (defaults to ctulogo)
 * @returns Properly formatted image URL
 */
export const getImageUrl = (imageUrl: string | null | undefined, fallback: string = ctulogo): string => {
  if (!imageUrl || imageUrl.trim() === '') {
    console.log('ImageUtils: No image URL, using fallback:', fallback);
    return fallback;
  }
  
  // If it's already an absolute URL, return as-is
  if (String(imageUrl).startsWith('http')) {
    console.log('ImageUtils: Absolute URL:', imageUrl);
    return imageUrl;
  }
  
  // If it's a relative URL, prepend the backend URL
  const baseUrl = getApiBaseUrl();
  const fullUrl = `${baseUrl}${imageUrl}`;
  console.log('ImageUtils: Relative URL converted to:', fullUrl);
  return fullUrl;
};

/**
 * Utility function to get the proper profile picture URL with fallback
 * @param profilePic - The profile picture URL from the backend
 * @param fallback - Optional fallback image (defaults to ctulogo)
 * @returns Properly formatted profile picture URL
 */
export const getProfilePicUrl = (profilePic: string | null | undefined, fallback: string = ctulogo): string => {
  return getImageUrl(profilePic, fallback);
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

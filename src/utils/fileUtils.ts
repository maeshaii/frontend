/**
 * File utility functions for frontend messaging system
 */

export type FileCategory = 'image' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'video' | 'audio' | 'archive' | 'text' | 'document';

export const getFileIcon = (fileCategory: FileCategory, fileType?: string): string => {
  switch (fileCategory) {
    case 'image':
      return '🖼️';
    case 'pdf':
      return '📄';
    case 'word':
      return '📝';
    case 'excel':
      return '📊';
    case 'powerpoint':
      return '📈';
    case 'video':
      return '🎥';
    case 'audio':
      return '🎵';
    case 'archive':
      return '📦';
    case 'text':
      return '📄';
    default:
      return '📎';
  }
};

export const getFileTypeDisplayName = (fileCategory: FileCategory): string => {
  switch (fileCategory) {
    case 'image':
      return 'Image';
    case 'pdf':
      return 'PDF Document';
    case 'word':
      return 'Word Document';
    case 'excel':
      return 'Excel Spreadsheet';
    case 'powerpoint':
      return 'PowerPoint Presentation';
    case 'video':
      return 'Video File';
    case 'audio':
      return 'Audio File';
    case 'archive':
      return 'Archive File';
    case 'text':
      return 'Text Document';
    default:
      return 'Document';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const isImageFile = (fileCategory: FileCategory, fileType?: string): boolean => {
  return fileCategory === 'image' || (fileType ? fileType.startsWith('image/') : false);
};

export const isVideoFile = (fileCategory: FileCategory, fileType?: string): boolean => {
  return fileCategory === 'video' || (fileType ? fileType.startsWith('video/') : false);
};

export const isAudioFile = (fileCategory: FileCategory, fileType?: string): boolean => {
  return fileCategory === 'audio' || (fileType ? fileType.startsWith('audio/') : false);
};

export const canPreview = (fileCategory: FileCategory, fileType?: string): boolean => {
  return isImageFile(fileCategory, fileType) || isVideoFile(fileCategory, fileType) || isAudioFile(fileCategory, fileType);
};


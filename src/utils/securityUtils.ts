/**
 * Client-side security utilities for content sanitization
 */

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeUserInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove null bytes and other dangerous characters
  let sanitized = input.replace(/\u0000/g, '');
  
  // Check length
  if (sanitized.length > maxLength) {
    throw new Error(`Input too long. Maximum ${maxLength} characters allowed.`);
  }

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove dangerous HTML entities
  sanitized = sanitized.replace(/&[#\w]+;/g, '');
  
  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Check for empty content after sanitization
  if (!sanitized) {
    throw new Error('Content cannot be empty after sanitization');
  }
  
  return sanitized;
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    throw new Error('Filename must be a string');
  }

  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '').replace(/[/\\]/g, '');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\u0000/g, '');
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Only allow alphanumeric, dots, hyphens, underscores, and spaces
  sanitized = sanitized.replace(/[^a-zA-Z0-9._\s-]/g, '');
  
  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Ensure filename is not empty
  if (!sanitized) {
    sanitized = 'unnamed_file';
  }
  
  // Limit length
  if (sanitized.length > 255) {
    const parts = sanitized.split('.');
    if (parts.length > 1) {
      const ext = parts.pop() || '';
      const name = parts.join('.');
      sanitized = name.substring(0, 200) + '.' + ext;
    } else {
      sanitized = sanitized.substring(0, 255);
    }
  }
  
  return sanitized;
}

/**
 * Validate message type
 */
export function validateMessageType(messageType: string): string {
  if (typeof messageType !== 'string') {
    throw new Error('Message type must be a string');
  }

  const allowedTypes = ['text', 'image', 'file', 'system'];
  const sanitized = messageType.toLowerCase().trim();
  
  if (!allowedTypes.includes(sanitized)) {
    throw new Error(`Invalid message type. Must be one of: ${allowedTypes.join(', ')}`);
  }
  
  return sanitized;
}

/**
 * Check if URL is safe (no javascript:, data:, etc.)
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const urlLower = url.toLowerCase();
  
  // Dangerous protocols
  const dangerousProtocols = [
    'javascript:', 'data:', 'vbscript:', 'file:', 'ftp:'
  ];
  
  return !dangerousProtocols.some(protocol => urlLower.startsWith(protocol));
}

/**
 * Escape HTML entities for safe display
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  const htmlEscapes: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
}

/**
 * Validate file extension
 */
export function validateFileExtension(filename: string, allowedExtensions: string[]): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const extension = '.' + filename.split('.').pop()?.toLowerCase();
  return allowedExtensions.includes(extension);
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number, maxSizeMB: number): boolean {
  if (typeof fileSize !== 'number' || fileSize <= 0) {
    return false;
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxSizeBytes;
}


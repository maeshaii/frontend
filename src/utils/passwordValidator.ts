/**
 * Password validation utility
 * Returns an array of missing requirements for the password
 */
export interface PasswordValidationResult {
  isValid: boolean;
  missingRequirements: string[];
  score: number;
  message: string;
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const missingRequirements: string[] = [];
  
  if (password.length < 16) {
    missingRequirements.push('16+ characters');
  }
  if (!/[A-Z]/.test(password)) {
    missingRequirements.push('uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    missingRequirements.push('lowercase letter');
  }
  if (!/\d/.test(password)) {
    missingRequirements.push('number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    missingRequirements.push('special character');
  }

  const score = 5 - missingRequirements.length;
  let message = '';
  if (score <= 2) {
    message = 'Weak';
  } else if (score === 3 || score === 4) {
    message = 'Medium';
  } else {
    message = 'Strong';
  }

  return {
    isValid: missingRequirements.length === 0,
    missingRequirements,
    score,
    message,
  };
};



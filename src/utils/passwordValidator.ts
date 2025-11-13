export interface PasswordValidationResult {
  isValid: boolean;
  missingRequirements: string[];
  score: number;
  message: string;
}

// Validate password strength: 16+ chars, upper, lower, number, special
export function validatePassword(password: string): PasswordValidationResult {
  const missingRequirements: string[] = [];

  if ((password || '').length < 16) missingRequirements.push('16+ characters');
  if (!/[A-Z]/.test(password)) missingRequirements.push('uppercase letter');
  if (!/[a-z]/.test(password)) missingRequirements.push('lowercase letter');
  if (!/\d/.test(password)) missingRequirements.push('number');
  if (!/[^A-Za-z0-9]/.test(password)) missingRequirements.push('special character');

  const score = 5 - missingRequirements.length;
  const message = score <= 2 ? 'Weak' : score <= 4 ? 'Medium' : 'Strong';

  return {
    isValid: missingRequirements.length === 0,
    missingRequirements,
    score,
    message,
  };
}

export default validatePassword;



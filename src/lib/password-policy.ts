/**
 * Password complexity validation.
 * Requirements: 12+ chars, uppercase, lowercase, number, special character.
 */

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("Must be at least 12 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Must contain an uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Must contain a lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Must contain a number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Must contain a special character");
  }

  return { valid: errors.length === 0, errors };
}

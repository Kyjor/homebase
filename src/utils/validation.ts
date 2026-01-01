export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  if (!email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  return { isValid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' };
  }
  return { isValid: true };
};

export const validateName = (name: string): ValidationResult => {
  if (!name.trim()) {
    return { isValid: false, error: 'Name is required' };
  }
  if (name.trim().length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters' };
  }
  return { isValid: true };
};

export const validateAmount = (amount: number | string): ValidationResult => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return { isValid: false, error: 'Amount must be a number' };
  }
  if (num < 0) {
    return { isValid: false, error: 'Amount cannot be negative' };
  }
  return { isValid: true };
};

export const validateCategoryName = (name: string): ValidationResult => {
  if (!name.trim()) {
    return { isValid: false, error: 'Category name is required' };
  }
  if (name.trim().length < 2) {
    return { isValid: false, error: 'Category name must be at least 2 characters' };
  }
  if (name.trim().length > 50) {
    return { isValid: false, error: 'Category name must be less than 50 characters' };
  }
  return { isValid: true };
};

export const validateItemName = (name: string): ValidationResult => {
  if (!name.trim()) {
    return { isValid: false, error: 'Item name is required' };
  }
  if (name.trim().length < 1) {
    return { isValid: false, error: 'Item name cannot be empty' };
  }
  if (name.trim().length > 200) {
    return { isValid: false, error: 'Item name must be less than 200 characters' };
  }
  return { isValid: true };
};

export const validateDate = (date: string): ValidationResult => {
  if (!date) {
    return { isValid: false, error: 'Date is required' };
  }
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }
  return { isValid: true };
};

export const validateHouseholdName = (name: string): ValidationResult => {
  if (!name.trim()) {
    return { isValid: false, error: 'Household name is required' };
  }
  if (name.trim().length < 2) {
    return { isValid: false, error: 'Household name must be at least 2 characters' };
  }
  if (name.trim().length > 100) {
    return { isValid: false, error: 'Household name must be less than 100 characters' };
  }
  return { isValid: true };
};










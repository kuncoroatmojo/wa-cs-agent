export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export const validateName = (name: string): boolean => {
  return name.length >= 2 && name.length <= 50
}

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url)
    return /^https?:\/\/.+/.test(url)
  } catch {
    return false
  }
}

export const validatePhone = (phone: string): boolean => {
  return /^\+?[\d\s\-()]+$/.test(phone)
}

export const validateRequired = (value: any): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return value !== null && value !== undefined
}

export const validateFileSize = (file: File, maxSize: number): boolean => {
  return file.size <= maxSize
}

export const validateFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type)
} 
export const theme = {
  colors: {
    primary: '#6366f1',
    primaryLight: '#60a5fa',
    background: '#f8fafc',
    surface: '#fff',
    text: {
      primary: '#2d3748',
      secondary: '#334155',
      tertiary: '#64748b',
    },
    border: '#cbd5e1',
    error: {
      background: '#fee2e2',
      text: '#b91c1c',
    },
    success: {
      background: '#e3f2fd',
      text: '#1565c0',
    },
    gray: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e5e7eb',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '24px',
    '2xl': '32px',
  },
  borderRadius: {
    sm: '5px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    '2xl': '14px',
    '3xl': '16px',
    '4xl': '24px',
  },
  shadows: {
    sm: '0 1px 4px 0 rgba(60,72,88,0.06)',
    md: '0 2px 8px 0 rgba(60,72,88,0.08)',
    lg: '0 4px 24px 0 rgba(60,72,88,0.10)',
    xl: '0 8px 32px 0 rgba(60,72,88,0.18)',
    '2xl': '0 12px 48px 0 rgba(60,72,88,0.22)',
  },
  gradients: {
    primary: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
    background: 'linear-gradient(120deg, #f8fafc 0%, #e3e7ed 100%)',
  },
  breakpoints: {
    mobile: 700,
  },
};

export const isMobile = () => typeof window !== 'undefined' && window.innerWidth < theme.breakpoints.mobile;










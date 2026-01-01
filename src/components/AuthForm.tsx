import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail, validatePassword, validateName } from '../utils/validation';
import styles from './AuthForm.module.css';

const AuthForm: React.FC = () => {
  const { signIn, signUp, loading, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: { [key: string]: string } = {};
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      errors.email = emailValidation.error || '';
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.error || '';
    }

    if (mode === 'signup') {
      const nameValidation = validateName(name);
      if (!nameValidation.isValid) {
        errors.name = nameValidation.error || '';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    
    if (mode === 'login') {
      await signIn(email, password);
    } else {
      await signUp(email, password, name);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.heading}>
          {mode === 'login' ? 'Login' : 'Sign Up'}
        </h2>
        {mode === 'signup' && (
          <div>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (validationErrors.name) {
                  setValidationErrors({ ...validationErrors, name: '' });
                }
              }}
              required
              className={`${styles.input} ${validationErrors.name ? styles.inputError : ''}`}
            />
            {validationErrors.name && <div className={styles.errorText}>{validationErrors.name}</div>}
          </div>
        )}
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              if (validationErrors.email) {
                setValidationErrors({ ...validationErrors, email: '' });
              }
            }}
            required
            className={`${styles.input} ${validationErrors.email ? styles.inputError : ''}`}
          />
          {validationErrors.email && <div className={styles.errorText}>{validationErrors.email}</div>}
        </div>
        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              if (validationErrors.password) {
                setValidationErrors({ ...validationErrors, password: '' });
              }
            }}
            required
            className={`${styles.input} ${validationErrors.password ? styles.inputError : ''}`}
          />
          {validationErrors.password && <div className={styles.errorText}>{validationErrors.password}</div>}
        </div>
        <button
          type="submit"
          disabled={loading}
          className={styles.submitButton}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
        </button>
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
        <div className={styles.switchContainer}>
          {mode === 'login' ? (
            <span>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setValidationErrors({});
                }}
                className={styles.switchButton}
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setValidationErrors({});
                }}
                className={styles.switchButton}
              >
                Login
              </button>
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

export default AuthForm; 
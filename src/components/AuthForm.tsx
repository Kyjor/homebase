import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AuthForm: React.FC = () => {
  const { signIn, signUp, loading, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await signIn(email, password);
    } else {
      await signUp(email, password, name);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(120deg, #f8fafc 0%, #e3e7ed 100%)',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          padding: '2.5rem 2rem',
          borderRadius: 12,
          boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)',
          minWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <h2 style={{ textAlign: 'center', margin: 0, fontWeight: 700, color: '#2d3748' }}>
          {mode === 'login' ? 'Login' : 'Sign Up'}
        </h2>
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 16,
            }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 16,
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 16,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '12px 0',
            fontWeight: 600,
            fontSize: 16,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 8,
            boxShadow: '0 2px 8px 0 rgba(60,72,88,0.08)',
            transition: 'background 0.2s',
          }}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
        </button>
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#b91c1c',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 15,
            textAlign: 'center',
            marginTop: 4,
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          {mode === 'login' ? (
            <span>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 15,
                }}
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 15,
                }}
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
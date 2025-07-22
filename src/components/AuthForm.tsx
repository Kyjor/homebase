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
    <div className="auth-form-container">
      <form onSubmit={handleSubmit}>
        <h2>{mode === 'login' ? 'Login' : 'Sign Up'}</h2>
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
        </button>
        {error && <div className="auth-error">{error}</div>}
      </form>
      <div className="auth-toggle">
        {mode === 'login' ? (
          <span>
            Don&apos;t have an account?{' '}
            <button type="button" onClick={() => setMode('signup')}>Sign Up</button>
          </span>
        ) : (
          <span>
            Already have an account?{' '}
            <button type="button" onClick={() => setMode('login')}>Login</button>
          </span>
        )}
      </div>
    </div>
  );
};

export default AuthForm; 
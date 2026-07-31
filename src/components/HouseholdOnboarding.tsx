import React, { useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { useAuth } from '../contexts/AuthContext';
import { validateHouseholdName } from '../utils/validation';
import styles from './HouseholdOnboarding.module.css';

const HouseholdOnboarding: React.FC = () => {
  const { household, createHousehold, joinHousehold, loading, error } = useHousehold();
  const { user } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!user) return null;

  if (household) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.brand}>Homebase</div>
          <h2 className={styles.title}>You're in {household.name}</h2>
          <p className={styles.subtitle}>
            Share this invite code with your partner so they can join.
          </p>
          <div className={styles.inviteCode}>{household.id}</div>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateHouseholdName(name);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid household name');
      return;
    }
    setValidationError(null);
    await createHousehold(name);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setValidationError('Invite code is required');
      return;
    }
    setValidationError(null);
    await joinHousehold(inviteCode);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>Homebase</div>
        <h2 className={styles.title}>Set up your household</h2>
        <p className={styles.subtitle}>
          Create a new home or join one with an invite code.
        </p>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${mode === 'create' ? styles.tabActive : ''}`}
            onClick={() => setMode('create')}
          >
            Create
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === 'join' ? styles.tabActive : ''}`}
            onClick={() => setMode('join')}
          >
            Join
          </button>
        </div>

        {mode === 'create' ? (
          <form className={styles.form} onSubmit={handleCreate}>
            <input
              className={styles.input}
              type="text"
              placeholder="Household name"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              required
            />
            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Creating…' : 'Create household'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleJoin}>
            <input
              className={styles.input}
              type="text"
              placeholder="Invite code"
              value={inviteCode}
              onChange={e => {
                setInviteCode(e.target.value);
                if (validationError) setValidationError(null);
              }}
              required
            />
            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Joining…' : 'Join household'}
            </button>
          </form>
        )}

        {(error || validationError) && (
          <div className={styles.error}>{error || validationError}</div>
        )}
      </div>
    </div>
  );
};

export default HouseholdOnboarding;

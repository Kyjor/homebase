import React, { useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { useAuth } from '../contexts/AuthContext';

const HouseholdOnboarding: React.FC = () => {
  const { household, createHousehold, joinHousehold, loading, error } = useHousehold();
  const { user } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  if (!user) return null;
  if (household) return (
    <div className="onboarding-success">
      <h2>Welcome to {household.name}!</h2>
      <p>Share this invite code with your partner: <strong>{household.id}</strong></p>
    </div>
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createHousehold(name);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    await joinHousehold(inviteCode);
  };

  return (
    <div className="household-onboarding-container">
      <div className="onboarding-toggle">
        <button onClick={() => setMode('create')} disabled={mode === 'create'}>Create Household</button>
        <button onClick={() => setMode('join')} disabled={mode === 'join'}>Join Household</button>
      </div>
      {mode === 'create' ? (
        <form onSubmit={handleCreate}>
          <h2>Create a New Household</h2>
          <input
            type="text"
            placeholder="Household Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>Create</button>
        </form>
      ) : (
        <form onSubmit={handleJoin}>
          <h2>Join an Existing Household</h2>
          <input
            type="text"
            placeholder="Invite Code"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>Join</button>
        </form>
      )}
      {error && <div className="onboarding-error">{error}</div>}
    </div>
  );
};

export default HouseholdOnboarding; 
import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';
import { getHouseholdMembers, inviteUserByEmail } from '../services/householdService';
import supabase from '../services/supabaseClient';
import { isMobile } from '../styles/theme';
import { validateEmail } from '../utils/validation';
import styles from './HouseholdMembers.module.css';

const HouseholdMembers: React.FC = () => {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mobile = isMobile();

  useEffect(() => {
    if (!household) return;

    loadMembers();

    const channel = supabase.channel('household-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `household_id=eq.${household.id}`,
        },
        () => {
          loadMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [household]);

  const loadMembers = async () => {
    if (!household) return;
    try {
      const data = await getHouseholdMembers(household.id);
      setMembers(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !inviteEmail.trim()) return;

    const emailValidation = validateEmail(inviteEmail);
    if (!emailValidation.isValid) {
      setError(emailValidation.error || 'Invalid email');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await inviteUserByEmail(inviteEmail.trim(), household.id);
      setSuccess(`Invitation sent to ${inviteEmail}!`);
      setInviteEmail('');
      await loadMembers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!household) return;
    navigator.clipboard.writeText(household.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!household) return null;

  return (
    <div className={`${styles.container} ${mobile ? styles.containerMobile : ''}`}>
      <h2 className={styles.heading}>Household Members</h2>

      {error && <div className={styles.errorMessage}>{error}</div>}
      {success && <div className={styles.successMessage}>{success}</div>}

      <div className={styles.membersList}>
        {members.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '20px 0' }}>
            No members yet
          </div>
        ) : (
          members.map(member => (
            <div key={member.id} className={styles.memberItem}>
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>
                  {member.name}
                  {member.id === user?.id && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6366f1' }}>
                      (You)
                    </span>
                  )}
                </div>
                <div className={styles.memberEmail}>{member.email}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.inviteSection}>
        <h3 className={styles.inviteTitle}>Invite Member</h3>
        <form onSubmit={handleInvite} className={styles.inviteForm}>
          <input
            type="email"
            placeholder="Enter email address"
            value={inviteEmail}
            onChange={e => {
              setInviteEmail(e.target.value);
              setError(null);
            }}
            required
            className={styles.inviteInput}
          />
          <button
            type="submit"
            disabled={loading}
            className={styles.inviteButton}
          >
            {loading ? 'Inviting...' : 'Invite'}
          </button>
        </form>

        <div className={styles.inviteCodeSection}>
          <div className={styles.inviteCodeLabel}>Or share this invite code:</div>
          <div className={styles.inviteCode}>{household.id}</div>
          <button onClick={handleCopyCode} className={styles.copyButton}>
            {copied ? '✓ Copied!' : 'Copy Code'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HouseholdMembers;


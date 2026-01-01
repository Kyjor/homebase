import React, { useEffect, useState, useMemo } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { useAuth } from '../contexts/AuthContext';
import { Reminder } from '../types';
import { getRemindersByHousehold, getRemindersByDate, addReminder, updateReminder, deleteReminder } from '../services/reminderService';
import supabase from '../services/supabaseClient';
import { isMobile } from '../styles/theme';
import styles from './Calendar.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Calendar: React.FC = () => {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', date: '', time: '' });
  const [error, setError] = useState<string | null>(null);
  const mobile = isMobile();

  useEffect(() => {
    if (!household) return;
    
    getRemindersByHousehold(household.id)
      .then(setReminders)
      .catch(e => setError(e.message));

    const channel = supabase.channel('reminders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `household_id=eq.${household.id}`,
        },
        () => {
          getRemindersByHousehold(household.id).then(setReminders);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [household]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = [];
    
    // Add previous month's trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }
    
    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    // Add next month's leading days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }
    
    return days;
  }, [year, month, daysInMonth, startingDayOfWeek]);

  const getRemindersForDate = (date: Date): Reminder[] => {
    const dateStr = date.toISOString().slice(0, 10);
    return reminders.filter(r => r.date === dateStr);
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().slice(0, 10);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === month && date.getFullYear() === year;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (date: Date) => {
    if (!isCurrentMonth(date)) return;
    const dateStr = formatDate(date);
    setSelectedDate(dateStr);
    setFormData({ ...formData, date: dateStr });
    setEditingReminder(null);
    setShowModal(true);
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !user || !formData.title || !formData.date) {
      setError('Title and date are required');
      return;
    }

    try {
      setError(null);
      const reminderData = {
        household_id: household.id,
        title: formData.title,
        description: formData.description || undefined,
        date: formData.date,
        time: formData.time || undefined,
        created_by: user.id,
        is_completed: false,
      };

      if (editingReminder) {
        await updateReminder(editingReminder.id, reminderData);
      } else {
        await addReminder(reminderData);
      }

      setShowModal(false);
      setFormData({ title: '', description: '', date: '', time: '' });
      setEditingReminder(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleComplete = async (reminder: Reminder) => {
    try {
      await updateReminder(reminder.id, { is_completed: !reminder.is_completed });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this reminder?')) return;
    try {
      await deleteReminder(id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      date: reminder.date,
      time: reminder.time || '',
    });
    setShowModal(true);
  };

  const selectedDateReminders = selectedDate
    ? reminders.filter(r => r.date === selectedDate)
    : [];

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={`${styles.container} ${mobile ? styles.containerMobile : ''}`}>
      <div className={styles.header}>
        <button onClick={handlePrevMonth} className={styles.navButton}>← Prev</button>
        <h2 className={styles.currentMonth}>{monthName}</h2>
        <button onClick={handleNextMonth} className={styles.navButton}>Next →</button>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.calendarGrid}>
        {DAYS.map(day => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
        {calendarDays.map((date, idx) => {
          if (!date) return null;
          const dateReminders = getRemindersForDate(date);
          const isCurrentMonthDay = isCurrentMonth(date);
          
          return (
            <div
              key={idx}
              className={`${styles.dayCell} ${
                !isCurrentMonthDay ? styles.dayCellOtherMonth : ''
              } ${isToday(date) ? styles.dayCellToday : ''}`}
              onClick={() => handleDayClick(date)}
            >
              <div className={styles.dayNumber}>{date.getDate()}</div>
              {dateReminders.slice(0, 3).map(reminder => (
                <div
                  key={reminder.id}
                  className={`${styles.reminderDot} ${
                    reminder.is_completed ? styles.reminderDotCompleted : ''
                  }`}
                  title={reminder.title}
                />
              ))}
              {dateReminders.length > 3 && (
                <div className={styles.dayNumber} style={{ fontSize: '10px', marginTop: '2px' }}>
                  +{dateReminders.length - 3}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDate && selectedDateReminders.length > 0 && (
        <div className={styles.reminderList}>
          <h3 style={{ fontWeight: 700, fontSize: 18, color: '#2d3748', marginBottom: 12 }}>
            Reminders for {new Date(selectedDate).toLocaleDateString()}
          </h3>
          {selectedDateReminders.map(reminder => (
            <div
              key={reminder.id}
              className={`${styles.reminderItem} ${
                reminder.is_completed ? styles.reminderItemCompleted : ''
              }`}
            >
              <div className={styles.reminderContent}>
                <div className={styles.reminderTitle}>{reminder.title}</div>
                {reminder.description && (
                  <div className={styles.reminderDescription}>{reminder.description}</div>
                )}
                {reminder.time && (
                  <div className={styles.reminderTime}>Time: {reminder.time}</div>
                )}
              </div>
              <div className={styles.reminderActions}>
                <button
                  onClick={() => handleToggleComplete(reminder)}
                  className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                >
                  {reminder.is_completed ? '✓' : '○'}
                </button>
                <button
                  onClick={() => handleEdit(reminder)}
                  className={styles.actionButton}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(reminder.id)}
                  className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={styles.modal} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingReminder ? 'Edit Reminder' : 'Add Reminder'}
              </h3>
              <button onClick={() => setShowModal(false)} className={styles.closeButton}>×</button>
            </div>
            <form onSubmit={handleAddReminder}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className={styles.formTextarea}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Time (optional)</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                  className={styles.formInput}
                />
              </div>
              <button type="submit" className={styles.actionButton} style={{ width: '100%', marginTop: '8px' }}>
                {editingReminder ? 'Update' : 'Add'} Reminder
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;


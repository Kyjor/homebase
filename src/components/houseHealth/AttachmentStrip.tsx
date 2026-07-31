import React, { useEffect, useState } from 'react';
import { TaskAttachment } from '../../types';
import {
  deleteAttachment,
  getAttachmentUrl,
  uploadAttachment,
} from '../../services/taskAttachmentService';
import styles from './HouseHealth.module.css';

interface AttachmentStripProps {
  householdId: string;
  taskId?: string | null;
  completionId?: string | null;
  attachments: TaskAttachment[];
  userId?: string | null;
  onChange: () => void;
}

const AttachmentStrip: React.FC<AttachmentStripProps> = ({
  householdId,
  taskId,
  completionId,
  attachments,
  userId,
  onChange,
}) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        attachments.map(async a => {
          try {
            next[a.id] = await getAttachmentUrl(a.storage_path);
          } catch {
            /* ignore signed url failures */
          }
        })
      );
      if (!cancelled) setUrls(next);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAttachment({
        householdId,
        taskId,
        completionId,
        file,
        createdBy: userId,
      });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: TaskAttachment) => {
    if (!confirm('Remove this photo?')) return;
    try {
      await deleteAttachment(attachment);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <div className={styles.attachmentStrip}>
        {attachments.map(a => (
          <div key={a.id} className={styles.thumbWrap}>
            {urls[a.id] ? (
              <a href={urls[a.id]} target="_blank" rel="noreferrer">
                <img src={urls[a.id]} alt="" className={styles.thumb} />
              </a>
            ) : (
              <div className={styles.thumb} style={{ background: '#f1f5f9' }} />
            )}
            <button
              type="button"
              className={styles.thumbDelete}
              onClick={() => handleDelete(a)}
              aria-label="Delete photo"
            >
              ×
            </button>
          </div>
        ))}
        <label className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
          {uploading ? 'Uploading…' : '+ Photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

export default AttachmentStrip;

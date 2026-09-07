import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../migrations/0047_user_deletion_integrity.sql', import.meta.url);

describe('user deletion privacy migration', () => {
  it('centralizes cleanup for sensitive, retained and shared user data', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).toContain('CREATE TRIGGER trg_users_privacy_cleanup');
    expect(sql).toContain('BEFORE DELETE ON users');

    // Sensitive/auth data must not survive account deletion.
    expect(sql).toContain('DELETE FROM ra_user_credentials WHERE user_id = OLD.id');
    expect(sql).toContain('DELETE FROM refresh_tokens WHERE user_id = OLD.id');
    expect(sql).toContain('DELETE FROM password_resets WHERE user_id = OLD.id');

    // Retained analytics/business records must be unlinked from the user.
    expect(sql).toContain('UPDATE product_requests SET user_id = NULL');
    expect(sql).toContain('UPDATE ai_usage_logs SET user_id = NULL');
    expect(sql).toContain('UPDATE affiliate_clicks SET user_id = NULL');

    // Shared content survives, but creator/uploader references do not.
    expect(sql).toContain('UPDATE files SET uploaded_by = NULL');
    expect(sql).toContain('UPDATE collections SET created_by = NULL');
    expect(sql).toContain('UPDATE collection_files SET added_by = NULL');

    // Support attachments must remain traceable for physical R2 purge.
    expect(sql).toContain('privacy_r2_purge_queue');
    expect(sql).toContain("'user_deletion'");

    // Deletion must not be blocked by moderator references.
    expect(sql).toContain('UPDATE announcement_comments SET deleted_by = NULL');

    // User profile snapshots in audit logs must be redacted.
    expect(sql).toContain('SET before_json = NULL');
    expect(sql).toContain('after_json = NULL');
  });
});

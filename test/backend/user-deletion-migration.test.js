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
    expect(sql).toContain('DELETE FROM ai_usage_logs WHERE user_id = OLD.id');
    expect(sql).toContain('DELETE FROM ra_link_audit_findings WHERE user_id = OLD.id');

    // Retained business records must be unlinked or scrubbed.
    expect(sql).toContain('UPDATE product_requests SET user_id = NULL');
    expect(sql).toContain('UPDATE affiliate_clicks');
    expect(sql).toContain('referer = NULL');
    expect(sql).toContain('user_agent = NULL');
    expect(sql).toContain('UPDATE form_submissions');
    expect(sql).toContain('email = NULL');
    expect(sql).toContain('message = NULL');

    // Account-owned engagement/personal structures are explicitly removed.
    expect(sql).toContain('DELETE FROM announcement_reactions WHERE user_id = OLD.id');
    expect(sql).toContain('DELETE FROM announcement_comments WHERE user_id = OLD.id');
    expect(sql).toContain('DELETE FROM notifications WHERE user_id = OLD.id');
    expect(sql).toContain('DELETE FROM user_collections WHERE user_id = OLD.id');

    // Shared content survives, but creator/uploader references do not.
    expect(sql).toContain('UPDATE files SET uploaded_by = NULL');
    expect(sql).toContain('UPDATE collections SET created_by = NULL');
    expect(sql).toContain('UPDATE collection_files SET added_by = NULL');
    expect(sql).toContain('UPDATE institution_files SET uploaded_by = NULL');

    // Support attachments remain traceable for physical R2 purge and support
    // snapshots are redacted before ticket IDs disappear.
    expect(sql).toContain('privacy_r2_purge_queue');
    expect(sql).toContain("'user_deletion'");
    expect(sql).toContain("entity_type = 'support_ticket'");

    // Deletion must not be blocked by moderator references.
    expect(sql).toContain('UPDATE announcement_comments SET deleted_by = NULL');

    // User profile snapshots in audit logs must be redacted.
    expect(sql).toContain('SET before_json = NULL');
    expect(sql).toContain('after_json = NULL');
  });

  it('does not null ai_usage_logs user_id because that can violate its CHECK constraint', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).not.toContain('UPDATE ai_usage_logs SET user_id = NULL');
  });
});

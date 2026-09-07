import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';

import app from '../../backend/src/index.js';

class MemoryBucket {
  constructor() {
    this.objects = new Map();
  }

  async put(key, body, opts = {}) {
    this.objects.set(key, {
      body,
      contentType: opts.httpMetadata?.contentType || 'application/octet-stream',
    });
  }

  async get(key) {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      body: object.body,
      httpEtag: '"test-etag"',
      writeHttpMetadata(headers) {
        headers.set('content-type', object.contentType);
      },
    };
  }
}

class SmokeD1 {
  constructor() {
    this.nextFileId = 1;
    this.nextCollectionId = 100;
    this.files = [];
    this.collections = [];
    this.collectionFiles = [];
    this.adminActions = [];
    this.supportTickets = [{ id: 501, user_id: 7, institution_id: 3 }];
    this.ticketReplies = [];
    this.announcements = [
      {
        id: 1,
        title: 'Published',
        summary: 'Visible now',
        full_content: 'Visible full content',
        category: 'general',
        priority: 'normal',
        is_published: 1,
        published_at: '2026-09-01 10:00:00',
        scheduled_publish_at: null,
      },
      {
        id: 2,
        title: 'Scheduled',
        summary: 'Visible after scheduled publish',
        full_content: 'Scheduled full content',
        category: 'update',
        priority: 'high',
        is_published: 0,
        published_at: null,
        scheduled_publish_at: '2000-01-01 00:00:00',
      },
      {
        id: 3,
        title: 'Draft',
        summary: 'Hidden',
        full_content: 'Hidden full content',
        category: 'general',
        priority: 'normal',
        is_published: 0,
        published_at: null,
        scheduled_publish_at: null,
      },
    ];
  }

  prepare(sql) {
    const db = this;
    return {
      binds: [],
      bind(...args) {
        this.binds = args;
        return this;
      },
      async first() {
        return db.dispatch(sql, this.binds, 'first');
      },
      async all() {
        return db.dispatch(sql, this.binds, 'all');
      },
      async run() {
        return db.dispatch(sql, this.binds, 'run');
      },
    };
  }

  async batch(statements) {
    for (const statement of statements) {
      if (typeof statement?.run === 'function') await statement.run();
    }
    return statements.map(() => ({ success: true }));
  }

  async dispatch(sql, binds, method) {
    if (method === 'first' && sql.includes('FROM files') && sql.includes('WHERE hash = ?')) {
      return this.files.find((file) => file.hash === binds[0]) || null;
    }

    if (method === 'run' && sql.includes('INSERT INTO files')) {
      const file = {
        id: this.nextFileId++,
        hash: binds[0],
        file_key: binds[1],
        original_name: binds[2],
        file_size: binds[3],
        mime_type: binds[4],
        extension: binds[5],
        uploaded_by: binds[6],
        created_at: '2026-09-06 00:00:00',
      };
      this.files.push(file);
      return { success: true, meta: { last_row_id: file.id } };
    }

    if (method === 'first' && sql.includes('FROM files') && sql.includes('WHERE id = ?')) {
      return this.files.find((file) => Number(file.id) === Number(binds[0])) || null;
    }

    if (method === 'first' && sql.includes('FROM files') && sql.includes('WHERE file_key = ?')) {
      return this.files.find((file) => file.file_key === binds[0]) || null;
    }

    if (method === 'first' && sql.includes("WHERE scope_type = 'system'")) {
      return this.collections.find((collection) => (
        collection.scope_type === 'system' &&
        Number(collection.scope_id) === Number(binds[0]) &&
        collection.kind === 'root' &&
        Number(collection.is_active) === 1
      )) || null;
    }

    if (method === 'run' && sql.includes('INSERT INTO collections')) {
      const collection = {
        id: this.nextCollectionId++,
        parent_id: null,
        name: '__root__',
        scope_type: 'system',
        scope_id: binds[0],
        kind: 'root',
        is_public: 0,
        is_active: 1,
        sort_order: 0,
        created_by: binds[1],
        created_at: '2026-09-06 00:00:00',
      };
      this.collections.push(collection);
      return { success: true, meta: { last_row_id: collection.id } };
    }

    if (method === 'first' && sql.includes('FROM collections') && sql.includes('WHERE id = ?')) {
      return this.collections.find((collection) => Number(collection.id) === Number(binds[0])) || null;
    }

    if (method === 'run' && sql.includes('INSERT INTO collection_files')) {
      const [collectionId, fileId, displayName, addedBy] = binds;
      const exists = this.collectionFiles.some((row) => (
        Number(row.collection_id) === Number(collectionId) &&
        Number(row.file_id) === Number(fileId) &&
        Number(row.is_active) === 1
      ));
      if (!exists) {
        this.collectionFiles.push({
          collection_id: collectionId,
          file_id: fileId,
          display_name: displayName,
          category: 'other',
          is_public: 0,
          is_active: 1,
          added_by: addedBy,
        });
      }
      return { success: true };
    }

    if (method === 'run' && sql.includes('INSERT INTO admin_action_logs')) {
      this.adminActions.push({ entityId: binds[2], action: binds[3] });
      return { success: true };
    }

    if (method === 'all' && sql.includes('FROM collection_files cf') && sql.includes("col.scope_type = 'institution'")) {
      const fileId = Number(binds[0]);
      const results = this.collectionFiles
        .filter((row) => Number(row.file_id) === fileId && Number(row.is_active) === 1)
        .map((row) => {
          const collection = this.collections.find((item) => Number(item.id) === Number(row.collection_id));
          if (!collection || collection.scope_type !== 'institution' || Number(collection.is_active) !== 1) return null;
          return { is_public: row.is_public, institution_id: collection.scope_id };
        })
        .filter(Boolean);
      return { results };
    }

    if (method === 'run' && sql.includes('UPDATE announcements')) {
      for (const announcement of this.announcements) {
        if (!announcement.is_published && announcement.scheduled_publish_at) {
          announcement.is_published = 1;
          announcement.published_at = announcement.scheduled_publish_at;
        }
      }
      return { success: true };
    }

    if (method === 'all' && sql.includes('FROM announcements') && sql.includes('WHERE is_published = 1')) {
      return {
        results: this.announcements
          .filter((announcement) => Number(announcement.is_published) === 1)
          .sort((a, b) => String(b.published_at || b.scheduled_publish_at).localeCompare(String(a.published_at || a.scheduled_publish_at))),
      };
    }

    if (method === 'first' && sql.includes('FROM support_tickets') && sql.includes('WHERE id = ? AND user_id = ?')) {
      return this.supportTickets.find((ticket) => (
        Number(ticket.id) === Number(binds[0]) &&
        Number(ticket.user_id) === Number(binds[1])
      )) || null;
    }

    if (method === 'run' && sql.includes('INSERT INTO ticket_replies')) {
      this.ticketReplies.push({
        ticket_id: binds[0],
        user_id: binds[1],
        message: binds[2],
        is_admin: sql.includes('?, 1, ?') ? 1 : 0,
        attachment_url: binds[3],
      });
      return { success: true, meta: { last_row_id: this.ticketReplies.length } };
    }

    if (method === 'run' && sql.includes('UPDATE support_tickets SET status')) {
      return { success: true };
    }

    if (method === 'first' && sql.includes('FROM ticket_replies r') && sql.includes('JOIN support_tickets t')) {
      const needle = String(binds[0] || '').replace(/^%/, '');
      const reply = this.ticketReplies.find((row) => String(row.attachment_url || '').endsWith(needle));
      if (!reply) return null;
      const ticket = this.supportTickets.find((row) => Number(row.id) === Number(reply.ticket_id));
      return ticket ? { user_id: ticket.user_id } : null;
    }

    if (method === 'all') return { results: [] };
    if (method === 'first') return null;
    return { success: true };
  }
}

function env(db, bucket, secret = 'test-jwt-secret') {
  return {
    DB: db,
    FILES_BUCKET: bucket,
    JWT_SECRET: secret,
    R2_PUBLIC_URL: 'https://files.example.test',
    ENVIRONMENT: 'staging',
  };
}

async function authHeader(role = 'super_admin', overrides = {}, secret = 'test-jwt-secret') {
  const token = await sign({
    user_id: 1,
    email: 'admin@example.edu',
    full_name: 'Test Admin',
    institution: 'Example University',
    institution_id: 3,
    role,
    type: 'access',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }, secret);
  return `Bearer ${token}`;
}

describe('files and announcements smoke coverage', () => {
  it('allows only super admins to upload managed files and serves uploaded files as private assets', async () => {
    const db = new SmokeD1();
    const bucket = new MemoryBucket();
    const uploadForm = new FormData();
    uploadForm.append('file', new File(['hello file'], 'hello.txt', { type: 'text/plain' }));

    const deniedRes = await app.request('/api/files/upload', {
      method: 'POST',
      headers: { authorization: await authHeader('user', { user_id: 7, role: 'user' }) },
      body: uploadForm,
    }, env(db, bucket));
    expect(deniedRes.status).toBe(403);

    const form = new FormData();
    form.append('file', new File(['hello file'], 'hello.txt', { type: 'text/plain' }));
    const uploadRes = await app.request('/api/files/upload', {
      method: 'POST',
      headers: { authorization: await authHeader('super_admin') },
      body: form,
    }, env(db, bucket));
    expect(uploadRes.status).toBe(200);

    const upload = await uploadRes.json();
    expect(upload).toMatchObject({
      success: true,
      deduplicated: false,
      name: 'hello.txt',
      type: 'txt',
      size: 10,
    });
    expect(upload.key).toMatch(/^files\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}\.txt$/);
    expect(bucket.objects.has(upload.key)).toBe(true);

    const anonymousGetRes = await app.request(`/api/files/${upload.key}`, {}, env(db, bucket));
    expect(anonymousGetRes.status).toBe(403);

    const adminGetRes = await app.request(`/api/files/${upload.key}`, {
      headers: { authorization: await authHeader('super_admin') },
    }, env(db, bucket));
    expect(adminGetRes.status).toBe(200);
    expect(adminGetRes.headers.get('cache-control')).toBe('private, max-age=0, no-store');
    expect(await adminGetRes.text()).toBe('hello file');
  });

  it('publishes due announcements and returns only public announcements', async () => {
    const db = new SmokeD1();
    const res = await app.request('/api/announcements', {}, env(db, new MemoryBucket()));

    expect(res.status).toBe(200);
    const announcements = await res.json();
    expect(announcements).toHaveLength(2);
    expect(announcements.map((item) => item.title)).toContain('Published');
    expect(announcements.map((item) => item.title)).toContain('Scheduled');
    expect(announcements.map((item) => item.title)).not.toContain('Draft');
    expect(announcements.find((item) => item.title === 'Scheduled')).toMatchObject({
      date: '2000-01-01 00:00:00',
      published_at: '2000-01-01 00:00:00',
    });
  });

  it('stores ticket reply attachments under ticket-attachments and restricts retrieval to owner or admin', async () => {
    const db = new SmokeD1();
    const bucket = new MemoryBucket();
    const form = new FormData();
    form.append('message', 'Attachment smoke reply');
    form.append('file', new File(['ticket attachment'], 'reply.pdf', { type: 'application/pdf' }));

    const replyRes = await app.request('/api/support/tickets/501/reply', {
      method: 'POST',
      headers: { authorization: await authHeader('user', { user_id: 7, role: 'user' }) },
      body: form,
    }, env(db, bucket));
    expect(replyRes.status).toBe(200);
    expect(await replyRes.json()).toMatchObject({ success: true });

    const attachmentUrl = db.ticketReplies[0]?.attachment_url;
    expect(attachmentUrl).toMatch(/^\/api\/files\/ticket-attachments\/501-\d+\.pdf$/);
    const key = attachmentUrl.replace('/api/files/', '');
    expect(bucket.objects.has(key)).toBe(true);

    const anonymousRes = await app.request(`/api/files/${key}`, {}, env(db, bucket));
    expect(anonymousRes.status).toBe(403);

    const otherUserRes = await app.request(`/api/files/${key}`, {
      headers: { authorization: await authHeader('user', { user_id: 99, role: 'user' }) },
    }, env(db, bucket));
    expect(otherUserRes.status).toBe(403);

    const ownerRes = await app.request(`/api/files/${key}`, {
      headers: { authorization: await authHeader('user', { user_id: 7, role: 'user' }) },
    }, env(db, bucket));
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.headers.get('cache-control')).toBe('private, max-age=0, no-store');
    expect(await ownerRes.text()).toBe('ticket attachment');

    const adminRes = await app.request(`/api/files/${key}`, {
      headers: { authorization: await authHeader('admin', { user_id: 2, role: 'admin' }) },
    }, env(db, bucket));
    expect(adminRes.status).toBe(200);
  });
});

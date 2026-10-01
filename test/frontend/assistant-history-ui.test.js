import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const uiPath = new URL('../../assets/js/assistant-ui.js', import.meta.url);
const routerPath = new URL('../../backend/src/assistant/router.js', import.meta.url);
const storagePath = new URL('../../backend/src/assistant/history-storage.js', import.meta.url);

describe('Assistant private history contract', () => {
  it('reopens saved results without POSTing to /api/assistant/ask', async () => {
    const ui = await readFile(uiPath, 'utf8');
    const openStart = ui.indexOf("open.addEventListener('click'");
    const deleteStart = ui.indexOf("const remove =", openStart);
    const openHandler = ui.slice(openStart, deleteStart);
    expect(openHandler).toContain("fetch('/api/assistant/history/'");
    expect(openHandler).toContain('renderLiveAssistantResult(saved.result)');
    expect(openHandler).not.toContain('/api/assistant/ask');
  });

  it('scopes reads and deletes to the authenticated owner with no role bypass', async () => {
    const storage = await readFile(storagePath, 'utf8');
    expect(storage).toContain("WHERE id = ? AND user_id = ? AND visibility = 'private'");
    expect(storage).toContain('DELETE FROM assistant_saved_queries WHERE id = ? AND user_id = ?');
    expect(storage).not.toMatch(/super_admin|role\s*===/);
  });

  it('persists only successful OK outcomes and keeps history separate from telemetry', async () => {
    const router = await readFile(routerPath, 'utf8');
    expect(router).toContain("if (result?.code === 'OK')");
    expect(router).toContain('saveAssistantHistory(c.env');
    expect(router).not.toMatch(/research_usage_events[^\n]*query/i);
  });
});

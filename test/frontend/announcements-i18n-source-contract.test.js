import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const announcementSource = readFileSync('announcements.html', 'utf8');
const i18nSource = readFileSync('assets/js/announcements-i18n.js', 'utf8');

const sourceStrings = [
  'Reaksiyon eklenemedi',
  'Yorum en fazla 2000 karakter olabilir',
  'Yorum eklenemedi',
  'Yorumun yayınlandı',
  'Yorum gönderilemedi',
  'Silme başarısız',
  'Yorum silindi',
  'Lütfen e-posta adresinizi girin',
  'Geçerli bir e-posta adresi girin',
  'Bülten aboneliğiniz zaten aktif',
  'Bülten aboneliğiniz başarıyla oluşturuldu!',
  'Bülten aboneliği sırasında bir hata oluştu'
];

const deleteConfirm = 'Bu yorumu silmek istediğinden emin misin?';

describe('announcements i18n source-string contract', () => {
  it.each(sourceStrings)('keeps the source and translation map aligned for %s', (message) => {
    expect(announcementSource).toContain(message);
    expect(i18nSource).toContain(`['${message}',`);
  });

  it('keeps the delete-confirm source string aligned with the English patch', () => {
    expect(announcementSource).toContain(`confirm('${deleteConfirm}')`);
    expect(i18nSource).toContain(`message === '${deleteConfirm}'`);
  });
});

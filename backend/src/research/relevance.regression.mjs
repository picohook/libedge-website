import assert from 'node:assert/strict';
import { filterRelevantWorks, relevanceTerms } from './relevance.js';

const query = 'CRISPR-Cas9 tabanlı gen düzenlemesinin klinik uygulamalarda güvenlik ve etkinlik açısından mevcut sınırlamaları nelerdir?';
const titles = [
  'Windows Tabanlı Uygulamalarda SQL Enjeksiyon Siber Saldırı Senaryosu ve Güvenlik Önlemleri',
  'Hava Gücünün Tarihi Gelişimi',
  'Uluslararası Hukuk Bakımından Soykırım Suçu ve İsrail-Filistin Meselesi',
  'Gebelikte Cinsel Aktivite ve Güvenlik',
  'Güvenlik Çalışmaları Alanının Mevcut Durumu ve Geleceği',
  'Şizofreni: Yedi Antipsikotik Arasında Akut Etkinlik ve Güvenlilik Açısından Hangi Kazanıyor?',
  'Klinik Uygulamalarda Genogram Kullanımı',
  'Eğitim Giderleri Açısından Merkezi Yönetim Bütçesi',
  'Proje tabanlı fizik öğretimi',
  'İndüklenmiş pluripotent kök hücrelerde CRISPR / Cas9 tabanlı gen düzenleme teknolojileri'
];
const works = titles.map((title, index) => ({ id: String(index + 1), title, abstract: null }));
const terms = relevanceTerms(query);
assert.ok(terms.some((term) => term.includes('cr')));
assert.ok(!terms.includes('acısından'));
const kept = filterRelevantWorks(query, works);
assert.deepEqual(kept.map((work) => work.id), ['10']);
console.log('research relevance regression: PASS');

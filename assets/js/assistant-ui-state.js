export const ASSISTANT_UI_STATES = Object.freeze({
  SUCCESS: 'success',
  LOADING: 'loading',
  GATE_BLOCKED: 'gate-blocked',
  ADAPTER_MISSING: 'adapter-missing',
  INVALID_QUERY: 'invalid-query',
  RETRIEVAL_ERROR: 'retrieval-error',
  EVIDENCE_ERROR: 'evidence-error',
  EVIDENCE_PAYLOAD_REQUIRED: 'evidence-payload-required',
  MODEL_ERROR: 'model-error',
  GROUNDING_REJECTED: 'grounding-rejected',
  GENERIC_ERROR: 'generic-error'
});

const CODE_MAP = Object.freeze({
  PROVIDER_PRIVACY_GATE_REQUIRED: {
    state: ASSISTANT_UI_STATES.GATE_BLOCKED,
    title: 'Gizlilik doğrulaması tamamlanmayı bekliyor',
    message: 'Model sağlayıcısı için gerekli gizlilik doğrulaması tamamlanmadan AI yanıt üretimi etkinleştirilmiyor.',
    tone: 'notice'
  },
  MODEL_ADAPTER_REQUIRED: {
    state: ASSISTANT_UI_STATES.ADAPTER_MISSING,
    title: 'Doğrulanmış model bağlantısı henüz hazır değil',
    message: 'Araştırma altyapısı mevcut, ancak kullanılacak model bağlantısı doğrulanıp etkinleştirilmeden AI yanıtı gösterilmiyor.',
    tone: 'notice'
  },
  ASSISTANT_QUERY_INVALID: {
    state: ASSISTANT_UI_STATES.INVALID_QUERY,
    title: 'Soruyu kontrol edin',
    message: 'Araştırma sorusu 2 ile 300 karakter arasında olmalıdır.',
    tone: 'warning'
  },
  ASSISTANT_QUERY_REQUIRED: {
    state: ASSISTANT_UI_STATES.INVALID_QUERY,
    title: 'Bir araştırma sorusu girin',
    message: 'Devam etmek için araştırmak istediğiniz konuyu yazın.',
    tone: 'warning'
  },
  DISCOVER_FAILED: {
    state: ASSISTANT_UI_STATES.RETRIEVAL_ERROR,
    title: 'Kaynak araması tamamlanamadı',
    message: 'Akademik kaynaklar şu anda alınamadı. Daha sonra yeniden deneyin.',
    tone: 'error'
  },
  EVIDENCE_PACK_FAILED: {
    state: ASSISTANT_UI_STATES.EVIDENCE_ERROR,
    title: 'Kanıt paketi oluşturulamadı',
    message: 'Kaynaklar güvenli yanıt üretimi için hazırlanamadığı için yanıt gösterilmiyor.',
    tone: 'error'
  },
  EVIDENCE_PAYLOAD_REQUIRED: {
    state: ASSISTANT_UI_STATES.EVIDENCE_PAYLOAD_REQUIRED,
    title: 'Yanıt için gerekli kanıt verisi eksik',
    message: 'Başarılı görünen sonuç beklenen kanıt payloadını içermediği için yanıt gösterilmiyor. Bu bir gizlilik doğrulaması değil, veri bütünlüğü korumasıdır.',
    tone: 'warning'
  },
  MODEL_ADAPTER_FAILED: {
    state: ASSISTANT_UI_STATES.MODEL_ERROR,
    title: 'AI yanıtı oluşturulamadı',
    message: 'Model katmanı yanıt veremedi. Kaynaklar korunuyor; desteklenmeyen bir yanıt gösterilmiyor.',
    tone: 'error'
  },
  MODEL_OUTPUT_INVALID: {
    state: ASSISTANT_UI_STATES.MODEL_ERROR,
    title: 'AI yanıtı doğrulanamadı',
    message: 'Model çıktısı beklenen güvenli yapıya uymadığı için kullanıcıya sunulmadı.',
    tone: 'error'
  },
  GROUNDING_VALIDATION_FAILED: {
    state: ASSISTANT_UI_STATES.GROUNDING_REJECTED,
    title: 'Kaynak doğrulaması tamamlanamadı',
    message: 'İddialar kanıtlarla güvenli biçimde doğrulanamadığı için yanıt gösterilmiyor.',
    tone: 'error'
  },
  GROUNDING_REJECTED: {
    state: ASSISTANT_UI_STATES.GROUNDING_REJECTED,
    title: 'Yanıt kaynaklarla yeterince desteklenmedi',
    message: 'Bir veya daha fazla iddia kanıt sınırını geçemediği için kısmi yanıt yerine hiçbir iddia gösterilmiyor.',
    tone: 'warning'
  }
});

export function mapAssistantResult(result) {
  if (result?.ok === true && result?.code === 'OK') {
    return {
      state: ASSISTANT_UI_STATES.SUCCESS,
      title: 'Kanıta dayalı yanıt hazır',
      message: 'Yanıt, kaynaklarla doğrulanan iddialardan oluşturuldu.',
      tone: 'success',
      claims: Array.isArray(result.claims) ? result.claims : [],
      evidencePackId: result.evidence_pack_id || null
    };
  }

  const mapped = CODE_MAP[result?.code];
  if (mapped) {
    return {
      ...mapped,
      claims: [],
      evidencePackId: result?.evidence_pack_id || null
    };
  }

  return {
    state: ASSISTANT_UI_STATES.GENERIC_ERROR,
    title: 'İşlem tamamlanamadı',
    message: 'Beklenmeyen bir durum oluştu. Güvenli olmayan veya doğrulanmamış bir yanıt gösterilmedi.',
    tone: 'error',
    claims: [],
    evidencePackId: result?.evidence_pack_id || null
  };
}

export function mapLiveAssistantResult(result) {
  if (result?.ok === true && result?.code === 'OK' && !Array.isArray(result.evidence)) {
    return mapAssistantResult({ ok: false, code: 'EVIDENCE_PAYLOAD_REQUIRED', claims: [] });
  }
  return mapAssistantResult(result);
}

export function loadingStage(index = 0) {
  const stages = [
    { title: 'Akademik kaynaklar aranıyor', message: 'İlgili araştırmalar DISCOVER katmanında bulunuyor.' },
    { title: 'Kanıt paketi hazırlanıyor', message: 'Kaynaklar yalnız gerekli alanlarla güvenli bir EvidencePack içinde düzenleniyor.' },
    { title: 'Yanıt doğrulanıyor', message: 'İddiaların kaynak desteği ve grounding sınırı kontrol ediliyor.' }
  ];
  return stages[Math.max(0, Math.min(index, stages.length - 1))];
}

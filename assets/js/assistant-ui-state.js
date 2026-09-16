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
    titleEn: 'Privacy verification is still pending',
    message: 'Model sağlayıcısı için gerekli gizlilik doğrulaması tamamlanmadan AI yanıt üretimi etkinleştirilmiyor.',
    messageEn: 'AI response generation is not enabled until the required privacy verification for the model provider is complete.',
    tone: 'notice'
  },
  MODEL_ADAPTER_REQUIRED: {
    state: ASSISTANT_UI_STATES.ADAPTER_MISSING,
    title: 'Doğrulanmış model bağlantısı henüz hazır değil',
    titleEn: 'A verified model connection is not ready yet',
    message: 'Araştırma altyapısı mevcut, ancak kullanılacak model bağlantısı doğrulanıp etkinleştirilmeden AI yanıtı gösterilmiyor.',
    messageEn: 'The research infrastructure is available, but no AI response is shown until the model connection to be used has been verified and enabled.',
    tone: 'notice'
  },
  ASSISTANT_QUERY_INVALID: {
    state: ASSISTANT_UI_STATES.INVALID_QUERY,
    title: 'Soruyu kontrol edin', titleEn: 'Check the question',
    message: 'Araştırma sorusu 2 ile 300 karakter arasında olmalıdır.', messageEn: 'The research question must be between 2 and 300 characters.',
    tone: 'warning'
  },
  ASSISTANT_QUERY_REQUIRED: {
    state: ASSISTANT_UI_STATES.INVALID_QUERY,
    title: 'Bir araştırma sorusu girin', titleEn: 'Enter a research question',
    message: 'Devam etmek için araştırmak istediğiniz konuyu yazın.', messageEn: 'Enter the topic you want to research to continue.',
    tone: 'warning'
  },
  DISCOVER_FAILED: {
    state: ASSISTANT_UI_STATES.RETRIEVAL_ERROR,
    title: 'Kaynak araması tamamlanamadı', titleEn: 'Source search could not be completed',
    message: 'Akademik kaynaklar şu anda alınamadı. Daha sonra yeniden deneyin.', messageEn: 'Academic sources could not be retrieved at this time. Try again later.',
    tone: 'error'
  },
  EVIDENCE_PACK_FAILED: {
    state: ASSISTANT_UI_STATES.EVIDENCE_ERROR,
    title: 'Kanıt paketi oluşturulamadı', titleEn: 'Evidence pack could not be created',
    message: 'Kaynaklar güvenli yanıt üretimi için hazırlanamadığı için yanıt gösterilmiyor.', messageEn: 'No response is shown because the sources could not be prepared for safe response generation.',
    tone: 'error'
  },
  EVIDENCE_PAYLOAD_REQUIRED: {
    state: ASSISTANT_UI_STATES.EVIDENCE_PAYLOAD_REQUIRED,
    title: 'Yanıt için gerekli kanıt verisi eksik',
    titleEn: 'Evidence data required for the response is missing',
    message: 'Başarılı görünen sonuç beklenen kanıt payloadını içermediği için yanıt gösterilmiyor. Bu bir gizlilik doğrulaması değil, veri bütünlüğü korumasıdır.',
    messageEn: 'No response is shown because the apparently successful result did not contain the expected evidence payload. This is not a privacy verification; it is a data-integrity safeguard.',
    tone: 'warning'
  },
  MODEL_ADAPTER_FAILED: {
    state: ASSISTANT_UI_STATES.MODEL_ERROR,
    title: 'AI yanıtı oluşturulamadı', titleEn: 'AI response could not be generated',
    message: 'Model katmanı yanıt veremedi. Kaynaklar korunuyor; desteklenmeyen bir yanıt gösterilmiyor.', messageEn: 'The model layer could not respond. The sources are preserved; an unsupported response is not shown.',
    tone: 'error'
  },
  MODEL_OUTPUT_INVALID: {
    state: ASSISTANT_UI_STATES.MODEL_ERROR,
    title: 'AI yanıtı doğrulanamadı', titleEn: 'AI response could not be verified',
    message: 'Model çıktısı beklenen güvenli yapıya uymadığı için kullanıcıya sunulmadı.', messageEn: 'The model output was not shown because it did not match the expected safe structure.',
    tone: 'error'
  },
  GROUNDING_VALIDATION_FAILED: {
    state: ASSISTANT_UI_STATES.GROUNDING_REJECTED,
    title: 'Kaynak doğrulaması tamamlanamadı', titleEn: 'Source validation could not be completed',
    message: 'İddialar kanıtlarla güvenli biçimde doğrulanamadığı için yanıt gösterilmiyor.', messageEn: 'No response is shown because the claims could not be safely validated against the evidence.',
    tone: 'error'
  },
  GROUNDING_REJECTED: {
    state: ASSISTANT_UI_STATES.GROUNDING_REJECTED,
    title: 'Yanıt kaynaklarla yeterince desteklenmedi', titleEn: 'The response was not sufficiently supported by the sources',
    message: 'Bir veya daha fazla iddia kanıt sınırını geçemediği için kısmi yanıt yerine hiçbir iddia gösterilmiyor.', messageEn: 'Because one or more claims did not pass the evidence threshold, no claims are shown instead of a partial response.',
    tone: 'warning'
  }
});

export function mapAssistantResult(result) {
  if (result?.ok === true && result?.code === 'OK') {
    return {
      state: ASSISTANT_UI_STATES.SUCCESS,
      title: 'Kanıta dayalı yanıt hazır', titleEn: 'Evidence-based response ready',
      message: 'Yanıt, kaynaklarla doğrulanan iddialardan oluşturuldu.', messageEn: 'The response was built from claims validated against the sources.',
      tone: 'success',
      claims: Array.isArray(result.claims) ? result.claims : [],
      evidencePackId: result.evidence_pack_id || null
    };
  }

  const mapped = CODE_MAP[result?.code];
  if (mapped) return { ...mapped, claims: [], evidencePackId: result?.evidence_pack_id || null };

  return {
    state: ASSISTANT_UI_STATES.GENERIC_ERROR,
    title: 'İşlem tamamlanamadı', titleEn: 'The operation could not be completed',
    message: 'Beklenmeyen bir durum oluştu. Güvenli olmayan veya doğrulanmamış bir yanıt gösterilmedi.', messageEn: 'An unexpected condition occurred. No unsafe or unverified response was shown.',
    tone: 'error', claims: [], evidencePackId: result?.evidence_pack_id || null
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
    { title: 'Akademik kaynaklar aranıyor', titleEn: 'Searching academic sources', message: 'İlgili araştırmalar DISCOVER katmanında bulunuyor.', messageEn: 'Relevant research is being found in the DISCOVER layer.' },
    { title: 'Kanıt paketi hazırlanıyor', titleEn: 'Preparing the evidence pack', message: 'Kaynaklar yalnız gerekli alanlarla güvenli bir EvidencePack içinde düzenleniyor.', messageEn: 'Sources are organized in a safe EvidencePack containing only the required fields.' },
    { title: 'Yanıt doğrulanıyor', titleEn: 'Validating the response', message: 'İddiaların kaynak desteği ve grounding sınırı kontrol ediliyor.', messageEn: 'Source support for the claims and the grounding boundary are being checked.' }
  ];
  return stages[Math.max(0, Math.min(index, stages.length - 1))];
}

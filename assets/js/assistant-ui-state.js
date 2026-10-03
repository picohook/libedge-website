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
  GENERIC_ERROR: 'generic-error',
  EMPTY_RESULT: 'empty-result'
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
  NO_AUTHORIZED_EVIDENCE: {
    state: ASSISTANT_UI_STATES.EMPTY_RESULT,
    title: 'Bu arama için uygun akademik kanıt bulunamadı', titleEn: 'No eligible academic evidence was found for this search',
    message: 'Kaynak araması tamamlandı ancak güvenli yanıt üretiminde kullanılabilecek yetkili ve uygun bir kanıt kaydı bulunamadı.', messageEn: 'The source search completed, but no authorized and eligible evidence record was available for safe response generation.',
    tone: 'notice'
  },
  NO_SUPPORTABLE_CLAIMS: {
    state: ASSISTANT_UI_STATES.EMPTY_RESULT,
    title: 'Kaynaklar tarandı, yeterince desteklenebilir bulgu üretilemedi', titleEn: 'Sources searched, no sufficiently supportable finding was generated',
    message: 'Kaynaklar bulundu ancak model bunlardan güvenli biçimde doğrulamaya gönderilebilecek bir bulgu üretmedi.', messageEn: 'Sources were found, but the model did not generate a finding that could safely be sent for verification.',
    tone: 'notice'
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
    message: 'Bu soruya yeterli kanıtla doğrulanmış bir yanıt oluşturamadım.', messageEn: 'I could not produce an answer to this question that was verified with sufficient evidence.',
    tone: 'error'
  },
  GROUNDING_REJECTED: {
    state: ASSISTANT_UI_STATES.GROUNDING_REJECTED,
    title: 'Yanıt kaynaklarla yeterince desteklenmedi', titleEn: 'The response was not sufficiently supported by the sources',
    message: 'Bu soruya yeterli kanıtla doğrulanmış bir yanıt oluşturamadım.', messageEn: 'I could not produce an answer to this question that was verified with sufficient evidence.',
    tone: 'warning'
  }
});

export function mapAssistantResult(result) {
  if (result?.ok === true && result?.code === 'OK') {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    if (claims.length === 0) {
      return {
        state: ASSISTANT_UI_STATES.EMPTY_RESULT,
        title: 'Kaynaklar tarandı, doğrulanmış bulgu üretilemedi', titleEn: 'Sources searched, no verified finding produced',
        message: 'Bu aramada kaynaklarla yeterince desteklenen bir bulgu oluşturulamadı.', messageEn: 'This search did not produce a finding sufficiently supported by the sources.',
        tone: 'notice', claims: [], evidencePackId: result.evidence_pack_id || null
      };
    }
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

function liveEvidenceDepth(evidence = []) {
  const abstractBearing = evidence.filter((item) => Boolean(String(item?.abstract || '').trim())).length;
  const metadataOnly = Math.max(0, evidence.length - abstractBearing);
  if (evidence.length > 0 && metadataOnly === evidence.length) return 'metadata-only';
  if (abstractBearing > 0 && metadataOnly > 0) return 'mixed';
  if (abstractBearing > 0) return 'abstract-bearing';
  return 'unknown';
}

export function mapLiveAssistantResult(result) {
  if (result?.ok === true && result?.code === 'OK' && (!Array.isArray(result.evidence) || !Array.isArray(result.claims))) {
    return mapAssistantResult({ ok: false, code: 'EVIDENCE_PAYLOAD_REQUIRED', claims: [] });
  }

  const mapped = mapAssistantResult(result);
  if (mapped.state !== ASSISTANT_UI_STATES.SUCCESS) return mapped;

  const depth = liveEvidenceDepth(result.evidence);
  if (depth === 'metadata-only') {
    return {
      ...mapped,
      message: 'Bulgular bibliyografik metadata ve başlık düzeyindeki kaynak kayıtlarıyla doğrulandı; gösterilen kanıtlarda özet veya tam metin bulunmuyor.',
      messageEn: 'The findings were validated against bibliographic metadata and title-level source records; the displayed evidence does not include abstracts or full text.'
    };
  }
  if (depth === 'mixed') {
    return {
      ...mapped,
      message: 'Bulgular kaynaklarla doğrulandı; kullanılan kanıtlar özet içeren ve yalnız metadata içeren kayıtların bir karışımıdır.',
      messageEn: 'The findings were validated against the sources; the evidence used is a mix of abstract-bearing and metadata-only records.'
    };
  }
  if (depth === 'abstract-bearing') {
    return {
      ...mapped,
      message: 'Bulgular, gösterilen kaynakların özet metinlerini içeren kanıtlarla doğrulandı.',
      messageEn: 'The findings were validated with evidence that includes the displayed sources’ abstract text.'
    };
  }
  return mapped;
}

export function loadingStage(index = 0) {
  const stages = [
    { title: 'Akademik kaynaklar aranıyor', titleEn: 'Searching academic sources', message: 'İlgili araştırmalar DISCOVER katmanında bulunuyor.', messageEn: 'Relevant research is being found in the DISCOVER layer.' },
    { title: 'Kanıt paketi hazırlanıyor', titleEn: 'Preparing the evidence pack', message: 'Kaynaklar yalnız gerekli alanlarla güvenli bir EvidencePack içinde düzenleniyor.', messageEn: 'Sources are organized in a safe EvidencePack containing only the required fields.' },
    { title: 'Yanıt doğrulanıyor', titleEn: 'Validating the response', message: 'İddiaların kaynak desteği ve grounding sınırı kontrol ediliyor.', messageEn: 'Source support for the claims and the grounding boundary are being checked.' }
  ];
  return stages[Math.max(0, Math.min(index, stages.length - 1))];
}


export function bibliographicYear(item = {}) {
  const direct = Number(item?.publicationYear);
  if (Number.isInteger(direct) && direct >= 1000 && direct <= 9999) return String(direct);

  const match = String(item?.publicationDate || '').trim().match(/^(\d{4})(?:-|$)/);
  if (!match) return '';
  const year = Number(match[1]);
  return Number.isInteger(year) && year >= 1000 && year <= 9999 ? match[1] : '';
}

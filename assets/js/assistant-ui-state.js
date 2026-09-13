export const ASSISTANT_UI_STATES = Object.freeze({
  SUCCESS:'success', LOADING:'loading', AUTH_REQUIRED:'auth-required', GATE_BLOCKED:'gate-blocked', ADAPTER_MISSING:'adapter-missing', INVALID_QUERY:'invalid-query', RETRIEVAL_ERROR:'retrieval-error', EVIDENCE_ERROR:'evidence-error', MODEL_ERROR:'model-error', GROUNDING_REJECTED:'grounding-rejected', SOURCE_PAYLOAD_REQUIRED:'source-payload-required', GENERIC_ERROR:'generic-error'
});

const CODE_MAP = Object.freeze({
  AUTH_REQUIRED:{state:ASSISTANT_UI_STATES.AUTH_REQUIRED,title:'Giriş yapmanız gerekiyor',message:'Research Assistant yalnız oturum açmış kullanıcılar için kullanılabilir.',tone:'notice'},
  PROVIDER_PRIVACY_GATE_REQUIRED:{state:ASSISTANT_UI_STATES.GATE_BLOCKED,title:'Research Assistant henüz kullanıma açılmadı',message:'Model sağlayıcısı gizlilik doğrulaması tamamlanana kadar AI yanıt üretimi güvenli biçimde kapalı tutuluyor.',tone:'notice'},
  MODEL_ADAPTER_REQUIRED:{state:ASSISTANT_UI_STATES.ADAPTER_MISSING,title:'AI yanıt katmanı henüz bağlı değil',message:'Araştırma altyapısı hazır, ancak doğrulanmış model bağlantısı henüz etkinleştirilmedi.',tone:'notice'},
  ASSISTANT_QUERY_INVALID:{state:ASSISTANT_UI_STATES.INVALID_QUERY,title:'Soruyu kontrol edin',message:'Araştırma sorusu 2 ile 300 karakter arasında olmalıdır.',tone:'warning'},
  ASSISTANT_QUERY_REQUIRED:{state:ASSISTANT_UI_STATES.INVALID_QUERY,title:'Bir araştırma sorusu girin',message:'Devam etmek için araştırmak istediğiniz konuyu yazın.',tone:'warning'},
  DISCOVER_FAILED:{state:ASSISTANT_UI_STATES.RETRIEVAL_ERROR,title:'Kaynak araması tamamlanamadı',message:'Akademik kaynaklar şu anda alınamadı. Daha sonra yeniden deneyin.',tone:'error'},
  EVIDENCE_PACK_FAILED:{state:ASSISTANT_UI_STATES.EVIDENCE_ERROR,title:'Kanıt paketi oluşturulamadı',message:'Kaynaklar güvenli yanıt üretimi için hazırlanamadığı için yanıt gösterilmiyor.',tone:'error'},
  MODEL_ADAPTER_FAILED:{state:ASSISTANT_UI_STATES.MODEL_ERROR,title:'AI yanıtı oluşturulamadı',message:'Model katmanı yanıt veremedi. Desteklenmeyen bir yanıt gösterilmiyor.',tone:'error'},
  MODEL_OUTPUT_INVALID:{state:ASSISTANT_UI_STATES.MODEL_ERROR,title:'AI yanıtı doğrulanamadı',message:'Model çıktısı beklenen güvenli yapıya uymadığı için kullanıcıya sunulmadı.',tone:'error'},
  GROUNDING_VALIDATION_FAILED:{state:ASSISTANT_UI_STATES.GROUNDING_REJECTED,title:'Kaynak doğrulaması tamamlanamadı',message:'İddialar kanıtlarla güvenli biçimde doğrulanamadığı için yanıt gösterilmiyor.',tone:'error'},
  GROUNDING_REJECTED:{state:ASSISTANT_UI_STATES.GROUNDING_REJECTED,title:'Yanıt kaynaklarla yeterince desteklenmedi',message:'Bir veya daha fazla iddia kanıt sınırını geçemediği için kısmi yanıt yerine hiçbir iddia gösterilmiyor.',tone:'warning'},
  EVIDENCE_PAYLOAD_REQUIRED:{state:ASSISTANT_UI_STATES.SOURCE_PAYLOAD_REQUIRED,title:'Kaynak görünümü için ek veri gerekiyor',message:'Yanıt üretildi ancak gerçek Sources & Evidence paneli için güvenli evidence payload sözleşmesi henüz tanımlanmadı. Fixture kaynaklar gerçek yanıtla karıştırılmıyor.',tone:'warning'},
  ASSISTANT_HTTP_ERROR:{state:ASSISTANT_UI_STATES.GENERIC_ERROR,title:'Research Assistant’a ulaşılamadı',message:'İstek tamamlanamadı. Güvenli olmayan veya eksik bir yanıt gösterilmedi.',tone:'error'}
});

export function mapAssistantResult(result){
  if(result?.ok===true && result?.code==='OK') return {state:ASSISTANT_UI_STATES.SUCCESS,title:'Kanıta dayalı yanıt hazır',message:'Yanıt, kaynaklarla doğrulanan iddialardan oluşturuldu.',tone:'success',claims:Array.isArray(result.claims)?result.claims:[],evidencePackId:result.evidence_pack_id||null};
  const mapped=CODE_MAP[result?.code];
  if(mapped) return {...mapped,claims:[],evidencePackId:result?.evidence_pack_id||null};
  return {state:ASSISTANT_UI_STATES.GENERIC_ERROR,title:'İşlem tamamlanamadı',message:'Beklenmeyen bir durum oluştu. Güvenli olmayan veya doğrulanmamış bir yanıt gösterilmedi.',tone:'error',claims:[],evidencePackId:result?.evidence_pack_id||null};
}

export function loadingStage(index=0){
  const stages=[
    {title:'Akademik kaynaklar aranıyor',message:'İlgili araştırmalar DISCOVER katmanında bulunuyor.'},
    {title:'Kanıt paketi hazırlanıyor',message:'Kaynaklar yalnız gerekli alanlarla güvenli bir EvidencePack içinde düzenleniyor.'},
    {title:'Yanıt doğrulanıyor',message:'İddiaların kaynak desteği ve grounding sınırı kontrol ediliyor.'}
  ];
  return stages[Math.max(0,Math.min(index,stages.length-1))];
}

// ملف إدارة المفاتيح والنماذج
const API_CONFIG = {
    huggingface: {
        key: "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",
        ocrModel: "Nanonets OCR",
        translationModel: "Qwen/Qwen2-1.5B-Instruct",
        fallbackTranslationModels: {
            en_ar: "Helsinki-NLP/opus-mt-en-ar",
            ja_ar: "Helsinki-NLP/opus-mt-ja-ar",
            zh_ar: "Helsinki-NLP/opus-mt-zh-ar"
        }
    },
    gemini: {
        key: "AIzaSyB4vkD7gGHZlfpfqCANxpy3PcBTcPoBLfU",
        model: "gemini-1.5-flash"
    }
};

function getApiKeys() {
    const hfStored   = localStorage.getItem("hf_api_key");
    const gemStored = localStorage.getItem("gemini_api_key");
    if (hfStored)  API_CONFIG.huggingface.key = hfStored;
    if (gemStored) API_CONFIG.gemini.key      = gemStored;
    return API_CONFIG;
}

function saveKeyToStorage(type, key) {
    if (type === "hf")     localStorage.setItem("hf_api_key", key);
    if (type === "gemini") localStorage.setItem("gemini_api_key", key);
}
async function extractTextWithNanonetsOCR(base64Image, hfKey) {
    const ocrModel = "nanonets/Nanonets-OCR-s";

    const fetch_res = await fetch(base64Image);
    const blob = await fetch_res.blob();

    const response = await fetch(
        `https://api-inference.huggingface.co/models/${ocrModel}`,
        {
            headers: { "Authorization": `Bearer ${hfKey}` },
            method: "POST",
            body: blob
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("OCR API Error:", errorBody);
        throw new Error(`فشل ocr : ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!Array.isArray(result)) {
        console.error("Unexpected OCR API response format:", result);
        throw new Error("تنسيق استجابة OCR غير متوقع");
    }

    return result.map(prediction => {
        return {
            originalText: prediction.label,
            boundingBox: {
                x_min: prediction.box.xmin,
                y_min: prediction.box.ymin,
                x_max: prediction.box.xmax,
                y_max: prediction.box.ymax
            }
        };
    });
}

async function translateWithLLM(text, sourceLang, hfKey) {
    const config = getApiKeys();
    const model = config.huggingface.translationModel;
    const prompt = `Translate the following text from ${sourceLang} to Arabic. Return only the translated text, without any introductory phrases. Text: "${text}"`;

    const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
            headers: {
                "Authorization": `Bearer ${hfKey}`,
                "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify({
                inputs: prompt,
                parameters: { max_new_tokens: 250, return_full_text: false }
            })
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Translation API Error:", errorBody);
        throw new Error(`فشل الترجمة: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result && result.length > 0 && result[0].generated_text) {
        return result[0].generated_text.trim();
    } else {
        console.error("Unexpected Translation API response format:", result);
        throw new Error("تنسيق استجابة الترجمة غير متوقع");
    }
}

async function translateWithGemini(text, sourceLang, gemKey) {
    const config = getApiKeys();
    const model = config.gemini.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`;

    const prompt = `Translate the following text from ${sourceLang} to Arabic. Return only the translated text, without any introductory phrases. Text: "${text}"`;

    const requestBody = {
        contents: [{
            parts: [{ "text": prompt }]
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API Error:", errorBody);
        throw new Error(`فشل ترجمة Gemini: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    try {
        return result.candidates[0].content.parts[0].text.trim();
    } catch (e) {
        console.error("Unexpected Gemini API response format:", result);
        throw new Error("تنسيق استجابة Gemini API غير متوقع");
    }
}
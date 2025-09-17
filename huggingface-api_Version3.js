const ocrModel = "nanonets/Nanonets-OCR-s";

async function extractTextWithNanonetsOCR(base64Image, hfKey) {
    const response = await fetch(
        `https://api-inference.huggingface.co/models/${ocrModel}`,
        {
            headers: { "Authorization": `Bearer ${hfKey}` },
            method: "POST",
            body: JSON.stringify({ inputs: base64Image.split(',')[1] })
        }
    );
    if (!response.ok) {
        throw new Error(`فشل ocr : ${response.status}`);
    }
    const result = await response.json();
    return result; // تحقق من شكل الاستجابة حسب النموذج
}
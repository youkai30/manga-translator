document.addEventListener("DOMContentLoaded", function() {
    const fileInput    = document.getElementById("file-upload");
    const dropArea     = document.getElementById("drop-area");
    const processBtn   = document.getElementById("process-btn");
    const resetBtn     = document.getElementById("reset-btn");
    const previewContainer = document.getElementById("preview-container");
    const resultsContainer = document.getElementById("results-container");
    const hfKeyInput   = document.getElementById("hf-key");
    const gemKeyInput  = document.getElementById("gemini-key");
    const srcLangSel   = document.getElementById("source-lang");
    const msgDiv       = document.getElementById("message");
    let images = [];

    // Load saved keys
    hfKeyInput.value  = localStorage.getItem("hf_api_key")     || "";
    gemKeyInput.value = localStorage.getItem("gemini_api_key") || "";

    hfKeyInput.addEventListener("input", () => saveKeyToStorage("hf", hfKeyInput.value.trim()));
    gemKeyInput.addEventListener("input", () => saveKeyToStorage("gemini", gemKeyInput.value.trim()));

    // Drag & Drop
    ["dragenter","dragover","dragleave","drop"].forEach(ev => dropArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
    ["dragenter","dragover"].forEach(ev => dropArea.addEventListener(ev, () => dropArea.classList.add("highlight")));
    ["dragleave","drop"].forEach(ev => dropArea.addEventListener(ev, () => dropArea.classList.remove("highlight")));
    dropArea.addEventListener("drop", e => handleFiles(e.dataTransfer.files));
    dropArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", e => handleFiles(e.target.files));

    function handleFiles(files) {
        images = Array.from(files).filter(f => f.type.match("image") && f.size <= 5 * 1024 * 1024);
        if (!images.length) return showError("اختر صور JPG/PNG ≤5MB");

        previewContainer.innerHTML = "";
        resultsContainer.innerHTML = "";
        msgDiv.innerHTML = "";

        images.forEach(file => previewFile(file));
        processBtn.disabled = false;
        showMessage(`تم تحميل ${images.length} صورة`, "success");
    }

    function previewFile(file) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.createElement("img");
            img.src = e.target.result;
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    processBtn.addEventListener("click", async () => {
        const keys   = getApiKeys();
        const hfKey  = keys.huggingface.key.trim();
        const gemKey = keys.gemini.key.trim();
        const useGem = gemKey.length > 0;
        const lang   = srcLangSel.value;

        // The Hugging Face key is mandatory for the OCR step.
        if (!hfKey) return showError("مفتاح Hugging Face مطلوب لإتمام العملية");
        if (!images.length) return showError("حمّل صورة أولاً");

        processBtn.disabled = resetBtn.disabled = true;
        resultsContainer.innerHTML = "";

        try {
            for (let i = 0; i < images.length; i++) {
                const imageFile = images[i];
                const progressStart = (i / images.length) * 100;
                const progressEnd = ((i + 1) / images.length) * 100;

                updateProgress(progressStart, `جاري معالجة الصورة ${i + 1}/${images.length}...`);

                const b64 = await toBase64(imageFile);
                const textBlocks = await extractTextWithNanonetsOCR(b64, hfKey);

                if (!textBlocks.length) {
                    showError(`لم يتم العثور على نص في الصورة ${i + 1}`);
                    continue;
                }

                showMessage(`اُكتشف ${textBlocks.length} فقاعة نص في الصورة ${i + 1}`, "success");

                const originals = textBlocks.map(b => b.originalText);
                const translated = [];

                for (let j = 0; j < originals.length; j++) {
                    const singleProgress = (j / originals.length) * (progressEnd - progressStart - 10);
                    updateProgress(progressStart + 5 + singleProgress, `ترجمة ${j + 1}/${originals.length} من الصورة ${i + 1}...`);

                    if (useGem && gemKey) {
                        translated.push(await translateWithGemini(originals[j], lang, gemKey));
                    } else {
                        translated.push(await translateWithLLM(originals[j], lang, hfKey));
                    }
                }

                updateProgress(progressEnd - 5, `إنشاء الصورة النهائية ${i + 1}...`);
                const translatedImgData = await drawTextOnImage(b64, textBlocks, translated);
                appendResultPair(b64, translatedImgData, i);
            }

            updateProgress(100, "اكتملت الترجمة!");
            showMessage(`تمّت معالجة ${images.length} صور بنجاح 🎉`, "success");

        } catch (e) {
            console.error(e);
            showError(`خطأ: ${e.message}`);
        } finally {
            processBtn.disabled = resetBtn.disabled = false;
        }
    });

    resetBtn.addEventListener("click", () => {
        previewContainer.innerHTML = "";
        resultsContainer.innerHTML = "";
        fileInput.value = "";
        msgDiv.innerHTML = "";
        updateProgress(0, "في انتظار تحميل الصورة...");
        images = [];
        processBtn.disabled = true;
    });

    function appendResultPair(originalData, translatedData, index) {
        const pairContainer = document.createElement('div');
        pairContainer.className = 'result-pair';

        // Original Image Card
        const originalCard = document.createElement('div');
        originalCard.className = 'result-card';
        originalCard.innerHTML = `<h3>الصورة الأصلية ${index + 1}</h3>`;
        const originalImgContainer = document.createElement('div');
        originalImgContainer.className = 'image-container';
        const originalImg = document.createElement('img');
        originalImg.src = originalData;
        originalImgContainer.appendChild(originalImg);
        originalCard.appendChild(originalImgContainer);

        // Translated Image Card
        const translatedCard = document.createElement('div');
        translatedCard.className = 'result-card';
        translatedCard.innerHTML = `<h3>الصورة المترجمة ${index + 1}</h3>`;
        const translatedImgContainer = document.createElement('div');
        translatedImgContainer.className = 'image-container';
        const translatedImg = document.createElement('img');
        translatedImg.src = translatedData;
        translatedImgContainer.appendChild(translatedImg);
        translatedCard.appendChild(translatedImgContainer);

        const btn = document.createElement('button');
        btn.textContent = `⬇️ تحميل الصورة المترجمة ${index + 1}`;
        btn.className = 'download-btn';
        btn.onclick = () => {
            const a = document.createElement("a");
            a.download = `manga-translated-${Date.now()}-${index + 1}.jpg`;
            a.href = translatedData;
            a.click();
        };
        translatedCard.appendChild(btn);

        pairContainer.appendChild(originalCard);
        pairContainer.appendChild(translatedCard);
        resultsContainer.appendChild(pairContainer);
    }

    function toBase64(file) {
        return new Promise((res, rej) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload  = () => res(reader.result);
            reader.onerror = e => rej(e);
        });
    }

    function showMessage(msg, type="info") {
        msgDiv.innerHTML = `<div class="${type}">${msg}</div>`;
    }

    function showError(msg) {
        showMessage(msg, "error");
    }

    function updateProgress(p, msg) {
        const bar = document.getElementById("progress-bar");
        const perc = document.getElementById("progress-percentage");
        const status = document.getElementById("status");
        if (bar) bar.style.width = `${p}%`;
        if (perc) perc.textContent = `${Math.round(p)}%`;
        if (status && msg) status.textContent = msg;
    }
});
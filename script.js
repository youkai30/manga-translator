document.addEventListener("DOMContentLoaded", function() {
    const fileInput    = document.getElementById("file-upload");
    const dropArea     = document.getElementById("drop-area");
    const processBtn   = document.getElementById("process-btn");
    const resetBtn     = document.getElementById("reset-btn");
    const origC        = document.getElementById("original-container");
    const transC       = document.getElementById("translated-container");
    const hfKeyInput   = document.getElementById("hf-key");
    const gemKeyInput  = document.getElementById("gemini-key");
    const srcLangSel   = document.getElementById("source-lang");
    const msgDiv       = document.getElementById("message");
    let images = [];

    // حمل المفاتيح المحفوظة
    hfKeyInput.value  = localStorage.getItem("hf_api_key")     || "";
    gemKeyInput.value = localStorage.getItem("gemini_api_key") || "";

    hfKeyInput.addEventListener("input", () =>
        saveKeyToStorage("hf", hfKeyInput.value.trim())
    );
    gemKeyInput.addEventListener("input", () =>
        saveKeyToStorage("gemini", gemKeyInput.value.trim())
    );

    // Drag & Drop
    ["dragenter","dragover","dragleave","drop"].forEach(ev=>{
        dropArea.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); });
    });
    ["dragenter","dragover"].forEach(ev=> dropArea.addEventListener(ev, ()=> dropArea.classList.add("highlight")));
    ["dragleave","drop"].forEach(ev=> dropArea.addEventListener(ev, ()=> dropArea.classList.remove("highlight")));
    dropArea.addEventListener("drop", e => handleFiles(e.dataTransfer.files));
    dropArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", e => handleFiles(e.target.files));

    function handleFiles(files) {
        images = Array.from(files).filter(f => f.type.match("image") && f.size <= 5*1024*1024);
        if (!images.length) return showError("اختر صور JPG/PNG ≤5MB");
        origC.innerHTML = ""; transC.innerHTML = ""; msgDiv.innerHTML = "";
        images.forEach((f,i) => previewFile(f,i));
        processBtn.disabled = false;
        showMessage(`تم تحميل ${images.length} صورة`, "success");
    }

    function previewFile(file,i) {
        const r = new FileReader();
        r.onload = e => {
            const d = document.createElement("div");
            d.style.display = "inline-block"; d.style.margin = "5px"; d.style.textAlign = "center";
            const img = document.createElement("img");
            img.src = e.target.result;
            img.style.width = img.style.height = "100px";
            img.style.objectFit = "cover";
            img.style.borderRadius = "8px";
            img.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
            d.appendChild(img);
            origC.appendChild(d);
        };
        r.readAsDataURL(file);
    }

    processBtn.addEventListener("click", async () => {
        const keys   = getApiKeys();
        const hfKey  = keys.huggingface.key.trim();
        const gemKey = keys.gemini.key.trim();
        const useGem = gemKey.length > 0;
        const lang   = srcLangSel.value;

        // The Hugging Face key is mandatory for the OCR step (Nanonets OCR).
        // Translation can use Gemini if a key is provided, but OCR requires HF.
        if (!hfKey) return showError("مفتاح Hugging Face مطلوب لإتمام العملية");
        if (!images.length) return showError("حمّل صورة أولاً");

        processBtn.disabled = resetBtn.disabled = true;
        transC.innerHTML = ""; // Clear previous results

        try {
            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                const progressStart = (i / images.length) * 100;
                const progressEnd = ((i + 1) / images.length) * 100;

                updateProgress(progressStart, `جاري معالجة الصورة ${i + 1}/${images.length}...`);

                const b64 = await toBase64(image);

                const textBlocks = await extractTextWithNanonetsOCR(b64, hfKey);
                if (!textBlocks.length) {
                    showError(`لم يتم العثور على نص في الصورة ${i + 1}`);
                    continue; // Skip to next image
                }

                showMessage(`اُكتشف ${textBlocks.length} فقاعة نص في الصورة ${i + 1}`, "success");

                const originals   = textBlocks.map(b => b.originalText);
                const translated = [];

                for (let j = 0; j < originals.length; j++) {
                    const singleProgress = (j / originals.length) * (progressEnd - progressStart - 10);
                    updateProgress(progressStart + 5 + singleProgress, `ترجمة ${j + 1}/${originals.length} من الصورة ${i + 1}...`);
                    if (useGem && gemKey) {
                        translated.push(await translateWithGemini(originals[j], gemKey));
                    } else {
                        translated.push(await translateWithLLM(originals[j], lang, hfKey));
                    }
                }

                updateProgress(progressEnd - 5, `إنشاء الصورة النهائية ${i + 1}...`);
                const outImg = await drawTextOnImage(b64, textBlocks, translated);
                appendTranslatedImage(outImg, i);
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
        origC.innerHTML = '<div class="placeholder">سيتم عرض الصورة الأصلية هنا</div>';
        transC.innerHTML= '<div class="placeholder">سيتم عرض الصورة المترجمة هنا</div>';
        fileInput.value = "";
        msgDiv.innerHTML = "";
        updateProgress(0, "في انتظار تحميل الصورة...");
        document.getElementById("progress-bar").style.width = "0%";
        document.getElementById("progress-percentage").textContent = "0%";
        images = [];
        processBtn.disabled = true;
    });

    function appendTranslatedImage(data, index) {
        const container = document.createElement('div');
        container.className = 'translated-image-item';

        const img = document.createElement("img");
        img.src = data;
        img.style.maxWidth = "100%";
        img.style.borderRadius = "8px";
        img.style.boxShadow = "0 5px 15px rgba(0,0,0,0.1)";

        const btn = document.createElement('button');
        btn.textContent = `⬇️ تحميل الصورة المترجمة ${index + 1}`;
        btn.className = 'download-btn';
        btn.onclick = () => {
            const a = document.createElement("a");
            a.download = `manga-translated-${Date.now()}-${index + 1}.jpg`;
            a.href = data;
            a.click();
        };

        container.appendChild(img);
        container.appendChild(btn);
        transC.appendChild(container);
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
        const b  = document.getElementById("progress-bar"),
              pr = document.getElementById("progress-percentage"),
              s  = document.getElementById("status");
        if (b)  b.style.width = `${p}%`;
        if (pr) pr.textContent = `${Math.round(p)}%`;
        if (s && msg) s.textContent = msg;
    }
});
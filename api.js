// رسم النصوص على الصورة باستخدام BBoxes حقيقية
async function drawTextOnImage(base64Image, blocks, translatedTexts) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            canvas.width  = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            const enhance = txt =>
                txt.replace(/([.!؟])/g, " \$1 ").replace(/\s+/g, " ").trim();

            blocks.forEach((block, i) => {
                let txt = translatedTexts[i] || "";
                if (!txt.trim()) return;
                txt = enhance(txt);

                const { x_min, y_min, x_max, y_max } = block.boundingBox;
                const X1 = Math.max(0, Math.round(x_min)),
                      Y1 = Math.max(0, Math.round(y_min)),
                      X2 = Math.min(img.width,  Math.round(x_max)),
                      Y2 = Math.min(img.height, Math.round(y_max));
                const W = X2 - X1, H = Y2 - Y1;
                if (W<=0||H<=0) return;

                // خلفية
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.fillRect(X1, Y1, W, H);

                // حجم الخط
                let fontSize = Math.min(32, Math.floor(H*0.8));
                ctx.font = `${fontSize}px Tajawal, Cairo, sans-serif`;
                ctx.textAlign = "right";
                ctx.textBaseline = "top";
                ctx.fillStyle = "#000";

                // تقسيم الأسطر
                const words = txt.split(" "), lines = [];
                let line = words[0] || "";
                for (let n=1; n<words.length; n++) {
                    const test = line + " " + words[n];
                    if (ctx.measureText(test).width <= W*0.9) {
                        line = test;
                    } else {
                        lines.push(line);
                        line = words[n];
                    }
                }
                lines.push(line);

                // ضبط الخط إذا لزم
                const lineHeight = fontSize * 1.4;
                const totalH     = lines.length * lineHeight;
                while (fontSize>10 && totalH>H*0.9) {
                    fontSize--;
                    ctx.font = `${fontSize}px Tajawal, Cairo, sans-serif`;
                }

                // رسم الأسطر
                const startY = Y1 + 5;
                lines.forEach((ln, idx) => {
                    ctx.fillText(ln.trim(), X2 - 5, startY + idx * lineHeight);
                });
            });

            resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.src = base64Image;
    });
}
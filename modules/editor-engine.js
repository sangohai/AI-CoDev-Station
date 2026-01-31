import { config } from './config.js';
import { githubFetch } from './github-api.js';
let imageCache = new Map();

export async function renderPreview(text, path) {
    const preview = document.getElementById('markdown-preview');
    const errBox = document.getElementById('syntax-error-container');
    if (!path || !text) { preview.innerHTML = ''; errBox.innerHTML = ''; return; }
    const ext = path.split('.').pop().toLowerCase();
    errBox.innerHTML = ''; 
    try {
        if (ext === 'md') {
            preview.innerHTML = marked.parse(text);
            handlePrivateImages(preview);
        } else if (ext === 'html') {
            preview.innerHTML = `
                <div class="alert alert-secondary d-flex justify-content-between align-items-center py-2 px-3 mb-3 border-0 shadow-sm">
                    <div><strong class="d-block">🌐 HTML 网页模式</strong><small class="text-muted">源码展示中，点击按钮跳转预览</small></div>
                    <button class="btn btn-sm btn-primary fw-bold px-3" onclick="window.station.previewHtmlInNewTab()">🚀 运行并预览网页</button>
                </div>
                <pre><code class="language-html">${text.replace(/</g, '&lt;')}</code></pre>`;
        } else if (ext === 'json') {
            try { preview.innerHTML = `<pre><code class="language-json">${JSON.stringify(JSON.parse(text), null, 2)}</code></pre>`; }
            catch (e) { 
                errBox.innerHTML = `<div class="alert alert-danger py-1 px-2 m-0 small fw-bold">❌ JSON 格式错误: ${e.message}</div>`;
                preview.innerHTML = `<pre><code class="language-json">${text}</code></pre>`;
            }
        } else {
            const langMap = { 'js': 'javascript', 'py': 'python', 'yml': 'yaml' };
            if ((ext === 'yaml' || ext === 'yml') && text.includes('\t')) errBox.innerHTML = `<div class="alert alert-danger py-1 px-2 m-0 small fw-bold">❌ YAML 严禁使用 Tab 缩进</div>`;
            preview.innerHTML = `<pre><code class="language-${langMap[ext] || ext}">${text}</code></pre>`;
        }
    } catch (err) { errBox.innerHTML = `<div class="alert alert-danger py-1 px-2 m-0 small">预览渲染异常</div>`; }
    preview.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
}

async function handlePrivateImages(container) {
    const imgs = container.querySelectorAll('img');
    for (let img of imgs) {
        const src = img.getAttribute('src');
        if (src && src.includes('assets/images') && !src.startsWith('http')) {
            if (imageCache.has(src)) img.src = imageCache.get(src);
            else {
                try {
                    const res = await githubFetch(src); const data = await res.json();
                    const blob = await (await fetch(`data:image/webp;base64,${data.content}`)).blob();
                    const url = URL.createObjectURL(blob); imageCache.set(src, url); img.src = url;
                } catch (e) {}
            }
        }
    }
}
export function compressImage(blob) {
    return new Promise(res => {
        const reader = new FileReader(); reader.readAsDataURL(blob);
        reader.onload = e => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const cvs = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > 1200) { h = (1200 / w) * h; w = 1200; }
                cvs.width = w; cvs.height = h;
                const ctx = cvs.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                res(cvs.toDataURL('image/webp', 0.8));
            }
        }
    });
}
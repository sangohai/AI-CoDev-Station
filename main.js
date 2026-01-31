import { config, state, loadSettings, saveConfigToLocal, checkImport, initTheme, toggleTheme } from './modules/config.js';
import { sleep, setSaveStatus, decodeUnicode } from './modules/utils.js';
import { getContents, putContent, deleteContent, githubFetch, getUserRepos } from './modules/github-api.js';
import { refreshFileList, updateTopUI, filterFiles } from './modules/ui-manager.js';
import { renderPreview, compressImage } from './modules/editor-engine.js';
import { getEmojiPickerHTML, addEmoji } from './modules/emoji.js';

document.addEventListener('DOMContentLoaded', async () => {
    checkImport(); loadSettings(); initTheme(); bindEvents();
    if (config.token && config.owner) {
        await refreshRepoList(); await fetchFolderList(); await refreshFileList();
    } else { openSettings(); }
});

function bindEvents() {
    document.getElementById('themeBtn').onclick = toggleTheme;
    document.getElementById('settingsBtn').onclick = openSettings;
    document.getElementById('btnSaveSettings').onclick = saveSettings;
    document.getElementById('repoSelector').onchange = changeRepo;
    document.getElementById('folderSelector').onchange = changeFolder;
    document.getElementById('btnNewFolder').onclick = createNewFolder;
    document.getElementById('btnRenameFolder').onclick = renameCurrentFolder;
    document.getElementById('btnDeleteFolder').onclick = deleteCurrentFolder;
    document.getElementById('btnCopyContext').onclick = copyFolderContext;
    document.getElementById('btnNewFile').onclick = createNewFile;
    document.getElementById('btnRenameFile').onclick = renameCurrentFile;
    document.getElementById('btnDelete').onclick = deleteCurrentFile;
    document.getElementById('fileSearchInput').oninput = filterFiles;
    document.getElementById('btnSave').onclick = manualSave;
    document.getElementById('btnLoad').onclick = loadContent;
    document.getElementById('btnUpload').onclick = () => document.getElementById('imageFileInput').click();
    document.getElementById('imageFileInput').onchange = (e) => handleImageFileSelect(e.target);
    document.getElementById('btnEmoji').onclick = () => {
        const p = document.getElementById('emojiPicker');
        p.innerHTML = getEmojiPickerHTML(); p.style.display = p.style.display === 'none' ? 'block' : 'none';
    };
    document.getElementById('btnBackToHome').onclick = () => {
        const s = localStorage.getItem('llm_clip_config');
        if(s) { const c = JSON.parse(s); config.owner = c.owner; config.repo = c.repo; location.reload(); }
    };
    
    const editor = document.getElementById('editor');
    editor.onkeydown = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault(); const s = editor.selectionStart;
            editor.value = editor.value.substring(0, s) + "  " + editor.value.substring(editor.selectionEnd);
            editor.selectionStart = editor.selectionEnd = s + 2;
        }
    };
    editor.oninput = handleInput;
    editor.addEventListener('paste', handlePaste);
    document.getElementById('btnCopyRaw').onclick = () => {
        navigator.clipboard.writeText(document.getElementById('editor').value).then(()=>alert("已复制"));
    };
}

window.station = {
    async switchFile(path, name) {
        config.path = path; saveConfigToLocal(); updateTopUI(path, name);
        if (path) await loadContent();
        const sb = document.getElementById('sidebarMenu');
        if (window.innerWidth < 768 && sb.classList.contains('show')) bootstrap.Offcanvas.getInstance(sb).hide();
    },
    insertEmoji(e) {
        const ed = document.getElementById('editor'); const s = ed.selectionStart;
        ed.value = ed.value.substring(0, s) + e + ed.value.substring(ed.selectionEnd);
        document.getElementById('emojiPicker').style.display = 'none';
        ed.focus(); renderPreview(ed.value, config.path);
    },
    addNewEmoji() {
        const i = document.getElementById('customEmojiInput');
        if (i.value) { addEmoji(i.value); document.getElementById('emojiPicker').innerHTML = getEmojiPickerHTML(); }
    },
    previewHtmlInNewTab() {
        const content = document.getElementById('editor').value;
        const blob = new Blob([content], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
    }
};

async function refreshRepoList() {
    const sel = document.getElementById('repoSelector'); sel.innerHTML = '<option>加载中...</option>';
    try {
        const repos = await getUserRepos(); sel.innerHTML = '';
        repos.forEach(r => {
            const opt = document.createElement('option'); opt.value = r.name;
            opt.innerText = (r.private ? '🔒 ' : '🌐 ') + r.name;
            if (r.name === config.repo) opt.selected = true;
            sel.appendChild(opt);
        });
        if (config.repo && !repos.find(r => r.name === config.repo)) {
            const opt = document.createElement('option'); opt.value = config.repo; opt.innerText = '🔍 ' + config.repo; opt.selected = true; sel.prepend(opt);
        }
    } catch (e) { sel.innerHTML = '<option>加载失败</option>'; }
}

async function changeRepo() {
    config.repo = document.getElementById('repoSelector').value;
    config.path = ''; state.currentFolder = ''; state.isReadOnly = false;
    saveConfigToLocal();
    document.getElementById('opsGroup').style.display = 'flex';
    document.getElementById('btnSave').disabled = false;
    await fetchFolderList(); await refreshFileList(); await checkManifest(); updateTopUI('', '');
}

async function loadContent() {
    if (!config.path) return;
    setSaveStatus("loading", "同步中...");
    try {
        const data = await getContents(config.path);
        state.currentFileSha = data.sha;
        const content = decodeUnicode(data.content);
        document.getElementById('editor').value = content;
        renderPreview(content, config.path);
        setSaveStatus("success", "已同步");
    } catch (e) { setSaveStatus("error", "拉取失败"); }
}

async function manualSave() {
    if (!config.path || state.isReadOnly) return;
    setSaveStatus("loading", "保存中...");
    try {
        const res = await putContent(config.path, document.getElementById('editor').value, 'Update', state.currentFileSha);
        state.currentFileSha = res.content.sha;
        setSaveStatus("success", "已保存");
        if (config.path.endsWith('manifest.yaml')) checkManifest();
    } catch (e) { setSaveStatus("error", "失败"); }
}

function handleInput() {
    setSaveStatus("unsaved", "等待保存...");
    renderPreview(document.getElementById('editor').value, config.path);
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(manualSave, 5000);
}

async function fetchFolderList() {
    const sel = document.getElementById('folderSelector'); sel.innerHTML = '<option value="">📂 根目录 (Root)</option>';
    try {
        const res = await githubFetch(`?t=${Date.now()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            data.filter(i => i.type === 'dir').forEach(f => {
                const opt = document.createElement('option'); opt.value = f.path; opt.text = `📂 ${f.name}`;
                sel.appendChild(opt);
            });
        }
    } catch(e) {}
}

async function changeFolder() {
    state.currentFolder = document.getElementById('folderSelector').value;
    const hasF = state.currentFolder !== "";
    document.getElementById('btnDeleteFolder').style.display = (hasF && !state.isReadOnly) ? 'inline-block' : 'none';
    document.getElementById('btnRenameFolder').style.display = (hasF && !state.isReadOnly) ? 'inline-block' : 'none';
    await refreshFileList(); await checkManifest();
}

async function createNewFile() {
    let name = prompt("文件名:"); if (!name) return; if (!name.includes('.')) name += '.md';
    const path = state.currentFolder ? `${state.currentFolder}/${name}` : name;
    try {
        await putContent(path, `# ${name}\n`, `Create`);
        await sleep(1000); await refreshFileList(); window.station.switchFile(path, name);
    } catch (e) { alert("失败"); }
}

async function createNewFolder() {
    let name = prompt("文件夹名:"); if (!name) return;
    const path = `${name.replace(/[\/\\]/g, '').trim()}/.gitkeep`;
    try {
        await putContent(path, ``, `Create folder`);
        await sleep(1000); location.reload();
    } catch (e) { alert("失败"); }
}

async function renameCurrentFile() {
    if (!config.path) return;
    const oldP = config.path; const oldN = oldP.split('/').pop();
    let newN = prompt("新名称:", oldN); if (!newN || newN === oldN) return;
    if (!newN.includes('.')) newN += '.md';
    const parts = oldP.split('/'); parts.pop();
    const newP = parts.length > 0 ? `${parts.join('/')}/${newN.trim()}` : newN.trim();
    try {
        setSaveStatus("loading", "正在重命名...");
        const res = await putContent(newP, document.getElementById('editor').value, 'Rename');
        await deleteContent(oldP, state.currentFileSha);
        config.path = newP; state.currentFileSha = res.content.sha;
        saveConfigToLocal(); await sleep(800); await refreshFileList(); updateTopUI(newP, newN);
    } catch (e) { alert("失败"); } finally { setSaveStatus("success", "就绪"); }
}

async function deleteCurrentFile() {
    if (!config.path || !confirm("确认删除？")) return;
    try {
        await deleteContent(config.path, state.currentFileSha);
        await sleep(800); config.path = ''; await refreshFileList(); window.station.switchFile('', '');
    } catch (e) { alert("失败"); }
}

async function renameCurrentFolder() {
    if (!state.currentFolder) return;
    const newN = prompt("新文件夹名:", state.currentFolder);
    if (!newN || newN === state.currentFolder) return;
    try {
        setSaveStatus("loading", "搬迁中...");
        const items = await (await githubFetch(state.currentFolder)).json();
        for (let item of items) {
            const data = await getContents(item.path);
            await putContent(`${newN}/${item.name}`, decodeUnicode(data.content));
            await deleteContent(item.path, item.sha);
        }
        await sleep(1000); location.reload();
    } catch (e) { alert("操作失败"); }
}

async function deleteCurrentFolder() {
    if (!state.currentFolder || !confirm("确认彻底删除？")) return;
    try {
        const items = await (await githubFetch(state.currentFolder)).json();
        for (let item of items) await deleteContent(item.path, item.sha);
        await sleep(1000); location.reload();
    } catch (e) { alert("失败"); }
}

async function checkManifest() {
    const banner = document.getElementById('manifestBanner');
    if (!state.currentFolder) { banner.style.display = 'none'; return; }
    try {
        const data = await getContents(`${state.currentFolder}/manifest.yaml`);
        const content = decodeUnicode(data.content);
        const name = content.match(/skill_name:\s*(.*)/)?.[1] || "未命名技能";
        const desc = content.match(/description:\s*(.*)/)?.[1] || "就绪";
        document.getElementById('skillName').innerText = name.replace(/['"]/g, '').trim();
        document.getElementById('skillDesc').innerText = desc.replace(/['"]/g, '').trim();
        banner.style.display = 'block';
    } catch (e) { banner.style.display = 'none'; }
}

async function copyFolderContext() {
    const btn = document.getElementById('btnCopyContext'); btn.innerText = "⏳ 正在拉取...";
    try {
        const res = await githubFetch(state.currentFolder);
        const items = await res.json();
        const files = items.filter(f => f.type === 'file' && /\.(md|json|yaml|yml|txt|js|py|html|sh)$/i.test(f.name));
        const results = await Promise.all(files.map(async f => {
            const data = await getContents(f.path);
            return `[FILE: ${f.name}]\n${decodeUnicode(data.content)}\n[END OF FILE]`;
        }));
        await navigator.clipboard.writeText(results.join('\n\n'));
        btn.innerText = "✅ 复制成功"; setTimeout(() => btn.innerText = "🚀 聚合技能上下文", 2000);
    } catch (e) { alert("失败"); }
}

async function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault(); const blob = item.getAsFile();
            const base64Header = await compressImage(blob);
            const path = `assets/images/img_${Date.now()}.webp`;
            await putContent(path, baseHeader.split(',')[1], 'Upload Image');
            const tag = `\n![img](${path})\n`;
            const ed = document.getElementById('editor');
            ed.value = ed.value.substring(0, ed.selectionStart) + tag + ed.value.substring(ed.selectionEnd);
            renderPreview(ed.value, config.path);
        }
    }
}

async function handleImageFileSelect(input) {
    if (input.files && input.files[0]) {
        const baseHeader = await compressImage(input.files[0]);
        const path = `assets/images/img_${Date.now()}.webp`;
        await putContent(path, baseHeader.split(',')[1], 'Upload');
        const ed = document.getElementById('editor');
        ed.value += `\n![img](${path})\n`; renderPreview(ed.value, config.path);
    }
}

document.getElementById('btnHarvest').onclick = async () => {
    let input = prompt("GitHub 网址或 Owner/Repo:");
    if (!input) return;
    try {
        let owner, repo;
        if (input.includes('github.com/')) {
            const parts = input.split('github.com/')[1].split('/');
            owner = parts[0]; repo = parts[1];
        } else { [owner, repo] = input.split('/'); }
        config.owner = owner; config.repo = repo; config.path = "";
        state.isReadOnly = true; 
        document.getElementById('opsGroup').style.display = 'none';
        document.getElementById('btnSave').disabled = true;
        document.getElementById('btnBackToHome').style.display = 'block';
        setSaveStatus("loading", `采集 ${repo}...`);
        await refreshRepoList(); await fetchFolderList(); await refreshFileList();
    } catch(e) { alert("格式错误"); }
};

function openSettings() {
    const m = new bootstrap.Modal(document.getElementById('settingsModal'));
    document.getElementById('cfgToken').value = config.token || '';
    document.getElementById('cfgUser').value = config.owner || '';
    document.getElementById('cfgRepo').value = config.repo || '';
    m.show();
}

function saveSettings() {
    config.token = document.getElementById('cfgToken').value.trim();
    config.owner = document.getElementById('cfgUser').value.trim();
    config.repo = document.getElementById('cfgRepo').value.trim();
    saveConfigToLocal(); location.reload();
}
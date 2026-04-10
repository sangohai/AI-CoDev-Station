/**
 * main.js - 核心业务流指挥中心 (v2.0)
 * 职责：整合所有模块，驱动“仓库-目录-文件”三级联动管理系统。
 * @module Main
 */
import { config, state, loadSettings, saveConfigToLocal, checkImport, initTheme, toggleTheme } from './modules/config.js';
import { sleep, setSaveStatus, decodeUnicode } from './modules/utils.js';
import { getContents, putContent, deleteContent, githubFetch, getUserRepos, createRepo, forkRepo, deleteRepo, updateRepo, getRepoTree } from './modules/github-api.js';
import { refreshRepoList, refreshFolderList, refreshFileGrid, updateManagerUI, filterFiles } from './modules/ui-manager.js';
import { renderPreview, compressImage } from './modules/editor-engine.js';
import { getEmojiPickerHTML, addEmoji } from './modules/emoji.js';

/**
 * 页面初始化入口
 */
document.addEventListener('DOMContentLoaded', async () => {
    checkImport();
    loadSettings();
    initTheme();
    bindEvents();

    if (config.token && config.owner) {
        await initStation();
    } else {
        openSettings();
    }
});

/**
 * 核心初始化序列：仓库矩阵 -> 抓取树状索引 -> 渲染目录 -> 渲染文件
 * @async
 */
async function initStation() {
    showLoader("正在同步云端资产...");
    try {
        await refreshRepoList();
        if (config.repo) {
            // 获取当前仓库的全量 Recursive Tree
            state.fullTree = await getRepoTree();
            await refreshFolderList();
            await refreshFileGrid();
            await checkManifest();
        }
        updateManagerUI();
    } catch (e) {
        console.error("Station 初始化失败:", e);
    } finally {
        hideLoader();
    }
}

/**
 * 安全绑定 UI 事件监听器
 */
function safeBind(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el[event] = fn;
}

/**
 * 集中绑定所有界面事件
 */
function bindEvents() {
    // --- 仓库层事件 ---
    safeBind('repoSelector', 'onchange', changeRepo);
    safeBind('btnNewRepo', 'onclick', createNewRepoFlow);
    safeBind('btnRenameRepo', 'onclick', renameRepoFlow);
    safeBind('btnDeleteRepo', 'onclick', deleteRepoFlow);
    safeBind('btnForkRepo', 'onclick', forkRepoFlow);

    // --- 目录层事件 ---
    safeBind('folderSelector', 'onchange', changeFolder);
    safeBind('btnNewFolder', 'onclick', createNewFolder);
    safeBind('btnRenameFolder', 'onclick', renameFolderFlow);
    safeBind('btnDeleteFolder', 'onclick', deleteFolderFlow);
    safeBind('btnCopyContext', 'onclick', copyFolderContext);

    // --- 文件层事件 ---
    safeBind('btnNewFile', 'onclick', createNewFile);
    safeBind('btnRenameFile', 'onclick', renameFileFlow);
    safeBind('btnDeleteFile', 'onclick', deleteFileFlow);
    safeBind('fileSearchInput', 'oninput', filterFiles);

    // --- 编辑器工具栏 ---
    safeBind('btnSave', 'onclick', manualSave);
    safeBind('btnLoad', 'onclick', loadContent);
    safeBind('btnUpload', 'onclick', () => document.getElementById('imageFileInput').click());
    safeBind('imageFileInput', 'onchange', (e) => handleImageFileSelect(e.target));
    safeBind('btnEmoji', 'onclick', toggleEmojiPicker);
    safeBind('btnCopyRaw', 'onclick', () => {
        const val = document.getElementById('editor').value;
        navigator.clipboard.writeText(val).then(() => alert("已成功复制源码"));
    });

    // --- 系统工具 ---
    safeBind('themeBtn', 'onclick', toggleTheme);
    safeBind('settingsBtn', 'onclick', openSettings);
    safeBind('btnSaveSettings', 'onclick', saveSettings);
    safeBind('btnBackToHome', 'onclick', () => location.reload());

    const editor = document.getElementById('editor');
    if (editor) {
        editor.oninput = handleInput;
        editor.addEventListener('paste', handlePaste);
        editor.onkeydown = (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = editor.selectionStart;
                editor.value = editor.value.substring(0, s) + "  " + editor.value.substring(editor.selectionEnd);
                editor.selectionStart = editor.selectionEnd = s + 2;
            }
        };
    }
}

/** 界面遮罩控制 */
function showLoader(text) {
    const loader = document.getElementById('global-loader');
    if (loader) {
        const textEl = document.getElementById('loader-text');
        if (textEl) textEl.innerText = text;
        loader.classList.replace('d-none', 'd-flex');
    }
}
function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.replace('d-flex', 'd-none');
}

/** 全局桥接对象 */
window.station = {
    async switchFile(path, name) {
        config.path = path;
        saveConfigToLocal();
        updateManagerUI();
        document.getElementById('currentFileName').innerText = name;
        if (path) await loadContent();
    },
    insertEmoji(e) {
        const ed = document.getElementById('editor'); const s = ed.selectionStart;
        ed.value = ed.value.substring(0, s) + e + ed.value.substring(ed.selectionEnd);
        document.getElementById('emojiPicker').style.display = 'none';
        renderPreview(ed.value, config.path);
    },
    addNewEmoji() {
        const i = document.getElementById('customEmojiInput');
        if (i && i.value) { addEmoji(i.value); document.getElementById('emojiPicker').innerHTML = getEmojiPickerHTML(); }
    },
    previewHtmlInNewTab() {
        const content = document.getElementById('editor').value;
        const blob = new Blob([content], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
    }
};

// ==========================================
// 1. 仓库级业务逻辑 (Repository Actions)
// ==========================================

async function changeRepo() {
    config.repo = document.getElementById('repoSelector').value;
    config.path = ''; 
    state.currentFolder = '';
    saveConfigToLocal();
    await initStation();
}

async function createNewRepoFlow() {
    const name = prompt("请输入新仓库名称 (建议 schema-xxx):", "schema-");
    if (!name || name === "schema-") return;
    showLoader("正在孵化云端蓝图...");
    try {
        await createRepo(name, "AI-CoDev Station 孵化蓝图", true);
        await sleep(4000);
        config.repo = name;
        const tps = [
            { p: '.ai-skill/blueprint.md', c: '# 项目意图层' },
            { p: '.ai-skill/schema.json', c: '{\n  "schema_version": "1.0.0",\n  "project_type": "AI-Driven"\n}' },
            { p: '.ai-skill/roadmap.yaml', c: 'current_milestone: "Discovery"\nstatus: "Active"' }
        ];
        for (const t of tps) {
            showLoader(`注入协议: ${t.p}...`);
            await putContent(t.p, t.c, "Initialize AI-CoDev Schema");
            await sleep(800);
        }
        saveConfigToLocal();
        location.reload();
    } catch (e) { alert("孵化失败: " + e.message); hideLoader(); }
}

async function renameRepoFlow() {
    const n = prompt("重命名当前仓库为:", config.repo);
    if (!n || n === config.repo) return;
    showLoader("正在同步仓库名...");
    try {
        await updateRepo(n, "");
        config.repo = n;
        saveConfigToLocal();
        location.reload();
    } catch (e) { alert(e.message); hideLoader(); }
}

async function deleteRepoFlow() {
    const t = config.repo;
    if (!t) return;
    if (t === "AI-CoDev-Station") { alert("核心工作站不可在此销毁"); return; }
    if (!confirm(`⚠️ 危险操作：确定要永久销毁仓库 [${t}] 吗？`)) return;
    if (prompt(`请输入仓库名 [ ${t} ] 以确认:`) !== t) { alert("校验失败"); return; }
    showLoader(`正在销毁资产 ${t}...`);
    try {
        await deleteRepo(config.owner, t);
        await sleep(2000);
        config.repo = "";
        saveConfigToLocal();
        location.reload();
    } catch (e) { alert("删除失败: " + e.message); hideLoader(); }
}

async function forkRepoFlow() {
    let input = prompt("请输入要 Fork 的仓库路径 (如 owner/repo):");
    if (!input) return;
    showLoader("正在执行云端 Fork...");
    try {
        let owner, repo;
        if (input.includes('github.com/')) {
            const parts = input.split('github.com/')[1].split('/');
            owner = parts[0]; repo = parts[1];
        } else {
            const parts = input.split('/');
            owner = parts[0]; repo = parts[1];
        }
        await forkRepo(owner, repo);
        showLoader("正在同步副本数据...");
        await sleep(6000);
        config.repo = repo;
        saveConfigToLocal();
        location.reload();
    } catch (e) { alert("Fork 失败: " + e.message); hideLoader(); }
}

// ==========================================
// 2. 目录级业务逻辑 (Folder Actions)
// ==========================================

async function changeFolder() {
    state.currentFolder = document.getElementById('folderSelector').value;
    await refreshFileGrid();
    await checkManifest();
    updateManagerUI();
}

async function createNewFolder() {
    let n = prompt("新文件夹名称:");
    if (!n) return;
    const p = `${n.replace(/[\/\\]/g, '').trim()}/.gitkeep`;
    showLoader("创建云端目录...");
    try {
        await putContent(p, ``, "Create folder placeholder");
        await sleep(1500);
        await initStation();
    } catch (e) { alert("创建失败"); hideLoader(); }
}

async function renameFolderFlow() {
    if (!state.currentFolder) return;
    const oldF = state.currentFolder;
    const newF = prompt("将目录重命名为:", oldF);
    if (!newF || newF === oldF) return;
    showLoader("正在执行批量搬迁...");
    try {
        const items = state.fullTree.tree.filter(f => f.path.startsWith(oldF + '/'));
        for (let item of items) {
            const data = await getContents(item.path);
            const newPath = item.path.replace(oldF, newF);
            await putContent(newPath, decodeUnicode(data.content), "Rename move");
            await deleteContent(item.path, item.sha);
        }
        await sleep(1500);
        state.currentFolder = newF;
        await initStation();
    } catch (e) { alert("操作失败"); hideLoader(); }
}

async function deleteFolderFlow() {
    if (!state.currentFolder || !confirm(`确定删除整个目录 [${state.currentFolder}] 吗？`)) return;
    showLoader("正在清理目录内容...");
    try {
        const items = state.fullTree.tree.filter(f => f.path.startsWith(state.currentFolder + '/'));
        for (let item of items) {
            await deleteContent(item.path, item.sha);
        }
        await sleep(1500);
        state.currentFolder = "";
        await initStation();
    } catch (e) { alert("删除失败"); hideLoader(); }
}

// ==========================================
// 3. 文件级业务逻辑 (File Actions)
// ==========================================

async function createNewFile() {
    let n = prompt("文件名 (支持 src/util.js 格式):");
    if (!n) return;
    const p = state.currentFolder ? `${state.currentFolder}/${n}` : n;
    showLoader("正在同步新文件...");
    try {
        await putContent(p, `# ${n}\n`, "Create file");
        await sleep(1500);
        await initStation();
        window.station.switchFile(p, n);
    } catch (e) { alert("创建失败"); hideLoader(); }
}

async function renameFileFlow() {
    if (!config.path) return;
    const oldP = config.path;
    const oldN = oldP.split('/').pop();
    let newN = prompt("重命名文件为:", oldN);
    if (!newN || newN === oldN) return;
    const parent = oldP.substring(0, oldP.lastIndexOf('/'));
    const newP = parent ? `${parent}/${newN}` : newN;
    showLoader("正在更新文件路径...");
    try {
        await putContent(newP, document.getElementById('editor').value, "Rename move");
        await deleteContent(oldP, state.currentFileSha);
        config.path = newP;
        saveConfigToLocal();
        await initStation();
    } catch (e) { alert("操作失败"); hideLoader(); }
}

async function deleteFileFlow() {
    if (!config.path || !confirm("确定永久删除此文档？")) return;
    showLoader("正在移除资产...");
    try {
        await deleteContent(config.path, state.currentFileSha);
        await sleep(1000);
        config.path = '';
        await initStation();
    } catch (e) { alert("删除失败"); hideLoader(); }
}

// ==========================================
// 4. 编辑器与内容处理 (Editor Actions)
// ==========================================

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
        const content = document.getElementById('editor').value;
        const res = await putContent(config.path, content, 'Update', state.currentFileSha);
        state.currentFileSha = res.content.sha;
        setSaveStatus("success", "已保存");
        if (config.path.endsWith('manifest.yaml')) await checkManifest();
    } catch (e) { setSaveStatus("error", "保存失败"); }
}

function handleInput() {
    setSaveStatus("unsaved", "等待保存...");
    renderPreview(document.getElementById('editor').value, config.path);
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(manualSave, 5000);
}

async function checkManifest() {
    const b = document.getElementById('manifestBanner');
    if (!b) return;
    const path = state.currentFolder ? `${state.currentFolder}/manifest.yaml` : 'manifest.yaml';
    const exists = state.fullTree && state.fullTree.tree.some(f => f.path === path);
    if (!exists) { b.style.display = 'none'; return; }
    try {
        const data = await getContents(path);
        const c = decodeUnicode(data.content);
        const nameMatch = c.match(/skill_name:\s*["']?([^"'\n]+)["']?/);
        document.getElementById('skillName').innerText = nameMatch ? nameMatch[1] : "技能就绪";
        b.style.display = 'block';
    } catch (e) { b.style.display = 'none'; }
}

async function copyFolderContext() {
    const btn = document.getElementById('btnCopyContext');
    btn.innerText = "⏳ 正在拉取技能...";
    try {
        const results = await Promise.all(state.fullTree.tree.filter(f => 
            f.type === 'blob' && 
            (state.currentFolder === "" ? !f.path.includes('/') : f.path.startsWith(state.currentFolder + '/')) && 
            /\.(md|json|yaml|yml|txt)$/i.test(f.path)
        ).slice(0, 20).map(async f => {
            const d = await getContents(f.path);
            return `[FILE: ${f.path}]\n${decodeUnicode(d.content)}\n[END OF FILE]`;
        }));
        await navigator.clipboard.writeText(results.join('\n\n'));
        btn.innerText = "✅ 聚合成功";
        setTimeout(() => btn.innerText = "🚀 聚合技能上下文", 2000);
    } catch (e) { alert("聚合失败"); }
}

async function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            showLoader("压缩上传中...");
            try {
                const baseHeader = await compressImage(blob);
                const path = `assets/images/img_${Date.now()}.webp`;
                await putContent(path, baseHeader.split(',')[1], 'Upload Image');
                const ed = document.getElementById('editor');
                const tag = `\n![img](${path})\n`;
                ed.value = ed.value.substring(0, ed.selectionStart) + tag + ed.value.substring(ed.selectionEnd);
                renderPreview(ed.value, config.path);
                manualSave();
            } catch(err) { alert("图片上传失败"); }
            finally { hideLoader(); }
        }
    }
}

async function handleImageFileSelect(input) {
    if (input.files && input.files[0]) {
        showLoader("正在处理图片...");
        try {
            const bh = await compressImage(input.files[0]);
            const path = `assets/images/img_${Date.now()}.webp`;
            await putContent(path, bh.split(',')[1], 'Upload Image');
            const ed = document.getElementById('editor');
            ed.value += `\n![img](${path})\n`;
            renderPreview(ed.value, config.path);
            manualSave();
        } catch(err) { alert("上传失败"); }
        finally { hideLoader(); }
    }
}

// --- 5. 系统设置业务 ---

function toggleEmojiPicker() {
    const p = document.getElementById('emojiPicker');
    if (!p) return;
    p.innerHTML = getEmojiPickerHTML();
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

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
    saveConfigToLocal();
    location.reload();
}
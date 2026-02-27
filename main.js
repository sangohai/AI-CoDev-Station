/**
 * main.js - AI-CoDev-Station 核心指挥中心 (v1.8.5)
 * 职责：负责模块协同、全局状态调度、UI 事件绑定及核心业务流程流转。
 * @module Main
 */

import { config, state, loadSettings, saveConfigToLocal, checkImport, initTheme, toggleTheme } from './modules/config.js';
import { sleep, setSaveStatus, decodeUnicode } from './modules/utils.js';
import { getContents, putContent, deleteContent, githubFetch, getUserRepos, createRepo, forkRepo, deleteRepo } from './modules/github-api.js';
import { refreshFileList, updateTopUI, filterFiles } from './modules/ui-manager.js';
import { renderPreview, compressImage } from './modules/editor-engine.js';
import { getEmojiPickerHTML, addEmoji } from './modules/emoji.js';

/**
 * 应用程序启动入口
 * 执行配置加载、主题初始化、事件绑定及初始数据拉取。
 */
document.addEventListener('DOMContentLoaded', async () => {
    checkImport();
    loadSettings();
    initTheme();
    bindEvents();

    if (config.token && config.owner) {
        await refreshRepoList();
        await refreshFileList();
    } else {
        openSettings();
    }
});

/**
 * 安全绑定 UI 事件监听器
 * 防止因 HTML 中缺少某个 ID 而导致脚本中断。
 * @param {string} id - DOM 元素 ID
 * @param {string} event - 事件名称 (如 'onclick')
 * @param {Function} fn - 回调函数
 */
function safeBind(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el[event] = fn;
}

/**
 * 集中管理所有 UI 交互事件的绑定
 */
function bindEvents() {
    // 系统级按钮
    safeBind('themeBtn', 'onclick', toggleTheme);
    safeBind('settingsBtn', 'onclick', openSettings);
    safeBind('btnSaveSettings', 'onclick', saveSettings);
    safeBind('btnBackToHome', 'onclick', () => location.reload());

    // 资产管理按钮
    safeBind('repoSelector', 'onchange', changeRepo);
    safeBind('btnNewRepo', 'onclick', createNewRepoFlow);
    safeBind('btnForkRepo', 'onclick', forkRepoFlow);
    safeBind('btnDeleteRepo', 'onclick', deleteRepoFlow);

    // 文件夹操作按钮 (由 Tree 驱动)
    safeBind('btnNewFolder', 'onclick', createNewFolder);
    safeBind('btnDeleteFolder', 'onclick', deleteCurrentFolder);
    safeBind('btnCopyContext', 'onclick', copyFolderContext);

    // 文档操作按钮
    safeBind('btnNewFile', 'onclick', createNewFile);
    safeBind('btnRenameFile', 'onclick', renameCurrentFile);
    safeBind('btnDelete', 'onclick', deleteCurrentFile);
    safeBind('btnSave', 'onclick', manualSave);
    safeBind('btnLoad', 'onclick', loadContent);
    safeBind('btnUpload', 'onclick', () => document.getElementById('imageFileInput').click());
    safeBind('btnEmoji', 'onclick', toggleEmojiPicker);
    safeBind('btnCopyRaw', 'onclick', () => {
        const val = document.getElementById('editor').value;
        navigator.clipboard.writeText(val).then(() => alert("已复制全文到剪贴板"));
    });

    // 输入框与编辑器监听
    safeBind('fileSearchInput', 'oninput', filterFiles);
    safeBind('imageFileInput', 'onchange', (e) => handleImageFileSelect(e.target));

    const editor = document.getElementById('editor');
    if (editor) {
        /** 处理 Tab 键缩进 (2空格) */
        editor.onkeydown = (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = editor.selectionStart, end = editor.selectionEnd;
                editor.value = editor.value.substring(0, s) + "  " + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = s + 2;
            }
        };
        editor.oninput = handleInput;
        editor.addEventListener('paste', handlePaste);
    }
}

/**
 * 显示全屏加载遮罩，冻结 UI 操作
 * @param {string} text - 提示文字
 */
function showLoader(text) {
    const loader = document.getElementById('global-loader');
    if (loader) {
        document.getElementById('loader-text').innerText = text;
        loader.classList.replace('d-none', 'd-flex');
    }
}

/** 隐藏全屏加载遮罩 */
function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.replace('d-flex', 'd-none');
}

/**
 * 注入全局 station 对象，供动态生成的树节点或其它模块调用
 * @global
 */
window.station = {
    /** 切换选中的文件并同步 UI */
    async switchFile(path, name) {
        config.path = path;
        saveConfigToLocal();
        updateTopUI(path, name);
        if (path) await loadContent();
        const sb = document.getElementById('sidebarMenu');
        if (window.innerWidth < 768 && sb && sb.classList.contains('show')) {
            bootstrap.Offcanvas.getInstance(sb).hide();
        }
    },
    /** 插入 Emoji 并刷新预览 */
    insertEmoji(e) {
        const ed = document.getElementById('editor');
        const s = ed.selectionStart;
        ed.value = ed.value.substring(0, s) + e + ed.value.substring(ed.selectionEnd);
        document.getElementById('emojiPicker').style.display = 'none';
        ed.focus();
        renderPreview(ed.value, config.path);
    },
    /** 添加自定义 Emoji 到本地存储 */
    addNewEmoji() {
        const i = document.getElementById('customEmojiInput');
        if (i && i.value) {
            addEmoji(i.value);
            document.getElementById('emojiPicker').innerHTML = getEmojiPickerHTML();
        }
    },
    /** 在独立标签页预览当前 HTML */
    previewHtmlInNewTab() {
        const content = document.getElementById('editor').value;
        const blob = new Blob([content], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
    }
};

// --- 核心业务函数 ---

/** 从云端加载当前文件内容 */
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

/** 执行手动保存操作 */
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

/** 编辑器输入监听逻辑 */
function handleInput() {
    setSaveStatus("unsaved", "等待保存...");
    renderPreview(document.getElementById('editor').value, config.path);
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(manualSave, 5000);
}

/** 刷新全账户仓库列表 */
async function refreshRepoList() {
    const sel = document.getElementById('repoSelector');
    if (!sel) return;
    try {
        const repos = await getUserRepos();
        sel.innerHTML = '';
        repos.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.name;
            opt.innerText = (r.private ? '🔒 ' : '🌐 ') + r.name;
            if (r.name === config.repo) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { sel.innerHTML = '<option>加载失败</option>'; }
}

/** 执行仓库切换流程 */
async function changeRepo() {
    const sel = document.getElementById('repoSelector');
    if (!sel) return;
    config.repo = sel.value;
    config.path = '';
    state.isReadOnly = false;
    saveConfigToLocal();
    showLoader("正在切换仓库...");
    await refreshFileList();
    await checkManifest();
    updateTopUI('', '');
    hideLoader();
}

/** 
 * [核心业务] 孵化新蓝图仓库全流程 
 * 包含：建库、等待索引、注入黄金协议、环境重载。
 */
async function createNewRepoFlow() {
    const nameInput = prompt("请输入新蓝图名称 (建议以 schema- 开头):", "schema-");
    if (!nameInput || nameInput === "schema-") return;
    const name = nameInput.trim();
    const desc = prompt("请输入仓库描述:", "AI-CoDev Schema");
    const isPrivate = confirm("是否设置为私有仓库？");

    showLoader("正在孵化云端蓝图...");
    try {
        await createRepo(name, desc, isPrivate);
        showLoader("正在分配数字神经元...");
        await sleep(4000);

        const templates = [
            { path: '.ai-skill/blueprint.md', content: `# ${name} 项目蓝图\n\n在此描述愿景...` },
            { path: '.ai-skill/schema.json', content: '{\n  "schema_version": "1.0.0"\n}' },
            { path: '.ai-skill/roadmap.yaml', content: 'status: "Active"' }
        ];

        config.repo = name;
        for (const t of templates) {
            showLoader(`注入协议: ${t.path}...`);
            await putContent(t.path, t.content, "Seed AI Protocol");
            await sleep(800);
        }
        saveConfigToLocal();
        location.reload();
    } catch (e) {
        alert("孵化失败: " + e.message);
        hideLoader();
    }
}

/** 执行 Fork 外部仓库流程 */
async function forkRepoFlow() {
    let input = prompt("请输入要 Fork 的仓库 (如 owner/repo):");
    if (!input) return;
    let owner, repo;
    try {
        if (input.includes('github.com/')) {
            const parts = input.split('github.com/')[1].split('/');
            owner = parts[0]; repo = parts[1];
        } else { [owner, repo] = input.split('/'); }
    } catch (e) { alert("格式错误"); return; }

    if (!confirm(`确定要 Fork [${owner}/${repo}] 吗？`)) return;
    showLoader(`正在搬运资源...`);
    try {
        await forkRepo(owner, repo);
        showLoader("正在初始化副本...");
        await sleep(6000);
        config.repo = repo;
        saveConfigToLocal();
        location.reload();
    } catch (e) { alert("Fork 失败"); hideLoader(); }
}

/** 执行危险的仓库销毁流程 */
async function deleteRepoFlow() {
    const target = config.repo;
    if (!target) return;
    if (target === "AI-CoDev-Station") { alert("核心调度站不可在此销毁"); return; }
    if (!confirm(`⚠️ 警告：确定要永久销毁 [${target}] 吗？`)) return;
    const verify = prompt(`请输入 [ ${target} ] 以确认：`);
    if (verify !== target) return;

    showLoader(`正在销毁仓库 ${target}...`);
    try {
        await deleteRepo(config.owner, target);
        showLoader("同步资产地图...");
        await sleep(2000);
        config.repo = "";
        saveConfigToLocal();
        location.reload();
    } catch (e) { alert("删除失败: " + e.message); hideLoader(); }
}

/** 快捷新建文件 */
async function createNewFile() {
    let name = prompt("文件名 (支持多级路径):");
    if (!name) return;
    try {
        await putContent(name, `# ${name}\n`, `Create file`);
        await sleep(1000);
        await refreshFileList();
        window.station.switchFile(name, name);
    } catch (e) { alert("创建失败"); }
}

/** 快捷新建文件夹 (占位符模式) */
async function createNewFolder() {
    let name = prompt("文件夹名:");
    if (!name) return;
    const path = `${name.replace(/[\/\\]/g, '').trim()}/.gitkeep`;
    try {
        await putContent(path, ``, `Create placeholder`);
        await sleep(1000);
        await refreshFileList();
    } catch (e) { alert("创建失败"); }
}

/** 重命名当前文件 (物理搬迁逻辑) */
async function renameCurrentFile() {
    if (!config.path) return;
    const oldP = config.path;
    let newN = prompt("新路径/名称:", oldP);
    if (!newN || newN === oldP) return;
    try {
        setSaveStatus("loading", "重命名中...");
        const res = await putContent(newN, document.getElementById('editor').value, 'Rename');
        await deleteContent(oldP, state.currentFileSha);
        config.path = newN;
        state.currentFileSha = res.content.sha;
        saveConfigToLocal();
        await sleep(1000);
        await refreshFileList();
        updateTopUI(newN, newN);
    } catch (e) { alert("失败"); } finally { setSaveStatus("success", "就绪"); }
}

/** 删除当前文档 */
async function deleteCurrentFile() {
    if (!config.path || !confirm("确认永久删除该文档？")) return;
    try {
        await deleteContent(config.path, state.currentFileSha);
        await sleep(1000);
        config.path = '';
        await refreshFileList();
        window.station.switchFile('', '');
    } catch (e) { alert("删除失败"); }
}

/** 执行空文件夹清理 (逻辑占位) */
async function deleteCurrentFolder() {
    alert("请在文件树节点上操作或访问 GitHub 网页端。");
}

/** 尝试检索并渲染当前蓝图的 Manifest 技能卡片 */
async function checkManifest() {
    const banner = document.getElementById('manifestBanner');
    try {
        const data = await getContents('manifest.yaml');
        const content = decodeUnicode(data.content);
        const name = content.match(/skill_name:\s*(.*)/)?.[1] || "蓝图技能包";
        const desc = content.match(/description:\s*(.*)/)?.[1] || "技能定义已就绪";
        document.getElementById('skillName').innerText = name.replace(/['"]/g, '').trim();
        document.getElementById('skillDesc').innerText = desc.replace(/['"]/g, '').trim();
        banner.style.display = 'block';
    } catch (e) { if(banner) banner.style.display = 'none'; }
}

/** 聚合当前全仓库上下文至剪贴板 */
async function copyFolderContext() {
    const btn = document.getElementById('btnCopyContext');
    btn.innerText = "⏳ 正在拉取...";
    try {
        const res = await githubFetch(`git/trees/main?recursive=1`);
        const data = await res.json();
        const files = data.tree.filter(f => f.type === 'blob' && /\.(md|json|yaml|yml|txt|js|py|sh|html|css)$/i.test(f.path));
        const results = await Promise.all(files.slice(0, 20).map(async f => {
            const fileData = await getContents(f.path);
            return `[FILE: ${f.path}]\n${decodeUnicode(fileData.content)}\n[END OF FILE]`;
        }));
        await navigator.clipboard.writeText(results.join('\n\n'));
        btn.innerText = "✅ 聚合成功";
        setTimeout(() => btn.innerText = "🚀 聚合技能上下文", 2000);
    } catch (e) { alert("聚合失败"); }
}

/** 拦截编辑器粘贴事件，处理图片压缩上传 */
async function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            const baseHeader = await compressImage(blob);
            const path = `assets/images/img_${Date.now()}.webp`;
            await putContent(path, baseHeader.split(',')[1], 'Upload Image');
            const ed = document.getElementById('editor');
            const tag = `\n![img](${path})\n`;
            ed.value = ed.value.substring(0, ed.selectionStart) + tag + ed.value.substring(ed.selectionEnd);
            renderPreview(ed.value, config.path);
        }
    }
}

/** 处理手动选择图片文件的上传 */
async function handleImageFileSelect(input) {
    if (input.files && input.files[0]) {
        const baseHeader = await compressImage(input.files[0]);
        const path = `assets/images/img_${Date.now()}.webp`;
        await putContent(path, baseHeader.split(',')[1], 'Upload Image');
        const ed = document.getElementById('editor');
        ed.value += `\n![img](${path})\n`;
        renderPreview(ed.value, config.path);
    }
}

/** 切换 Emoji 选择器的显示状态 */
function toggleEmojiPicker() {
    const p = document.getElementById('emojiPicker');
    if (p) {
        p.innerHTML = getEmojiPickerHTML();
        p.style.display = p.style.display === 'none' ? 'block' : 'none';
    }
}

/** 打开仓库配置弹窗并回填当前设置 */
function openSettings() {
    const m = new bootstrap.Modal(document.getElementById('settingsModal'));
    document.getElementById('cfgToken').value = config.token || '';
    document.getElementById('cfgUser').value = config.owner || '';
    document.getElementById('cfgRepo').value = config.repo || '';
    m.show();
}

/** 执行保存配置动作并刷新页面 */
function saveSettings() {
    config.token = document.getElementById('cfgToken').value.trim();
    config.owner = document.getElementById('cfgUser').value.trim();
    config.repo = document.getElementById('cfgRepo').value.trim();
    saveConfigToLocal();
    location.reload();
}
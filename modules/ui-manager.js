/**
 * ui-manager.js - 资产管理器 UI 渲染引擎 (v2.0)
 * @module UIManager
 */
import { config, state } from './config.js';
import { getUserRepos } from './github-api.js';

/**
 * 1. 刷新仓库下拉列表 (Repo Box)
 */
export async function refreshRepoList() {
    const sel = document.getElementById('repoSelector');
    if (!sel) return;
    sel.innerHTML = '<option>加载中...</option>';
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

/**
 * 2. 刷新目录下拉列表 (Folder Box)
 */
export async function refreshFolderList() {
    const sel = document.getElementById('folderSelector');
    if (!sel) return;
    sel.innerHTML = '<option value="">📂 根目录 (Root)</option>';
    
    if (state.fullTree && state.fullTree.tree) {
        // 过滤出所有目录
        const folders = state.fullTree.tree.filter(item => item.type === 'tree');
        // 按字母顺序排列
        folders.sort((a, b) => a.path.localeCompare(b.path)).forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.path;
            opt.innerText = `📁 ${f.path}`;
            if (f.path === state.currentFolder) opt.selected = true;
            sel.appendChild(opt);
        });
    }
}

/**
 * 3. 刷新文件列表网格 (File Box)
 */
export async function refreshFileGrid() {
    const listGroup = document.getElementById('fileListGroup');
    if (!listGroup) return;
    listGroup.innerHTML = '';

    if (!state.fullTree || !state.fullTree.tree) {
        listGroup.innerHTML = '<div class="p-4 text-center text-muted small">无可用资产</div>';
        return;
    }

    // 准许显示的文件格式
    const allowed = /\.(md|json|yaml|yml|txt|js|py|html|sh|css)$/i;
    
    // 筛选出当前选定目录下的直属文件
    const files = state.fullTree.tree.filter(item => {
        if (item.type !== 'blob' || !allowed.test(item.path)) return false;
        const pathParts = item.path.split('/');
        pathParts.pop(); // 移除文件名
        const parentPath = pathParts.join('/');
        return parentPath === state.currentFolder;
    });

    if (files.length === 0) {
        listGroup.innerHTML = '<div class="p-4 text-center text-muted small">此目录下无文档</div>';
        return;
    }

    files.forEach(file => {
        const a = document.createElement('a');
        a.className = `list-group-item list-group-item-action py-2 ${file.path === config.path ? 'active' : ''}`;
        a.setAttribute('data-path', file.path);
        
        let icon = '📄';
        if (file.path.endsWith('.json')) icon = '📦';
        else if (file.path.endsWith('.yaml') || file.path.endsWith('.yml')) icon = '⚙️';
        else if (file.path.endsWith('.html')) icon = '🌐';
        else if (file.path.includes('.ai-skill/')) icon = '💎';

        const fileName = file.path.split('/').pop();
        a.innerHTML = `<span class="text-truncate small">${icon} ${fileName}</span>`;
        a.onclick = (e) => {
            e.preventDefault();
            window.station.switchFile(file.path, fileName);
        };
        listGroup.appendChild(a);
    });
}

/**
 * 4. 侧边栏搜索过滤
 */
export function filterFiles() {
    const input = document.getElementById('fileSearchInput');
    if (!input) return;
    const kw = input.value.toLowerCase();
    document.querySelectorAll('#fileListGroup a').forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(kw) ? 'block' : 'none';
    });
}

/**
 * 5. 更新管理器的操作按钮状态
 */
export function updateManagerUI() {
    const isRepoReady = !!config.repo;
    const isFolderReady = state.currentFolder !== "";
    const isFileReady = !!config.path;

    // 仓库改名/删除按钮
    const btnRenRepo = document.getElementById('btnRenameRepo');
    const btnDelRepo = document.getElementById('btnDeleteRepo');
    if (btnRenRepo) btnRenRepo.style.display = isRepoReady ? 'inline-block' : 'none';
    if (btnDelRepo) btnDelRepo.style.display = isRepoReady ? 'inline-block' : 'none';

    // 目录改名/删除按钮
    const btnRenFolder = document.getElementById('btnRenameFolder');
    const btnDelFolder = document.getElementById('btnDeleteFolder');
    if (btnRenFolder) btnRenFolder.style.display = isFolderReady ? 'inline-block' : 'none';
    if (btnDelFolder) btnDelFolder.style.display = isFolderReady ? 'inline-block' : 'none';

    // 文件改名/删除按钮
    const btnRenFile = document.getElementById('btnRenameFile');
    const btnDelFile = document.getElementById('btnDeleteFile');
    if (btnRenFile) btnRenFile.style.display = isFileReady ? 'inline-block' : 'none';
    if (btnDelFile) btnDelFile.style.display = isFileReady ? 'inline-block' : 'none';

    // 列表选中态同步
    document.querySelectorAll('#fileListGroup a').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-path') === config.path);
    });
}
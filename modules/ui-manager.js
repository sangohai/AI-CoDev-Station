/**
 * ui-manager.js - 树状导航与界面渲染模块
 * @module UIManager
 */
import { config, state } from './config.js';
import { getRepoTree } from './github-api.js';

/**
 * @typedef {Object} TreeNode
 * @property {string} name - 文件或文件夹名称
 * @property {string} path - 完整路径
 * @property {string} type - 节点类型 ('tree' 为文件夹, 'blob' 为文件)
 * @property {Object.<string, TreeNode>} children - 子节点字典
 */

/** @type {Set<string>} 存储已折叠文件夹路径的集合 */
const collapsedFolders = new Set();

/**
 * 刷新并重新构建侧边栏树状文件列表
 * @async
 */
export async function refreshFileList() {
    const listGroup = document.getElementById('fileListGroup');
    if (!listGroup) return;
    listGroup.innerHTML = '<div class="p-4 text-center small text-muted">正在同步全景树...</div>';
    
    try {
        const data = await getRepoTree();
        if (!data || !data.tree) throw new Error("Fetch Failed");

        // 准许显示的文件后缀正则
        const allowed = /\.(md|json|yaml|yml|txt|js|py|html|css|sh|c|cpp|go|rs|sql)$/i;
        
        // 过滤并构建嵌套树结构
        const treeData = buildTree(data.tree.filter(item => 
            item.type === 'tree' || (item.type === 'blob' && allowed.test(item.path))
        ));

        listGroup.innerHTML = '';
        renderTree(treeData, listGroup, 0);

    } catch (e) {
        listGroup.innerHTML = '<div class="p-4 text-center text-danger small">列表拉取失败</div>';
    }
}

/**
 * 将 GitHub 返回的扁平路径数组转换为嵌套树结构对象
 * @param {Array<Object>} flatItems - API 返回的 tree 数组
 * @returns {Object.<string, TreeNode>}
 * @private
 */
function buildTree(flatItems) {
    const root = {};
    flatItems.forEach(item => {
        const parts = item.path.split('/');
        let current = root;
        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = {
                    name: part,
                    path: item.path,
                    type: (index === parts.length - 1) ? item.type : 'tree',
                    children: {}
                };
            }
            current = current[part].children;
        });
    });
    return root;
}

/**
 * 递归渲染树节点到容器中
 * @param {Object.<string, TreeNode>} treeObj - 树结构对象
 * @param {HTMLElement} container - 挂载容器
 * @param {number} level - 当前层级深度
 * @private
 */
function renderTree(treeObj, container, level) {
    const sortedKeys = Object.keys(treeObj).sort((a, b) => {
        if (treeObj[a].type !== treeObj[b].type) return treeObj[a].type === 'tree' ? -1 : 1;
        return a.localeCompare(b);
    });

    const indentSize = window.innerWidth < 768 ? 8 : 12;

    sortedKeys.forEach(key => {
        const node = treeObj[key];
        const itemEl = document.createElement('a');
        itemEl.href = "#";
        itemEl.className = `list-group-item list-group-item-action border-0 tree-item ${node.path === config.path ? 'active' : ''} ${node.type === 'tree' ? 'folder-node' : ''}`;
        
        itemEl.style.paddingLeft = `${level * indentSize + 12}px`;
        itemEl.setAttribute('data-path', node.path);
        itemEl.setAttribute('data-type', node.type);

        let icon = '📄';
        if (node.type === 'tree') {
            icon = collapsedFolders.has(node.path) ? '📁' : '📂';
        } else {
            if (node.name.endsWith('.json')) icon = '📦';
            else if (node.name.endsWith('.yaml') || node.name.endsWith('.yml')) icon = '⚙️';
            else if (/\.(js|py|html|sh)$/i.test(node.name)) icon = '💻';
            else if (node.name === 'manifest.yaml') icon = '💎';
        }

        itemEl.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="me-2 flex-shrink-0">${icon}</span>
                <span class="text-truncate">${node.name}</span>
            </div>
        `;

        itemEl.onclick = (e) => {
            e.preventDefault();
            if (node.type === 'tree') {
                if (collapsedFolders.has(node.path)) collapsedFolders.delete(node.path);
                else collapsedFolders.add(node.path);
                refreshFileList(); 
            } else {
                window.station.switchFile(node.path, node.name);
            }
        };

        container.appendChild(itemEl);

        if (node.type === 'tree' && !collapsedFolders.has(node.path)) {
            renderTree(node.children, container, level + 1);
        }
    });
}

/**
 * 更新编辑器顶栏 UI 状态
 * @param {string} path - 当前选中的文件路径
 * @param {string} [name] - 显示名称
 */
export function updateTopUI(path, name) {
    const fileName = name || path.split('/').pop() || '未选择文件';
    const nameEl = document.getElementById('currentFileName');
    if (nameEl) nameEl.innerText = fileName;
    
    const isSel = !!path;
    const btnDel = document.getElementById('btnDelete');
    const btnRen = document.getElementById('btnRenameFile');
    
    if (btnDel) btnDel.style.display = (isSel && !state.isReadOnly) ? 'inline-block' : 'none';
    if (btnRen) btnRen.style.display = (isSel && !state.isReadOnly) ? 'inline-block' : 'none';
    
    document.querySelectorAll('#fileListGroup a').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-path') === path);
    });
}

/**
 * 侧边栏文件搜索过滤逻辑
 */
export function filterFiles() {
    const input = document.getElementById('fileSearchInput');
    if (!input) return;
    const kw = input.value.toLowerCase();
    document.querySelectorAll('#fileListGroup a').forEach(item => {
        const path = item.getAttribute('data-path').toLowerCase();
        const type = item.getAttribute('data-type');
        if (type === 'blob') {
            item.style.display = path.includes(kw) ? 'block' : 'none';
        } else {
            item.style.display = kw ? 'none' : 'block'; 
        }
    });
}
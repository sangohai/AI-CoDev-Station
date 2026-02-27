/**
 * config.js - 配置与全局状态模块
 * @module Config
 */

/**
 * @typedef {Object} StationConfig
 * @property {string} token - GitHub Personal Access Token
 * @property {string} owner - GitHub 用户名
 * @property {string} repo - 当前操作的仓库名
 * @property {string} path - 当前打开文件的完整路径
 */
export let config = { token: '', owner: '', repo: '', path: '' };

/**
 * @typedef {Object} AppState
 * @property {string} currentFolder - 当前在树中选中的文件夹路径
 * @property {string} currentFileSha - 当前打开文件的 SHA 指纹
 * @property {number|null} autoSaveTimer - 自动保存的定时器 ID
 * @property {boolean} isDark - 是否为暗黑模式
 * @property {boolean} isReadOnly - 是否为只读模式（Harvester/外部库模式）
 */
export let state = { 
    currentFolder: '', 
    currentFileSha: '', 
    autoSaveTimer: null, 
    isDark: false, 
    isReadOnly: false 
};

const KEY = 'llm_clip_config';

/**
 * 从本地存储加载配置
 * @returns {StationConfig}
 */
export function loadSettings() {
    const s = localStorage.getItem(KEY);
    if (s) config = { ...config, ...JSON.parse(s) };
    return config;
}

/**
 * 将当前配置持久化到本地存储
 */
export function saveConfigToLocal() { 
    localStorage.setItem(KEY, JSON.stringify(config)); 
}

/**
 * 初始化主题设置
 */
export function initTheme() { 
    state.isDark = localStorage.getItem('theme') === 'dark'; 
    applyTheme(); 
}

/**
 * 切换暗黑/明亮模式
 */
export function toggleTheme() { 
    state.isDark = !state.isDark; 
    localStorage.setItem('theme', state.isDark ? 'dark' : 'light'); 
    applyTheme(); 
}

/**
 * 执行主题样式的 DOM 变换
 * @private
 */
function applyTheme() {
    document.documentElement.setAttribute('data-bs-theme', state.isDark ? 'dark' : 'light');
    const b = document.getElementById('themeBtn'); 
    if(b) b.innerText = state.isDark ? '☀️' : '🌙';
}

/**
 * 检查并处理通过 URL Hash 导入的配置
 */
export function checkImport() {
    const h = window.location.hash.substring(1); 
    const p = new URLSearchParams(h); 
    const d = p.get('import');
    if (d) { 
        try { 
            localStorage.setItem(KEY, atob(d)); 
            history.replaceState(null, null, window.location.pathname); 
            window.location.reload(); 
        } catch (e) { console.error("Import Error:", e); } 
    }
}
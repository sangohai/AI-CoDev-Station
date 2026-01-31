export let config = { token: '', owner: '', repo: '', path: '' };
export let state = { currentFolder: '', currentFileSha: '', autoSaveTimer: null, isDark: false, isReadOnly: false };
const KEY = 'llm_clip_config';

export function loadSettings() {
    const s = localStorage.getItem(KEY);
    if (s) config = { ...config, ...JSON.parse(s) };
    return config;
}
export function saveConfigToLocal() { localStorage.setItem(KEY, JSON.stringify(config)); }
export function initTheme() { state.isDark = localStorage.getItem('theme') === 'dark'; applyTheme(); }
export function toggleTheme() { 
    state.isDark = !state.isDark; localStorage.setItem('theme', state.isDark ? 'dark' : 'light'); applyTheme(); 
}
function applyTheme() {
    document.documentElement.setAttribute('data-bs-theme', state.isDark ? 'dark' : 'light');
    const b = document.getElementById('themeBtn'); if(b) b.innerText = state.isDark ? '☀️' : '🌙';
}
export function checkImport() {
    const h = window.location.hash.substring(1); const p = new URLSearchParams(h); const d = p.get('import');
    if (d) { try { localStorage.setItem(KEY, atob(d)); history.replaceState(null, null, window.location.pathname); window.location.reload(); } catch (e) {} }
}
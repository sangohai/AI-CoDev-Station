/**
 * github-api.js - GitHub REST/Git Data API 通信模块
 * @module GitHubAPI
 */
import { config } from './config.js';
import { encodeUnicode } from './utils.js';

const API_BASE = 'https://api.github.com';

/**
 * 基础 Fetch 封装
 * @param {string} path - 相对路径或完整 URL
 * @param {RequestInit} [options={}] - Fetch 配置项
 * @returns {Promise<Response>}
 */
export async function githubFetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;
    return fetch(url, { 
        ...options, 
        headers: { 
            'Authorization': `token ${config.token}`, 
            'Content-Type': 'application/json', 
            ...options.headers 
        } 
    });
}

/**
 * 创建新仓库
 * @param {string} name - 仓库名
 * @param {string} description - 描述
 * @param {boolean} isPrivate - 是否私有
 * @returns {Promise<Object>}
 */
export async function createRepo(name, description, isPrivate) {
    const res = await fetch(`${API_BASE}/user/repos`, {
        method: 'POST',
        headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, private: isPrivate, auto_init: true })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Create Failed"); }
    return res.json();
}

/**
 * Fork 外部仓库
 * @param {string} owner - 原仓库主
 * @param {string} repo - 原仓库名
 * @returns {Promise<Object>}
 */
export async function forkRepo(owner, repo) {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/forks`, {
        method: 'POST',
        headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Fork Failed"); }
    return res.json();
}

/**
 * 删除当前仓库
 * @param {string} owner 
 * @param {string} repo 
 * @returns {Promise<boolean>}
 */
export async function deleteRepo(owner, repo) {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}`, {
        method: 'DELETE',
        headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' }
    });
    if (res.status !== 204) { const err = await res.json(); throw new Error(err.message || "Delete Failed"); }
    return true;
}

/**
 * 获取文件内容信息
 * @param {string} path 
 * @returns {Promise<Object>}
 */
export async function getContents(path) {
    const res = await githubFetch(`${path}?t=${Date.now()}`);
    if (!res.ok) throw new Error("Fetch Content Error"); 
    return res.json();
}

/**
 * 获取用户所有仓库列表
 * @returns {Promise<Array<Object>>}
 */
export async function getUserRepos() {
    const res = await fetch(`${API_BASE}/user/repos?per_page=100&sort=updated`, {
        headers: { 'Authorization': `token ${config.token}` }
    });
    if (!res.ok) return []; 
    return res.json();
}

/**
 * 写入/更新文件
 * @param {string} path 
 * @param {string} content - 原始内容（文本）或 Base64（图片）
 * @param {string} message 
 * @param {string|null} sha 
 */
export async function putContent(path, content, message = 'Update', sha = null) {
    const isImg = path.match(/\.(png|jpe?g|webp|gif)$/i);
    const body = { message, content: isImg ? content : encodeUnicode(content) };
    if (sha) body.sha = sha;
    const res = await githubFetch(path, { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) throw new Error("Write Failed"); 
    return res.json();
}

/**
 * 删除文件内容对象
 * @param {string} path 
 * @param {string} sha 
 */
export async function deleteContent(path, sha) {
    const res = await githubFetch(path, { method: 'DELETE', body: JSON.stringify({ message: 'Delete', sha }) });
    return res.ok;
}

/**
 * 获取全量递归文件树
 * @param {string} [branch='main'] 
 * @returns {Promise<Object|null>}
 */
export async function getRepoTree(branch = 'main') {
    try {
        const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/trees/${branch}?recursive=1&t=${Date.now()}`;
        const res = await fetch(url, { headers: { 'Authorization': `token ${config.token}` } });
        if (!res.ok) return null; 
        return res.json();
    } catch (e) { return null; }
}
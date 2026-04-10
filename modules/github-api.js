import { config } from './config.js';
import { encodeUnicode } from './utils.js';
const API_BASE = 'https://api.github.com';

export async function githubFetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;
    return fetch(url, { ...options, headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json', ...options.headers } });
}

export async function createRepo(name, description, isPrivate) {
    const res = await fetch(`${API_BASE}/user/repos`, {
        method: 'POST',
        headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, private: isPrivate, auto_init: true })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
    return res.json();
}

export async function updateRepo(name, description) {
    const res = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}`, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
    });
    if (!res.ok) throw new Error("更新失败");
    return res.json();
}

export async function forkRepo(owner, repo) {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/forks`, {
        method: 'POST',
        headers: { 'Authorization': `token ${config.token}` }
    });
    if (!res.ok) throw new Error("Fork失败");
    return res.json();
}

export async function deleteRepo(owner, repo) {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}`, {
        method: 'DELETE',
        headers: { 'Authorization': `token ${config.token}` }
    });
    if (res.status !== 204) throw new Error("权限不足");
    return true;
}

export async function getContents(path) {
    const res = await githubFetch(`${path}?t=${Date.now()}`);
    if (!res.ok) throw new Error(); return res.json();
}

export async function getUserRepos() {
    const res = await fetch(`${API_BASE}/user/repos?per_page=100&sort=updated`, {
        headers: { 'Authorization': `token ${config.token}` }
    });
    if (!res.ok) return []; return res.json();
}

export async function putContent(path, content, message, sha = null) {
    const isImg = path.match(/\.(png|jpe?g|webp|gif)$/i);
    const body = { message, content: isImg ? content : encodeUnicode(content) };
    if (sha) body.sha = sha;
    const res = await githubFetch(path, { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) throw new Error(); return res.json();
}

export async function deleteContent(path, sha) {
    await githubFetch(path, { method: 'DELETE', body: JSON.stringify({ message: 'Delete', sha }) });
}

export async function getRepoTree() {
    const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/trees/main?recursive=1&t=${Date.now()}`;
    const res = await fetch(url, { headers: { 'Authorization': `token ${config.token}` } });
    if (!res.ok) return null; return res.json();
}
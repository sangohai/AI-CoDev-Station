import { config } from './config.js';
import { encodeUnicode } from './utils.js';
const API_BASE = 'https://api.github.com';

export async function githubFetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;
    return fetch(url, { ...options, headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json', ...options.headers } });
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
export async function putContent(path, content, message = 'Update', sha = null) {
    const isImg = path.match(/\.(png|jpe?g|webp|gif)$/i);
    const body = { message, content: isImg ? content : encodeUnicode(content) };
    if (sha) body.sha = sha;
    const res = await githubFetch(path, { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) throw new Error(); return res.json();
}
export async function deleteContent(path, sha) {
    const res = await githubFetch(path, { method: 'DELETE', body: JSON.stringify({ message: 'Delete', sha }) });
    return res.ok;
}
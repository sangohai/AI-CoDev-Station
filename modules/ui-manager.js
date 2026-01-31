import { config, state } from './config.js';
import { githubFetch } from './github-api.js';

export async function refreshFileList() {
    const listGroup = document.getElementById('fileListGroup');
    listGroup.innerHTML = '<div class="p-4 text-center small text-muted">...</div>';
    const res = await githubFetch(state.currentFolder ? `${state.currentFolder}?t=${Date.now()}` : `?t=${Date.now()}`);
    const data = await res.json();
    listGroup.innerHTML = '';
    if (Array.isArray(data)) {
        const allowed = /\.(md|json|yaml|yml|txt|js|py|html|css|sh|c|cpp|go|rs|sql)$/i;
        data.filter(f => f.type === 'file' && allowed.test(f.name)).forEach(file => {
            const a = document.createElement('a');
            a.className = `list-group-item list-group-item-action py-2 ${file.path === config.path ? 'active' : ''}`;
            a.setAttribute('data-path', file.path);
            let icon = file.name.endsWith('.json') ? '📦' : (file.name.endsWith('.yaml') || file.name.endsWith('.yml') ? '⚙️' : '📄');
            if(/\.(js|py|html|sh)$/i.test(file.name)) icon = '💻';
            if(file.name === 'manifest.yaml') icon = '💎';
            a.innerHTML = `<span class="text-truncate fw-medium">${icon} ${file.name}</span>`;
            a.onclick = (e) => { e.preventDefault(); window.station.switchFile(file.path, file.name); };
            listGroup.appendChild(a);
        });
    }
}
export function updateTopUI(path, name) {
    document.getElementById('currentFileName').innerText = name || path.split('/').pop() || '未选择文件';
    const isSel = !!path;
    document.getElementById('btnDelete').style.display = (isSel && !state.isReadOnly) ? 'inline-block' : 'none';
    document.getElementById('btnRenameFile').style.display = (isSel && !state.isReadOnly) ? 'inline-block' : 'none';
    document.querySelectorAll('#fileListGroup a').forEach(el => el.classList.toggle('active', el.getAttribute('data-path') === path));
}
export function filterFiles() {
    const kw = document.getElementById('fileSearchInput').value.toLowerCase();
    document.querySelectorAll('#fileListGroup a').forEach(item => {
        item.style.display = item.innerText.toLowerCase().includes(kw) ? 'block' : 'none';
    });
}
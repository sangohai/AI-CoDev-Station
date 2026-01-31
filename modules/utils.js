export function encodeUnicode(s) { return btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1))); }
export function decodeUnicode(s) { 
    try { return decodeURIComponent(atob(s).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')); } 
    catch(e) { return atob(s); } 
}
export const sleep = (ms) => new Promise(res => setTimeout(res, ms));
export function setSaveStatus(s, t) {
    const el = document.getElementById('saveStatus'); if (!el) return;
    el.innerText = t; el.className = 'badge rounded-pill fw-normal small ' + (s==='loading'?'text-bg-warning':s==='success'?'text-bg-success':s==='error'?'text-bg-danger':'text-bg-secondary');
}
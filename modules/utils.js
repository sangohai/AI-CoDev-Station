/**
 * utils.js - 基础工具模块
 * @module Utils
 */

/**
 * 将字符串进行 Unicode 安全的 Base64 编码（支持中文）
 * @param {string} s - 待编码的原始字符串
 * @returns {string} Base64 编码后的字符串
 */
export function encodeUnicode(s) { 
    return btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1))); 
}

/**
 * 将 Base64 字符串解码为 Unicode 字符串（支持中文）
 * @param {string} s - 待解码的 Base64 字符串
 * @returns {string} 解码后的原始字符串
 */
export function decodeUnicode(s) { 
    try { 
        return decodeURIComponent(atob(s).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')); 
    } catch(e) { 
        return atob(s); 
    } 
}

/**
 * 异步延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * 更新界面顶栏的保存状态标识
 * @param {'loading'|'success'|'error'|'unsaved'} s - 状态类型枚举
 * @param {string} t - 状态描述文字
 */
export function setSaveStatus(s, t) {
    const el = document.getElementById('saveStatus'); 
    if (!el) return;
    el.innerText = t; 
    el.className = 'badge rounded-pill fw-normal small ' + 
        (s === 'loading' ? 'text-bg-warning' : 
         s === 'success' ? 'text-bg-success' : 
         s === 'error' ? 'text-bg-danger' : 'text-bg-secondary');
}


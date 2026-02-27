/**
 * emoji.js - 自定义 Emoji 存储与选择器模块
 * @module Emoji
 */

const STORAGE_KEY = 'custom_emojis';
const DEFAULT_EMOJIS = {
    "状态": ["🚀", "✅", "❌", "⏳", "⚠️", "🔥", "🛠️", "💡"],
    "文档": ["📝", "📖", "📜", "📑", "💎", "🔍", "🔖", "📥"]
};

/**
 * 生成 Emoji 选择面板的 HTML 字符串
 * @returns {string}
 */
export function getEmojiPickerHTML() {
    const custom = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const groups = { "自定义": custom, ...DEFAULT_EMOJIS };
    let html = `<div class="p-2 border-bottom bg-body-tertiary"><div class="input-group input-group-sm">
                <input type="text" id="customEmojiInput" class="form-control" placeholder="新表情">
                <button class="btn btn-primary" onclick="window.station.addNewEmoji()">+</button></div></div>
                <div class="emoji-picker-content p-2" style="max-height:250px; overflow-y:auto;">`;
    for (let cat in groups) {
        if (groups[cat].length === 0 && cat === "自定义") continue;
        html += `<div class="mb-2"><small class="text-muted d-block mb-1">${cat}</small><div class="d-flex flex-wrap gap-2">`;
        groups[cat].forEach(e => html += `<span class="emoji-item" onclick="window.station.insertEmoji('${e}')">${e}</span>`);
        html += `</div></div>`;
    }
    return html + '</div>';
}

/**
 * 将新 Emoji 保存到本地自定义库
 * @param {string} char - Emoji 字符
 */
export function addEmoji(char) {
    if (!char.trim()) return;
    let custom = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!custom.includes(char)) { 
        custom.unshift(char); 
        localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)); 
    }
}
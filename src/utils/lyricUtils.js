/**
 * 解析 LRC 歌词文件
 * @param {string} lrcText 
 * @returns {Array<{time: number, text: string}>}
 */
export const parseLyrics = (lrcText) => {
    if (!lrcText) return [];

    const lines = lrcText.split('\n');
    const result = [];
    const timeReg = /\[(\d+):(\d+)\.(\d+)?\]/g;

    lines.forEach(line => {
        const matches = [...line.matchAll(timeReg)];
        // 剥离 LRC 时间标签 [...] 和内嵌精确时间标签 <...>
        const text = line.replace(timeReg, '').replace(/<[^>]+>/g, '').trim();

        if (text) {
            matches.forEach(match => {
                const min = parseInt(match[1]);
                const sec = parseInt(match[2]);
                const ms = parseInt(match[3] || '0');
                const time = min * 60 + sec + ms / 1000;
                result.push({ time, text });
            });
        }
    });

    return result.sort((a, b) => a.time - b.time);
};

/**
 * 解析 LRC 歌词文件
 * @param {string} lrcText 
 * @returns {Array<{time: number, text: string}>}
 */
export const parseLyrics = (lrcText) => {
    if (!lrcText) return [];

    const lines = lrcText.split('\n');
    const result = [];
    // 兼容 [mm:ss]、[mm:ss.x]、[mm:ss.xx]、[mm:ss.xxx]
    const timeReg = /\[(\d+):(\d+)(?:\.(\d+))?\]/g;

    lines.forEach(line => {
        const matches = [...line.matchAll(timeReg)];
        // 剥离 LRC 时间标签 [...] 和内嵌精确时间标签 <...>
        const text = line.replace(timeReg, '').replace(/<[^>]+>/g, '').trim();

        if (text) {
            matches.forEach(match => {
                const min = Number.parseInt(match[1], 10);
                const sec = Number.parseInt(match[2], 10);
                const fraction = match[3];
                const fractionValue = fraction
                    ? Number.parseInt(fraction, 10) / (10 ** fraction.length)
                    : 0;
                const time = min * 60 + sec + fractionValue;
                result.push({ time, text });
            });
        }
    });

    return result.sort((a, b) => a.time - b.time);
};

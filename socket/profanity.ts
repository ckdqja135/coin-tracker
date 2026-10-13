/**
 * 채팅 욕설 필터
 * - 숫자·기호를 끼워 넣거나(시1발, f.u.c.k) 띄어 쓰는(씨 발) 우회를 잡기 위해 정규화한 문자열에서 찾고,
 *   찾은 범위를 원문에서 *로 가린다 (공백은 남긴다).
 * - 띄어쓰기를 지우고 찾으면 "강시 발견"처럼 단어 경계를 넘어 잘못 걸리는 경우가 생기므로,
 *   공백을 지우고도 찾는 단어(STRICT)와 한 단어 안에서만 찾는 단어(LOOSE)를 나눈다.
 * - "시발점"처럼 욕설을 포함하는 정상 단어는 ALLOW로 예외 처리한다.
 */

// 공백을 지워도 찾는다 (오탐 위험이 낮은 단어)
const STRICT = [
    '씨발', '씨빨', '씨바', '씨팔', '시팔', '쓰발', '쓰벌', 'ㅅㅂ', 'ㅆㅂ', 'ㅄ', 'ㅂㅅ',
    '병신', '븅신', '빙신', '좆', '좃같', '개새끼', '개색기', '개색히', '개새기', '개쌔끼',
    '니애미', '니애비', '느금마', '느그애미', '엠창', '지랄', '염병', '썅', '쌍년', '창녀',
    'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'asshole', 'nigger', 'nigga', 'faggot', 'retard',
];

// 한 단어 안에서만 찾는다 (띄어쓰기를 지우면 다른 단어에 걸리기 쉬운 단어)
const LOOSE = ['시발', '시바', '미친놈', '미친년', '새끼', '새기', '존나', '졸라', 'ㅈㄴ', 'ㅈㄹ', '애미', '애비', '씹'];

// 욕설을 포함하지만 정상인 단어
const ALLOW = ['시발점', '시발역', '시바견', '씹어', '씹고', '씹는', '씹다', '씹을'];

const LETTER = /[a-z가-힣ㄱ-ㅎㅏ-ㅣ]/;

/** 글자(한글·자모·영문)만 남기고, 남은 글자의 원문 위치를 함께 돌려준다 */
const normalize = (chars: string[], keepSpace: boolean) => {
    let norm = '';
    const map: number[] = [];
    chars.forEach((c, i) => {
        const lc = c.toLowerCase();
        if (LETTER.test(lc) || (keepSpace && /\s/.test(lc))) {
            norm += lc;
            map.push(i);
        }
    });
    return { norm, map };
};

const findAll = (hay: string, needle: string) => {
    const out: number[] = [];
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
    return out;
};

/** 가려야 할 원문 글자 위치 */
const badPositions = (text: string): Set<number> => {
    const chars = Array.from(text);
    const bad = new Set<number>();
    const tight = normalize(chars, false);
    const spaced = normalize(chars, true);

    // 예외 단어에 속한 원문 위치는 가리지 않는다
    const allowed = new Set<number>();
    ALLOW.forEach(w => findAll(tight.norm, w).forEach(s => {
        for (let k = s; k < s + w.length; k++) allowed.add(tight.map[k]);
    }));

    // 원문을 공백으로 나눈 조각 번호와, 조각마다 첫/마지막 글자 위치
    const token: number[] = [];
    const first: number[] = [];
    const last: number[] = [];
    let tk = 0;
    chars.forEach((c, i) => {
        if (/\s/.test(c)) { if (first[tk] != null) tk++; token.push(-1); return; }
        token.push(tk);
        if (LETTER.test(c.toLowerCase())) { if (first[tk] == null) first[tk] = i; last[tk] = i; }
    });

    const mark = (n: { norm: string; map: number[] }, words: string[]) => words.forEach(w => findAll(n.norm, w).forEach(s => {
        const pos = n.map.slice(s, s + w.length);
        if (pos.some(p => allowed.has(p))) return;
        // 띄어쓰기를 넘는 일치는 걸친 조각을 통째로 쓴 경우("씨 발")만 인정한다 ("병 신약"은 제외)
        const a = token[pos[0]];
        const b = token[pos[pos.length - 1]];
        if (a !== b && (first[a] !== pos[0] || last[b] !== pos[pos.length - 1])) return;
        // 사이에 끼운 숫자·기호까지 함께 가린다 (시1발 -> ***), 공백은 그대로 둔다
        for (let p = pos[0]; p <= pos[pos.length - 1]; p++) if (!/\s/.test(chars[p])) bad.add(p);
    }));
    mark(tight, STRICT);
    mark(spaced, STRICT);
    mark(spaced, LOOSE);
    return bad;
};

/** 욕설 글자를 *로 바꾼다 */
export const maskProfanity = (text: string): { text: string; masked: boolean } => {
    const bad = badPositions(text);
    if (!bad.size) return { text, masked: false };
    return { text: Array.from(text).map((c, i) => (bad.has(i) ? '*' : c)).join(''), masked: true };
};

export const hasProfanity = (text: string) => badPositions(text).size > 0;

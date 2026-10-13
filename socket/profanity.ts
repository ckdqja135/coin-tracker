/**
 * 채팅 욕설 필터
 * - 입력을 NFKC로 정규화해 분해된 한글(NFD)·전각 문자(ｆｕｃｋ) 우회를 막는다 (자모는 호환용 자모로 되돌린다).
 * - 숫자·기호를 끼워 넣거나(시1발, f.u.c.k) 띄어 쓰는(씨 발) 우회를 잡기 위해 글자만 남긴 문자열에서 찾고,
 *   찾은 범위를 *로 가린다 (공백은 남긴다).
 * - 정상 단어 오탐을 줄이는 규칙
 *   · LOOSE 단어는 한 단어(공백 사이) 안에서만 찾는다.
 *   · START 단어는 단어 첫머리에서 시작할 때만 찾는다 ("아저씨바빠요"의 씨바 제외).
 *   · 띄어쓰기를 넘는 일치(STRICT만)는 앞 조각들이 한 글자씩 끊긴 경우("씨 발", "ㅅ ㅂ")만 인정하고,
 *     마지막 조각에 남는 글자는 욕설에 흔히 붙는 말("놈", "아" 등)일 때만 인정한다 ("병 신약"은 제외, "씨 발놈아"는 포함).
 *   · ALLOW 단어(시발점, 새끼손가락, scunthorpe 등)에 속한 글자는 가리지 않는다. ALLOW는 한 단어 안에서만 찾는다.
 */

// 띄어쓰기를 넘어서도 찾는다
const STRICT = [
    '씨발', '씨빨', '시팔', '쓰발', '쓰벌', 'ㅅㅂ', 'ㅆㅂ', 'ㅄ', 'ㅂㅅ',
    '병신', '븅신', '빙신', '좆', '좃같', '개새끼', '개색기', '개색히', '개새기', '개쌔끼',
    '니애미', '니애비', '느금마', '느그애미', '엠창', '지랄', '염병', '썅', '쌍년', '창녀',
    'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'nigger', 'nigga', 'faggot', 'retard',
];

// 한 단어 안에서만 찾는다
const LOOSE = ['시발', '미친놈', '미친년', '새끼', '존나', 'ㅈㄴ', 'ㅈㄹ', '애미', '애비', '씹'];

// 한 단어 안에서, 단어 첫머리에서 시작할 때만 찾는다 (앞말에 붙어 다른 뜻이 되기 쉬운 단어)
const START = ['씨바', '시바', '씨팔'];

// 욕설을 포함하지만 정상인 단어
const ALLOW = [
    '시발점', '시발역', '시바견', '시바이누', '시바코인', '시바토큰',
    '씹어', '씹고', '씹는', '씹다', '씹을', '씹었',
    '새끼손가락', '새끼발가락', '새끼손', '새끼발', '새끼줄', '애비뉴', '애미뉴',
    'scunthorpe', 'retardant', 'retardation',
];

// 띄어 쓴 욕설 뒤에 흔히 붙는 말 ("씨 발놈아", "병 신이네")
const SUFFIX = /^(놈|년|새끼|새기|같|아|야|이|들|련|롬|은|는|을|를|임|하|해|ㄴ|ㅋ|ㅎ)/;

const LETTER = /[a-z가-힣ㄱ-ㅎㅏ-ㅣ]/;

// NFKC는 호환용 자모(ㅅ U+3145, ㅄ U+3144 등)를 조합용 자모(ᄉ, ᄡ)로 바꾸므로,
// 호환용 자모 전체(U+3131–318E)의 NFKC 결과로 역변환 표를 만들어 되돌린다
const COMPAT_JAMO = new Map<string, string>();
for (let n = 0x3131; n <= 0x318e; n++) {
    const c = String.fromCharCode(n);
    const k = c.normalize('NFKC');
    if (k !== c && Array.from(k).length === 1 && !COMPAT_JAMO.has(k)) COMPAT_JAMO.set(k, c);
}
const toCompatJamo = (c: string) => COMPAT_JAMO.get(c) ?? c;

/** NFKC로 정규화(전각 문자·분해된 한글을 일반 문자로)하고, 자모는 호환용 자모로 맞춘다 */
export const normalizeText = (s: string) => Array.from(s.normalize('NFKC'), toCompatJamo).join('');
const isLetter = (c: string) => [...c.toLowerCase()].some(ch => LETTER.test(ch));

interface Normalized { norm: string; map: number[] }

/**
 * 글자(한글·자모·영문)만 남기고, 남은 글자마다 원문 위치를 기록한다.
 * 소문자로 바꾸면 길어지는 문자(İ -> i̇)가 있어, 소문자로 바꾼 뒤 글자 단위로 다시 거른다.
 */
const normalize = (chars: string[], keepSpace: boolean): Normalized => {
    let norm = '';
    const map: number[] = [];
    chars.forEach((c, i) => {
        if (/\s/.test(c)) {
            if (keepSpace) { norm += ' '; map.push(i); }
            return;
        }
        for (const ch of c.toLowerCase()) {
            if (LETTER.test(ch)) { norm += ch; map.push(i); }
        }
    });
    return { norm, map };
};

const findAll = (hay: string, needle: string) => {
    const out: number[] = [];
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
    return out;
};

/** 가려야 할 글자 위치 (chars는 NFKC로 정규화한 문자열의 글자 배열) */
const badPositions = (chars: string[]): Set<number> => {
    const bad = new Set<number>();
    const tight = normalize(chars, false);
    const spaced = normalize(chars, true);

    // 공백으로 나눈 조각 번호와, 조각마다 첫/마지막 글자 위치
    const token: number[] = [];
    const first: number[] = [];
    const last: number[] = [];
    let tk = -1;
    let inToken = false;
    chars.forEach((c, i) => {
        if (/\s/.test(c)) { inToken = false; token.push(-1); return; }
        if (!inToken) { tk++; inToken = true; }
        token.push(tk);
        if (isLetter(c)) {
            if (first[tk] == null) first[tk] = i;
            last[tk] = i;
        }
    });

    // 예외 단어는 한 단어 안에서만 찾는다 ("개씹 어"가 "씹어"로 붙지 않도록)
    const allowed = new Set<number>();
    ALLOW.forEach(w => findAll(spaced.norm, w).forEach(s => {
        for (let k = s; k < s + w.length; k++) allowed.add(spaced.map[k]);
    }));

    // 사이에 끼운 숫자·기호까지 함께 가린다 (시1발 -> ***), 공백은 그대로 둔다
    const cover = (pos: number[]) => {
        for (let p = pos[0]; p <= pos[pos.length - 1]; p++) if (!/\s/.test(chars[p])) bad.add(p);
    };

    // 한 단어 안 일치
    const within = (words: string[], atStart: boolean) => words.forEach(w => findAll(spaced.norm, w).forEach(s => {
        const pos = spaced.map.slice(s, s + w.length);
        if (pos.some(p => allowed.has(p))) return;
        if (atStart && first[token[pos[0]]] !== pos[0]) return;
        cover(pos);
    }));
    within(STRICT, false);
    within(LOOSE, false);
    within(START, true);

    // 띄어쓰기를 넘는 일치 (STRICT만)
    STRICT.forEach(w => findAll(tight.norm, w).forEach(s => {
        const pos = tight.map.slice(s, s + w.length);
        const a = token[pos[0]];
        const b = token[pos[pos.length - 1]];
        if (a === b || pos.some(p => allowed.has(p))) return;
        // 앞 조각들은 한 글자짜리로 끊겨 있어야 한다 ("씨 발", "ㅅ ㅂ")
        for (let t = a; t < b; t++) if (first[t] !== last[t]) return;
        // 마지막 조각에 남는 글자는 흔한 욕설 꼬리말일 때만 인정한다
        const rest = chars.slice(pos[pos.length - 1] + 1, last[b] + 1).filter(isLetter).join('').toLowerCase();
        if (rest && !SUFFIX.test(rest)) return;
        cover(pos);
    }));
    return bad;
};

/** 욕설 글자를 *로 바꾼다 (normalizeText로 정규화한 문자열을 돌려준다) */
export const maskProfanity = (input: string): { text: string; masked: boolean } => {
    const chars = Array.from(normalizeText(input));
    const bad = badPositions(chars);
    return { text: chars.map((c, i) => (bad.has(i) ? '*' : c)).join(''), masked: bad.size > 0 };
};

export const hasProfanity = (input: string) => badPositions(Array.from(normalizeText(input))).size > 0;

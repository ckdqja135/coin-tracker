import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasProfanity, maskProfanity, normalizeText } from './profanity';

const mask = (s: string) => maskProfanity(s).text;

describe('maskProfanity: 욕설을 가린다', () => {
    const cases: [string, string][] = [
        ['씨발 또 떨어지네', '** 또 떨어지네'],
        ['시1발 뭐야', '*** 뭐야'],
        ['병.신', '***'],
        ['F.U.C.K this', '******* this'],
        ['ㅅㅂ', '**'],
        ['개새끼들', '***들'],
        ['존나 오른다', '** 오른다'],
        ['이 새끼 뭐냐', '이 ** 뭐냐'],
        ['Shit coin', '**** coin'],
        ['시바 뭐야', '** 뭐야'],
        // 띄어 쓴 우회
        ['씨 발', '* *'],
        ['ㅅ ㅂ', '* *'],
        ['씨 발놈아', '* *놈아'],
        ['병 신이네', '* *이네'],
        // 예외 단어를 띄어쓰기 너머로 붙여도 가린다
        ['개씹 어', '개* 어'],
        ['씨발점', '**점'],
    ];
    cases.forEach(([input, expected]) => it(input, () => assert.equal(mask(input), expected)));

    it('분해된 한글(NFD)과 전각 문자도 가린다', () => {
        assert.equal(maskProfanity('씨발'.normalize('NFD')).masked, true);
        assert.equal(mask('ｆｕｃｋ'), '****');
    });

    it('소문자로 바꾸면 길어지는 문자가 앞에 있어도 위치가 어긋나지 않는다', () => {
        assert.equal(mask('İfuck'), 'İ****');
    });
});

describe('maskProfanity: 정상 문장은 그대로 둔다', () => {
    [
        '시발점이 어디야', '강시 발견', '껌 씹는 중', '비트 시바견 코인', '시바이누 간다', '오늘 비트 좋네요',
        '미친 상승', 'shiba inu', '병 신약 개발', '아저씨바빠요', 'Fukuoka 여행', 'Scunthorpe', 'fire retardant',
        '새끼손가락', '애비뉴', '되새기다', '졸라맨', 'this hit me',
    ].forEach(input => it(input, () => assert.deepEqual(maskProfanity(input), { text: input, masked: false })));
});

describe('hasProfanity', () => {
    it('닉네임 검사', () => {
        assert.equal(hasProfanity('병신123'), true);
        assert.equal(hasProfanity('시바이누홀더'), false);
        assert.equal(hasProfanity('비트홀더'), false);
    });
});

describe('normalizeText', () => {
    it('초성·모음은 호환용 자모로 남는다 (ㅋㅋ, ㅠㅠ가 다른 문자로 바뀌지 않는다)', () => {
        assert.equal(normalizeText('ㅋㅋㅋ ㅠㅠ ㅄ'), 'ㅋㅋㅋ ㅠㅠ ㅄ');
    });
    it('분해된 한글과 전각 문자는 일반 문자로 바뀐다', () => {
        assert.equal(normalizeText('비트'.normalize('NFD')), '비트');
        assert.equal(normalizeText('ＢＴＣ'), 'BTC');
    });
});

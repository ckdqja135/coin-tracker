import fs from 'fs';
import path from 'path';
import axios from 'axios';
import logger from '../log/logger';

/**
 * BTC 도미넌스 기록기
 * 무료로 받을 수 있는 공개 API에는 전체 코인 시가총액의 과거 이력이 없어서(CoinGecko는 유료)
 * 도미넌스 추이를 직접 쌓는다. 서버가 켜져 있는 동안 10분마다 현재 값을 파일에 기록한다.
 */

export interface DominancePoint { t: number; v: number }

const FILE = path.join(__dirname, '..', 'data', 'btc-dominance.json');
const INTERVAL_MS = 10 * 60_000;
const KEEP_MS = 2 * 365 * 86_400_000; // 최대 2년치

let points: DominancePoint[] = [];

const load = () => {
    try {
        if (fs.existsSync(FILE)) points = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (err: any) {
        logger.error(`[dominance] failed to load ${FILE}: ${err.message}`);
        points = [];
    }
};

const save = () => {
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(points));
    } catch (err: any) {
        logger.error(`[dominance] failed to save: ${err.message}`);
    }
};

const sample = async () => {
    try {
        const { data } = await axios.get('https://api.coingecko.com/api/v3/global', { timeout: 10_000 });
        const v = data?.data?.market_cap_percentage?.btc;
        if (typeof v !== 'number') return;
        const t = Math.floor(Date.now() / INTERVAL_MS) * INTERVAL_MS;
        if (points.length && points[points.length - 1].t === t) points[points.length - 1].v = v;
        else points.push({ t, v });
        const cutoff = Date.now() - KEEP_MS;
        while (points.length && points[0].t < cutoff) points.shift();
        save();
    } catch (err: any) {
        logger.warn(`[dominance] sample failed: ${err.message}`);
    }
};

let started = false;
export const startDominanceRecorder = () => {
    if (started) return;
    started = true;
    load();
    sample();
    setInterval(sample, INTERVAL_MS);
};

/** since 이후 기록을 bucketMs 단위로 묶어(구간의 마지막 값) 돌려준다 */
export const getDominance = (since: number, bucketMs: number): DominancePoint[] => {
    const out: DominancePoint[] = [];
    for (const p of points) {
        if (p.t < since) continue;
        const t = Math.floor(p.t / bucketMs) * bucketMs;
        const last = out[out.length - 1];
        if (last && last.t === t) last.v = p.v; else out.push({ t, v: p.v });
    }
    return out;
};

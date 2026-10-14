import { useEffect, useState } from 'react';

/**
 * deps가 바뀔 때마다 loader를 호출하고, 이전 요청 결과는 버린다.
 * refreshMs를 주면 주기적으로 다시 불러온다 (로딩 표시 없이 조용히 갱신).
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[], refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const run = (initial: boolean) => {
      if (initial) setLoading(true);
      loader()
        .then(d => { if (alive) { setData(d); setError(null); } })
        .catch(e => { if (alive) setError(e?.response?.data?.error || e.message || 'Error'); })
        .finally(() => { if (alive && initial) setLoading(false); });
    };
    run(true);
    const timer = refreshMs ? setInterval(() => run(false), refreshMs) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}

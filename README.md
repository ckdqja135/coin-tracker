# Coin Tracker


## 시작하기

### 사전 요구 사항
- Node.js
- MariaDB

### 설치

1. 리포지토리를 클론합니다:
    ```sh
    git clone https://github.com/ckdqja135/coin-tracker.git
    cd coin-tracker
    ```

2. 종속성을 설치합니다:
    ```sh
    npm i
    ```

3. `config/config.json` 파일에서 데이터베이스 구성을 설정합니다.

4. 데이터베이스 마이그레이션을 실행합니다:
    ```sh
    npx sequelize-cli db:migrate
    ```

5. 서버를 시작합니다:
    ```sh
    npm run dev
    ```

## 시장 분석 웹 (coin-tracker-web)

외부 거래소 공개 API(Binance, Upbit, Bithumb, Bybit, OKX, Yahoo Finance)를 사용하며 DB 없이도 동작합니다.

```sh
npm run dev                                  # API 서버 (3000)
cd coin-tracker-web && PORT=3001 npm start   # 웹 (3001, /api는 3000으로 프록시)
```

| 경로 | 기능 |
| --- | --- |
| `/` | 임펄스 모니터: 코인 가격 + 미결제약정/롱숏비율/펀딩비/김치프리미엄 오버레이 |
| `/compare` | 최대 6개 자산 비교 (선형/로그/%, 이동평균, CSV, 캡처, 내 차트 저장) |
| `/btc`, `/eth` | 코인 요약 지표 + 캔들 차트 + 파생 지표 |
| `/markets` | 암호화폐·지수·원자재·환율 캔들 차트 |
| `/longs-shorts` | 거래소별 롱/숏 비율, 실시간 대규모 체결·청산 |
| `/correlation` | 자산 간 상관계수, 삼각 히트맵 |
| `/live` | 기존 소켓 기반 실시간 대시보드 (MariaDB 필요) |

API: `/api/market/{klines,metric,longshort,premium,snapshot}`

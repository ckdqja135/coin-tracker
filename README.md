# Coin Tracker

A personal project that collects public market data from Korean and international exchanges and shows it as charts. It works without accounts or a database (DB), and all data is for reference only.

## Main pages

| Path | Features |
| --- | --- |
| `/` | USD/KRW · Tether premium · Fear & Greed strip, coin search → exchange chart, per-exchange listing/premium table, arbitrage calculator, kimchi premium alerts (browser notifications while the page is open), **Coin Impulse Monitor (CIM)** (1-minute % change from the 09:00 KST open, resets daily at 09:00) |
| `/btc`, `/eth` | BTC·ETH comparison cards against other assets (OI by exchange, Upbit kimchi premium, indices, commodities, mining data, Fear & Greed, BTC dominance) |
| `/markets` | Card charts for crypto, indices, and commodities |
| `/compare` | Compare multiple items on one chart (moving average, linear/log/%, date range, capture, CSV, save to My Charts) |
| `/longs-shorts` | Per-exchange (Binance·Bybit·OKX·Bitget) taker buy/sell gauge, account long/short ratio, live large trades, liquidations (Binance·Bybit·OKX) |
| `/notices` | Upbit·Bithumb announcements with listing / delisting / caution tags |
| `/correlation` | Correlation coefficients between assets, triangle heatmap |
| `/blog`, `/calendar`, `/about`, `/policy` | Blog, economic calendar (TradingView), about·contact, privacy policy |

An anonymous live chat (bottom right) is available on every page.

Supports Korean/English, light (Toss style)/dark themes, and mobile layouts.

## Layout

```
index.ts                  Express API server (+ serves the web build in deployment)
service/marketService.ts  Exchange/data-provider API calls, caching, data normalization
service/tradeAggregator.ts  Real-time trade aggregation for the Longs/Shorts page (in memory)
service/liquidationAggregator.ts  Real-time liquidation aggregation for the Longs/Shorts page (in memory)
service/chatService.ts    Anonymous live chat over plain HTTP (GET/POST /api/chat, last 50 messages in memory)
service/dominanceRecorder.ts  Records BTC dominance every 10 minutes (data/btc-dominance.json)
coin-tracker-web/         React (CRA) + MUI + Highcharts frontend
python-analysis-server/   Separate analysis server (FastAPI)
```

## Development

Requirements: Node.js 22 or later (the server uses the built-in WebSocket)

```sh
npm i
npm --prefix coin-tracker-web i

npm run dev                                  # API server (http://localhost:3000)
cd coin-tracker-web && PORT=3001 npm start   # Web (http://localhost:3001, /api proxies to 3000)
```

Tests (frontend):

```sh
cd coin-tracker-web && CI=true npx react-scripts test --watchAll=false
```

## Deployment (single server)

If the web build exists, the API server serves the pages too, so you only need to run one server.

```sh
npm run build:web     # creates coin-tracker-web/build
PORT=3000 npm start   # pages + /api/* on one server
```

- All paths except `/api/*` return `index.html` (React Router handles routing).
- The Longs/Shorts aggregation and BTC dominance records **only accumulate while the server is running**. On restart the Longs/Shorts aggregation starts over; dominance records stay in the file and continue.
- Live chat uses plain HTTP requests to `/api/chat` (the page polls every few seconds), so it works wherever `/api/*` reaches the server, including a frontend on Vercel (HTTPS) that rewrites `/api/*` to an HTTP backend. No WebSocket is needed.
- The Longs/Shorts liquidation totals and chat history also live in memory and reset on restart.
- The `data/` folder (dominance records) is not committed to git. On the deployment server, keep it on persistent storage.

### Environment variables

| Name | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Server port |
| `ENABLE_DB_COLLECTOR` | `false` | Turns on the old collector that polls Binance every second and stores to the DB (not used by current pages) |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | `localhost` / `3306` / … | MariaDB connection. The site works without a DB connection (only `/api/coin/*` history is unavailable) |

## Data sources and caveats

| Data | Source |
| --- | --- |
| KRW price·candles | Upbit, Bithumb, Coinone, Korbit |
| USDT price·candles | Binance, Gate |
| Open interest, account long/short ratio, funding rate | Binance Futures, Bybit, OKX, Bitget |
| Live trades | Binance·Bybit·OKX·Bitget WebSocket (server aggregation + direct browser connection) |
| Indices, commodities, USD/KRW rate | Yahoo Finance chart API |
| Market cap, BTC dominance, coin images | CoinGecko |
| Fear & Greed / hash rate·difficulty | alternative.me / mempool.space |
| Home chart, economic calendar | TradingView embed widgets |

- All are public APIs that need no key. If an external call fails (including rate limits), the server returns **the last successful value from within the past 6 hours** and does not call that API again for 15 seconds.
- **Yahoo Finance** is not an official public API and may be blocked without notice.
- **CoinGecko** free API has a call limit. One server sharing its cache is fine, but if there are many servers or the cache time is shortened, check the limit.
- **TradingView** charts may sometimes look empty on `localhost`, so check them on the real domain after deployment.
- Terms (including commercial use) differ by exchange·data provider, so check each provider's terms before running this as a service.

## Market data API

| Endpoint | Description |
| --- | --- |
| `GET /api/market/klines` | Candles (`source`, `symbol`, `interval`, `limit` or `since`) |
| `GET /api/market/tickers` | Full prices per exchange (`exchange`, `coins`) |
| `GET /api/market/series` | Secondary series (OI per exchange, Fear & Greed, hash rate, difficulty, BTC dominance) |
| `GET /api/market/longshort` | Account long/short ratio (`exchange`, `coin`, `period`) |
| `GET /api/market/flow` | Server-aggregated taker buy/sell totals per period + recent large trades (`coin`) |
| `GET /api/market/overview` | Index strip (S&P 500, US 100, dollar index, crypto market cap, BTC dominance) |
| `GET /api/market/coininfo`, `/coins`, `/snapshot`, `/metric`, `/premium` | Coin summary, search list, summary indicators, futures metrics, kimchi premium |

## (Optional) DB history API

The old `/api/coin/*` history API uses MariaDB. If you need it, set the environment variables above and run it with `ENABLE_DB_COLLECTOR=true`.

```sh
npx sequelize-cli db:migrate
ENABLE_DB_COLLECTOR=true npm run dev
```

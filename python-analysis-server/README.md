# 🐍 Crypto Analysis Server (Python)

현재 Node.js 기반 암호화폐 트래커의 **고급 분석 기능**을 제공하는 파이썬 서버입니다.

## 🚀 주요 기능

### 📊 고급 기술적 분석
- **20+ 기술적 지표**: RSI, MACD, 볼린저 밴드, ADX, ATR, 스토캐스틱 등
- **지지/저항선 자동 감지**: 차트 패턴 분석
- **트렌드 분석**: 상승/하락/횡보 트렌드 자동 판정
- **종합 스코어**: 0-100점 매매 신호 점수

### 🔔 스마트 알림 시스템
- **가격 목표 알림**: 지정한 가격 도달시 알림
- **급등/급락 감지**: 단기간 큰 변화 감지
- **높은 변동성 알림**: 변동성 스파이크 감지
- **이상 패턴 탐지**: Z-score 기반 이상치 감지

### 📈 실시간 분석
- **WebSocket 스트리밍**: 실시간 분석 결과 전송
- **빠른 분석**: 1초 이내 기본 지표 계산
- **시장 개요**: 전체 시장 상황 요약

### 🤖 향후 확장 계획
- **AI 가격 예측**: LSTM/GRU 기반 가격 예측
- **백테스팅**: 거래 전략 성능 테스트
- **포트폴리오 최적화**: 리스크 관리 및 자산 배분

## 🛠️ 설치 및 실행

### 1. 의존성 설치
```bash
cd python-analysis-server
pip install -r requirements.txt
```

### 2. 환경 변수 설정
```bash
# .env 파일 생성
cp .env.example .env

# 데이터베이스 설정 (Node.js와 동일)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=123456
DB_DATABASE=test
```

### 3. 서버 실행
```bash
python main.py
```

서버가 http://localhost:8000 에서 실행됩니다.

## 📡 API 엔드포인트

### 기본 정보
- `GET /` - 서버 상태 확인
- `GET /health` - 헬스체크

### 기술적 분석
- `GET /analysis/{symbol}?timeframe=1h` - 종합 기술적 분석
- `GET /indicators/{symbol}?timeframe=1h` - 기술적 지표들
- `GET /market-overview` - 시장 전체 개요

### 실시간 연결
- `WebSocket /ws/analysis` - 실시간 분석 스트리밍

### 예시 요청
```javascript
// 기술적 분석 조회
fetch('http://localhost:8000/analysis/BTCUSDT?timeframe=1h')
  .then(res => res.json())
  .then(data => console.log(data));

// WebSocket 연결
const ws = new WebSocket('ws://localhost:8000/ws/analysis');
ws.send(JSON.stringify({
  type: 'subscribe',
  symbol: 'BTCUSDT'
}));
```

## 📋 응답 예시

### 기술적 분석 응답
```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "analysis": {
    "indicators": {
      "rsi": 65.5,
      "rsi_signal": "neutral",
      "macd": {
        "macd": 120.5,
        "signal": 115.2,
        "histogram": 5.3,
        "signal_interpretation": "bullish"
      },
      "bollinger_bands": {
        "upper": 108500,
        "middle": 107200,
        "lower": 105900,
        "position": "upper_half"
      }
    },
    "trend": {
      "direction": "bullish",
      "strength": "strong"
    },
    "support_resistance": {
      "support": [106500, 105800, 104900],
      "resistance": [108800, 109500, 110200]
    },
    "overall_score": {
      "score": 72,
      "interpretation": "strong_buy"
    },
    "last_price": 107288.39
  }
}
```

## 🔗 Node.js 백엔드와의 연동

이 파이썬 서버는 기존 Node.js 백엔드와 **동일한 데이터베이스**를 사용합니다:

1. **데이터 소스**: Node.js가 수집한 OHLC 데이터 활용
2. **테이블 공유**: `coin`, `tb_5min`, `tb_hour`, `tb_day`, `tb_month`
3. **실시간 연동**: Node.js 소켓 데이터를 분석에 활용

## 🎯 React 프론트엔드 통합

### WebSocket 연결 예시
```javascript
// React 컴포넌트에서 사용
const useAnalysisData = (symbol) => {
  const [analysisData, setAnalysisData] = useState(null);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/analysis');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        symbol: symbol
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'analysis_update') {
        setAnalysisData(data.data);
      }
    };
    
    return () => ws.close();
  }, [symbol]);
  
  return analysisData;
};
```

## 📊 성능 특징

- **빠른 분석**: 기본 지표 계산 < 100ms
- **메모리 효율**: 최근 100개 데이터만 캐싱
- **확장 가능**: 비동기 처리로 다중 심볼 지원
- **안정성**: 예외 처리 및 에러 복구

## 🔧 개발 환경

- **Python**: 3.8+
- **FastAPI**: 고성능 비동기 웹 프레임워크
- **Pandas**: 데이터 처리
- **TA-Lib**: 기술적 분석 라이브러리
- **SQLAlchemy**: 데이터베이스 ORM
- **WebSocket**: 실시간 통신

## 📈 향후 로드맵

### Phase 1 (현재)
- ✅ 기술적 분석 엔진
- ✅ 실시간 알림 시스템
- ✅ WebSocket API

### Phase 2 (다음 단계)
- 🔄 AI 가격 예측 모델
- 🔄 백테스팅 시스템
- 🔄 리스크 관리 도구

### Phase 3 (미래)
- ⏳ 자동매매 시뮬레이션
- ⏳ 포트폴리오 최적화
- ⏳ 시장 심리 분석

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 라이선스

MIT License - 자유롭게 사용 가능합니다.

---

**💡 팁**: 이 서버는 기존 Node.js 백엔드를 **보완**하는 역할입니다. 두 서버를 함께 실행하여 최고의 성능을 경험하세요! 
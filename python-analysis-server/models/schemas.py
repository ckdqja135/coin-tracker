from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class CoinData(BaseModel):
    """코인 데이터 모델"""
    id: int
    coin_id: str
    open: float
    high: float
    low: float
    close: float
    timestamp: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class TechnicalIndicator(BaseModel):
    """기술적 지표 모델"""
    name: str
    value: float
    signal: Optional[str] = None
    interpretation: Optional[str] = None

class AnalysisResult(BaseModel):
    """분석 결과 모델"""
    symbol: str
    timeframe: str
    indicators: Dict[str, Any]
    trend: Dict[str, Any]
    support_resistance: Dict[str, List[float]]
    signals: Dict[str, str]
    overall_score: Dict[str, Any]
    last_price: float
    change_24h: float
    analysis_time: str

class AlertConfig(BaseModel):
    """알림 설정 모델"""
    symbol: str
    target_high: Optional[float] = None
    target_low: Optional[float] = None
    volatility_threshold: Optional[float] = 5.0
    enabled: bool = True

class Alert(BaseModel):
    """알림 모델"""
    type: str
    symbol: str
    message: str
    severity: str  # 'low', 'medium', 'high'
    timestamp: str
    data: Optional[Dict[str, Any]] = None

class MarketOverview(BaseModel):
    """시장 개요 모델"""
    active_symbols: int
    total_volume: Optional[float] = None
    market_trend: Optional[str] = None
    top_gainers: List[Dict[str, Any]] = []
    top_losers: List[Dict[str, Any]] = []
    timestamp: str

class PredictionRequest(BaseModel):
    """예측 요청 모델"""
    symbol: str
    timeframe: str = "1h"
    prediction_horizon: int = 24  # 예측 시간 (시간 단위)
    confidence_level: float = 0.95

class PredictionResult(BaseModel):
    """예측 결과 모델"""
    symbol: str
    current_price: float
    predicted_prices: List[Dict[str, Any]]  # [{'timestamp': '', 'price': 0.0, 'confidence': 0.0}]
    trend_direction: str  # 'up', 'down', 'sideways'
    confidence_score: float
    model_used: str
    prediction_time: str

class BacktestConfig(BaseModel):
    """백테스팅 설정 모델"""
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float = 10000.0
    strategy_type: str  # 'sma_crossover', 'rsi_mean_reversion', 'macd_signal'
    parameters: Dict[str, Any] = {}

class BacktestResult(BaseModel):
    """백테스팅 결과 모델"""
    symbol: str
    strategy_type: str
    start_date: str
    end_date: str
    initial_capital: float
    final_capital: float
    total_return: float
    total_return_pct: float
    max_drawdown: float
    sharpe_ratio: float
    win_rate: float
    total_trades: int
    trades: List[Dict[str, Any]]
    performance_chart: Optional[List[Dict[str, Any]]] = None

class WebSocketMessage(BaseModel):
    """웹소켓 메시지 모델"""
    type: str
    symbol: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

class PortfolioConfig(BaseModel):
    """포트폴리오 설정 모델"""
    symbols: List[str]
    weights: List[float]  # 가중치 (합이 1.0이어야 함)
    rebalance_frequency: str = "weekly"  # 'daily', 'weekly', 'monthly'
    risk_tolerance: str = "medium"  # 'low', 'medium', 'high'

class RiskMetrics(BaseModel):
    """리스크 지표 모델"""
    symbol: str
    var_95: float  # 95% VaR
    var_99: float  # 99% VaR
    expected_shortfall: float
    volatility: float
    sharpe_ratio: Optional[float] = None
    max_drawdown: float
    beta: Optional[float] = None
    calculation_date: str

class CorrelationMatrix(BaseModel):
    """상관관계 매트릭스 모델"""
    symbols: List[str]
    matrix: List[List[float]]
    timeframe: str
    calculation_date: str

# API 응답 모델들
class APIResponse(BaseModel):
    """기본 API 응답 모델"""
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None
    timestamp: str = datetime.now().isoformat()

class AnalysisResponse(APIResponse):
    """분석 API 응답 모델"""
    data: Optional[AnalysisResult] = None

class AlertResponse(APIResponse):
    """알림 API 응답 모델"""
    data: Optional[List[Alert]] = None

class PredictionResponse(APIResponse):
    """예측 API 응답 모델"""
    data: Optional[PredictionResult] = None

class BacktestResponse(APIResponse):
    """백테스팅 API 응답 모델"""
    data: Optional[BacktestResult] = None

# 실시간 데이터 모델들
class RealtimePrice(BaseModel):
    """실시간 가격 모델"""
    symbol: str
    price: float
    volume: Optional[float] = None
    change_24h: Optional[float] = None
    timestamp: str

class RealtimeAnalysis(BaseModel):
    """실시간 분석 모델"""
    symbol: str
    price: float
    trend: str
    momentum: float
    volatility: float
    rsi: Optional[float] = None
    volume_spike: bool = False
    timestamp: str

# 설정 모델들
class UserPreferences(BaseModel):
    """사용자 설정 모델"""
    user_id: str
    watched_symbols: List[str] = []
    alert_configs: List[AlertConfig] = []
    notification_methods: List[str] = ["websocket"]  # 'websocket', 'email', 'sms'
    timezone: str = "UTC"
    updated_at: str = datetime.now().isoformat()

class SystemStatus(BaseModel):
    """시스템 상태 모델"""
    status: str  # 'healthy', 'degraded', 'down'
    uptime: str
    active_connections: int
    monitored_symbols: int
    last_data_update: str
    services: Dict[str, str]  # 각 서비스별 상태
    timestamp: str 
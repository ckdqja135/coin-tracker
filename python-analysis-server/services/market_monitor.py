import asyncio
import numpy as np
from typing import Dict, List, Any, Callable
from datetime import datetime, timedelta
import json

class MarketMonitorService:
    """시장 모니터링 및 알림 서비스"""
    
    def __init__(self):
        self.alert_handlers: List[Callable] = []
        self.monitoring_symbols = set()
        self.price_history = {}  # 가격 히스토리 캐시
        self.alert_configs = {}  # 알림 설정
        
    def add_alert_handler(self, handler: Callable):
        """알림 핸들러 추가"""
        self.alert_handlers.append(handler)
    
    async def start_monitoring(self, symbols: List[str]):
        """모니터링 시작"""
        for symbol in symbols:
            self.monitoring_symbols.add(symbol)
            
        print(f"🔍 Started monitoring {len(symbols)} symbols")
    
    async def stop_monitoring(self, symbol: str = None):
        """모니터링 중지"""
        if symbol:
            self.monitoring_symbols.discard(symbol)
        else:
            self.monitoring_symbols.clear()
    
    async def update_price(self, symbol: str, price: float, timestamp: str = None):
        """가격 업데이트 및 알림 체크"""
        if symbol not in self.monitoring_symbols:
            return
            
        if timestamp is None:
            timestamp = datetime.now().isoformat()
            
        # 가격 히스토리 업데이트
        if symbol not in self.price_history:
            self.price_history[symbol] = []
            
        self.price_history[symbol].append({
            'price': price,
            'timestamp': timestamp
        })
        
        # 최근 100개만 유지
        if len(self.price_history[symbol]) > 100:
            self.price_history[symbol] = self.price_history[symbol][-100:]
        
        # 각종 알림 체크
        await self._check_price_alerts(symbol, price)
        await self._check_volatility_alerts(symbol)
        await self._check_trend_alerts(symbol)
    
    async def _check_price_alerts(self, symbol: str, current_price: float):
        """가격 기반 알림 체크"""
        config = self.alert_configs.get(symbol, {})
        
        # 가격 목표 알림
        if 'target_high' in config and current_price >= config['target_high']:
            await self._send_alert({
                'type': 'price_target',
                'symbol': symbol,
                'message': f"{symbol} reached target high: ${current_price:,.2f}",
                'price': current_price,
                'target': config['target_high'],
                'severity': 'high'
            })
            
        if 'target_low' in config and current_price <= config['target_low']:
            await self._send_alert({
                'type': 'price_target',
                'symbol': symbol,
                'message': f"{symbol} reached target low: ${current_price:,.2f}",
                'price': current_price,
                'target': config['target_low'],
                'severity': 'high'
            })
    
    async def _check_volatility_alerts(self, symbol: str):
        """변동성 알림 체크"""
        history = self.price_history.get(symbol, [])
        
        if len(history) < 10:
            return
            
        # 최근 10개 가격으로 변동성 계산
        recent_prices = [item['price'] for item in history[-10:]]
        
        # 표준편차 기반 변동성
        std_dev = np.std(recent_prices)
        mean_price = np.mean(recent_prices)
        volatility_pct = (std_dev / mean_price) * 100
        
        # 높은 변동성 (5% 이상)
        if volatility_pct > 5:
            await self._send_alert({
                'type': 'high_volatility',
                'symbol': symbol,
                'message': f"{symbol} showing high volatility: {volatility_pct:.2f}%",
                'volatility': volatility_pct,
                'current_price': recent_prices[-1],
                'severity': 'medium'
            })
    
    async def _check_trend_alerts(self, symbol: str):
        """트렌드 변화 알림 체크"""
        history = self.price_history.get(symbol, [])
        
        if len(history) < 20:
            return
            
        # 최근 20개 가격
        prices = [item['price'] for item in history[-20:]]
        
        # 급등/급락 감지 (단기간 큰 변화)
        short_term = prices[-5:]  # 최근 5개
        long_term = prices[-20:-5]  # 그 이전 15개
        
        short_avg = np.mean(short_term)
        long_avg = np.mean(long_term)
        
        change_pct = ((short_avg - long_avg) / long_avg) * 100
        
        # 급등 (5% 이상)
        if change_pct > 5:
            await self._send_alert({
                'type': 'price_spike',
                'symbol': symbol,
                'message': f"{symbol} price spiked: +{change_pct:.2f}%",
                'change_percent': change_pct,
                'current_price': prices[-1],
                'severity': 'high'
            })
        
        # 급락 (5% 이상)
        elif change_pct < -5:
            await self._send_alert({
                'type': 'price_drop',
                'symbol': symbol,
                'message': f"{symbol} price dropped: {change_pct:.2f}%",
                'change_percent': change_pct,
                'current_price': prices[-1],
                'severity': 'high'
            })
    
    async def _send_alert(self, alert: Dict[str, Any]):
        """알림 전송"""
        alert['timestamp'] = datetime.now().isoformat()
        
        # 모든 등록된 핸들러에 알림 전송
        for handler in self.alert_handlers:
            try:
                await handler(alert)
            except Exception as e:
                print(f"Error in alert handler: {e}")
        
        print(f"🚨 ALERT: {alert['message']}")
    
    def set_alert_config(self, symbol: str, config: Dict[str, Any]):
        """알림 설정"""
        self.alert_configs[symbol] = config
        print(f"Alert config set for {symbol}: {config}")
    
    def get_symbol_stats(self, symbol: str) -> Dict[str, Any]:
        """심볼 통계 정보"""
        history = self.price_history.get(symbol, [])
        
        if not history:
            return {'error': 'No data available'}
        
        prices = [item['price'] for item in history]
        
        return {
            'symbol': symbol,
            'current_price': prices[-1],
            'min_price': min(prices),
            'max_price': max(prices),
            'avg_price': np.mean(prices),
            'volatility': (np.std(prices) / np.mean(prices)) * 100,
            'data_points': len(history),
            'last_update': history[-1]['timestamp']
        }
    
    def get_all_stats(self) -> Dict[str, Any]:
        """모든 모니터링 중인 심볼의 통계"""
        stats = {}
        
        for symbol in self.monitoring_symbols:
            stats[symbol] = self.get_symbol_stats(symbol)
            
        return {
            'monitoring_count': len(self.monitoring_symbols),
            'symbols': stats,
            'timestamp': datetime.now().isoformat()
        }
    
    async def detect_anomalies(self, symbol: str) -> Dict[str, Any]:
        """이상 패턴 감지"""
        history = self.price_history.get(symbol, [])
        
        if len(history) < 30:
            return {'error': 'Insufficient data for anomaly detection'}
        
        prices = np.array([item['price'] for item in history])
        
        # Z-score 기반 이상치 감지
        mean_price = np.mean(prices)
        std_price = np.std(prices)
        
        current_price = prices[-1]
        z_score = (current_price - mean_price) / std_price
        
        anomalies = []
        
        # Z-score가 2 이상이면 이상치로 판정
        if abs(z_score) > 2:
            anomalies.append({
                'type': 'price_outlier',
                'z_score': float(z_score),
                'description': f"Price is {abs(z_score):.2f} standard deviations from mean"
            })
        
        # 연속된 같은 방향 움직임 감지
        recent_changes = np.diff(prices[-10:])  # 최근 10개 가격 변화
        
        if len(recent_changes) > 0:
            positive_streak = 0
            negative_streak = 0
            
            for change in reversed(recent_changes):
                if change > 0:
                    positive_streak += 1
                    negative_streak = 0
                elif change < 0:
                    negative_streak += 1
                    positive_streak = 0
                else:
                    break
            
            if positive_streak >= 5:
                anomalies.append({
                    'type': 'extended_uptrend',
                    'streak_length': positive_streak,
                    'description': f"Price increased for {positive_streak} consecutive periods"
                })
            elif negative_streak >= 5:
                anomalies.append({
                    'type': 'extended_downtrend',
                    'streak_length': negative_streak,
                    'description': f"Price decreased for {negative_streak} consecutive periods"
                })
        
        return {
            'symbol': symbol,
            'anomalies': anomalies,
            'z_score': float(z_score),
            'current_price': float(current_price),
            'mean_price': float(mean_price),
            'analysis_time': datetime.now().isoformat()
        }
    
    async def get_price_prediction_features(self, symbol: str) -> Dict[str, Any]:
        """가격 예측을 위한 특성 추출"""
        history = self.price_history.get(symbol, [])
        
        if len(history) < 20:
            return {'error': 'Insufficient data for feature extraction'}
        
        prices = np.array([item['price'] for item in history])
        
        # 기술적 특성들
        features = {
            'symbol': symbol,
            'current_price': float(prices[-1]),
            
            # 이동평균들
            'sma_5': float(np.mean(prices[-5:])),
            'sma_10': float(np.mean(prices[-10:])),
            'sma_20': float(np.mean(prices[-20:])) if len(prices) >= 20 else None,
            
            # 변화율들
            'change_1': float((prices[-1] - prices[-2]) / prices[-2] * 100) if len(prices) >= 2 else 0,
            'change_5': float((prices[-1] - prices[-6]) / prices[-6] * 100) if len(prices) >= 6 else 0,
            'change_10': float((prices[-1] - prices[-11]) / prices[-11] * 100) if len(prices) >= 11 else 0,
            
            # 변동성
            'volatility_5': float(np.std(prices[-5:]) / np.mean(prices[-5:]) * 100),
            'volatility_10': float(np.std(prices[-10:]) / np.mean(prices[-10:]) * 100),
            
            # 모멘텀
            'momentum': float(prices[-1] - prices[-5]) if len(prices) >= 5 else 0,
            
            # 가격 위치 (최근 범위에서의 위치)
            'price_position': float((prices[-1] - np.min(prices[-20:])) / (np.max(prices[-20:]) - np.min(prices[-20:]))),
            
            'timestamp': datetime.now().isoformat()
        }
        
        return features 
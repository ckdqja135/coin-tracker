import pandas as pd
import numpy as np
import talib
import pandas_ta as ta
from typing import Dict, List, Any, Optional
from datetime import datetime

class TechnicalAnalysisService:
    """기술적 분석 서비스"""
    
    def __init__(self):
        self.indicators_cache = {}
    
    async def analyze(self, data: List[Dict]) -> Dict[str, Any]:
        """종합적인 기술적 분석 수행"""
        if len(data) < 20:
            return {"error": "Insufficient data for analysis"}
        
        df = self._prepare_dataframe(data)
        
        # 각종 지표 계산
        indicators = await self.calculate_indicators(data)
        
        # 트렌드 분석
        trend_analysis = self._analyze_trend(df, indicators)
        
        # 지지/저항선 분석
        support_resistance = self._find_support_resistance(df)
        
        # 거래 신호 생성
        signals = self._generate_signals(df, indicators)
        
        # 종합 스코어 계산
        overall_score = self._calculate_overall_score(indicators, trend_analysis, signals)
        
        return {
            "indicators": indicators,
            "trend": trend_analysis,
            "support_resistance": support_resistance,
            "signals": signals,
            "overall_score": overall_score,
            "last_price": float(df['close'].iloc[-1]),
            "change_24h": self._calculate_change_24h(df),
            "analysis_time": datetime.now().isoformat()
        }
    
    async def calculate_indicators(self, data: List[Dict]) -> Dict[str, Any]:
        """기술적 지표들 계산"""
        df = self._prepare_dataframe(data)
        
        if len(df) < 20:
            return {}
        
        indicators = {}
        
        try:
            # 이동평균선들
            indicators['sma_20'] = float(talib.SMA(df['close'], timeperiod=20).iloc[-1])
            indicators['sma_50'] = float(talib.SMA(df['close'], timeperiod=50).iloc[-1]) if len(df) >= 50 else None
            indicators['ema_12'] = float(talib.EMA(df['close'], timeperiod=12).iloc[-1])
            indicators['ema_26'] = float(talib.EMA(df['close'], timeperiod=26).iloc[-1])
            
            # RSI
            rsi = talib.RSI(df['close'], timeperiod=14)
            indicators['rsi'] = float(rsi.iloc[-1])
            indicators['rsi_signal'] = self._interpret_rsi(rsi.iloc[-1])
            
            # MACD
            macd, macdsignal, macdhist = talib.MACD(df['close'])
            indicators['macd'] = {
                'macd': float(macd.iloc[-1]),
                'signal': float(macdsignal.iloc[-1]),
                'histogram': float(macdhist.iloc[-1]),
                'signal_interpretation': self._interpret_macd(macd.iloc[-1], macdsignal.iloc[-1], macdhist.iloc[-1])
            }
            
            # 볼린저 밴드
            bb_upper, bb_middle, bb_lower = talib.BBANDS(df['close'])
            current_price = df['close'].iloc[-1]
            indicators['bollinger_bands'] = {
                'upper': float(bb_upper.iloc[-1]),
                'middle': float(bb_middle.iloc[-1]),
                'lower': float(bb_lower.iloc[-1]),
                'position': self._bb_position(current_price, bb_upper.iloc[-1], bb_middle.iloc[-1], bb_lower.iloc[-1])
            }
            
            # 스토캐스틱
            slowk, slowd = talib.STOCH(df['high'], df['low'], df['close'])
            indicators['stochastic'] = {
                'k': float(slowk.iloc[-1]),
                'd': float(slowd.iloc[-1]),
                'signal': self._interpret_stochastic(slowk.iloc[-1], slowd.iloc[-1])
            }
            
            # ADX (트렌드 강도)
            adx = talib.ADX(df['high'], df['low'], df['close'])
            indicators['adx'] = {
                'value': float(adx.iloc[-1]),
                'strength': self._interpret_adx(adx.iloc[-1])
            }
            
            # 변동성 (ATR)
            atr = talib.ATR(df['high'], df['low'], df['close'])
            indicators['atr'] = {
                'value': float(atr.iloc[-1]),
                'volatility_level': self._interpret_atr(atr.iloc[-1], df['close'].iloc[-1])
            }
            
        except Exception as e:
            print(f"Error calculating indicators: {e}")
        
        return indicators
    
    async def get_quick_analysis(self, data: List[Dict]) -> Dict[str, Any]:
        """빠른 분석 (실시간용)"""
        if len(data) < 10:
            return {"error": "Insufficient data"}
        
        df = self._prepare_dataframe(data)
        current_price = float(df['close'].iloc[-1])
        
        # 기본 지표들만 계산
        quick_indicators = {}
        
        if len(df) >= 14:
            # RSI
            rsi = talib.RSI(df['close'], timeperiod=14)
            quick_indicators['rsi'] = float(rsi.iloc[-1])
            
            # 단기 이동평균
            sma_10 = talib.SMA(df['close'], timeperiod=10)
            quick_indicators['sma_10'] = float(sma_10.iloc[-1])
            quick_indicators['price_vs_sma10'] = current_price - quick_indicators['sma_10']
        
        # 24시간 변화율
        change_24h = self._calculate_change_24h(df)
        
        # 간단한 트렌드 판정
        trend = self._quick_trend_analysis(df)
        
        return {
            "price": current_price,
            "change_24h": change_24h,
            "trend": trend,
            "indicators": quick_indicators,
            "timestamp": datetime.now().isoformat()
        }
    
    def _prepare_dataframe(self, data: List[Dict]) -> pd.DataFrame:
        """데이터를 pandas DataFrame으로 변환"""
        df = pd.DataFrame(data)
        
        # 컬럼명 매핑
        if 'close' not in df.columns:
            # Node.js 백엔드의 스키마에 맞춤
            df = df.rename(columns={
                'close': 'close',
                'open': 'open', 
                'high': 'high',
                'low': 'low'
            })
        
        # 숫자형으로 변환
        for col in ['open', 'high', 'low', 'close']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # 시간 정렬
        if 'createdAt' in df.columns:
            df['timestamp'] = pd.to_datetime(df['createdAt'])
            df = df.sort_values('timestamp')
        
        return df
    
    def _analyze_trend(self, df: pd.DataFrame, indicators: Dict) -> Dict[str, Any]:
        """트렌드 분석"""
        trend_signals = []
        
        # 이동평균 기반 트렌드
        if 'sma_20' in indicators and 'sma_50' in indicators and indicators['sma_50'] is not None:
            if indicators['sma_20'] > indicators['sma_50']:
                trend_signals.append('bullish_ma')
            else:
                trend_signals.append('bearish_ma')
        
        # 가격과 이동평균 관계
        current_price = df['close'].iloc[-1]
        if 'sma_20' in indicators:
            if current_price > indicators['sma_20']:
                trend_signals.append('above_sma20')
            else:
                trend_signals.append('below_sma20')
        
        # 전반적인 트렌드 방향
        if len(trend_signals) > 0:
            bullish_count = sum(1 for signal in trend_signals if 'bullish' in signal or 'above' in signal)
            bearish_count = len(trend_signals) - bullish_count
            
            if bullish_count > bearish_count:
                overall_trend = 'bullish'
            elif bearish_count > bullish_count:
                overall_trend = 'bearish'
            else:
                overall_trend = 'neutral'
        else:
            overall_trend = 'neutral'
        
        return {
            'direction': overall_trend,
            'signals': trend_signals,
            'strength': self._calculate_trend_strength(indicators)
        }
    
    def _find_support_resistance(self, df: pd.DataFrame) -> Dict[str, List[float]]:
        """지지선과 저항선 찾기"""
        if len(df) < 20:
            return {"support": [], "resistance": []}
        
        # 최근 20개 데이터에서 지지/저항 찾기
        recent_data = df.tail(20)
        
        # 단순한 방법: 최고가/최저가 기반
        resistance_levels = []
        support_levels = []
        
        # 최근 최고가들
        highs = recent_data['high'].nlargest(3)
        for high in highs:
            resistance_levels.append(float(high))
        
        # 최근 최저가들  
        lows = recent_data['low'].nsmallest(3)
        for low in lows:
            support_levels.append(float(low))
        
        return {
            "support": sorted(list(set(support_levels))),
            "resistance": sorted(list(set(resistance_levels)), reverse=True)
        }
    
    def _generate_signals(self, df: pd.DataFrame, indicators: Dict) -> Dict[str, str]:
        """매매 신호 생성"""
        signals = {}
        
        # RSI 신호
        if 'rsi' in indicators:
            rsi = indicators['rsi']
            if rsi < 30:
                signals['rsi'] = 'oversold_buy'
            elif rsi > 70:
                signals['rsi'] = 'overbought_sell'
            else:
                signals['rsi'] = 'neutral'
        
        # MACD 신호
        if 'macd' in indicators:
            macd_data = indicators['macd']
            if macd_data['histogram'] > 0 and macd_data['macd'] > macd_data['signal']:
                signals['macd'] = 'bullish'
            elif macd_data['histogram'] < 0 and macd_data['macd'] < macd_data['signal']:
                signals['macd'] = 'bearish'
            else:
                signals['macd'] = 'neutral'
        
        return signals
    
    def _calculate_overall_score(self, indicators: Dict, trend: Dict, signals: Dict) -> Dict[str, Any]:
        """종합 점수 계산 (0-100)"""
        score = 50  # 중립 점수
        
        # 트렌드 점수
        if trend['direction'] == 'bullish':
            score += 15
        elif trend['direction'] == 'bearish':
            score -= 15
        
        # RSI 점수
        if 'rsi' in indicators:
            rsi = indicators['rsi']
            if 30 <= rsi <= 70:
                score += 5  # 안정적인 RSI
            elif rsi < 20:
                score += 10  # 과매도
            elif rsi > 80:
                score -= 10  # 과매수
        
        # MACD 점수
        if 'macd' in signals:
            if signals['macd'] == 'bullish':
                score += 10
            elif signals['macd'] == 'bearish':
                score -= 10
        
        # 점수 범위 제한
        score = max(0, min(100, score))
        
        # 해석
        if score >= 70:
            interpretation = 'strong_buy'
        elif score >= 60:
            interpretation = 'buy'
        elif score >= 40:
            interpretation = 'neutral'
        elif score >= 30:
            interpretation = 'sell'
        else:
            interpretation = 'strong_sell'
        
        return {
            'score': score,
            'interpretation': interpretation
        }
    
    def _calculate_change_24h(self, df: pd.DataFrame) -> float:
        """24시간 변화율 계산"""
        if len(df) < 2:
            return 0.0
        
        current_price = df['close'].iloc[-1]
        prev_price = df['close'].iloc[0]  # 첫 번째 데이터를 이전 가격으로 사용
        
        change = ((current_price - prev_price) / prev_price) * 100
        return round(change, 2)
    
    def _quick_trend_analysis(self, df: pd.DataFrame) -> str:
        """빠른 트렌드 분석"""
        if len(df) < 5:
            return 'neutral'
        
        recent_prices = df['close'].tail(5)
        
        # 최근 5개 가격의 평균 기울기
        x = range(len(recent_prices))
        slope = np.polyfit(x, recent_prices, 1)[0]
        
        if slope > 0:
            return 'uptrend'
        elif slope < 0:
            return 'downtrend'
        else:
            return 'sideways'
    
    # 헬퍼 메서드들
    def _interpret_rsi(self, rsi: float) -> str:
        if rsi < 30:
            return 'oversold'
        elif rsi > 70:
            return 'overbought'
        else:
            return 'neutral'
    
    def _interpret_macd(self, macd: float, signal: float, histogram: float) -> str:
        if macd > signal and histogram > 0:
            return 'bullish'
        elif macd < signal and histogram < 0:
            return 'bearish'
        else:
            return 'neutral'
    
    def _bb_position(self, price: float, upper: float, middle: float, lower: float) -> str:
        if price > upper:
            return 'above_upper'
        elif price < lower:
            return 'below_lower'
        elif price > middle:
            return 'upper_half'
        else:
            return 'lower_half'
    
    def _interpret_stochastic(self, k: float, d: float) -> str:
        if k < 20 and d < 20:
            return 'oversold'
        elif k > 80 and d > 80:
            return 'overbought'
        else:
            return 'neutral'
    
    def _interpret_adx(self, adx: float) -> str:
        if adx > 50:
            return 'very_strong'
        elif adx > 25:
            return 'strong'
        else:
            return 'weak'
    
    def _interpret_atr(self, atr: float, price: float) -> str:
        atr_percentage = (atr / price) * 100
        if atr_percentage > 5:
            return 'high'
        elif atr_percentage > 2:
            return 'medium'
        else:
            return 'low'
    
    def _calculate_trend_strength(self, indicators: Dict) -> str:
        # 간단한 트렌드 강도 계산
        if 'adx' in indicators:
            return indicators['adx']['strength']
        return 'unknown' 
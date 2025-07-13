import os
import pymysql
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import List, Dict, Any, Optional
import pandas as pd
from datetime import datetime

class DatabaseService:
    """데이터베이스 서비스 - Node.js 백엔드와 동일한 DB 사용"""
    
    def __init__(self):
        # 환경변수에서 DB 설정 가져오기 (Node.js와 동일)
        self.host = os.getenv('DB_HOST', 'localhost')
        self.port = int(os.getenv('DB_PORT', 3306))
        self.username = os.getenv('DB_USERNAME', 'root')
        self.password = os.getenv('DB_PASSWORD', '123456')
        self.database = os.getenv('DB_DATABASE', 'cointable')
        
        # 동기 엔진 (pandas 사용시)
        self.sync_engine = None
        # 비동기 엔진 (FastAPI 사용시)
        self.async_engine = None
        
    async def connect(self):
        """데이터베이스 연결 초기화"""
        try:
            # 동기 연결 (pandas 사용)
            sync_url = f"mysql+pymysql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
            self.sync_engine = create_engine(sync_url, echo=False)
            
            # 연결 테스트
            with self.sync_engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                print("✅ Database connected successfully!")
                
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            raise
    
    async def disconnect(self):
        """데이터베이스 연결 종료"""
        if self.sync_engine:
            self.sync_engine.dispose()
        if self.async_engine:
            await self.async_engine.dispose()
    
    async def get_coin_data(self, symbol: str, timeframe: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        코인 데이터 조회 (Node.js 백엔드와 동일한 테이블 구조)
        """
        try:
            # 시간 단위에 따른 테이블 선택
            table_name = self._get_table_name(timeframe)
            
            # SQL 쿼리 - Node.js 백엔드와 동일한 스키마
            query = f"""
            SELECT id, coin_id, open, high, low, close, createdAt, updatedAt
            FROM {table_name}
            WHERE coin_id = %s
            ORDER BY createdAt DESC
            LIMIT %s
            """
            
            # pandas로 데이터 읽기
            df = pd.read_sql(
                query, 
                self.sync_engine, 
                params=[symbol, limit]
            )
            
            if df.empty:
                return []
            
            # 시간순으로 정렬 (오래된 것부터)
            df = df.sort_values('createdAt')
            
            # 딕셔너리 리스트로 변환
            data = []
            for _, row in df.iterrows():
                data.append({
                    'id': int(row['id']),
                    'coin_id': row['coin_id'],
                    'open': float(row['open']),
                    'high': float(row['high']),
                    'low': float(row['low']),
                    'close': float(row['close']),
                    'timestamp': row['createdAt'].isoformat() if row['createdAt'] else None,
                    'createdAt': row['createdAt'].isoformat() if row['createdAt'] else None,
                    'updatedAt': row['updatedAt'].isoformat() if row['updatedAt'] else None
                })
            
            return data
            
        except Exception as e:
            print(f"Error fetching coin data: {e}")
            return []
    
    async def get_latest_price(self, symbol: str) -> Optional[Dict[str, Any]]:
        """최신 가격 조회"""
        try:
            query = """
            SELECT coin_id, close, createdAt
            FROM coin
            WHERE coin_id = %s
            ORDER BY createdAt DESC
            LIMIT 1
            """
            
            df = pd.read_sql(query, self.sync_engine, params=[symbol])
            
            if df.empty:
                return None
                
            row = df.iloc[0]
            return {
                'symbol': row['coin_id'],
                'price': float(row['close']),
                'timestamp': row['createdAt'].isoformat()
            }
            
        except Exception as e:
            print(f"Error fetching latest price: {e}")
            return None
    
    async def get_multiple_symbols_data(self, symbols: List[str], timeframe: str = "1h", limit: int = 50) -> Dict[str, List[Dict]]:
        """여러 심볼의 데이터를 한번에 조회"""
        result = {}
        
        for symbol in symbols:
            data = await self.get_coin_data(symbol, timeframe, limit)
            result[symbol] = data
            
        return result
    
    async def get_market_summary(self) -> Dict[str, Any]:
        """시장 요약 정보"""
        try:
            # 최근 1시간 데이터에서 활성 코인들 조회
            query = """
            SELECT coin_id, COUNT(*) as data_count, 
                   MIN(close) as min_price, MAX(close) as max_price,
                   AVG(close) as avg_price,
                   MAX(createdAt) as last_update
            FROM tb_hour
            WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY coin_id
            HAVING data_count > 10
            ORDER BY last_update DESC
            """
            
            df = pd.read_sql(query, self.sync_engine)
            
            summary = {
                'active_symbols': len(df),
                'symbols': []
            }
            
            for _, row in df.iterrows():
                symbol_info = {
                    'symbol': row['coin_id'],
                    'min_price': float(row['min_price']),
                    'max_price': float(row['max_price']),
                    'avg_price': float(row['avg_price']),
                    'last_update': row['last_update'].isoformat()
                }
                summary['symbols'].append(symbol_info)
            
            return summary
            
        except Exception as e:
            print(f"Error fetching market summary: {e}")
            return {'active_symbols': 0, 'symbols': []}
    
    async def save_analysis_result(self, symbol: str, timeframe: str, analysis: Dict[str, Any]):
        """분석 결과를 별도 테이블에 저장 (선택사항)"""
        try:
            # 분석 결과 저장용 테이블 생성 (필요시)
            create_table_query = """
            CREATE TABLE IF NOT EXISTS analysis_results (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                symbol VARCHAR(255) NOT NULL,
                timeframe VARCHAR(10) NOT NULL,
                analysis_data JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_symbol_time (symbol, timeframe, created_at)
            )
            """
            
            with self.sync_engine.connect() as conn:
                conn.execute(text(create_table_query))
                conn.commit()
                
                # 분석 결과 저장
                insert_query = """
                INSERT INTO analysis_results (symbol, timeframe, analysis_data)
                VALUES (%s, %s, %s)
                """
                
                import json
                analysis_json = json.dumps(analysis)
                conn.execute(text(insert_query), [symbol, timeframe, analysis_json])
                conn.commit()
                
            print(f"Analysis result saved for {symbol} ({timeframe})")
            
        except Exception as e:
            print(f"Error saving analysis result: {e}")
    
    def _get_table_name(self, timeframe: str) -> str:
        """시간 단위에 따른 테이블명 반환 (Node.js 백엔드와 동일)"""
        table_mapping = {
            '1m': 'coin',          # 1분 데이터는 기본 coin 테이블
            '5m': 'tb_5min',       # 5분 데이터
            '1h': 'tb_hour',       # 1시간 데이터  
            '1d': 'tb_day',        # 1일 데이터
            '1M': 'tb_month'       # 1개월 데이터
        }
        
        return table_mapping.get(timeframe, 'coin')
    
    async def test_connection(self) -> bool:
        """연결 테스트"""
        try:
            with self.sync_engine.connect() as conn:
                result = conn.execute(text("SELECT COUNT(*) as cnt FROM coin LIMIT 1"))
                count = result.fetchone()[0]
                print(f"✅ Connection test passed. Coin table has {count} records.")
                return True
        except Exception as e:
            print(f"❌ Connection test failed: {e}")
            return False
    
    async def get_table_info(self) -> Dict[str, Any]:
        """테이블 정보 조회 (디버깅용)"""
        try:
            tables = ['coin', 'tb_5min', 'tb_hour', 'tb_day', 'tb_month']
            info = {}
            
            for table in tables:
                try:
                    query = f"SELECT COUNT(*) as count, MAX(createdAt) as latest FROM {table}"
                    df = pd.read_sql(query, self.sync_engine)
                    
                    info[table] = {
                        'record_count': int(df.iloc[0]['count']),
                        'latest_record': df.iloc[0]['latest'].isoformat() if df.iloc[0]['latest'] else None
                    }
                except Exception as table_error:
                    info[table] = {'error': str(table_error)}
            
            return info
            
        except Exception as e:
            return {'error': str(e)} 
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import uvicorn
from typing import Dict, List
import json

from services.database import DatabaseService
from services.technical_analysis import TechnicalAnalysisService
from services.market_monitor import MarketMonitorService
from models.schemas import CoinData, AnalysisResult, AlertConfig

app = FastAPI(title="Crypto Analysis Server", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # React 클라이언트
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 서비스 인스턴스
db_service = DatabaseService()
analysis_service = TechnicalAnalysisService()
monitor_service = MarketMonitorService()

# 웹소켓 연결 관리
active_connections: List[WebSocket] = []

@app.on_startup
async def startup_event():
    """서버 시작 시 초기화"""
    await db_service.connect()
    print("🚀 Analysis Server Started!")

@app.on_shutdown
async def shutdown_event():
    """서버 종료 시 정리"""
    await db_service.disconnect()
    print("🛑 Analysis Server Stopped!")

@app.get("/")
async def root():
    return {"message": "Crypto Analysis Server is running!"}

@app.get("/analysis/{symbol}")
async def get_technical_analysis(symbol: str, timeframe: str = "1h"):
    """특정 코인의 기술적 분석 결과 반환"""
    try:
        # 데이터베이스에서 OHLCV 데이터 가져오기
        data = await db_service.get_coin_data(symbol, timeframe, limit=100)
        
        if not data:
            return {"error": "No data found"}
        
        # 기술적 분석 수행
        analysis = await analysis_service.analyze(data)
        
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "analysis": analysis,
            "timestamp": data[-1]["timestamp"] if data else None
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/indicators/{symbol}")
async def get_indicators(symbol: str, timeframe: str = "1h"):
    """기술적 지표들 반환"""
    try:
        data = await db_service.get_coin_data(symbol, timeframe, limit=100)
        
        if not data:
            return {"error": "No data found"}
        
        indicators = await analysis_service.calculate_indicators(data)
        
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "indicators": indicators
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/market-overview")
async def get_market_overview():
    """시장 전체 개요 반환"""
    try:
        # 주요 코인들의 분석 결과
        symbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT"]
        overview = {}
        
        for symbol in symbols:
            data = await db_service.get_coin_data(symbol, "1h", limit=50)
            if data:
                analysis = await analysis_service.get_quick_analysis(data)
                overview[symbol] = analysis
        
        return overview
    except Exception as e:
        return {"error": str(e)}

@app.websocket("/ws/analysis")
async def websocket_analysis(websocket: WebSocket):
    """실시간 분석 결과 스트리밍"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            # 클라이언트로부터 메시지 대기
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "subscribe":
                symbol = message.get("symbol")
                # 실시간 분석 시작
                await start_realtime_analysis(websocket, symbol)
                
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print("Client disconnected from analysis stream")

async def start_realtime_analysis(websocket: WebSocket, symbol: str):
    """실시간 분석 스트리밍"""
    while websocket in active_connections:
        try:
            # 최신 데이터 가져오기
            data = await db_service.get_coin_data(symbol, "1m", limit=50)
            
            if data:
                # 빠른 분석 수행
                analysis = await analysis_service.get_quick_analysis(data)
                
                # 클라이언트에 전송
                await websocket.send_text(json.dumps({
                    "type": "analysis_update",
                    "symbol": symbol,
                    "data": analysis,
                    "timestamp": data[-1]["timestamp"]
                }))
            
            # 5초마다 업데이트
            await asyncio.sleep(5)
            
        except Exception as e:
            print(f"Error in realtime analysis: {e}")
            break

async def broadcast_alert(alert: Dict):
    """모든 연결된 클라이언트에 알림 브로드캐스트"""
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps({
                "type": "alert",
                "data": alert
            }))
        except:
            # 연결이 끊어진 경우 제거
            active_connections.remove(connection)

if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    ) 
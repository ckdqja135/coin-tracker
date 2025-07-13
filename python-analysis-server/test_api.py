#!/usr/bin/env python3
"""
Python 분석 서버 API 테스트 스크립트
"""
import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_endpoint(endpoint, description):
    """API 엔드포인트 테스트"""
    print(f"\n 테스트: {description}")
    print(f" 요청: GET {BASE_URL}{endpoint}")
    
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
        print(f"상태코드: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"응답 데이터:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print(f"오류 응답: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(" 연결 실패: 서버가 실행 중인지 확인하세요")
    except requests.exceptions.Timeout:
        print(" 타임아웃: 서버 응답이 너무 느립니다")
    except Exception as e:
        print(f" 오류: {e}")

def test_websocket_info():
    """WebSocket 정보 표시"""
    print(f"\n WebSocket 엔드포인트: ws://localhost:8000/ws/analysis")
    print( " 사용법:")
    print("  - 연결 후 다음 메시지 전송:")
    print("  {\"type\": \"subscribe\", \"symbol\": \"BTCUSDT\"}")

def main():
    print("=" * 60)
    print(" Python 분석 서버 API 테스트")
    print("=" * 60)
    
    # 기본 엔드포인트 테스트
    test_endpoint("/", "서버 상태 확인")
    
    # 기술적 분석 테스트
    test_endpoint("/analysis/BTCUSDT?timeframe=1h", "BTCUSDT 기술적 분석")
    
    # 지표 테스트
    test_endpoint("/indicators/BTCUSDT?timeframe=1h", "BTCUSDT 기술적 지표")
    
    # 시장 개요 테스트
    test_endpoint("/market-overview", "시장 전체 개요")
    
    # FastAPI 자동 문서 정보
    print(f"\n API 문서:")
    print(f"  - Swagger UI: {BASE_URL}/docs")
    print(f"  - ReDoc: {BASE_URL}/redoc")
    
    # WebSocket 정보
    test_websocket_info()
    
    print("\n" + "=" * 60)
    print(" API 테스트 완료!")
    print("=" * 60)

if __name__ == "__main__":
    main() 
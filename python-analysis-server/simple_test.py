import requests
import json

print(" Python 분석 서버 API 테스트")
print("=" * 50)

# 기본 엔드포인트 테스트
try:
    response = requests.get("http://localhost:8000/")
    print(f" 서버 상태: {response.status_code}")
    if response.status_code == 200:
        print(f" 응답: {response.json()}")
    else:
        print(f" 오류: {response.text}")
except Exception as e:
    print(f" 연결 실패: {e}")

print("\n" + "=" * 50)
print(" API 문서 확인:")
print("  - Swagger UI: http://localhost:8000/docs")
print("  - ReDoc: http://localhost:8000/redoc")
print("=" * 50) 
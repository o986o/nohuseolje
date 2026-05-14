#!/usr/bin/env bash
# 개발환경 초기 설정
set -euo pipefail

echo "=== 노후설계 플랫폼 개발환경 설정 ==="

# .env 파일 생성
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ .env 파일 생성 완료 (비밀번호를 반드시 변경하세요)"
fi

# Python 가상환경 (선택)
if command -v python3 &>/dev/null; then
  if [ ! -d "backend/venv" ]; then
    python3 -m venv backend/venv
    echo "✓ Python 가상환경 생성"
  fi
  source backend/venv/bin/activate
  pip install -q -r backend/requirements.txt
  echo "✓ Python 의존성 설치 완료"
fi

# Node 의존성
if command -v npm &>/dev/null; then
  cd frontend && npm install && cd ..
  echo "✓ Node 의존성 설치 완료"
fi

# Docker 시작
if command -v docker &>/dev/null; then
  docker compose up -d postgres redis
  echo "✓ PostgreSQL & Redis 시작"
  sleep 3
  echo "✓ 데이터베이스 준비 완료"
fi

echo ""
echo "=== 설정 완료 ==="
echo "백엔드 시작: cd backend && uvicorn app.main:app --reload"
echo "프론트엔드 시작: cd frontend && npm run dev"
echo "API 문서: http://localhost:8000/api/docs"
echo "대시보드: http://localhost:3000/dashboard"

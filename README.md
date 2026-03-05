# Dyfine - Family Asset Management System

Dyfine은 가구 단위의 자산 관리와 복식부기 기반의 투명한 재정 추적을 위한 웹 가계부 서비스입니다.

## ✨ 주요 기능

- **복식부기 전표 시스템**: 단순 수입/지출을 넘어 계좌 간 이체와 대차 평형을 완벽하게 관리합니다.
- **자동이체 엔진**: 정기적인 이체 규칙을 설정하고, 실행 전 확인을 통해 실수를 방지합니다.
- **대출 시뮬레이션**: 거치 기간, 체증식 상환 등 다양한 상환 방식과 금리 이력을 추적합니다.
- **투자 포트폴리오**: 테마별/계좌별 투자 비중을 관리하고 목표 비중 대비 리밸런싱 가이드를 제공합니다.
- **개인 용돈 관리**: 가구 공통 자산과 분리된 개인별 용돈 및 고정지출을 독립적으로 관리합니다.
- **반려동물 케어**: '누리무무' 전용 케어 로그를 통해 반려동물 지출을 체계적으로 추적합니다.

## 🚀 시작하기

### 사전 준비
- Node.js (v18+)
- Supabase 프로젝트 및 API 키

### 설치
```bash
git clone https://github.com/moonoo59/dyfine.git
cd dyfine
npm install
```

### 환경 변수 설정
`.env.local` 파일을 생성하고 다음 정보를 입력합니다.
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 실행
```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

## 🛠 기술 스택
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand
- **Backend/DB**: Supabase (PostgreSQL), Edge Functions, pg_cron
- **Deployment**: Cloudflare Pages

## 📂 문서 가이드
상세 설계 및 업데이트 내역은 `docs/` 폴더를 참조하십시오.
- [아키텍처 및 설계](./docs/01_ARCH_DESIGN.md)
- [요구사항 및 API 명세](./docs/02_REQUIREMENTS_API.md)
- [릴리즈 노트](./docs/RELEASE_NOTES.md)
- [사용자 매뉴얼](./docs/user_manual.md)

---
Developed by **Dyfine 전문가 에이전트 팀**.

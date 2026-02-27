# Dyfine Changelog

## v1.0.0 — Phase 1 Release (2026-02-27)

### 핵심 기능
- **Auth + Onboarding**: 이메일 로그인, 가구/계좌/카테고리 초기 설정
- **복식부기 거래**: RPC 기반 원자적 전표 생성 (수입/지출/이체/조정)
- **자동이체**: 규칙 생성 → 인스턴스 자동 생성 → 확인/삭제
- **예산 관리**: 카테고리별 월간 예산 설정 + 실적 대비
- **월 마감**: RPC 원자적 마감 (전표 락 + 스냅샷 + 마감 레코드)
- **Dashboard**: KPI 5개, 자금 흐름/잔액 추이/Waterfall/파이 차트, 해야 할 일
- **Transactions**: 4개 탭 (전체/인박스/즐겨찾기/Import), FilterBar 연동
- **CSV Import**: 3단계 UX (파일→컬럼 매핑→미리보기), Papa Parse
- **분류 룰**: 패턴 → 카테고리 자동 매핑 규칙 CRUD
- **리포트**: 카테고리별 파이+바 차트, CSV Export
- **알림**: 읽음/미읽음 관리, GNB 알림 뱃지

### 보안
- RLS 전 테이블 적용 (household_id 기반 데이터 격리)
- is_locked 전표 UPDATE/DELETE 방지 정책
- RPC SECURITY DEFINER 권한 제한
- audit_logs 테이블 (감사 추적)

### 인프라
- GitHub Actions CI (tsc + vite build)
- Vite 코드 분할 (recharts/supabase/react 별도 chunk)
- Cloudflare 보안 헤더 (CSP, X-Frame-Options 등)

### 기술 스택
- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS
- State: Zustand (Auth) + React Query (Server State)
- Backend: Supabase (Auth, PostgreSQL, Realtime, RPC)
- Charts: Recharts
- CI/CD: GitHub Actions

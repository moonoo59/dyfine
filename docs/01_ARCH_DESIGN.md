# Dyfine Architecture & Design Specification (Integrated)

이 문서는 Dyfine 시스템의 설계 원칙, 데이터 모델, 아키텍처 및 세부 설계 전략을 통합하여 관리합니다. 최신 설계 내역이 상단에 위치합니다.

---

## 🏗️ 1. v3.0 엑셀 기반 통합 설계 (2026-03-04)

> **원칙**: 스프레드시트의 양식과 구조를 반영하되, 데이터는 사용자가 직접 입력. "집 구매 시 목표 PF" 제외.

### 1-1. 기능 매핑 요약
| 구분 | 시트명 | Dyfine 대응 기능 | 작업 상태 |
|---|---|---|---|
| 대출 | 대출현황 / 상환계획 | `/loans` 확장 (은행명, 상환순위, FRS 연계) | ✅ 완료 |
| 예산 | 종합 월별 예산표 | `/budgets` (카테고리 구조 재구성) | ✅ 완료 |
| 거래 | 덕원/여선 DATA | 거래 내역 + 태그 전표 시스템 | ✅ 완료 |
| 자산 | 전체 / 목표 PF | `/investments` 목표 비중 및 스냅샷 | ✅ 완료 |

### 1-2. 데이터 스키마 확장
- **`loans`**: `bank_name`, `repayment_priority`, `grace_period_months` 추가.
- **`investment_targets`**: 테마별 목표 비중(`target_weight`) 관리 테이블 신설.
- **`monthly_asset_snapshots`**: 월 마감 시점의 자산 상태를 JSONB로 박제.
- **`pet_care_logs`**: 반려동물 전용 독립 비용 추적 테이블 (`Hundgarten` 대응).

---

## 🏗️ 2. v2.0 전문가 에이전트 팀 종합 검토 (2026-02-27)

### 아키텍처 평가
- **Frontend**: React + Zustand + TanStack Query 기반의 실시간 동기화 아키텍처.
- **Backend**: Supabase RPC를 미들웨어로 활용하여 복식부기의 원자성(`Atomicity`) 보장.
- **Security**: 테이블별 RLS(Row Level Security) 적용으로 가족 구성원 간 프라이버시 보호.

### 주요 검토 의견 (보완됨)
- **RPC 정합성**: `create_transaction`을 통한 모든 거래 유입 일원화.
- **성능**: DB View(`v_account_balance_actual`)를 활용한 실시간 잔액 계산 최적화.
- **확장성**: 대출(`loans`)과 투자(`securities`) 모듈의 독립성 및 상호 참조(FRS) 구조 확보.

---

## 🌊 3. 데이터 파이프라인 및 워크플로우 (Data Pipeline)

### 입력 -> 처리 -> 집계 구조
1.  **진입점**: 수동 입력, CSV Import, 자동이체 엔진(`pg_cron`).
2.  **분개(RPC)**: `create_transaction` 함수를 통해서만 원장 기록 가능 -> 복식부기 정합성 체크.
3.  **집계(View)**: 무거운 합계 연산을 View로 위임하여 프론트엔드 성능 최적화.
    - `v_account_balance_actual`: 실시간 계좌 잔액.
    - `v_monthly_category_actual`: 월별/카테고리별 통계.

---

## 🚀 4. 대출 및 미래 재무 시뮬레이션 전략

### FRS (Free Route Space) 개념
- **계산식**: `고정수입 - (고정지출 + 변동지출예산 + 최소대출상환액) = 잉여 자금`.
- **전략**: FRS를 대출 조기 상환에 쓸 것인가, 투자의 기회비용으로 쓸 것인가를 시각화하여 유저에게 인사이트 제공.

### 시뮬레이션 엔진
- **RPC `simulate_loan_payoff`**: 중도 상환 금액에 따른 만기 단축일 및 절감 이자 실시간 계산.
- **What-If 분석**: 대출 금리 vs 투자 기대 수익률 비교를 통한 순자산(Net Worth) 예측.

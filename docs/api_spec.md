# Dyfine API 명세서 (v3.0)

> 최종 업데이트: 2026-03-04

## RPC Functions (Supabase PostgreSQL)

### 1. `create_transaction`
| 항목 | 내용 |
|------|------|
| **목적** | 복식부기 거래 생성 (전표 + 라인) |
| **파일** | `0027_security_and_validations.sql` |
| **파라미터** | `p_household_id`, `p_user_id`, `p_entry_type`, `p_occurred_at`, `p_category_id`, `p_memo`, `p_from_account_id`, `p_to_account_id`, `p_amount` |
| **반환** | 생성된 `transaction_entry` ID |

### 2. `create_transaction_with_tags`
| 항목 | 내용 |
|------|------|
| **목적** | 거래 생성 + 태그 자동 연결 (없으면 신규 생성) |
| **파일** | `0027_security_and_validations.sql` |
| **파라미터** | 위 `create_transaction`과 동일 + `p_tags text[]` |
| **반환** | 생성된 `transaction_entry` ID |

### 3. `close_month`
| 항목 | 내용 |
|------|------|
| **목적** | 월 마감 처리 — 해당 월 전표 잠금(is_locked=true) |
| **파일** | `0027_security_and_validations.sql` |
| **파라미터** | `p_year_month CHAR(7)`, `p_user_id UUID` |
| **반환** | `{ locked_count: number }` |
| **비고** | 프론트에서 마감 후 `update_holding_snapshot` + `monthly_asset_snapshots` upsert도 함께 실행 |

### 4. `create_loan`
| 항목 | 내용 |
|------|------|
| **목적** | 대출 생성 + 계좌 자동 생성 + 초기 잔액 설정 |
| **파일** | `0027_security_and_validations.sql` |
| **파라미터** | `p_household_id`, `p_user_id`, `p_name`, `p_principal`, `p_annual_rate`, `p_term_months`, `p_start_date`, `p_repayment_type` |
| **반환** | 생성된 `loan` ID |

### 5. `update_holding_snapshot`
| 항목 | 내용 |
|------|------|
| **목적** | 투자 종목별 보유 현황 스냅샷 저장/갱신 |
| **파일** | `0015_investment_snapshot.sql` |
| **파라미터** | `p_household_id UUID`, `p_snapshot_date DATE` |
| **반환** | void |

### 6. `update_security_prices`
| 항목 | 내용 |
|------|------|
| **목적** | 종목 현재가 일괄 업데이트 |
| **파일** | `0015_investment_snapshot.sql` |
| **파라미터** | `p_prices JSONB` (종목ID → 가격 매핑) |
| **반환** | void |

### 7. `record_trade`
| 항목 | 내용 |
|------|------|
| **목적** | 매매 거래 기록 + 보유 수량 자동 업데이트 |
| **파일** | `0014_investment_core.sql` |
| **파라미터** | `p_household_id`, `p_holding_id`, `p_trade_type`, `p_quantity`, `p_price`, `p_fee`, `p_trade_date` |
| **반환** | 생성된 `trade` ID |

### 8. `confirm_auto_transfer`
| 항목 | 내용 |
|------|------|
| **목적** | 자동 이체 인스턴스 확인 → 거래 전표 생성 |
| **파일** | `0009_rpc_confirm_auto_transfer.sql` |
| **파라미터** | `p_instance_id BIGINT`, `p_user_id UUID` |
| **반환** | 생성된 `transaction_entry` ID |

### 9. `generate_monthly_loan_entries`
| 항목 | 내용 |
|------|------|
| **목적** | pg_cron 스케줄러용 — 해당 월 대출 상환 거래 자동 생성 |
| **파일** | `0016_loan_cron.sql` |
| **파라미터** | `p_target_date DATE DEFAULT CURRENT_DATE` |
| **반환** | void |
| **비고** | 매일 자정 cron에 의해 자동 실행 |

### 10. `is_household_member` / `is_household_owner`
| 항목 | 내용 |
|------|------|
| **목적** | RLS 정책용 헬퍼 — 현재 사용자가 가구 구성원/소유자인지 확인 |
| **파일** | `0006_fix_rls_patch.sql` |
| **반환** | `boolean` |

---

## 테이블 목록

| 테이블 | 용도 | RLS |
|--------|------|-----|
| `households` | 가구(가계부) 단위 | ✅ |
| `household_members` | 가구 구성원 매핑 | ✅ |
| `accounts` | 계좌 (예금/카드/대출/투자 등) | ✅ |
| `categories` | 카테고리 (2단계 트리) | ✅ |
| `transaction_entries` | 거래 전표 (헤더) | ✅ |
| `transaction_lines` | 거래 라인 (복식부기) | ✅ |
| `tags` / `entry_tags` | 거래 태그 (다대다) | ✅ |
| `budgets` | 월별 예산 | ✅ |
| `transfer_rules` / `transfer_instances` | 자동 이체 룰 및 인스턴스 | ✅ |
| `loans` | 대출 정보 | ✅ |
| `closings` | 월 마감 이력 | ✅ |
| `securities` / `holdings` / `trades` | 투자 (종목/보유/거래) | ✅ |
| `holding_snapshots` | 투자 스냅샷 | ✅ |
| `investment_targets` | 투자 목표 비중 | ✅ |
| `monthly_contributions` | 월 정기투자 금액 | ✅ |
| `monthly_asset_snapshots` | 월별 순자산 스냅샷 (JSONB) | ✅ |
| `favorite_templates` | 즐겨찾기 거래 템플릿 | ✅ |
| `classification_rules` | 자동 분류 룰 | ✅ |
| `notifications` | 알림 | ✅ |
| `petcare_logs` | 훈트가르텐 이용 기록 | ✅ |

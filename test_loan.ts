import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) env[match[1]] = match[2].trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLoanInsert() {
    console.log("Testing loan insert to trigger constraint error...");

    const testHouseholdId = 'c2daa7be-26c8-4a1c-a1c5-6961a735c281'; // From previous output

    const { error } = await supabase.rpc('create_loan', {
        p_household_id: testHouseholdId,
        p_name: 'test_loan',
        p_principal: 1000,
        p_start_date: '2026-03-01',
        p_maturity_date: '2027-03-01',
        p_term_months: 12,
        p_repayment_type: 'annuity', // Test if annuity works
        p_interest_pay_day: 1,
        p_initial_rate: 0.05,
        p_linked_account_id: null,
        p_bank_name: null,
        p_repayment_priority: null,
        p_created_by: null,
        p_grace_period_months: 0
    });

    if (error) {
        console.error("Error creating loan with 'graduated':", error);
    } else {
        console.log("Success with 'graduated'!");
    }
}

testLoanInsert();

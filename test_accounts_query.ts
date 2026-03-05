import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) env[match[1]] = match[2].trim();
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testAccounts() {
    console.log("Testing frontend accounts query...");
    const { data, error } = await supabase
        .from('v_account_balance_actual')
        .select('*')
        .limit(5);

    if (error) {
        console.error("Accounts Query Error:", error);
    } else {
        console.log("Accounts Success! Data length:", data.length);
        console.log(JSON.stringify(data[0], null, 2));
    }
}

testAccounts();

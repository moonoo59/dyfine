import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local manually to avoid dotenv dependency
const envFile = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        env[match[1]] = match[2];
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('transaction_entries')
        .select(`
            id, occurred_at, entry_type, memo,
            lines:transaction_lines(id, account_id, amount)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("DB Error:", error);
    } else {
        console.log("=== Recent Transactions ===");
        console.log(JSON.stringify(data, null, 2));
    }
}

check();

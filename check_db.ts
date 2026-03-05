import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('transaction_entries')
        .select('id, occurred_at, entry_type, lines:transaction_lines(account_id, amount)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

check();

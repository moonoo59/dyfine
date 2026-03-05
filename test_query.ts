import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) env[match[1]] = match[2].trim();
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testQuery() {
    console.log("Testing exact frontend query...");
    const { data, error } = await supabase
        .from('transaction_entries')
        .select(`
            *,
            category:categories(id, name),
            lines:transaction_lines(
                id, amount, line_memo,
                account:accounts(name)
            ),
            tags:entry_tags(
                tag:tags(id, name)
            ),
            creator:profiles!transaction_entries_created_by_fkey(display_name)
        `)
        .order('occurred_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log("Success! Data length:", data.length);
        console.log(JSON.stringify(data[0], null, 2));
    }
}

testQuery();

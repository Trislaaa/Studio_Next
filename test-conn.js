const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    console.log('Connecting to:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'));
    try {
        await client.connect();
        console.log('✅ Connection Successful!');
        const res = await client.query('SELECT NOW()');
        console.log('Server time:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        if (err.code) console.error('Code:', err.code);
        if (err.address) console.error('Address:', err.address);
    }
}

check();

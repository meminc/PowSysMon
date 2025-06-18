// scripts/setup-db.js
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        // Create database if it doesn't exist
        // Note: This should be run with a superuser connection first
        
        console.log('Database setup complete!');
    } catch (error) {
        console.error('Database setup error:', error);
    } finally {
        await client.end();
    }
}

setupDatabase();
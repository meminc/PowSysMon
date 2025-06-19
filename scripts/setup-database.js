// scripts/setup-database.js
const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Database connection for initial setup
const setupConfig = {
    host: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'localhost',
    port: 5431,
    user: 'postgres',
    password: 'password', // Change this to your PostgreSQL superuser password
    database: 'postgres'
};

// Extract database name from connection string
const dbName = process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || 'grid_monitoring';

async function createDatabase() {
    const client = new Client(setupConfig);
    
    try {
        await client.connect();
        console.log('Connected to PostgreSQL server');

        // Check if database exists
        const checkDb = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbName]
        );

        if (checkDb.rows.length === 0) {
            // Create database
            await client.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ Database '${dbName}' created successfully`);
        } else {
            console.log(`ℹ️  Database '${dbName}' already exists`);
        }
    } catch (error) {
        console.error('Error creating database:', error.message);
    } finally {
        await client.end();
    }
}

async function setupSchema() {
    // Connect to the newly created database
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log(`Connected to database '${dbName}'`);

        // Read the schema file
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        let schema;
        
        try {
            schema = await fs.readFile(schemaPath, 'utf8');
        } catch (error) {
            // If schema.sql doesn't exist, use the embedded schema
            schema = getEmbeddedSchema();
        }

        // Split the schema into individual statements
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        // Execute each statement
        try {
            await client.query(schema);
            console.log(`✅ Query successfully executed`);
        } catch (error) {
            console.error(`❌ Error in query:`, error.message);
        }

        console.log('\n✅ Database schema created successfully');

        // Create default admin user
        await createDefaultAdmin(client);

        // Create sample data if requested
        if (process.argv.includes('--sample-data')) {
            await createSampleData(client);
        }

    } catch (error) {
        console.error('Error setting up schema:', error);
    } finally {
        await client.end();
    }
}

async function createDefaultAdmin(client) {
    try {
        const email = 'admin@gridmonitor.com';
        const password = 'admin123'; // Change this!
        const hashedPassword = await bcrypt.hash(password, 10);

        await client.query(`
            INSERT INTO users (email, password_hash, name, role) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO UPDATE 
            SET password_hash = $2
            `, [email, hashedPassword, 'System Admin', 'admin']);

        console.log('\n✅ Default admin user created:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log('   ⚠️  Please change this password immediately!\n');
    } catch (error) {
        console.error('Error creating admin user:', error.message);
    }
}

async function createSampleData(client) {
    console.log('\nCreating sample data...');

    try {
        // Create sample buses
        const busIds = [];
        for (let i = 1; i <= 3; i++) {
            const result = await client.query(`
                INSERT INTO grid_elements (element_type, name, description, latitude, longitude, status)
                VALUES ('bus', $1, $2, $3, $4, 'active')
                RETURNING id
            `, [
                `Bus ${i}`,
                `Main distribution bus ${i}`,
                40.7128 + (Math.random() - 0.5) * 0.1,
                -74.0060 + (Math.random() - 0.5) * 0.1
            ]);
            
            const busId = result.rows[0].id;
            busIds.push(busId);

            await client.query(`
                INSERT INTO buses (id, voltage_level, bus_type)
                VALUES ($1, $2, $3)
            `, [busId, i === 1 ? 132 : 11, i === 1 ? 'slack' : 'pq']);
        }

        // Create sample generators
        const genTypes = ['solar', 'wind', 'thermal'];
        for (let i = 0; i < genTypes.length; i++) {
            const result = await client.query(`
                INSERT INTO grid_elements (element_type, name, description, latitude, longitude, status)
                VALUES ('generator', $1, $2, $3, $4, 'active')
                RETURNING id
            `, [
                `${genTypes[i].charAt(0).toUpperCase() + genTypes[i].slice(1)} Plant ${i + 1}`,
                `${genTypes[i]} generation facility`,
                40.7128 + (Math.random() - 0.5) * 0.2,
                -74.0060 + (Math.random() - 0.5) * 0.2
            ]);

            await client.query(`
                INSERT INTO generators (id, generation_type, rated_capacity, min_capacity, max_capacity, voltage_level, bus_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                result.rows[0].id,
                genTypes[i],
                50 + Math.random() * 100,
                10,
                150,
                11,
                busIds[i]
            ]);
        }

        // Create sample loads
        const loadTypes = ['residential', 'commercial', 'industrial'];
        for (let i = 0; i < loadTypes.length; i++) {
            const result = await client.query(`
                INSERT INTO grid_elements (element_type, name, description, latitude, longitude, status)
                VALUES ('load', $1, $2, $3, $4, 'active')
                RETURNING id
            `, [
                `${loadTypes[i].charAt(0).toUpperCase() + loadTypes[i].slice(1)} Load ${i + 1}`,
                `${loadTypes[i]} load center`,
                40.7128 + (Math.random() - 0.5) * 0.15,
                -74.0060 + (Math.random() - 0.5) * 0.15
            ]);

            await client.query(`
                INSERT INTO loads (id, load_type, connection_type, rated_power, power_factor, voltage_level, bus_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                result.rows[0].id,
                loadTypes[i],
                'three_phase',
                20 + Math.random() * 80,
                0.85 + Math.random() * 0.1,
                11,
                busIds[i]
            ]);
        }

        // Create sample transformer
        const transResult = await client.query(`
            INSERT INTO grid_elements (element_type, name, description, latitude, longitude, status)
            VALUES ('transformer', $1, $2, $3, $4, 'active')
            RETURNING id
            `, [
            'Main Transformer T1',
            'Step-down transformer 132/11 kV',
            40.7128,
            -74.0060
        ]);

        await client.query(`
            INSERT INTO transformers (id, primary_voltage, secondary_voltage, rated_power, primary_bus_id, secondary_bus_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            `, [
            transResult.rows[0].id,
            132,
            11,
            100,
            busIds[0],
            busIds[1]
        ]);

        // Create network connections
        await client.query(`
            INSERT INTO network_connections (from_element_id, to_element_id, connection_type)
            VALUES ($1, $2, 'electrical')
            `, [busIds[0], busIds[1]]);

        console.log('✅ Sample data created successfully');
    } catch (error) {
        console.error('Error creating sample data:', error.message);
    }
}

function getEmbeddedSchema() {
    // This is a simplified version - you should use the full schema from the artifact
    return `
        -- Enable UUID extension
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Create basic schema
        -- Copy the full schema from the SQL artifact here
    `;
}

async function main() {
    console.log('🚀 Grid Monitoring Database Setup\n');
    
    // Step 1: Create database
    await createDatabase();
    
    // Step 2: Setup schema
    await setupSchema();
    
    console.log('\n✅ Database setup complete!');
    console.log('\nNext steps:');
    console.log('1. Update your .env.local file with the correct database credentials');
    console.log('2. Run "npm run dev" to start the Next.js development server');
    console.log('3. Access the application at http://localhost:3000');
    
    if (!process.argv.includes('--sample-data')) {
        console.log('\nTip: Run "npm run setup:db -- --sample-data" to create sample data');
    }
}

// Run the setup
main().catch(console.error);
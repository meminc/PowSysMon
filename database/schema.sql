-- Grid Monitoring System Database Schema
-- PostgreSQL Database Setup

-- Create database (run this as superuser if needed)
-- CREATE DATABASE grid_monitoring;

-- Connect to the grid_monitoring database before running the rest
-- \c grid_monitoring;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing types if they exist (for clean setup)
DROP TYPE IF EXISTS element_type CASCADE;
DROP TYPE IF EXISTS element_status CASCADE;
DROP TYPE IF EXISTS load_type CASCADE;
DROP TYPE IF EXISTS generation_type CASCADE;
DROP TYPE IF EXISTS connection_type CASCADE;
DROP TYPE IF EXISTS priority_level CASCADE;

-- Create enum types
CREATE TYPE element_type AS ENUM ('load', 'generator', 'transformer', 'line', 'bus', 'breaker');
CREATE TYPE element_status AS ENUM ('active', 'inactive', 'maintenance', 'fault');
CREATE TYPE load_type AS ENUM ('residential', 'commercial', 'industrial');
CREATE TYPE generation_type AS ENUM ('solar', 'wind', 'hydro', 'thermal', 'nuclear', 'battery');
CREATE TYPE connection_type AS ENUM ('single_phase', 'three_phase');
CREATE TYPE priority_level AS ENUM ('critical', 'high', 'medium', 'low');

-- Base grid elements table
CREATE TABLE IF NOT EXISTS grid_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_type element_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    status element_status DEFAULT 'active',
    commissioning_date DATE,
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    installation_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for grid_elements
CREATE INDEX idx_element_type ON grid_elements(element_type);
CREATE INDEX idx_status ON grid_elements(status);
CREATE INDEX idx_location ON grid_elements(latitude, longitude);
CREATE INDEX idx_deleted_at ON grid_elements(deleted_at);
CREATE INDEX idx_created_at ON grid_elements(created_at);

-- Buses table (must be created before other tables that reference it)
CREATE TABLE IF NOT EXISTS buses (
    id UUID PRIMARY KEY REFERENCES grid_elements(id) ON DELETE CASCADE,
    voltage_level DECIMAL(10, 2) NOT NULL,
    bus_type VARCHAR(10) DEFAULT 'pq',
    substation_id UUID,
    nominal_voltage DECIMAL(10, 2),
    voltage_tolerance_min DECIMAL(5, 2) DEFAULT 0.95,
    voltage_tolerance_max DECIMAL(5, 2) DEFAULT 1.05
);

CREATE INDEX idx_substation ON buses(substation_id);
CREATE INDEX idx_bus_type ON buses(bus_type);

-- Loads table
CREATE TABLE IF NOT EXISTS loads (
    id UUID PRIMARY KEY REFERENCES grid_elements(id) ON DELETE CASCADE,
    load_type load_type NOT NULL,
    connection_type connection_type NOT NULL,
    rated_power DECIMAL(10, 2) NOT NULL,
    power_factor DECIMAL(3, 2) CHECK (power_factor >= 0 AND power_factor <= 1),
    voltage_level DECIMAL(10, 2) NOT NULL,
    priority priority_level DEFAULT 'medium',
    bus_id UUID REFERENCES buses(id)
);

CREATE INDEX idx_load_type ON loads(load_type);
CREATE INDEX idx_priority ON loads(priority);
CREATE INDEX idx_load_bus_id ON loads(bus_id);

-- Generators table
CREATE TABLE IF NOT EXISTS generators (
    id UUID PRIMARY KEY REFERENCES grid_elements(id) ON DELETE CASCADE,
    generation_type generation_type NOT NULL,
    rated_capacity DECIMAL(10, 2) NOT NULL,
    min_capacity DECIMAL(10, 2) NOT NULL,
    max_capacity DECIMAL(10, 2) NOT NULL,
    ramp_rate DECIMAL(10, 2),
    efficiency DECIMAL(3, 2) CHECK (efficiency >= 0 AND efficiency <= 1),
    fuel_type VARCHAR(50),
    voltage_level DECIMAL(10, 2) NOT NULL,
    bus_id UUID REFERENCES buses(id),
    CHECK (min_capacity <= max_capacity),
    CHECK (rated_capacity <= max_capacity)
);

CREATE INDEX idx_generation_type ON generators(generation_type);
CREATE INDEX idx_gen_bus_id ON generators(bus_id);

-- Transformers table
CREATE TABLE IF NOT EXISTS transformers (
    id UUID PRIMARY KEY REFERENCES grid_elements(id) ON DELETE CASCADE,
    primary_voltage DECIMAL(10, 2) NOT NULL,
    secondary_voltage DECIMAL(10, 2) NOT NULL,
    rated_power DECIMAL(10, 2) NOT NULL,
    current_tap INTEGER DEFAULT 0,
    min_tap INTEGER DEFAULT -10,
    max_tap INTEGER DEFAULT 10,
    tap_step_size DECIMAL(5, 2) DEFAULT 1.25,
    winding_configuration VARCHAR(20),
    cooling_type VARCHAR(10),
    primary_bus_id UUID REFERENCES buses(id),
    secondary_bus_id UUID REFERENCES buses(id),
    CHECK (min_tap <= current_tap AND current_tap <= max_tap)
);

CREATE INDEX idx_primary_bus ON transformers(primary_bus_id);
CREATE INDEX idx_secondary_bus ON transformers(secondary_bus_id);

-- Transmission lines table
CREATE TABLE IF NOT EXISTS transmission_lines (
    id UUID PRIMARY KEY REFERENCES grid_elements(id) ON DELETE CASCADE,
    from_bus_id UUID NOT NULL REFERENCES buses(id),
    to_bus_id UUID NOT NULL REFERENCES buses(id),
    length DECIMAL(10, 2) NOT NULL,
    voltage_level DECIMAL(10, 2) NOT NULL,
    conductor_type VARCHAR(20),
    configuration VARCHAR(20),
    rated_current DECIMAL(10, 2),
    resistance DECIMAL(10, 6),
    reactance DECIMAL(10, 6),
    capacitance DECIMAL(10, 6),
    CHECK (from_bus_id != to_bus_id)
);

CREATE INDEX idx_from_bus ON transmission_lines(from_bus_id);
CREATE INDEX idx_to_bus ON transmission_lines(to_bus_id);
CREATE INDEX idx_bus_pair ON transmission_lines(from_bus_id, to_bus_id);

-- Network topology connections
CREATE TABLE IF NOT EXISTS network_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_element_id UUID NOT NULL REFERENCES grid_elements(id) ON DELETE CASCADE,
    to_element_id UUID NOT NULL REFERENCES grid_elements(id) ON DELETE CASCADE,
    connection_type VARCHAR(20) DEFAULT 'electrical',
    is_connected BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_element_id, to_element_id),
    CHECK (from_element_id != to_element_id)
);

CREATE INDEX idx_from_element ON network_connections(from_element_id);
CREATE INDEX idx_to_element ON network_connections(to_element_id);
CREATE INDEX idx_connection_status ON network_connections(is_connected);

-- Element groups for organizational purposes
CREATE TABLE IF NOT EXISTS element_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS element_group_members (
    group_id UUID REFERENCES element_groups(id) ON DELETE CASCADE,
    element_id UUID REFERENCES grid_elements(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, element_id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_role ON users(role);

-- API keys for real-time data ingestion
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{}',
    rate_limit INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_key_hash ON api_keys(key_hash);
CREATE INDEX idx_active_keys ON api_keys(is_active, expires_at);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    dashboard_config JSONB DEFAULT '{}',
    map_preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data import tracking
CREATE TABLE IF NOT EXISTS data_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes BIGINT,
    imported_by UUID REFERENCES users(id),
    import_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    import_completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    records_processed INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_log JSONB DEFAULT '[]',
    element_mapping JSONB DEFAULT '{}'
);

CREATE INDEX idx_import_status ON data_imports(status);
CREATE INDEX idx_imported_by ON data_imports(imported_by);

-- Audit log for changes
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_action ON audit_log(user_id, action);
CREATE INDEX idx_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);

-- Events and alarms table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id UUID REFERENCES grid_elements(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    parameters JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_element ON events(element_id);
CREATE INDEX idx_event_type ON events(event_type);
CREATE INDEX idx_event_severity ON events(severity);
CREATE INDEX idx_event_status ON events(status);
CREATE INDEX idx_event_created ON events(created_at);

-- Trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_grid_elements_updated_at BEFORE UPDATE
    ON grid_elements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_network_connections_updated_at BEFORE UPDATE
    ON network_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE
    ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create materialized view for network topology
CREATE MATERIALIZED VIEW IF NOT EXISTS network_topology AS
SELECT 
    e1.id as from_id,
    e1.name as from_name,
    e1.element_type as from_type,
    e2.id as to_id,
    e2.name as to_name,
    e2.element_type as to_type,
    nc.connection_type,
    nc.is_connected
FROM network_connections nc
JOIN grid_elements e1 ON nc.from_element_id = e1.id
JOIN grid_elements e2 ON nc.to_element_id = e2.id
WHERE nc.is_connected = true 
    AND e1.deleted_at IS NULL 
    AND e2.deleted_at IS NULL;

CREATE INDEX idx_topology_from ON network_topology(from_id);
CREATE INDEX idx_topology_to ON network_topology(to_id);

-- Create view for element details
CREATE OR REPLACE VIEW element_details AS
SELECT 
    e.*,
    CASE 
        WHEN e.element_type = 'load' THEN jsonb_build_object(
            'load_type', l.load_type,
            'connection_type', l.connection_type,
            'rated_power', l.rated_power,
            'power_factor', l.power_factor,
            'voltage_level', l.voltage_level,
            'priority', l.priority,
            'bus_id', l.bus_id
        )
        WHEN e.element_type = 'generator' THEN jsonb_build_object(
            'generation_type', g.generation_type,
            'rated_capacity', g.rated_capacity,
            'min_capacity', g.min_capacity,
            'max_capacity', g.max_capacity,
            'ramp_rate', g.ramp_rate,
            'efficiency', g.efficiency,
            'fuel_type', g.fuel_type,
            'voltage_level', g.voltage_level,
            'bus_id', g.bus_id
        )
        WHEN e.element_type = 'transformer' THEN jsonb_build_object(
            'primary_voltage', t.primary_voltage,
            'secondary_voltage', t.secondary_voltage,
            'rated_power', t.rated_power,
            'current_tap', t.current_tap,
            'primary_bus_id', t.primary_bus_id,
            'secondary_bus_id', t.secondary_bus_id
        )
        WHEN e.element_type = 'line' THEN jsonb_build_object(
            'from_bus_id', tl.from_bus_id,
            'to_bus_id', tl.to_bus_id,
            'length', tl.length,
            'voltage_level', tl.voltage_level,
            'rated_current', tl.rated_current
        )
        WHEN e.element_type = 'bus' THEN jsonb_build_object(
            'voltage_level', b.voltage_level,
            'bus_type', b.bus_type,
            'substation_id', b.substation_id
        )
    END as properties
FROM grid_elements e
LEFT JOIN loads l ON e.id = l.id
LEFT JOIN generators g ON e.id = g.id
LEFT JOIN transformers t ON e.id = t.id
LEFT JOIN transmission_lines tl ON e.id = tl.id
LEFT JOIN buses b ON e.id = b.id
WHERE e.deleted_at IS NULL;

-- Sample data insertion (optional)
-- Insert a default admin user (password: 'admin123' - should be changed immediately)
INSERT INTO users (email, password_hash, name, role) VALUES 
('admin@gridmonitor.com', '$2a$10$YourHashedPasswordHere', 'System Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Grant permissions (adjust based on your PostgreSQL setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Useful queries for verification
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM pg_indexes WHERE schemaname = 'public';
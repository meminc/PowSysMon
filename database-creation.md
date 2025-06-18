# If using Docker
docker run --name grid-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
# 5431:5432 ? if not works
# Or use your local PostgreSQL installation

# If using Docker
docker run --name grid-redis -p 6379:6379 -d redis

# Or use your local Redis installation

# If using Docker
docker run --name grid-influxdb -p 8086:8086 -d influxdb:2.7

# Or download from https://www.influxdata.com/downloads/


----------------------------------------------------------------------------------------------
# Using Docker
docker run --name grid-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres

# Or ensure your local PostgreSQL is running

4. Run the Database Setup

# Basic setup (schema only)
npm run setup:db

# Setup with sample data
npm run setup:db:sample


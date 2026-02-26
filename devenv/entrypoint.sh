#!/bin/bash
set -e

PG_BIN="/usr/lib/postgresql/bin"

# Set up Postgres user if needed
if ! id -u postgres >/dev/null 2>&1; then
  useradd -m postgres
fi

# Ensure data dir ownership
chown -R postgres:postgres $PGDATA

# Initialize DB if empty (and set password if provided)
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Initializing PostgreSQL database..."

  su postgres -c "$PG_BIN/initdb -D $PGDATA"
  
  # Configure PostgreSQL to listen on all interfaces
  echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
  
  # Allow external connections with scram-sha-256 authentication
  echo "host    all    all    0.0.0.0/0    scram-sha-256" >> "$PGDATA/pg_hba.conf"
  
  if [ -n "$POSTGRES_PASSWORD" ]; then
    echo "Setting password..."
    su postgres -c "$PG_BIN/pg_ctl -D $PGDATA start"
    su postgres -c "$PG_BIN/psql -c \"ALTER USER postgres WITH PASSWORD '$POSTGRES_PASSWORD';\""
    su postgres -c "$PG_BIN/pg_ctl -D $PGDATA stop"
  fi
  
  # Create pgvector extension
  echo "Setting up pgvector extension..."
  su postgres -c "$PG_BIN/pg_ctl -D $PGDATA start"
  su postgres -c "$PG_BIN/psql -d postgres -c \"CREATE EXTENSION IF NOT EXISTS vector;\""
  if [ -n "$POSTGRES_DB" ]; then
    su postgres -c "$PG_BIN/psql -d $POSTGRES_DB -c \"CREATE EXTENSION IF NOT EXISTS vector;\" || true"
  fi
  su postgres -c "$PG_BIN/pg_ctl -D $PGDATA stop"
fi

# Start Postgres
echo "Starting PostgreSQL"
su postgres -c "$PG_BIN/postgres -D $PGDATA -h 0.0.0.0 \${@}"

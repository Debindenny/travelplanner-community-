-- Create additional databases for the per-service architecture.
-- identity_db is created by the POSTGRES_DB env var; this adds the rest.

CREATE DATABASE planner_db OWNER travlplanr;
CREATE DATABASE affiliate_db OWNER travlplanr;
CREATE DATABASE reporting_db OWNER travlplanr;

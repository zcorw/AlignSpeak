-- Run inside the production Postgres container after replacing the password.
-- Example:
-- docker compose -f compose.yml exec -T db psql -U alignspeak -d alignspeak < readonly-user.sql

DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'alignspeak_ro') THEN
      CREATE ROLE alignspeak_ro LOGIN PASSWORD 'replace-with-readonly-password';
   ELSE
      ALTER ROLE alignspeak_ro WITH LOGIN PASSWORD 'replace-with-readonly-password';
   END IF;
END
$$;

GRANT CONNECT ON DATABASE alignspeak TO alignspeak_ro;
GRANT USAGE ON SCHEMA public TO alignspeak_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO alignspeak_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO alignspeak_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO alignspeak_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO alignspeak_ro;

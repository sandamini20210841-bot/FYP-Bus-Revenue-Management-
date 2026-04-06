BEGIN;

-- Refresh users role constraint to include time_keeper.
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%role%'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('rider', 'bus_owner', 'accountant', 'admin', 'time_keeper'));
END $$;

COMMIT;

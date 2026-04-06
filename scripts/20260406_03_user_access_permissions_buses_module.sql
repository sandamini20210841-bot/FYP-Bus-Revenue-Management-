BEGIN;

-- Refresh module_name constraint to include buses.
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'user_access_permissions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%module_name%'
    LOOP
        EXECUTE format('ALTER TABLE user_access_permissions DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE user_access_permissions
        ADD CONSTRAINT user_access_permissions_module_name_check
        CHECK (
            module_name IN (
                'dashboard',
                'discrepancies',
                'routes',
                'buses',
                'summary',
                'reports',
                'users',
                'audit_logs'
            )
        );
END $$;

COMMIT;

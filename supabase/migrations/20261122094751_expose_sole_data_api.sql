-- Preserve existing exposed schemas. RLS and grants still control access.
ALTER ROLE authenticator SET pgrst.db_schemas='public,graphql_public,sole';
NOTIFY pgrst,'reload config';
NOTIFY pgrst,'reload schema';

# Supabase database certificate

`supabase-ca.crt` is the public Supabase Root 2021 certificate downloaded over HTTPS from:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

It is a public trust certificate, not a private key. The PostgreSQL driver verifies certificates and hostnames; it does not disable verification. Set `DATABASE_CA_CERT` to a replacement CA file if the database provider changes. Prisma migrations use the same CA with strict certificate verification.

See https://supabase.com/docs/guides/platform/ssl-enforcement.

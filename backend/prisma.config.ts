import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'
import { fileURLToPath } from 'node:url'
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url))
config({path:local('.env.local'),quiet:true})
config({path:local('.env'),quiet:true})
const connection = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://localhost/ascent_configuration_required')
connection.searchParams.set('sslmode', 'require')
connection.searchParams.set('sslaccept', 'strict')
connection.searchParams.set('sslcert', process.env.DATABASE_CA_CERT || local('certs/supabase-ca.crt'))
export default defineConfig({
  schema:local('prisma/schema.prisma'),
  migrations:{path:local('prisma/migrations')},
  datasource:{url:connection.toString()},
})

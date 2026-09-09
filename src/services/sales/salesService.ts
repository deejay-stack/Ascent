import type { AuthUser } from '../../types/auth'
import type { Sale, SaleRequest } from '../../types/commerce'
export interface SalesService { list(actor: AuthUser): Sale[]; complete(input: SaleRequest): Promise<Sale>; nextTransaction(): string }


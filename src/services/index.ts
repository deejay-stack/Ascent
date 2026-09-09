import { isSupabaseMode } from './supabaseClient'
import { mockProductService } from './products/mockProductService'
import { mockInventoryService } from './inventory/mockInventoryService'
import { mockSalesService } from './sales/mockSalesService'
import { mockPaymentService } from './payments/mockPaymentService'
import { orderService as mockOrderService } from './orders/mockOrderService'
import { reportService as mockReportService } from './reports/reportService'
import { settingsService as mockSettingsService } from './settingsService'
import { productManagementService as mockProductManagementService } from './products/productManagementService'
import { uploadService as mockUploadService } from './uploadService'
import {
  apiProductService,
  apiInventoryService,
  apiSalesService,
  apiPaymentService,
  apiOrderService,
  apiReportService,
  apiSettingsService,
  apiProductManagementService,
  apiUploadService,
} from './remote/apiServices'
export const productService = isSupabaseMode ? apiProductService : mockProductService
export const inventoryService = isSupabaseMode ? apiInventoryService : mockInventoryService
export const salesService = isSupabaseMode ? apiSalesService : mockSalesService
export const paymentService = isSupabaseMode ? apiPaymentService : mockPaymentService
export const orderService = isSupabaseMode ? apiOrderService : mockOrderService
export const reportService = isSupabaseMode ? apiReportService : mockReportService
export const settingsService = isSupabaseMode ? apiSettingsService : mockSettingsService
export const productManagementService = isSupabaseMode
  ? apiProductManagementService
  : mockProductManagementService
export const uploadService = isSupabaseMode ? apiUploadService : mockUploadService

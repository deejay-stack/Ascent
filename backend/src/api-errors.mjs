import { z } from 'zod'
import multer from 'multer'

export function apiError(error) {
  const connectionFailure = ['DatabaseNotReachable', 'ConnectionClosed', 'SocketTimeout'].includes(
    error.meta?.driverAdapterError?.cause?.kind,
  )
  if (error instanceof z.ZodError)
    return {
      status: 400,
      message: error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
    }
  if (error instanceof multer.MulterError)
    return {
      status: error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? 'The image is too large. Choose a PNG, JPEG or WebP up to 2 MB.'
          : 'Upload one product image using the image field.',
    }
  if (error.type === 'entity.parse.failed')
    return { status: 400, message: 'The request contains invalid JSON.' }
  if (error.type === 'entity.too.large')
    return {
      status: 413,
      message: 'The request is too large. Upload images using the product image field.',
    }
  if (
    connectionFailure ||
    [
      'P1001',
      'P1002',
      'P1008',
      'P1017',
      'P2024',
      'P2028',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
    ].includes(error.code)
  )
    return {
      status: 503,
      message: 'The database connection was interrupted or timed out. Please try again shortly.',
    }
  if (error.status) return { status: error.status, message: error.message }
  const known = {
    P2002: [409, 'This SKU, barcode, category or account already exists.'],
    P2003: [
      409,
      'The referenced record is missing or is still used elsewhere. Refresh and check your selection.',
    ],
    P2025: [404, 'Record not found.'],
    P2034: [409, 'Another operation changed this record. Please try again.'],
  }[error.code]
  return known
    ? { status: known[0], message: known[1] }
    : { status: 500, message: 'The operation could not be completed. Please try again.' }
}

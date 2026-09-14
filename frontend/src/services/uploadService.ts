export const uploadService = {
  async productImage(file: File): Promise<string> {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    )
      throw new Error('Choose a JPG, PNG or WebP image under 2 MB.')
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('The image could not be read.'))
      reader.readAsDataURL(file)
    })
  },
}

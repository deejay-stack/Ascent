import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const directory = resolve('frontend/public/images/payments')
const assets = {
  gcash:
    'https://cdn.prod.website-files.com/6385b55675a0bd614777a5c1/64265cd252f7516ad684940c_Webclip.png',
  maya: 'https://www.maya.ph/hubfs/Maya/favicons/MAYA_FAVICONS-Mint-OnBlackBG.png',
  paypal: 'https://www.paypalobjects.com/webstatic/icon/pp258.png',
}
await mkdir(directory, { recursive: true })
for (const [name, url] of Object.entries(assets)) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not download ' + name)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (
    bytes.length > 1000000 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('Unexpected image format')
  await writeFile(resolve(directory, name + '.png'), bytes)
  console.log(name + ' official icon saved: ' + bytes.length + ' bytes')
}
await writeFile(
  resolve(directory, 'README.md'),
  '# Payment brand assets\n\nUnmodified icons sourced from the official provider websites. Trademarks belong to their respective owners; their use identifies demo payment methods and does not imply affiliation.\n\n' +
    Object.entries(assets)
      .map(([name, url]) => '- [' + name + '](' + url + ')')
      .join('\n') +
    '\n',
)

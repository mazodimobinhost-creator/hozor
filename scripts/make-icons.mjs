import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve('public/icons/icon.svg')
const outDir = resolve('public/icons')
mkdirSync(outDir, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
]

for (const t of targets) {
  await sharp(src, { density: 600 })
    .resize(t.size, t.size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, t.file))
  console.log('wrote', t.file)
}

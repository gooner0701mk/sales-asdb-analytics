/**
 * PWA / ホーム画面用 PNG を生成する。
 * 独自画像に差し替えるときは public/icons/source.png（1024×1024 推奨）を置いて実行。
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'public', 'icons')
const sourcePng = join(iconsDir, 'source.png')
const sourceSvg = join(iconsDir, 'app-icon.svg')
const input = existsSync(sourcePng) ? sourcePng : sourceSvg

const outputs = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-512-maskable.png', size: 512, maskable: true },
]

async function main() {
  for (const { file, size, maskable } of outputs) {
    let img = sharp(input).resize(size, size, { fit: 'cover' })
    if (maskable) {
      const pad = Math.round(size * 0.1)
      const inner = size - pad * 2
      const innerBuf = await sharp(input)
        .resize(inner, inner, { fit: 'cover' })
        .png()
        .toBuffer()
      img = sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 37, g: 99, b: 235, alpha: 1 },
        },
      }).composite([{ input: innerBuf, left: pad, top: pad }])
    }
    await img.png().toFile(join(iconsDir, file))
    console.log(`wrote ${file} (${size}px)`)
  }
  console.log(`source: ${input.replace(root, '.')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

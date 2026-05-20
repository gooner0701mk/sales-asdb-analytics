/**
 * PWA / ホーム画面用 PNG を生成する。
 * 独自画像: public/icons/source.png（正方形推奨・1024px以上）を置いて npm run icons
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'public', 'icons')
const sourcePng = join(iconsDir, 'source.png')
const sourceSvg = join(iconsDir, 'app-icon.svg')
const useCustomLogo = existsSync(sourcePng)
const input = useCustomLogo ? sourcePng : sourceSvg

const logoBg = { r: 255, g: 255, b: 255, alpha: 1 }
const defaultBg = { r: 37, g: 99, b: 235, alpha: 1 }

const outputs = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-512-maskable.png', size: 512, maskable: true },
]

async function squareIcon(size, { maskable = false } = {}) {
  const bg = useCustomLogo ? logoBg : defaultBg
  const pad = maskable ? Math.round(size * 0.12) : useCustomLogo ? Math.round(size * 0.06) : 0
  const inner = size - pad * 2
  const fit = useCustomLogo ? 'contain' : 'cover'

  const innerBuf = await sharp(input)
    .resize(inner, inner, { fit, background: bg })
    .png()
    .toBuffer()

  return sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  }).composite([{ input: innerBuf, left: pad, top: pad }])
}

async function main() {
  for (const { file, size, maskable } of outputs) {
    const img = await squareIcon(size, { maskable })
    await img.png().toFile(join(iconsDir, file))
    console.log(`wrote ${file} (${size}px)`)
  }
  console.log(`source: ${input.replace(root, '.')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

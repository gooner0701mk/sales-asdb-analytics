import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'attendance',
  'constants.ts',
)

const src = `/** \u6240\u5b9a\u52b4\u50cd\u6642\u9593\uff08\u5206\uff09 */
export const STANDARD_WORK_MINUTES = 8 * 60

/** \u81ea\u52d5\u63a7\u9664\u3059\u308b\u4f11\u61a9\uff08\u5206\uff09 */
export const AUTO_BREAK_MINUTES = 60

/** \u9031\u306e\u6240\u5b9a\u52b4\u50cd\u6642\u9593\uff08\u5206\uff09\u2014 \u8d85\u904e\u8868\u793a\u7528 */
export const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60
`

fs.writeFileSync(out, src, 'utf8')
console.log('constants.ts ok')

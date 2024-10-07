import test from 'node:test'

import * as path from 'forward-slash-path'
import fs from 'fs-extra'

import makeCli from 'src/makeCli.js'

const thisFolder = path.cleanPath(import.meta.dirname)
const rootFolder = path.dirname(thisFolder)
test('run', async () => {
  const outputFolder = `${rootFolder}/out/test/basic`
  await fs.emptyDir(outputFolder)
  const cli = makeCli()
  await cli([
    '--projects-folder',
    `${thisFolder}/fixture/projects`,
    '--debug',
    '--output-mode',
    'none',
    '--chrome-executable',
    process.env.CHROME_EXECUTABLE || 'D:/portable/thorium/126.0.6478.251/BIN/thorium.exe',
    '--output-folder',
    `${rootFolder}/out/test`,
    'basic',
  ])
})

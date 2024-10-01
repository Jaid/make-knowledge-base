import test from 'node:test'

import * as path from 'forward-slash-path'

import makeCli from 'src/makeCli.js'

const thisFolder = path.cleanPath(import.meta.dirname)
const rootFolder = path.dirname(thisFolder)
test('run', async () => {
  const cli = makeCli()
  await cli([
    '--projects-folder',
    `${thisFolder}/fixture/projects`,
    '--use-cache',
    'false',
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

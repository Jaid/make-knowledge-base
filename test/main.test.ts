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
    // '--use-cache',
    // 'false',
    '--output-mode',
    'none',
    '--chrome-executable',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '--output-folder',
    `${rootFolder}/out/test`,
    'basic',
  ])
})

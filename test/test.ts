import type {FirstParameter} from 'more-types'

import process from 'node:process'
import {run} from 'node:test'

import * as path from 'forward-slash-path'
import {tap as tapReporter} from 'node:test/reporters'

const thisFolder = path.cleanPath(import.meta.dirname)
const runOptions: FirstParameter<typeof run> = {
  globPatterns: [`${thisFolder}/*.test.ts`],
  timeout: 60_000,
}
const onFail = () => {
  process.exitCode = 1
}
run(runOptions)
  .on('test:fail', onFail)
  .compose(tapReporter)
  .pipe(process.stdout)

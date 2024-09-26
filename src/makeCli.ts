import type {FirstParameter} from 'more-types'
import type {InferredOptionTypes} from 'yargs'

import {makeCli} from 'zeug'

import * as mainCommand from 'src/command/main.js'

export type GlobalArgs = InferredOptionTypes<typeof globalOptions>
const globalOptions = {
  verbose: {
    type: `boolean`,
    default: false,
    description: `Enable verbose logging (DEBUG=make-knowledge-base)`,
  },
  debug: {
    type: `boolean`,
    default: false,
    description: `Output additional debug information to file system`,
  },
} as const
export default (additionalOptions: FirstParameter<typeof makeCli> = {}) => {
  return makeCli({
    command: mainCommand,
    strict: true,
    ...additionalOptions,
  })
}

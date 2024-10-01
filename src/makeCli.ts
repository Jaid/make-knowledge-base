import type {YargsArgs} from 'lib/YargsArgs.js'
import type {FirstParameter} from 'more-types'

import {makeCli} from 'zeug'

import * as mainCommand from 'src/command/main.js'

export type GlobalArgs = YargsArgs<typeof globalOptions>
const globalOptions = {
  verbose: {
    type: 'boolean',
    default: false,
    description: 'Enable verbose logging (DEBUG=make-knowledge-base)',
  },
  debug: {
    type: 'boolean',
    default: false,
    description: 'Output additional debug information to file system',
  },
}
export default (additionalOptions: FirstParameter<typeof makeCli> = {}) => {
  return makeCli({
    command: mainCommand,
    strict: true,
    ...additionalOptions,
  })
}

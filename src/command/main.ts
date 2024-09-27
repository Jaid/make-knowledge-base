import type {GlobalArgs} from 'src/makeCli.js'
import type {Simplify} from 'type-fest'
import type {ArgumentsCamelCase, Argv, CommandBuilder} from 'yargs'

import debug from 'lib/debug.js'
import run from 'src/run.js'

export type Args = (typeof builder) extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never
export type ArgsMerged = Simplify<GlobalArgs & Args>

export const command = '$0 [projectIds...]'
export const description = 'Compiles source entries into a knowledge base'
export const builder = (argv: Argv) => {
  return argv
    .positional('projectIds', {
      type: 'string',
      array: true,
      description: 'Project IDs to process',
      demandOption: true,
    })
    .option('projectsFolder', {
      type: 'string',
      description: 'Path to the projects folder',
      demandOption: true,
    })
    .option('invalidateCacheAfterMinutes', {
      type: 'number',
      default: 10_080, // 7 days
      description: 'Invalidate cache after this many minutes',
    })
    .option('invalidateCacheOnEntryChange', {
      type: 'boolean',
      default: false,
      description: 'Invalidate cache when entry changes',
    })
    .option('outputFileExtension', {
      type: 'string',
      default: 'txt',
      description: 'Output file extension',
    })
    .option('pandocPath', {
      type: 'string',
      default: 'pandoc',
      description: 'Path to pandoc executable',
    })
    .option('chromeExecutable', {
      type: 'string',
      default: 'google-chrome',
      description: 'Path to Chrome executable',
    })
    .option('minifyWholeDocument', {
      type: 'boolean',
      default: true,
      description: 'Minify the whole document',
    })
    .option('useCache', {
      type: 'boolean',
      default: true,
      description: 'Use cache',
    })
    .option('outputMode', {
      type: 'string',
      default: 'single',
      description: 'Output mode',
      choices: ['single', 'multiple', 'none'],
    })
    .option('outputTreeFile', {
      type: 'string',
      description: 'Output tree file',
    })
}

export const handler = async (args: ArgsMerged) => {
  debug('Args: %o', args)
  await run(args)
}

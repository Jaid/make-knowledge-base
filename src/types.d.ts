import type {Context, RunFunction} from 'lib/context.ts'
import type {SecondParameter} from 'more-types'
import type {Options} from 'src/cli.ts'
import type {Promisable, ValueOf} from 'type-fest'

type ExtractorFunctionContext = Context & {
  id: string
  options: Options['merged']
}

export type ExtractorFunction = (entry: ValueOf<Options['parameter']['entries']>, context: ExtractorFunctionContext) => Promisable<string>

import type {SecondParameter} from 'more-types'
import type {Options} from 'src/cli.ts'
import type {Promisable, ValueOf} from 'type-fest'

type ExtractorFunctionContext = {
  id: string
  options: Options['merged']
}

export type ExtractorFunction = (entry: ValueOf<Options['parameter']['entries']>, context: ExtractorFunctionContext) => Promisable<string>

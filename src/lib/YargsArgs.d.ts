import type {Dict} from 'more-types'
import type {OmitIndexSignature, Simplify} from 'type-fest'
import type {ArgumentsCamelCase, Argv, InferredOptionTypes} from 'yargs'

export type YargsArgs<Builder> =
  Builder extends (argv: Argv<any>) => Argv<infer InferredArgs>
    ? Simplify<OmitIndexSignature<ArgumentsCamelCase<InferredArgs>>>
    : Builder extends Dict
      ? Simplify<OmitIndexSignature<ArgumentsCamelCase<InferredOptionTypes<Builder>>>>
      : never

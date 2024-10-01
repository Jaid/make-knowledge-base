import type {Dict} from 'more-types'
import type {OmitIndexSignature, Simplify} from 'type-fest'
import type {ArgumentsCamelCase, Argv, InferredOptionTypes} from 'yargs'

type DefaultKeys = '$0' | '_'

export type YargsArgs<Builder> =
  Builder extends (argv: Argv<any>) => Argv<infer InferredArgs>
    ? Simplify<Omit<OmitIndexSignature<ArgumentsCamelCase<InferredArgs>>>, DefaultKeys>
    : Builder extends Dict
      ? Simplify<Omit<OmitIndexSignature<ArgumentsCamelCase<InferredOptionTypes<Builder>>>>, DefaultKeys>
      : never

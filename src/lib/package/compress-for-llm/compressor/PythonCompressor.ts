import type {Dict} from 'more-types'

import dedent from 'dedent'
import {execa} from 'execa'
import JSON5 from 'json5'
import which from 'which'

import TextCompressor from 'lib/package/compress-for-llm/compressor/TextCompressor.js'

export const formatPython = async (code: string, options: Pick<PythonCompressor[`options`], `yapfConfig` | `yapfExecutableFile`>) => {
  const yapfExecutable = options.yapfExecutableFile ?? await which(`yapf`)
  const style = options.yapfConfig
  const executionResult = await execa({
    input: code,
  })`${yapfExecutable} --no-local-style --style=${JSON5.stringify(style)}`
  console.dir({yapfResult: executionResult.stdout})
  return executionResult.stdout
}

const pyminify = async (code: string, options: Pick<PythonCompressor[`options`], `pyminifyExecutableFile` | `pyminifyFlags`>) => {
  console.dir({
    code,
    options,
  })
  const pyminifyArguments = options.pyminifyFlags.map(argument => `--${argument}`)
  const pyminifyExecutable = options.pyminifyExecutableFile ?? await which(`pyminify`)
  const executionResult = await execa({
    input: code,
  })`${pyminifyExecutable} ${pyminifyArguments} -`
  return executionResult.stdout
}

export const minifyPython = async (code: string, options: PythonCompressor[`options`]) => {
  code = await pyminify(code, options)
  code = await formatPython(code, options)
  return code
}

type Options = {
  pyminifyExecutableFile?: string
  pyminifyFlags: Array<string>
  yapfConfig?: Dict
  yapfExecutableFile?: string
}

const defaultOptions = {
  pyminifyFlags: [
    `remove-literal-statements`,
    `no-remove-annotations`,
    `no-rename-locals`,
    `no-hoist-literals`,
    `no-convert-posargs-to-args`,
    `remove-asserts`,
    `remove-debug`,
    `no-preserve-shebang`,
  ],
  yapfConfig: {
    column_limit: 1_000_000,
    indent_width: 2,
    spaces_before_comment: 1,
    blank_line_before_class_docstring: false,
    blank_line_before_module_docstring: false,
    blank_line_before_nested_class_or_def: false,
    blank_lines_around_top_level_definition: 0,
    blank_lines_between_top_level_imports_and_variables: 0,
  },
}

export default class PythonCompressor<ExtraOptions = {}> extends TextCompressor<ExtraOptions & Options> {
  async compress(code: string) {
    const compressed = await minifyPython(code, this.options)
    const cleaned = await super.compress(compressed)
    return cleaned
  }
  getDefaultOptions(): Partial<ExtraOptions & Options> {
    return {
      ...super.getDefaultOptions(),
      ...defaultOptions,
    }
  }
}

if (import.meta.filename.toLowerCase() === process.argv[1].toLowerCase()) {
  const compressor = new PythonCompressor
  const code = dedent`
    if 100 >= 100:
      assert True
      print("hello" + " " + "world")
    if 100 > 100:
      print("this")
      print("branch")
      print("is")
      print("unreachable")
  `
  const result = await compressor.compress(code)
  console.dir({result})
}

import type {Dict} from 'more-types'
import type {Promisable} from 'type-fest'

import prettier from '@prettier/sync'
import YAML from 'yaml'
import {toCleanYaml} from 'zeug'

import JsonCompressor from 'lib/package/compress-for-llm/compressor/JsonCompressor.js'
import PythonCompressor from 'lib/package/compress-for-llm/compressor/PythonCompressor.js'
import {CodeContentModule} from 'src/make_knowledge_base/contentModule/CodeContentModule.js'
import {DownloadExtractor} from 'src/make_knowledge_base/extractor/DownloadExtractor.js'
import {minifyText} from 'src/make_knowledge_base/lib/minifyText.js'

export type ExtraOptions = {
}

const pythonCompressor = new PythonCompressor
const jsonCompressor = new JsonCompressor
const formatters: Dict<(input: string) => Promisable<string>> = {
  json: input => jsonCompressor.compress(input),
  yml: input => {
    const object = YAML.parse(input)
    return toCleanYaml(object)
  },
  ts: input => {
    const codeCompressed = input.replaceAll(/^\s*[\n\r]/gm, ``)
    const codeFormatted = prettier.format(codeCompressed, {
      parser: `typescript`,
      arrowParens: `avoid`,
      bracketSameLine: true,
      bracketSpacing: false,
      embeddedLanguageFormatting: `off`,
      jsxSingleQuote: true,
      printWidth: 1_000_000,
      quoteProps: `as-needed`,
      requirePragma: false,
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: `none`,
    })
    const codeCleaned = minifyText(codeFormatted)
    return codeCleaned
  },
  py: input => pythonCompressor.compress(input),
  toml: input => {
    const codeCleaned = minifyText(input)
    return codeCleaned
  },
} as const

export class CodeExtractor<ExtraOptionsGeneric = {}> extends DownloadExtractor<ExtraOptions & ExtraOptionsGeneric> {
  getContentModule() {
    return new CodeContentModule(this.entry, this.content)
  }
  getExtensionNormalized() {
    const extension = super.getExtensionNormalized()
    if (!extension) {
      return
    }
    const isJsRegex = /^[cm]?[jt]sx?$/
    if (isJsRegex.test(extension)) {
      return `ts`
    }
    return extension
  }
  async init() {
    await super.init()
    const extension = this.getExtensionNormalized()
    if (!extension) {
      return
    }
    const formatter = formatters[extension]
    if (formatter) {
      try {
        const formattedCode = await formatter(this.content)
        this.content = formattedCode.trim()
      } catch (error) {
        this.context.log(`Error formatting ${extension} content: ${error}`)
      }
    }
  }
}

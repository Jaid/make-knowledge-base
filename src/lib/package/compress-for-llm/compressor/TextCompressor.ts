import type {Promisable} from 'type-fest'

import Compressor from 'lib/package/compress-for-llm/compressor/Compressor.js'

type Options = {
  /**
   * Controls how leading whitespace is handled
   * @default true
   * @example Disable dedent
   * ```ts
   * const options = {
   *   dedent: false
   * }
   * ```
   * @example Dedent common whitespace for every line, but keep individual indentation
   * ```ts
   * const options = {
   *   dedent: true // or 'common'
   * }
   * ```
   * @example Just remove all leading whitespace
   * ```ts
   * const options = {
   *   dedent: 'crush'
   * }
   */
  dedent?: 'common' | 'crush' | boolean
}

const defaultOptions = {
  dedent: true as Options['dedent'],
}

/**
 * If every single line (blank lines excluded) starts with the same whitespace, return that whitespace
 */
export const getGlobalIndentation = (text: string) => {
  const lines = text.split('\n').filter(line => line.trim() !== '')
  if (lines.length === 0) {
    return
  }
  const whitespacePattern = /^(\s+)/
  const firstIndentMatch = whitespacePattern.exec(lines[0])
  const firstIndent = firstIndentMatch?.[0]
  if (firstIndent === undefined) {
    return
  }
  const allSame = lines.every(indent => {
    const match = whitespacePattern.exec(indent)
    return match?.[0] === firstIndent
  })
  if (allSame) {
    return firstIndent
  }
}

export const dedentCommon = (text: string) => {
  const globalIndent = getGlobalIndentation(text)
  if (globalIndent === undefined) {
    return text
  }
  const lines = text.split('\n')
  const linesDedented = lines.map(line => {
    if (line.startsWith(globalIndent)) {
      return line.slice(globalIndent.length)
    }
    return line
  })
  return linesDedented.join('\n')
}

export const minifyText = (text: string, options: TextCompressor['options']): string => {
  // remove empty lines
  text = text.replaceAll(/^\s*[\n\r]/gm, '')
  // replace \r\n with \n
  text = text.replaceAll('\r\n', '\n')
  // replace \n\r with \n
  text = text.replaceAll('\n\r', '\n')
  // replace \r with \n
  text = text.replaceAll('\r', '\n')
  if (options.dedent === true || options.dedent === 'common') {
    text = dedentCommon(text)
  } else if (options.dedent === 'crush') {
    // strip line starts
    text = text.replaceAll(/^([^\S\n]+)/gm, '')
  }
  // strip line ends
  text = text.replaceAll(/([^\S\n]+)$/gm, '')
  return text
}

export default class TextCompressor<ExtraOptions = {}> extends Compressor<ExtraOptions & Options> {
  compress(code: string): Promisable<string> {
    return minifyText(code, this.options)
  }
  getDefaultOptions(): Partial<ExtraOptions & Options> {
    return {
      ...super.getDefaultOptions(),
      ...defaultOptions,
    }
  }
}

if (import.meta.filename.toLowerCase() === process.argv[1].toLowerCase()) {
  const compressor = new TextCompressor({dedent: true})
  const code = '  a  \n  b\n  c\n'
  const result = await compressor.compress(code)
  console.dir({result})
}

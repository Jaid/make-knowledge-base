type Options = {
  unindent?: boolean
}

export const minifyText = (text: string, options: Options = {}) => {
  // remove empty lines
  text = text.replaceAll(/^\s*[\n\r]/gm, ``)
  // replace \r\n with \n
  text = text.replaceAll(`\r\n`, `\n`)
  // replace \n\r with \n
  text = text.replaceAll(`\n\r`, `\n`)
  // replace \r with \n
  text = text.replaceAll(`\r`, `\n`)
  if (options.unindent ?? false) {
  // strip line starts
    text = text.replaceAll(/^([^\S\n]+)/gm, ``)
  }
  // strip line ends
  text = text.replaceAll(/([^\S\n]+)$/gm, ``)
  return text
}

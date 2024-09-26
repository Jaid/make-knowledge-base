import type {FirstParameter} from 'more-types'

import showdown from 'showdown'

type Options = showdown.ConverterOptions & {
  flavor?: FirstParameter<InstanceType<typeof showdown.Converter>[`setFlavor`]>
}

export const markdownToSimpleHtml = (markdownInput: string, showdownOptions?: Options) => {
  const converter = new showdown.Converter({
    tables: true,
    noHeaderId: true,
    tablesHeaderId: false,
    ...showdownOptions,
  })
  if (showdownOptions?.flavor) {
    converter.setFlavor(showdownOptions.flavor)
  }
  const html = converter.makeHtml(markdownInput)
  return html.replace(/^<p>/, ``).replace(/<\/p>$/, ``)
}

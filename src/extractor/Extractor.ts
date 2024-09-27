import type {ContentModule} from 'src/contentModule/ContentModule.js'
import type {RunSingleOptions} from 'src/run.js'

import debug from 'lib/debug.js'
import {HtmlContentModule} from 'src/contentModule/HtmlContentModule.js'

export type Entry<ExtraOptions = {}> = ExtraOptions & {
  id: string
  title?: string
  url: string
}

type ExtractorContext = {
  args: RunSingleOptions
  id: string
}

export type ContentTypeId = keyof typeof contentTypes

export const contentTypes = {
  html: {
    title: 'HTML',
    extension: 'html',
  },
  markdown: {
    title: 'Markdown',
    extension: 'md',
  },
}

export abstract class Extractor<ExtraOptions = {}> {
  content: string
  context: ExtractorContext
  entry: Entry<ExtraOptions>
  constructor(entry: Extractor<ExtraOptions>['entry'], context: Extractor<ExtraOptions>['context']) {
    this.entry = entry
    this.context = context
  }
  getContent() {
    return this.content
  }
  protected getContentModule(): ContentModule {
    const text = this.getContent()
    const title = this.getTitle()
    return new HtmlContentModule(this.entry, text, title)
  }
  getContentModules(): Array<ContentModule> {
    return [this.getContentModule()]
  }
  getTitle() {
    return this.entry.title ?? this.context.id
  }
  async init() {
  }
  log(message: string) {
    console.log(`  ${message}`)
  }
  logVerbose(message: string) {
    debug(`  ${message}`)
  }
}

import type {CacheContentModule, Entry} from 'src/make_knowledge_base/cli.js'

import {ContentModule} from './ContentModule.js'

export class CachedContentModule extends ContentModule {
  constructor(entry: Entry, text: string, cacheData: CacheContentModule) {
    super(entry, text, cacheData.title)
  }
  asHtml(): string {
    return `<div id='${this.entry.id}'>${this.sourceText}</div>`
  }
  getRaw(): string {
    return this.sourceText
  }
}

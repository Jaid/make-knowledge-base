import type {Entry} from 'src/make_knowledge_base/cli.js'

export abstract class ContentModule {
  entry: Entry
  sourceText: string
  title?: string
  constructor(entry: Entry, sourceText: string, title?: string) {
    this.entry = entry
    this.sourceText = sourceText
    this.title = title
  }
  abstract asHtml(): string
  getTitle() {
    return this.entry.title ?? this.title
  }
}

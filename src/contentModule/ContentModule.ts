import type {Entry} from 'src/run.js'

export abstract class ContentModule {
  entry: Entry
  sourceText: string
  title?: string
  constructor(entry: Entry, sourceText: string, title?: string) {
    this.entry = entry
    this.sourceText = sourceText
    this.title = title
  }
  getFileExtension() {
    return 'txt'
  }
  abstract asHtml(): string
  getTitle() {
    return this.entry.title ?? this.title
  }
}

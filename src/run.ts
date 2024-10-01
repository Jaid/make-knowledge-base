import type {Dict} from 'more-types'
import type {ArgsMerged} from 'src/command/main.js'
import type {ContentModule} from 'src/contentModule/ContentModule.js'
import type {Simplify} from 'type-fest'

import {pathToFileURL} from 'node:url'

import epochSeconds from 'epoch-seconds'
import * as path from 'forward-slash-path'
import fs from 'fs-extra'
import mapObject, {mapObjectSkip} from 'map-obj'
import hashObject from 'object-hash'
import readFileYaml from 'read-file-yaml'
import {toYamlFile} from 'zeug'

import getTokenSize from 'lib/getTokenSize.js'
import {CodeContentModule} from 'src/contentModule/CodeContentModule.js'
import {HtmlContentModule} from 'src/contentModule/HtmlContentModule.js'
import {MarkdownContentModule} from 'src/contentModule/MarkdownContentModule.js'
import {CodeExtractor} from 'src/extractor/CodeExtractor.js'
import {DownloadExtractor} from 'src/extractor/DownloadExtractor.js'
import {HtmlExtractor} from 'src/extractor/HtmlExtractor.js'
import {HtmlFromMarkdownExtractor} from 'src/extractor/HtmlFromMarkdownExtractor.js'
import {MarkdownExtractor} from 'src/extractor/MarkdownExtractor.js'
import {MarkdownFromHtmlExtractor} from 'src/extractor/MarkdownFromHtmlExtractor.js'
import {RedditThreadExtractor} from 'src/extractor/RedditThreadExtractor.js'
import {WikimediaExtractor} from 'src/extractor/WikimediaExtractor.js'
import {guessExtractor} from 'src/guessExtractor.js'
import * as ansi from 'src/lib/ansi.js'
import debug from 'src/lib/debug.js'
import {outputEngineTypes} from 'src/outputEngine/index.js'

export type Entries = Dict<AnonymousEntry>

type BaseEntry = {
  extractor?: keyof typeof extractors
  page?: string
  target?: Dict | number | string
  title?: string
  type?: string
}

export type AnonymousEntry = BaseEntry & Dict

export type Entry = AnonymousEntry & {
  id: number | string
}

export const extractors = {
  download: DownloadExtractor,
  markdown: MarkdownExtractor,
  markdownFromHtml: MarkdownFromHtmlExtractor,
  wikimedia: WikimediaExtractor,
  html: HtmlExtractor,
  htmlFromMarkdown: HtmlFromMarkdownExtractor,
  code: CodeExtractor,
  redditThread: RedditThreadExtractor,
}
export const contentModules = {
  code: CodeContentModule,
  html: HtmlContentModule,
  markdown: MarkdownContentModule,
}

export type CacheContentModule = {
  title: string
  type: string
}

type CacheEntry = {
  content: Dict<{
    extension?: string
    title: string
    type: string
  }>
  hash: string
  timestamp: number
}

type CachePage = Dict<CacheEntry>

type Cache = Dict<CachePage>

type ReportContentEntry = {
  sizeBytes: number
}

type ReportEntry = {
  content: Dict<ReportContentEntry>
  timeMs: number
}

type ReportPage = Dict<ReportEntry>

type Report = Dict<ReportPage>

type TreeNode = {
  contentModules: Array<ContentModule>
  entries: Array<TreeNode>
  id: string
}

export type RunSingleOptions = Simplify<Omit<ArgsMerged, 'projectIds' | 'projectsFolder'> & {
  outputFolder: string
  projectFolder: string
  projectId: string
}>

const runSingle = async (args: RunSingleOptions) => {
  debug('Args: %O', args)
  const contentFolder = path.join(args.outputFolder, 'content')
  const cacheIndexFile = path.join(args.outputFolder, 'cache.yml')
  const entriesScriptFile = path.join(args.projectFolder, 'sources.ts')
  const {default: entries} = await import(pathToFileURL(entriesScriptFile).toString()) as {default: Entries}
  debug('Entries: %O', entries)
  let cacheIndex: Cache = {}
  const report: Report = {} // Initialize the report object
  if (Object.keys(entries).length === 0) {
    console.log(`No entries found in ${ansi.linkedFile(entriesScriptFile)}`)
    return
  }
  if (args.useCache && await fs.pathExists(cacheIndexFile)) {
    try {
      const loadedCache = await readFileYaml.default(cacheIndexFile) as Cache
      cacheIndex = loadedCache
      console.log(`Loaded cache index from ${ansi.linkedFile(cacheIndexFile)}`)
    } catch (error) {
      console.log('Failed to load cache index. Proceeding without cache.')
    }
  }
  const contentModulePages: Dict<Array<ContentModule> | undefined> = {}
  const treePages: Dict<TreeNode> = {}
  const processEntry = async (value: BaseEntry, id: string, parentNode: TreeNode, pathSegments: Array<string>): Promise<void> => {
    const startTime = Date.now() // Start timing
    const entryId = id || '(no id)'
    const node: TreeNode = {
      id: entryId,
      entries: [],
      contentModules: [],
    }
    parentNode.entries.push(node)
    const currentPathSegments = [...pathSegments, entryId]
    if (value.type) {
      console.log(ansi.make`[type ${value.type}] ${entryId}`)
    } else {
      const extractorName = value.extractor ?? 'guess'
      console.log(ansi.make`[extractor ${extractorName}] ${entryId}`)
    }
    debug(value)
    let entry: Entry = {
      ...value,
      id: entryId,
    }
    const guess = await guessExtractor(entry)
    if (!guess)
      return
    if (Array.isArray(guess)) {
      console.log(`↓ [${guess.length}]`)
      for (const guessEntry of guess)
        await processEntry(guessEntry, guessEntry.id.toString() || '(no id)', node, currentPathSegments)
      return
    }
    if (typeof guess === 'string') {
      entry = {
        ...entry,
        extractor: guess,
      }
    } else if (guess !== true) {
      console.log('↓')
      await processEntry(guess, guess.id.toString() || '(no id)', node, currentPathSegments)
      return
    }
    if (entry.extractor === undefined)
      throw new TypeError('Extractor is not defined')
    const timestamp = epochSeconds()
    const pageId = value.page ?? ''
    if (!cacheIndex[pageId])
      cacheIndex[pageId] = {}
    if (!report[pageId])
      report[pageId] = {}
    const pageCache = cacheIndex[pageId]
    const pageReport = report[pageId]
    const entryHash = hashObject(entry)
    const cachedEntry = pageCache[entryId]
    debug('Found cached entry: %O', cachedEntry)
    let useCache = false
    if (cachedEntry && args.useCache) {
      const isHashMatching = cachedEntry.hash.toLowerCase() === entryHash.toLowerCase()
      const cacheAge = timestamp - cachedEntry.timestamp
      const isExpired = args.invalidateCacheAfterMinutes && cacheAge > args.invalidateCacheAfterMinutes * 60
      if (isExpired)
        debug('Cache expired for entry %s', entryId)
      else if (!args.invalidateCacheOnEntryChange)
        useCache = true
      else if (isHashMatching)
        useCache = true
    }
    let newContentModules: Array<ContentModule> = []
    if (useCache) {
      const cachedContent = cachedEntry.content || {}
      for (const [cmKey, cmData] of Object.entries(cachedContent)) {
        const cacheFileName = `${cmKey}.${cmData.extension || 'txt'}`
        const contentModulePath = path.join(contentFolder, ...currentPathSegments, cacheFileName)
        const cacheFileExists = await fs.pathExists(contentModulePath)
        if (cacheFileExists) {
          const sourceText = await fs.readFile(contentModulePath, 'utf8')
          const ContentModule = contentModules[cmData.type]
          if (!ContentModule)
            throw new TypeError(`Unknown content module type: ${cmData.type}`)
          const cachedContentModule = new ContentModule({
            entry,
            sourceText,
            title: cmData.title,
          })
          newContentModules.push(cachedContentModule)
          // Compute sizeBytes and store in report
          const sizeBytes = Buffer.byteLength(sourceText, 'utf8')
          if (!pageReport[entryId])
            pageReport[entryId] = {
              timeMs: 0,
              content: {},
            }
          pageReport[entryId].content[cmKey] = {
            sizeBytes,
          }
        } else {
          useCache = false
          debug('File not found: %s', contentModulePath)
          break
        }
      }
      if (useCache)
        console.log(`✓ Cache hit for entry ${entryId}`)
    }
    if (!useCache) {
      const ExtractorClass = extractors[entry.extractor]
      if (!ExtractorClass)
        throw new TypeError(`Unknown extractor: ${entry.extractor}`)
      const extractorContext = {
        args,
        id: entryId,
      }
      const extractor = new ExtractorClass(entry, extractorContext)
      await extractor.init()
      newContentModules = extractor.getContentModules().filter(contentModule => contentModule.sourceText.length)
      if (args.useCache) {
        pageCache[entryId] = {
          hash: entryHash,
          timestamp,
          content: {},
        }
      }
      for (const [index, contentModule] of newContentModules.entries()) {
        const contentModuleType = contentModule.constructor.name.replace(/ContentModule$/, '').toLowerCase()
        console.log(ansi.make`+ ${contentModule.sourceText.length} characters from ${contentModuleType}`)
        const safePathSegments = currentPathSegments.map(segment => segment.replaceAll(/[^\-.0-9a-z_]/gi, '_'))
        const folder = path.join(contentFolder, ...safePathSegments)
        const fileStem = `${entryId}_${contentModuleType}_${index}`
        const fileName = `${fileStem}.${contentModule.getFileExtension()}`
        const file = path.join(folder, fileName)
        await fs.outputFile(file, contentModule.sourceText)
        debug(`Wrote content module to ${ansi.linkedFile(file)}`)
        const cacheEntry = {
          title: contentModule.title,
          type: contentModuleType,
        }
        const extension = contentModule.getFileExtension()
        if (extension !== 'txt')
          cacheEntry.extension = extension
        if (args.useCache) {
          pageCache[entryId].content[fileStem] = cacheEntry
        }
        const page = value.page ?? ''
        if (contentModulePages[page] === undefined)
          contentModulePages[page] = []
        contentModulePages[page].push(contentModule)
        node.contentModules.push(contentModule)
        const sizeBytes = Buffer.byteLength(contentModule.sourceText, 'utf8')
        if (!pageReport[entryId])
          pageReport[entryId] = {
            timeMs: 0,
            content: {},
          }
        pageReport[entryId].content[fileStem] = {
          bytes: sizeBytes,
          tokens: getTokenSize(contentModule.sourceText),
        }
      }
    }
    const endTime = Date.now()
    const timeMs = endTime - startTime
    if (!pageReport[entryId])
      pageReport[entryId] = {
        timeMs: 0,
        content: {},
      }
    pageReport[entryId].timeMs = timeMs
  }
  for (const [id, value] of Object.entries(entries)) {
    const pageId = value.page ?? ''
    if (!treePages[pageId]) {
      treePages[pageId] = {
        id: pageId || '(no page id)',
        entries: [],
        contentModules: [],
      }
    }
    await processEntry(value, id, treePages[pageId], [pageId || '(no page id)'])
  }
  const filteredPages = mapObject(contentModulePages, (key, value) => {
    if (value === undefined || value.length === 0)
      return mapObjectSkip
    return [key, value]
  })
  const Engine = outputEngineTypes[args.outputMode] as (typeof outputEngineTypes[keyof typeof outputEngineTypes] | undefined)
  if (Engine) {
    const engine = new Engine({
      args,
      pages: filteredPages,
      projectId: args.projectId,
      outputFolder: args.outputFolder,
    })
    await engine.run()
  }
  if (args.useCache) {
    try {
      await toYamlFile(cacheIndex, cacheIndexFile)
      console.log(`Saved cache index to ${ansi.linkedFile(cacheIndexFile)}`)
    } catch (error) {
      console.log(`Failed to save cache index: ${error}`)
    }
  }
  if (args.debug) {
    try {
      const reportFile = path.join(args.outputFolder, 'report.yml')
      await toYamlFile(report, reportFile)
      console.log(`Saved report to ${ansi.linkedFile(reportFile)}`)
    } catch (error) {
      console.log(`Failed to save report: ${error}`)
    }
  }
}

export default async (args: ArgsMerged) => {
  for (const projectId of args.projectIds) {
    const projectFolder = path.join(args.projectsFolder, projectId)
    const outputFolder = args.outputFolder ? path.join(args.outputFolder, projectId) : path.join(projectFolder, 'out')
    await runSingle({
      ...args,
      outputFolder,
      projectFolder,
      projectId,
    })
  }
}

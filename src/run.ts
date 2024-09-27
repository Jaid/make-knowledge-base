import type {Dict} from 'more-types'
import type {ArgsMerged} from 'src/command/main.js'
import type {ContentModule} from 'src/contentModule/ContentModule.js'

import {pathToFileURL} from 'node:url'

import epochSeconds from 'epoch-seconds'
import * as path from 'forward-slash-path'
import fs from 'fs-extra'
import mapObject, {mapObjectSkip} from 'map-obj'
import hashObject from 'object-hash'
import readFileYaml from 'read-file-yaml'
import {toYamlFile} from 'zeug'

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
    title: string
    type: string
  }>
  hash: string
  timestamp: number
}

type CachePage = Dict<CacheEntry>

type Cache = Dict<CachePage>

type TreeNode = {
  contentModules: Array<ContentModule>
  entries: Array<TreeNode>
  id: string
}

export default async function run(arguments_: ArgsMerged) {
  for (const projectId of arguments_.projectIds) {
    const projectFolder = path.join(arguments_.projectsFolder, projectId)
    const outputFolder = path.join(projectFolder, `out`)
    const contentFolder = path.join(outputFolder, `content`)
    const cacheIndexFile = path.join(outputFolder, `cache.yml`)
    const entriesScriptFile = path.join(projectFolder, `sources.ts`)
    const {default: entries} = await import(pathToFileURL(entriesScriptFile).toString()) as {default: Entries}
    let cacheIndex: Cache = {}
    if (arguments_.useCache && await fs.pathExists(cacheIndexFile)) {
      try {
        const loadedCache = await readFileYaml.default(cacheIndexFile) as Cache
        cacheIndex = loadedCache
        console.log(`Loaded cache index from ${ansi.linkedFile(cacheIndexFile)}`)
      } catch (error) {
        console.log(`Failed to load cache index. Proceeding without cache.`)
      }
    }
    const contentModulePages: Dict<Array<ContentModule> | undefined> = {}
    const treePages: Dict<TreeNode> = {}
    const processEntry = async (value: BaseEntry,
      id: string,
      parentNode: TreeNode,
      pathSegments: Array<string>): Promise<void> => {
      const entryId = id || `(no id)`
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
        const extractorName = value.extractor ?? `guess`
        console.log(ansi.make`[extractor ${extractorName}] ${entryId}`)
      }
      debug(value)
      let entry: Entry = {
        ...value,
        id: entryId,
      }
      const guess = await guessExtractor(entry)
      if (!guess) {
        return
      }
      if (Array.isArray(guess)) {
        console.log(`↓ [${guess.length}]`)
        for (const guessEntry of guess) {
          await processEntry(guessEntry, guessEntry.id.toString() || `(no id)`, node, currentPathSegments)
        }
        return
      }
      if (typeof guess === `string`) {
        entry = {
          ...entry,
          extractor: guess,
        }
      } else if (guess !== true) {
        console.log(`↓`)
        await processEntry(guess, guess.id.toString() || `(no id)`, node, currentPathSegments)
        return
      }
      if (entry.extractor === undefined) {
        throw new TypeError(`Extractor is not defined`)
      }
      const timestamp = epochSeconds()
      const pageId = value.page ?? ``
      if (!cacheIndex[pageId]) {
        cacheIndex[pageId] = {}
      }
      const pageCache = cacheIndex[pageId]
      const entryHash = hashObject(entry)
      const cachedEntry = pageCache[entryId]
      let useCache = false
      if (cachedEntry && arguments_.useCache) {
        const isHashMatching = cachedEntry.hash.toLowerCase() === entryHash.toLowerCase()
        const cacheAge = timestamp - cachedEntry.timestamp
        const isExpired = arguments_.invalidateCacheAfterMinutes && cacheAge > arguments_.invalidateCacheAfterMinutes * 60
        if (!isExpired) {
          if (!arguments_.invalidateCacheOnEntryChange) {
            useCache = true
          } else if (isHashMatching) {
            useCache = true
          }
        }
      }
      let newContentModules: Array<ContentModule> = []
      if (useCache) {
        const cachedContent = cachedEntry.content || {}
        for (const [cmKey, cmData] of Object.entries(cachedContent)) {
          const contentModulePath = path.join(contentFolder, ...currentPathSegments, `${cmKey}.${arguments_.outputFileExtension}`)
          if (await fs.pathExists(contentModulePath)) {
            const sourceText = await fs.readFile(contentModulePath, `utf8`)
            const ContentModule = contentModules[cmData.type]
            if (!ContentModule) {
              throw new TypeError(`Unknown content module type: ${cmData.type}`)
            }
            const cachedContentModule = new ContentModule({
              entry,
              sourceText,
              title: cmData.title,
            })
            newContentModules.push(cachedContentModule)
          } else {
            useCache = false
            break
          }
        }
        if (useCache) {
          console.log(`✓ Cache hit for entry ${entryId}`)
        }
      }
      if (!useCache) {
        const ExtractorClass = extractors[entry.extractor]
        if (!ExtractorClass) {
          throw new TypeError(`Unknown extractor: ${entry.extractor}`)
        }
        const extractorContext = {
          args: arguments_,
          id: entryId,
        }
        const extractor = new ExtractorClass(entry, extractorContext)
        await extractor.init()
        newContentModules = extractor.getContentModules()
        if (arguments_.useCache) {
          pageCache[entryId] = {
            hash: entryHash,
            timestamp,
            content: {},
          }
          await fs.ensureDir(contentFolder)
          for (const [index, contentModule] of newContentModules.entries()) {
            if (!contentModule.sourceText.length) {
              continue
            }
            console.log(ansi.make`+ ${contentModule.sourceText.length} characters from ${contentModule.constructor.name}`)
            const safePathSegments = currentPathSegments.map(segment => segment.replaceAll(/[^\-.0-9a-z_]/gi, `_`))
            const baseOutputPath = path.join(contentFolder, ...safePathSegments)
            const fileName = `${entryId}_${contentModule.constructor.name}_${index}.${arguments_.outputFileExtension}`
            const filePath = path.join(baseOutputPath, fileName)
            await fs.outputFile(filePath, contentModule.sourceText)
            debug(`Wrote content module to ${ansi.linkedFile(filePath)}`)
            const cmKey = `${entryId}_${contentModule.constructor.name}_${index}`
            pageCache[entryId].content[cmKey] = {
              type: contentModule.constructor.name.toLowerCase(),
              title: contentModule.title,
            }
            const page = value.page ?? ``
            if (contentModulePages[page] === undefined) {
              contentModulePages[page] = []
            }
            contentModulePages[page].push(contentModule)
            node.contentModules.push(contentModule)
          }
        } else {
          for (const contentModule of newContentModules) {
            if (!contentModule.sourceText.length) {
              continue
            }
            console.log(ansi.make`+ ${contentModule.sourceText.length} characters from ${contentModule.constructor.name}`)
            const safePathSegments = currentPathSegments.map(segment => segment.replaceAll(/[^\-.0-9a-z_]/gi, `_`))
            const baseOutputPath = path.join(contentFolder, ...safePathSegments)
            const fileNameId = entry.id ? entry.id.toString() : `no_id`
            const fileName = `${fileNameId}_${contentModule.constructor.name}.${arguments_.outputFileExtension}`
            const filePath = path.join(baseOutputPath, fileName)
            await fs.outputFile(filePath, contentModule.sourceText)
            debug(`Wrote content module to ${ansi.linkedFile(filePath)}`)
            const page = value.page ?? ``
            if (contentModulePages[page] === undefined) {
              contentModulePages[page] = []
            }
            contentModulePages[page].push(contentModule)
            node.contentModules.push(contentModule)
          }
        }
      }
    }
    for (const [id, value] of Object.entries(entries)) {
      const pageId = value.page ?? ``
      if (!treePages[pageId]) {
        treePages[pageId] = {
          id: pageId || `(no page id)`,
          entries: [],
          contentModules: [],
        }
      }
      await processEntry(value, id, treePages[pageId], [pageId || `(no page id)`])
    }
    const filteredPages = mapObject(contentModulePages, (key, value) => {
      if (value === undefined || value.length === 0) {
        return mapObjectSkip
      }
      return [key, value]
    })
    const Engine = outputEngineTypes[arguments_.outputMode] as (typeof outputEngineTypes[keyof typeof outputEngineTypes] | undefined)
    if (Engine) {
      const engine = new Engine({
        args: arguments_,
        pages: filteredPages,
        projectId,
        outputFolder,
      })
      await engine.run()
    }
    if (arguments_.useCache) {
      try {
        await toYamlFile(cacheIndex, cacheIndexFile)
        console.log(`Saved cache index to ${ansi.linkedFile(cacheIndexFile)}`)
      } catch (error) {
        console.log(`Failed to save cache index: ${error}`)
      }
    }
  }
}

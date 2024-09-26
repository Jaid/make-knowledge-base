import type {defaultOptions as contextDefaultOptions, RunFunction} from 'lib/context.js'
import type {Dict, InputOptions} from 'more-types'
import type {ContentModule} from 'src/contentModule/ContentModule.js'

import {pathToFileURL} from 'url'

import epochSeconds from 'epoch-seconds'
import * as path from 'forward-slash-path'
import fs from 'fs-extra'
import mapObject, {mapObjectSkip} from 'map-obj'
import hashObject from 'object-hash'
import readFileYaml from 'read-file-yaml'
import {toYamlFile} from 'zeug'

import * as ansi from 'lib/ansi.js'
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
import {outputEngineTypes} from 'src/outputEngine/index.js'

import {guessExtractor} from './guessExtractor.js'

export type Options = InputOptions<{
  defaultsType: typeof defaultOptions & typeof contextDefaultOptions
  optionalOptions: {
    debug: boolean
    invalidateCacheAfterMinutes: number
    invalidateCacheOnEntryChange: boolean
    outputFileExtension: string
  }
  requiredOptions: {
    project: string
    projectsFolder: string
  }
}>

export type Entries = Dict<AnonymousEntry>

type BaseEntry = {
  extractor?: keyof typeof extractors
  page?: string
  target?: Dict | number | string
  title?: string
  type?: `civitai_article` | `civitai_model_description` | `github_readme` | `github_wiki_article` | `github_wiki` | `glob` | `reddit_comments` | `rentry` | `repo_glob` | `repo_markdown`
}

export type AnonymousEntry = BaseEntry & Dict

export type Entry = AnonymousEntry & {
  id: number | string
}

export const defaultOptions = {
  pandocPath: `pandoc`,
  chromeExecutable: `google-chrome`,
  minifyWholeDocument: true,
  useCache: true,
  outputMode: `single` as (keyof typeof outputEngineTypes | `none`),
  outputTreeFile: undefined as string | undefined,
  outputFileExtension: `txt`,
  invalidateCacheAfterMinutes: 10_080, // 7 days
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

export const run: RunFunction<Options> = async (options, context) => {
  for (const projectId of options._) {
    const projectFolder = path.join(options.projectsFolder, projectId)
    const outputFolder = path.join(projectFolder, `out`)
    const contentFolder = path.join(outputFolder, `content`)
    const cacheIndexFile = path.join(outputFolder, `cache.yml`)
    const entriesScriptFile = path.join(projectFolder, `sources.ts`)
    // @ts-expect-error TS7036
    const {default: entries} = await import(pathToFileURL(entriesScriptFile)) as {default: Entries}
    let cacheIndex: Cache = {}
    if (options.useCache && await fs.pathExists(cacheIndexFile)) {
      try {
        const loadedCache = await readFileYaml.default(cacheIndexFile) as Cache
        cacheIndex = loadedCache
        context.log(`Loaded cache index from ${ansi.linkedFile(cacheIndexFile)}`)
      } catch (error) {
        context.log(`Failed to load cache index. Proceeding without cache.`)
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
        context.log(ansi.make`[type ${value.type}] ${entryId}`)
      } else {
        const extractorName = value.extractor ?? `guess`
        context.log(ansi.make`[extractor ${extractorName}] ${entryId}`)
      }
      context.logInspectVerbose(value)
      let entry: Entry = {
        ...value,
        id: entryId,
      }
      const guess = await guessExtractor(entry)
      if (!guess) {
        return
      }
      if (Array.isArray(guess)) {
        context.log(`↓ [${guess.length}]`)
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
        context.log(`↓`)
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
      if (cachedEntry && options.useCache) {
        const isHashMatching = cachedEntry.hash.toLowerCase() === entryHash.toLowerCase()
        const cacheAge = timestamp - cachedEntry.timestamp
        const isExpired = options.invalidateCacheAfterMinutes && cacheAge > options.invalidateCacheAfterMinutes * 60
        if (!isExpired) {
          if (!options.invalidateCacheOnEntryChange) {
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
          const contentModulePath = path.join(contentFolder, ...currentPathSegments, `${cmKey}.${options.outputFileExtension}`)
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
          context.log(`✓ Cache hit for entry ${entryId}`)
        }
      }
      if (!useCache) {
        const ExtractorClass = extractors[entry.extractor]
        if (!ExtractorClass) {
          throw new TypeError(`Unknown extractor: ${entry.extractor}`)
        }
        const extractorContext = {
          ...context,
          options,
          id: entryId,
        }
        // @ts-expect-error TS2345
        const extractor = new ExtractorClass(entry, extractorContext)
        await extractor.init()
        newContentModules = extractor.getContentModules()
        if (options.useCache) {
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
            context.log(ansi.make`+ ${contentModule.sourceText.length} characters from ${contentModule.constructor.name}`)
            const safePathSegments = currentPathSegments.map(segment => segment.replaceAll(/[^\-.0-9a-z_]/gi, `_`))
            const baseOutputPath = path.join(contentFolder, ...safePathSegments)
            const fileName = `${entryId}_${contentModule.constructor.name}_${index}.${options.outputFileExtension}`
            const filePath = path.join(baseOutputPath, fileName)
            await fs.outputFile(filePath, contentModule.sourceText)
            context.logVerbose(`Wrote content module to ${ansi.linkedFile(filePath)}`)
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
            context.log(ansi.make`+ ${contentModule.sourceText.length} characters from ${contentModule.constructor.name}`)
            const safePathSegments = currentPathSegments.map(segment => segment.replaceAll(/[^\-.0-9a-z_]/gi, `_`))
            const baseOutputPath = path.join(contentFolder, ...safePathSegments)
            const fileNameId = entry.id ? entry.id.toString() : `no_id`
            const fileName = `${fileNameId}_${contentModule.constructor.name}.${options.outputFileExtension}`
            const filePath = path.join(baseOutputPath, fileName)
            await fs.outputFile(filePath, contentModule.sourceText)
            context.logVerbose(`Wrote content module to ${ansi.linkedFile(filePath)}`)
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
    const Engine = outputEngineTypes[options.outputMode] as (typeof outputEngineTypes[keyof typeof outputEngineTypes] | undefined)
    if (Engine) {
      const engine = new Engine({
        ...context,
        options,
        pages: filteredPages,
        projectId,
        outputFolder,
      })
      await engine.run()
    }
    if (options.useCache) {
      try {
        await toYamlFile(cacheIndex, cacheIndexFile)
        context.log(`Saved cache index to ${ansi.linkedFile(cacheIndexFile)}`)
      } catch (error) {
        context.log(`Failed to save cache index: ${error}`)
      }
    }
  }
}

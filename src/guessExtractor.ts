import type {AnonymousEntry, Entry, extractors} from 'src/cli.js'
import type {Promisable} from 'type-fest'

import {pipeline} from 'node:stream/promises'
import {createGunzip} from 'node:zlib'

import * as path from 'forward-slash-path'
import {globby} from 'globby'
import got from 'got'
import * as lodash from 'lodash-es'
import * as tarFs from 'tar-fs'
import * as tempy from 'tempy'

import {Octokit} from 'src/lib/Octokit.js'

const defaultGlobbyOptions = {
  caseSensitiveMatch: false,
  dot: true,
}
const repoTargetFromStringTarget = (target: string): {branch?: string
  owner: string
  repo: string} => {
  const [owner, repo] = target.split(`/`)
  if (repo.includes(`/`)) {
    const [actualRepo, branch] = repo.split(`/`)
    return {
      owner,
      repo: actualRepo,
      branch,
    }
  }
  return {
    owner,
    repo,
  }
}

type GuessResult = Array<Entry> | Entry | keyof typeof extractors | boolean | undefined
type EntryPreset = (entry: Entry) => Promisable<GuessResult>
type EntryPresetsKey = NonNullable<AnonymousEntry[`type`]>

export const entryPresets: Record<EntryPresetsKey, EntryPreset> = {
  rentry: entry => {
    const target = entry.target as string
    return {
      ...lodash.omit(entry, `type`),
      extractor: `htmlFromMarkdown`,
      url: `https://rentry.org/${target}/raw`,
    } as unknown as Entry
  },
  civitai_article: entry => {
    const target = entry.target as string
    return {
      ...lodash.omit(entry, `type`),
      extractor: `html`,
      url: `https://civitai.com/articles/${target}`,
      domSelector: `article`,
      puppeteer: true,
    } as unknown as Entry
  },
  civitai_model_description: entry => {
    const target = entry.target as string
    return {
      ...lodash.omit(entry, `type`),
      extractor: `html`,
      url: `https://civitai.com/api/v1/models/${target}`,
    } as unknown as Entry
  },
  github_wiki_article: entry => {
    type GitHubWikiArticleTarget = {
      article: string
      owner: string
      repo: string
    }
    const target = entry.target as GitHubWikiArticleTarget
    return {
      ...lodash.omit(entry, `type`),
      url: `https://github.com/${target.owner}/${target.repo}/wiki/${target.article}.md`,
      extractor: `htmlFromMarkdown`,
      title: `Wiki article “${target.article}” from GitHub repository ${target.owner}/${target.repo}`,
    } as unknown as Entry
  },
  github_readme: async entry => {
    type GitHubReadmeTarget = {
      branch?: string
      owner: string
      repo: string
    }
    const target = (typeof entry.target === `string` ? repoTargetFromStringTarget(entry.target) : entry.target) as GitHubReadmeTarget
    const octokit = new Octokit
    const readmeFile = await octokit.findReadme(target.owner, target.repo, target.branch)
    return {
      title: `github.com/${target.owner}/${target.repo}/readme.md`,
      ...lodash.omit(entry, `type`),
      extractor: `htmlFromMarkdown`,
      url: readmeFile.download_url as string,
    } as unknown as Entry
  },
  repo_markdown: entry => {
    type GitHubMarkdownTarget = {
      branch?: string
      owner: string
      repo: string
      titlePrefix?: string
    }
    const target = (typeof entry.target === `string` ? repoTargetFromStringTarget(entry.target) : entry.target) as GitHubMarkdownTarget
    const titlePrefix = target.titlePrefix ?? `github.com/${target.owner}/${target.repo}/`
    return {
      ...entry,
      extractor: `htmlFromMarkdown`,
      type: `repo_glob`,
      target: {
        ...target,
        pattern: [
          `**/*.md`,
          `!**/node_modules/**`,
          `!**/CONTRIBUTING.md`,
          `!**/LICENSE.md`,
          `!**/SECURITY.md`,
        ],
        globbyOptions: defaultGlobbyOptions,
        titlePrefix,
      },
    }
  },
  repo_glob: async entry => {
    type GitHubGlobTarget = {
      branch?: string
      globbyOptions?: NonNullable<Parameters<typeof globby>[1]>
      owner: string
      pattern: Parameters<typeof globby>[0]
      repo: string
      titlePrefix?: string
    }
    const target = entry.target as GitHubGlobTarget
    const repoId = target.branch ? `${target.owner}_${target.repo}_${target.branch}` : `${target.owner}_${target.repo}`
    const temporaryFolder = await tempy.temporaryDirectory({prefix: `github-repo-${repoId}-`})
    const branch = target.branch ?? `master`
    const tarGzUrl = `https://github.com/${target.owner}/${target.repo}/archive/${branch}.tar.gz`
    await pipeline(got.stream(tarGzUrl), createGunzip(), tarFs.extract(temporaryFolder, {
      strict: false,
      readable: true,
      writable: true,
      ignore: (_, header) => {
        if (header.type === `file`) {
          return false
        }
        if (header.type === `directory`) {
          return false
        }
        return true
      },
    }))
    const extractedFolders = await globby(`*`, {
      onlyDirectories: true,
      cwd: temporaryFolder,
    })
    if (extractedFolders.length === 0) {
      throw new Error(`No folders extracted from ${tarGzUrl}`)
    }
    if (extractedFolders.length > 1) {
      throw new Error(`More than one folder extracted from ${tarGzUrl}`)
    }
    const newFolder = path.join(temporaryFolder, extractedFolders[0])
    return {
      extractor: `code`,
      ...entry,
      target: {
        ...target,
        pattern: target.pattern,
        titlePrefix: target.titlePrefix ?? `github.com/${target.owner}/${target.repo}/`,
        folder: newFolder,
      },
      type: `glob`,
    }
  },
  glob: async entry => {
    type GlobTarget = {
      folder: string
      globbyOptions?: NonNullable<Parameters<typeof globby>[1]>
      pattern: Parameters<typeof globby>[0]
      titlePrefix?: string
    }
    const resultEntries: Array<Entry> = []
    const target = {
      ...entry.target as GlobTarget,
    }
    if (!target.globbyOptions) {
      target.globbyOptions = defaultGlobbyOptions
    }
    if (typeof target.globbyOptions.cwd !== `string`) {
      target.globbyOptions = {
        ...target.globbyOptions,
        cwd: target.folder,
      }
      if (typeof target.globbyOptions.cwd !== `string`) {
        throw new TypeError(`target.globbyOptions.cwd or target.folder must be a string`)
      }
    }
    const filePartials = await globby(target.pattern, {
      onlyFiles: true,
      ...target.globbyOptions,
    })
    for (const [index, filePartial] of filePartials.entries()) {
      const file = path.join(target.globbyOptions.cwd, filePartial)
      const title = `${target.titlePrefix ?? ``}${filePartial}`
      resultEntries.push({
        id: `${entry.id}_${index}_${path.stem(file)}`,
        title: entry.title ? `${entry.title} - ${title}` : title,
        url: file,
        ...lodash.pick(entry, [`extractor`, `page`]),
      })
    }
    return resultEntries
  },
  // BLOCKEDBY https://github.com/orgs/community/discussions/102891#discussioncomment-8340473
  github_wiki: async entry => {
    const [owner, repo] = String(entry.target).split(`/`)
    // const octokit = new Octokit()
    // console.dir(allPages)
    // return {
    //   ...entry,
    //   extractor: "htmlFromMarkdown",
    // }
    return true
  },
  reddit_comments: async entry => {
    const target = entry.target as string
    return {
      ...lodash.omit(entry, `type`),
      extractor: `redditThread`,
      url: target,
    } as unknown as Entry
  },
}

export const guessExtractor = async (entry: Entry): Promise<GuessResult> => {
  if (!entry.type) {
    return true
  }
  if (!entry.target) {
    return true
  }
  const typeProvider = entryPresets[entry.type]
  if (typeProvider) {
    const newEntry = await typeProvider(entry)
    return newEntry
  }
}

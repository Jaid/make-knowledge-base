import type {Dict} from 'more-types'
import type {AsyncReturnType} from 'type-fest'

import {RequestError} from '@octokit/request-error'
import {Octokit as BaseOctokit} from '@octokit/rest'

export type RepoData = (ReturnType<typeof Octokit.prototype.repos.get> extends Promise<infer U> ? U : never)['data']
export type GistData = (ReturnType<typeof Octokit.prototype.gists.get> extends Promise<infer U> ? U : never)['data']

export class Octokit extends BaseOctokit {
  authOwner: string
  hasToken: boolean
  constructor(octokitOptions: ConstructorParameters<typeof Octokit>[0] = {}, token?: string) {
    const options = {
      timeZone: process.env.TZ ?? 'UTC',
      ...octokitOptions,
    }
    if (!token && process.env.GITHUB_TOKEN) {
      token = process.env.GITHUB_TOKEN
    }
    if (token) {
      options.auth = token
    }
    super(options)
    this.hasToken = Boolean(token)
  }
  async findGist(gistId: string): Promise<GistData | undefined> {
    const gist = await this.gists.get({
      gist_id: gistId,
    })
    return gist.data
  }
  async findReadme(owner: string, repo: string, branch?: string): Promise<AsyncReturnType<typeof Octokit.prototype.repos.getContent>['data'][number]> {
    const getContentOptions: Dict = {
      owner,
      repo,
    }
    if (branch) {
      getContentOptions.branch = branch
    }
    const getContentsResult = await this.repos.getContent({
      ...getContentOptions,
      path: '',
    })
    const readmeFile = getContentsResult.data.find(file => file.name.toLowerCase() === 'readme.md') ?? getContentsResult.data.find(file => file.name.toLowerCase() === 'readme.txt') ?? getContentsResult.data.find(file => file.name.toLowerCase() === 'readme')
    if (!readmeFile) {
      throw new Error(`No readme file found in the repository ${owner}/${repo}`)
    }
    return readmeFile
  }
  async findRepo(repoName: string, githubUser?: string): Promise<RepoData | undefined> {
    let owner = githubUser
    if (!owner) {
      owner = await this.getAuthOwner()
    }
    let repo: {data: RepoData}
    try {
      repo = await this.repos.get({
        owner,
        repo: repoName,
      })
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) {
        return
      }
      throw error
    }
    return repo.data
  }
  async getAuthOwner(): Promise<string> {
    if (this.authOwner) {
      return this.authOwner
    }
    const authUser = await this.users.getAuthenticated()
    this.authOwner = authUser.data.login
    return this.authOwner
  }
  async listRepos(githubUser?: string): Promise<Array<RepoData>> {
    if (this.hasToken) {
      const remoteRepoNames = await this.paginate(this.rest.repos.listForAuthenticatedUser, {
        per_page: 100,
      }, response => {
        return response.data
      })
      // @ts-expect-error
      return remoteRepoNames
    }
    if (!githubUser) {
      throw new Error('No GitHub user specified – Either specify $GITHUB_USER or $GITHUB_TOKEN or --github-user')
    }
    const remoteRepoNames = await this.paginate(this.repos.listForUser, {
      per_page: 100,
      username: githubUser,
    }, response => {
      return response.data
    })
    // @ts-expect-error
    return remoteRepoNames
  }
}

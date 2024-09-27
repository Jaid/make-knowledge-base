import {renderHandlebars} from 'zeug'

import {DownloadExtractor} from 'src/extractor/DownloadExtractor.js'
import {markdownToSimpleHtml} from 'src/lib/markdownToSimpleHtml.js'

export type ExtraOptions = {
  commentsLimit?: number
  minimumScore?: number
}

type RedditPayload = Array<RedditListing>

interface RedditListing {
  data: {
    after: string | null
    before: string | null
    children: Array<RedditComment | RedditPost>
    dist: number | null
    geo_filter: string
    modhash: string
  }
  kind: 'Listing'
}
interface RedditPost {
  data: {
    author: string
    created: number
    created_utc: number
    id: string
    is_self: boolean
    num_comments: number
    permalink: string
    score: number
    selftext: string
    selftext_html: string
    subreddit: string
    subreddit_id: string
    title: string
    ups: number
    url: string
  }
  kind: 't3'
}
interface RedditComment {
  data: {
    author: string
    body: string
    body_html: string
    created: number
    created_utc: number
    id: string
    is_submitter: boolean
    link_id: string
    parent_id: string
    permalink: string
    replies: RedditListing | string
    score: number
    subreddit: string
    subreddit_id: string
    ups: number
  }
  kind: 't1'
}

export class RedditThreadExtractor<ExtraOptionsGeneric = {}> extends DownloadExtractor<ExtraOptions & ExtraOptionsGeneric> {
  post: RedditPost['data']
  getDownloadUrl() {
    const url = this.entry.url.includes('reddit.com') ? this.entry.url : `https://reddit.com/comments/${this.entry.url}`
    const commentsLimit = this.entry.commentsLimit || 200
    return `${url}.json?limit=${commentsLimit}`
  }
  getTitle() {
    return this.post.title ? `[Reddit Thread] ${this.post.title}` : super.getTitle()
  }
  async init() {
    await super.init()
    const payload = JSON.parse(this.response.body) as RedditPayload
    this.post = payload[0].data.children[0].data as RedditPost['data']
    if (!this.post.is_self) {
      throw new Error('RedditThreadExtractor: Post is not a self post')
    }
    const comments = payload[1].data.children
    const postTemplate = /* handlebars */ '<p class=\'original-post\'><h3>#0{{#if author}} by {{author}}{{/if}} to {{subreddit_name_prefixed}} (Score: {{score}})</h3><div>{{markdownToHtml selftext}}</div></p>'
    const commentTemplate = /* handlebars */ `
    <p class='comment'>
      <h3>#{{commentIndex}}{{#if author}} by {{author}}{{/if}}{{replyToText}} (Score: {{score}})</h3>
      <div>{{markdownToHtml this.body}}</div>
    </p>`
    const template = /* handlebars */ '<article>{{post}}{{comments}}</p></article>'
    const baseHelpers = {
      markdownToHtml: (input: string, headerLevelStart: number = 4) => {
        const html = markdownToSimpleHtml(input, {
          headerLevelStart,
        })
        return html
      },
    }
    this.content = renderHandlebars(template, {}, {
      ...baseHelpers,
      post: () => {
        return renderHandlebars(postTemplate, this.post, baseHelpers)
      },
      comments: () => {
        let commentIndex = 1
        const commentIdMap = new Map<string, number>
        const renderComment = (comment: RedditComment['data'], depth: number = 0, parentId?: string): string => {
          if (this.entry.minimumScore !== undefined && this.entry.minimumScore > comment.score) {
            return '' // Skip this comment and its children
          }
          const currentIndex = commentIndex++
          commentIdMap.set(comment.id, currentIndex)
          let replyToText = ''
          if (depth > 0 && parentId) {
            const parentIndex = commentIdMap.get(parentId)
            if (parentIndex !== undefined) {
              replyToText = ` in reply to #${parentIndex}`
            }
          }
          const renderedComment = renderHandlebars(commentTemplate, {
            ...comment,
            commentIndex: currentIndex,
            replyToText,
            body: baseHelpers.markdownToHtml(comment.body),
          }, baseHelpers)
          let repliesHtml = ''
          if (typeof comment.replies === 'object' && comment.replies.data.children.length > 0) {
            repliesHtml = comment.replies.data.children
              .filter(child => child.kind === 't1')
              .map(child => renderComment(child.data, depth + 1, comment.id))
              .join('')
          }
          return `<div class="comment-depth-${depth}">${renderedComment}${repliesHtml}</div>`
        }
        return comments
          .filter(comment => comment.kind === 't1')
          .map(comment => renderComment(comment.data))
          .join('')
      },
    })
  }
}

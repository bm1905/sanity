/* eslint-disable max-depth, complexity */
import {Diff} from '@sanity/diff'
import {Chunk} from '@sanity/field/diff'
import {applyPatch, incremental, RawPatch} from 'mendoza'
import {Value} from 'mendoza/lib/incremental-patcher'
import {Transaction, TransactionLogEvent, Doc, RemoteMutationWithVersion} from './types'
import {diffValue, Meta} from './mendozaDiffer'
import {TwoEndedArray} from './twoEndedArray'
import {mergeChunk, chunkFromTransaction} from './chunker'
import {TraceEvent} from './tracer'

export type ParsedTimeRef = Chunk | 'loading' | 'invalid'

type Attributes = Record<string, unknown>

type Options = {
  publishedId: string
  draft: Doc | null
  published: Doc | null
  enableTrace?: boolean
}

type DocumentVersion = {
  rev: string
  attributes: Attributes
}

function createVersion(document: Doc | null): DocumentVersion | null {
  if (document) {
    const attributes = {...document} as Attributes
    delete attributes._rev
    if (!document._rev) throw new Error('document must have _rev')
    return {rev: document._rev, attributes}
  }

  return null
}

function patchVersion(
  version: DocumentVersion | null,
  rev: string,
  patch: RawPatch
): DocumentVersion | null {
  const attributes = version ? version.attributes : null
  const newAttributes = applyPatch(attributes, patch)
  return newAttributes === null ? null : {rev, attributes: newAttributes}
}

/**
 * Timeline maintains information about the history of a document:
 * Grouping raw translog entries into sensible groups, replaying and
 * reconstructing different versions and abstract other details.
 *
 * Note that this class by itself is not capable of _fetching_ information,
 * but will only organize and structure the incoming translog entries.
 */
export class Timeline {
  reachedEarliestEntry = false

  publishedId: string
  draftId: string
  private _transactions = new TwoEndedArray<Transaction>()
  private _chunks = new TwoEndedArray<Chunk>()
  private _draftVersion: DocumentVersion | null
  private _publishedVersion: DocumentVersion | null

  // These two properties are here to handle the case
  private _possiblePendingTransactions = new Map<
    string,
    {
      transaction: Transaction
      idx: number
    }
  >()
  private _recreateTransactionsFrom?: number
  private _trace?: TraceEvent[]

  constructor(opts: Options) {
    this.publishedId = opts.publishedId
    this.draftId = `drafts.${opts.publishedId}`
    this._draftVersion = createVersion(opts.draft)
    this._publishedVersion = createVersion(opts.published)

    if (opts.enableTrace) {
      this._trace = []
      this._trace.push({
        type: 'initial',
        publishedId: opts.publishedId,
        draft: opts.draft,
        published: opts.published
      })
      ;(window as any).__sanityTimelineTrace = this._trace
    }
  }

  get chunkCount() {
    return this._chunks.length
  }

  /** Maps over the chunk from newest to oldest. */
  mapChunks<T>(mapper: (chunk: Chunk, idx: number) => T): T[] {
    const result: T[] = []

    const firstIdx = this._chunks.firstIdx
    const lastIdx = this._chunks.lastIdx

    for (let idx = lastIdx; idx >= firstIdx; idx--) {
      result.push(mapper(this._chunks.get(idx), idx))
    }

    return result
  }

  /**
   * Adds a remote mutation to the timeline. This methods assumes that the remote mutations
   * come in correct order for their respective version, but has no ordering requirements
   * across draft/published.
   *
   * Example: [D1, D2, P1] (where D1 and P1 were mutations done to the draft and published
   * version in the same transaction) is a valid input. [P1, D2, D1] is _not_ valid since
   * the mutation for the draft is out of order.
   */
  addRemoteMutation(entry: RemoteMutationWithVersion) {
    if (this._trace) this._trace.push({type: 'addRemoteMutation', event: entry})

    const pending = this._possiblePendingTransactions.get(entry.transactionId)

    const transaction: Transaction = pending
      ? pending.transaction
      : {
          index: 0,
          id: entry.transactionId,
          timestamp: entry.timestamp,
          author: entry.author
        }

    if (entry.version === 'published') {
      transaction.publishedEffect = entry.effects as any
      this._publishedVersion = patchVersion(
        this._publishedVersion,
        entry.transactionId,
        entry.effects.apply as RawPatch
      )
    } else {
      transaction.draftEffect = entry.effects as any
      this._draftVersion = patchVersion(
        this._draftVersion,
        entry.transactionId,
        entry.effects.apply as RawPatch
      )
    }

    if (pending) {
      this._possiblePendingTransactions.delete(entry.transactionId)
      this._invalidateTransactionFrom(pending.idx)
    } else {
      this._transactions.addToEnd(transaction)
      this._possiblePendingTransactions.set(entry.transactionId, {
        transaction,
        idx: this._transactions.lastIdx
      })
    }
  }

  addTranslogEntry(event: TransactionLogEvent) {
    if (this._trace) this._trace.push({type: 'addTranslogEntry', event})

    this._transactions.addToBeginning({
      index: 0,
      id: event.id,
      author: event.author,
      timestamp: new Date(event.timestamp),
      draftEffect: event.effects[this.draftId],
      publishedEffect: event.effects[this.publishedId]
    })
  }

  /** Mark that we've reached the earliest entry. */
  didReachEarliestEntry() {
    if (this._trace) this._trace.push({type: 'didReachEarliestEntry'})

    this.reachedEarliestEntry = true
  }

  /**
   * updateChunks synchronizes the chunks to match the current state
   * of the transactions array. After calling this method you need
   * to invalidate all Chunks.
   */
  updateChunks() {
    if (this._trace) this._trace.push({type: 'updateChunks'})

    this._removeInvalidatedChunks()
    this._addChunksFromTransactions()
    this._createInitialChunk()
  }

  private _removeInvalidatedChunks() {
    if (this._recreateTransactionsFrom) {
      while (this._chunks.length > 0) {
        const chunk = this._chunks.last
        if (this._recreateTransactionsFrom < chunk.end) {
          this._chunks.removeFromEnd()
        } else {
          break
        }
      }
      this._recreateTransactionsFrom = undefined
    }
  }

  private _addChunksFromTransactions() {
    const firstIdx = this._transactions.firstIdx
    const lastIdx = this._transactions.lastIdx

    // Add transactions at the end:
    const nextTransactionToChunk = this._chunks.length > 0 ? this._chunks.last.end : firstIdx
    for (let idx = nextTransactionToChunk; idx <= lastIdx; idx++) {
      const transaction = this._transactions.get(idx)
      this._chunks.mergeAtEnd(chunkFromTransaction(transaction), mergeChunk)
    }

    // Add transactions at the beginning:
    if (this._chunks.length == 0) return

    const firstTransactionChunked = this._chunks.first.start

    for (let idx = firstTransactionChunked - 1; idx >= firstIdx; idx--) {
      const transaction = this._transactions.get(idx)
      this._chunks.mergeAtBeginning(chunkFromTransaction(transaction), mergeChunk)
    }
  }

  private _invalidateTransactionFrom(idx: number) {
    if (this._recreateTransactionsFrom === undefined || idx < this._recreateTransactionsFrom) {
      this._recreateTransactionsFrom = idx
    }
  }

  private _createInitialChunk() {
    if (this.reachedEarliestEntry) {
      if (this._chunks.first?.type === 'initial') return

      const firstTx = this._transactions.first
      if (!firstTx) return
      const initialChunk = chunkFromTransaction(firstTx)
      initialChunk.type = 'initial'
      initialChunk.id = '@initial'
      this._chunks.addToBeginning(initialChunk)
    }
  }

  /**
   * Resolves a time reference.
   *
   * Note that the chunk returned is only valid if the timeline stays constant.
   * Once the timeline is updated, you must re-parse all references.
   */
  parseTimeId(id: string): ParsedTimeRef {
    if (this._chunks.length === 0) {
      return this.reachedEarliestEntry ? 'invalid' : 'loading'
    }

    if (id === '@lastPublished') {
      const chunk = this.findMaybeLastPublishedBefore(this._chunks.lastIdx)
      if (chunk) return chunk

      return this.reachedEarliestEntry ? this._chunks.first : 'loading'
    }

    const [timestampStr, chunkId] = id.split('/', 2)
    const timestamp = new Date(Number(timestampStr))

    for (let idx = this._chunks.lastIdx; idx >= this._chunks.firstIdx; idx--) {
      const chunk = this._chunks.get(idx)
      if (chunk.id === chunkId) {
        return chunk
      }

      if (chunk.endTimestamp.valueOf() + 60 * 60 * 1000 < timestamp.valueOf()) {
        // The chunk ended _before_ the timestamp we're asking for. This means that there
        // is no point in looking further and the chunk is invalid.

        // We add 1 hour to allow some slack since transactions are not guaranteed to be in order.
        return 'invalid'
      }
    }

    return this.reachedEarliestEntry ? 'invalid' : 'loading'
  }

  findLastPublishedBefore(chunkIdx: number) {
    return this.findMaybeLastPublishedBefore(chunkIdx) || this._chunks.first
  }

  findMaybeLastPublishedBefore(chunkIdx: number) {
    for (; chunkIdx >= this._chunks.firstIdx; chunkIdx--) {
      const chunk = this._chunks.get(chunkIdx)
      if (chunk.type === 'publish' || chunk.type === 'initial') {
        return chunk
      }
    }

    return null
  }

  isLatestChunk(chunk: Chunk) {
    return chunk === this._chunks.last
  }

  // eslint-disable-next-line class-methods-use-this
  createTimeId(chunk: Chunk): string {
    return `${chunk.endTimestamp.valueOf()}/${chunk.id}`
  }

  lastChunk(): Chunk {
    return this._chunks.last
  }

  transactionByIndex(idx: number): Transaction | null {
    if (!this._transactions.has(idx)) return null
    return this._transactions.get(idx)
  }

  chunkByTransactionIndex(idx: number, startChunkIdx = 0): Chunk {
    let chunkIdx = startChunkIdx
    for (;;) {
      const chunk = this._chunks.get(chunkIdx)
      if (!chunk) throw new Error('transaction does not belong in any chunk')

      if (idx >= chunk.end) {
        chunkIdx++
      } else if (idx < chunk.start) {
        chunkIdx--
      } else {
        return chunk
      }
    }
  }

  // We maintain a single "reconstruction" of a range in the history.
  private _reconstruction?: Reconstruction

  /**
   * Sets the range for the current reconstruction.
   *
   * This method optimizes for the cases where `startRef` and/or `endRef` is
   * equal (using object identity) to the previous range, so feel free to call
   * this often rather seldom.
   */
  setRange(start: Chunk | null, end: Chunk) {
    const current = this._reconstruction

    if (current) {
      if (current.start !== start) {
        current.diff = undefined
        current.startDocument = undefined
        current.start = start
      }

      if (current.end !== end) {
        current.diff = undefined
        current.endDocument = undefined
        current.end = end
      }

      return
    }

    this._reconstruction = {start, end}
  }

  /** Returns the attributes as seen at the end of the range. */
  endAttributes() {
    const current = this._reconstruction
    if (!current) {
      throw new Error('range required')
    }

    if (!current.endDocument) {
      const draft: any = this._draftVersion ? this._draftVersion.attributes : null
      const published: any = this._publishedVersion ? this._publishedVersion.attributes : null
      current.endDocument = this._replayBackwards(current.end.end, this._transactions.lastIdx, {
        draft,
        published
      })
    }

    return getAttrs(current.endDocument)
  }

  /** Returns the attributes as seen at the end of the range. */
  startAttributes() {
    const current = this._reconstruction
    if (!current) {
      throw new Error('range required')
    }

    if (!current.start) throw new Error('start required')

    if (!current.startDocument) {
      // Ensure that endDocument is generated
      this.endAttributes()

      current.startDocument = this._replayBackwards(
        current.start.end,
        current.end.end - 1,
        current.endDocument!
      )
    }

    return getAttrs(current.startDocument)
  }

  private _replayBackwards(
    firstIdx: number,
    lastIdx: number,
    doc: CombinedDocument
  ): CombinedDocument {
    let draft = doc.draft
    let published = doc.published
    for (let idx = lastIdx; idx >= firstIdx; idx--) {
      const transaction = this._transactions.get(idx)

      if (transaction.draftEffect) {
        draft = applyPatch(draft, transaction.draftEffect.revert)
      }

      if (transaction.publishedEffect) {
        published = applyPatch(published, transaction.publishedEffect.revert)
      }
    }

    return {draft, published}
  }

  /** Returns the diff between the start and the end range. */
  currentDiff() {
    const current = this._reconstruction
    if (!current || current.start === null) {
      return null
    }

    if (current.diff) {
      return current.diff
    }

    // Make sure that start/endDocument is populated
    this.startAttributes()
    this.endAttributes()

    const doc = current.startDocument!

    let draftValue = incremental.wrap<Meta>(doc.draft, null)
    let publishedValue = incremental.wrap<Meta>(doc.published, null)

    const initialValue = getValue(draftValue, publishedValue)
    const initialAttributes = getAttrs(doc)

    // Loop over all of the chunks:
    for (let chunkIdx = current.start.index + 1; chunkIdx <= current.end.index; chunkIdx++) {
      const chunk = this._chunks.get(chunkIdx)

      for (let idx = chunk.start; idx < chunk.end; idx++) {
        const transaction = this._transactions.get(idx)

        const meta = {
          chunk,
          chunkIndex: chunkIdx,
          transactionIndex: idx
        }

        const preDraftValue = draftValue
        const prePublishedValue = publishedValue

        if (transaction.draftEffect) {
          draftValue = incremental.applyPatch(draftValue, transaction.draftEffect.apply, meta)
        }

        if (transaction.publishedEffect) {
          publishedValue = incremental.applyPatch(
            publishedValue,
            transaction.publishedEffect.apply,
            meta
          )
        }

        const didHaveDriaft = incremental.getType(preDraftValue) !== 'null'
        const haveDraft = incremental.getType(draftValue) !== 'null'
        const havePublished = incremental.getType(publishedValue) !== 'null'

        if (havePublished && !haveDraft) {
          publishedValue = incremental.rebaseValue(preDraftValue, publishedValue)
        }

        if (haveDraft && !didHaveDriaft) {
          draftValue = incremental.rebaseValue(prePublishedValue, draftValue)
        }
      }
    }

    const finalValue = incremental.getType(draftValue) === 'null' ? publishedValue : draftValue
    const finalAttributes = getAttrs(current.endDocument!)
    current.diff = diffValue(this, initialValue, initialAttributes, finalValue, finalAttributes)
    return current.diff
  }
}

function getAttrs(doc: CombinedDocument) {
  return doc.draft || doc.published
}

function getValue(draftValue: Value<Meta>, publishedValue: Value<Meta>) {
  return incremental.getType(draftValue) === 'null' ? publishedValue : draftValue
}

// The combined document stores information about both the draft and the published version.
type CombinedDocument = {
  draft: Attributes
  published: Attributes
}

type Reconstruction = {
  start: Chunk | null
  end: Chunk
  startDocument?: CombinedDocument
  endDocument?: CombinedDocument
  diff?: Diff<any>
}

/* eslint-disable max-depth */
import React, {useCallback} from 'react'
import {
  ObjectDiff,
  ObjectSchemaType,
  DocumentChangeContext,
  ChangeList,
  Chunk
} from '@sanity/field/diff'
import CloseIcon from 'part:@sanity/base/close-icon'
import Button from 'part:@sanity/components/buttons/default'
import {useDocumentHistory} from '../documentHistory'

import styles from './changesPanel.css'
import {format} from 'date-fns'
import {formatTimelineEventDate, formatTimelineEventLabel} from '../timeline'

interface ChangesPanelProps {
  changesSinceSelectRef: React.MutableRefObject<HTMLDivElement | null>
  documentId: string
  isTimelineOpen: boolean
  loading: boolean
  onTimelineOpen: () => void
  schemaType: ObjectSchemaType
  since: Chunk | null
  timelineMode: 'rev' | 'since' | 'closed'
}

export function ChangesPanel({
  changesSinceSelectRef,
  documentId,
  isTimelineOpen,
  loading,
  onTimelineOpen,
  since,
  schemaType,
  timelineMode
}: ChangesPanelProps) {
  const {close: closeHistory, timeline} = useDocumentHistory()
  const diff: ObjectDiff = timeline.currentDiff() as any

  if (!loading && diff?.type !== 'object') {
    return null
  }

  const documentContext = React.useMemo(() => ({documentId, schemaType}), [documentId, schemaType])

  // This is needed to stop the ClickOutside-handler (in the Popover) to treat the click
  // as an outside-click.
  const ignoreClickOutside = useCallback((evt: React.MouseEvent<HTMLDivElement>) => {
    evt.stopPropagation()
  }, [])

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.mainNav}>
          <h2 className={styles.title}>Changes</h2>
          <div className={styles.closeButtonContainer}>
            <Button
              icon={CloseIcon}
              kind="simple"
              onClick={closeHistory}
              padding="small"
              title="Hide changes panel"
              type="button"
            />
          </div>
        </div>
        <div className={styles.versionSelectContainer}>
          <div ref={changesSinceSelectRef} style={{display: 'inline-block'}}>
            <Button
              kind="simple"
              onMouseUp={ignoreClickOutside}
              onClick={onTimelineOpen}
              padding="small"
              selected={isTimelineOpen && timelineMode === 'since'}
              size="small"
            >
              {isTimelineOpen && timelineMode === 'since' ? (
                <>Review changes since</>
              ) : (
                sinceText(since)
              )}{' '}
              &darr;
            </Button>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <DocumentChangeContext.Provider value={documentContext}>
            <div className={styles.changeList}>
              <ChangeList diff={diff} schemaType={schemaType} />
            </div>
          </DocumentChangeContext.Provider>
        )}
      </div>
    </div>
  )
}

function sinceText(since: Chunk | null) {
  if (!since) return `Since unknown version`

  return `Since ${formatTimelineEventLabel(since.type)} ${formatTimelineEventDate(
    since.endTimestamp
  )}`
}

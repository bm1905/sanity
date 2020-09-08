/* eslint-disable max-depth */
import React, {useCallback} from 'react'
import {
  ObjectDiff,
  ObjectSchemaType,
  DocumentChangeContext,
  DiffAnnotationTooltipContent,
  ChangeList,
  Chunk,
  DocumentChangeContextProps
} from '@sanity/field/diff'
import CloseIcon from 'part:@sanity/base/close-icon'
import {UserAvatar} from '@sanity/base/components'
import {Tooltip} from 'part:@sanity/components/tooltip'
import Button from 'part:@sanity/components/buttons/default'
import {AvatarStack} from 'part:@sanity/components/avatar'
import {formatTimelineEventDate, formatTimelineEventLabel} from '../timeline'
import {useDocumentHistory} from '../documentHistory'
import {Reporter} from '@sanity/base/lib/change-indicators'
import * as PathUtils from '@sanity/util/paths'

import styles from './changesPanel.css'
import {collectLatestAuthorAnnotations} from './helpers'

const ChangeFieldWrapper = (props: {change: any; children: React.ReactNode}) => (
  <Reporter id={`change-${PathUtils.toString(props.change.path)}`} data={{}}>
    {props.children}
  </Reporter>
)

interface ChangesPanelProps {
  changesSinceSelectRef: React.MutableRefObject<HTMLDivElement | null>
  documentId: string
  isTimelineOpen: boolean
  loading: boolean
  onTimelineOpen: () => void
  schemaType: ObjectSchemaType
  since: Chunk | null
  onScrollTopChange: (number) => void
  timelineMode: 'rev' | 'since' | 'closed'
}

export function ChangesPanel({
  changesSinceSelectRef,
  documentId,
  isTimelineOpen,
  loading,
  onTimelineOpen,
  since,
  onScrollTopChange,
  schemaType,
  timelineMode
}: ChangesPanelProps) {
  const {close: closeHistory, timeline} = useDocumentHistory()
  const diff: ObjectDiff = timeline.currentDiff() as any

  if (!loading && diff?.type !== 'object') {
    return null
  }

  const documentContext: DocumentChangeContextProps = React.useMemo(
    () => ({
      documentId,
      schemaType,
      FieldWrapper: ChangeFieldWrapper
    }),
    [documentId, schemaType]
  )

  const changeAnnotations = React.useMemo(
    () => (diff ? collectLatestAuthorAnnotations(diff) : []),
    [diff]
  )

  const handleScroll = useCallback(
    (event: React.UIEvent) => {
      onScrollTopChange(event.currentTarget.scrollTop)
    },
    [onScrollTopChange]
  )

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
          {changeAnnotations.length > 0 && (
            <Tooltip
              content={
                (
                  <DiffAnnotationTooltipContent
                    description="Changes by"
                    annotations={changeAnnotations}
                  />
                ) as any
              }
              placement="top"
            >
              <div className={styles.changeAuthorsContainer}>
                <AvatarStack className={styles.changeAuthorsAvatarStack} maxLength={4}>
                  {changeAnnotations.map(({author}) => (
                    <UserAvatar key={author} userId={author} />
                  ))}
                </AvatarStack>
              </div>
            </Tooltip>
          )}
        </div>

      </header>

      <Reporter id="changesPanel" component="div" className={styles.body} onScroll={handleScroll}>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <DocumentChangeContext.Provider value={documentContext}>
            <div className={styles.changeList}>
              <ChangeList diff={diff} schemaType={schemaType} />
              <div style={{height: 2000}} />
            </div>
          </DocumentChangeContext.Provider>
        )}
      </Reporter>
    </div>
  )
}

function sinceText(since: Chunk | null) {
  if (!since) return `Since unknown version`

  return `Since ${formatTimelineEventLabel(since.type)} ${formatTimelineEventDate(
    since.endTimestamp
  )}`
}

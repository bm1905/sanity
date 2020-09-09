import {useDocumentOperation} from '@sanity/react-hooks'
import React, {useCallback, useContext} from 'react'
import {FieldChangeNode, OperationsAPI} from '../../types'
import {ChangeHeader} from './ChangeHeader'
import {DiffErrorBoundary} from './DiffErrorBoundary'
import {DocumentChangeContext} from './DocumentChangeContext'
import {RevertChangesButton} from './RevertChangesButton'
import {undoChange} from './undoChange'

import styles from './FieldChange.css'
import {ValueError} from './ValueError'

const FallbackDiff = () => <div>Missing diff</div>

export function FieldChange({change}: {change: FieldChangeNode}) {
  const DiffComponent = change.diffComponent || FallbackDiff
  const {documentId, schemaType, FieldWrapper = React.Fragment} = useContext(DocumentChangeContext)
  const docOperations = useDocumentOperation(documentId, schemaType.name) as OperationsAPI

  const handleRevertChanges = useCallback(
    () => undoChange(change.diff, change.path, docOperations),
    [documentId, change.key, change.diff]
  )

  const rootClass = change.error ? styles.error : styles.root

  return (
    <FieldWrapper change={change}>
      <div className={rootClass}>
        {change.renderHeader && <ChangeHeader titlePath={change.titlePath} />}

        <div className={styles.diffComponent}>
          {change.error ? (
            <ValueError error={change.error} />
          ) : (
            <DiffErrorBoundary>
              <DiffComponent diff={change.diff} schemaType={change.schemaType} />
            </DiffErrorBoundary>
          )}
        </div>

        <div className={styles.revertChangesButtonContainer}>
          <RevertChangesButton onClick={handleRevertChanges} />
        </div>
      </div>
    </FieldWrapper>
  )
}

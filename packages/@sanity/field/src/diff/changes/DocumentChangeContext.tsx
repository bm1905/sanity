import {createContext} from 'react'
import {FieldChangeNode, SchemaType} from '../../types'

export type DocumentChangeContextProps = {
  documentId: string
  schemaType: SchemaType
  FieldWrapper: React.ComponentType<{change: FieldChangeNode; children: React.ReactNode}>
}

export const DocumentChangeContext = createContext<DocumentChangeContextProps>({} as any)

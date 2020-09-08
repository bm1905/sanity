import React from 'react'
import {Connector} from '../../components/changeConnector'
import {Line} from '../../components/changeConnector/Line'

interface Props {
  children?: React.ReactNode
  trackerRef: React.RefObject<HTMLDivElement>
  regions: any[]
  documentPanelScrollTop: number
  changePanelScrollTop: number
}

const DEBUG = false

export function ConnectorsOverlay(props: Props) {
  const {
    children,
    trackerRef,
    regions,
    documentPanelScrollTop,
    changePanelScrollTop,
    ...rest
  } = props

  const changesPanel = regions.find(region => region.id == 'changesPanel')
  const fieldRegions = regions.filter(
    region => region !== changesPanel && region.id.startsWith('field-')
  )
  const changeRegions = regions.filter(
    region => region !== changesPanel && region.id.startsWith('change-')
  )

  // note: this assumes the changes panel header and the document panel always have the same height
  const topEdge = changesPanel?.rect?.top - 8
  return (
    <div ref={trackerRef} {...rest}>
      {children}
      {changesPanel && (
        <svg
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            ...(DEBUG ? {backgroundColor: 'rgba(0, 100, 100, 0.2)'} : {}),
            top: changesPanel.rect.top,
            left: 0,
            right: 0,
            bottom: 0,
            height: changesPanel.rect.height,
            width: '100%'
          }}
        >
          <g>
            {fieldRegions.map(fieldRegion => {
              const changeId = fieldRegion.id.replace('field-', 'change-')
              const changeRegion = changeRegions.find(r => r.id === changeId)

              const changeMarkerLeft = changeRegion?.rect?.left - 10

              return (
                <>
                  {DEBUG && (
                    <>
                      <rect
                        width={fieldRegion.rect.width}
                        height={fieldRegion.rect.height}
                        x={fieldRegion.rect.left}
                        y={fieldRegion.rect.top - topEdge}
                        style={{opacity: 0.2}}
                      />
                      {changeRegion && (
                        <rect
                          width={changeRegion.rect.width}
                          height={changeRegion.rect.height}
                          x={changeRegion.rect.left}
                          y={changeRegion.rect.top - topEdge}
                          style={{opacity: 0.2}}
                        />
                      )}
                    </>
                  )}
                  <Line
                    key={`field-${fieldRegion.id}`}
                    from={{
                      left: changesPanel.rect.left,
                      top: Math.max(fieldRegion.rect.top - documentPanelScrollTop) - topEdge
                    }}
                    to={{
                      left: changesPanel.rect.left,
                      top:
                        fieldRegion.rect.top +
                        fieldRegion.rect.height -
                        documentPanelScrollTop -
                        topEdge
                    }}
                    color="#2276FC"
                    strokeWidth={2}
                  />
                  {changeRegion && (
                    <Connector
                      from={{
                        left: changesPanel.rect.left,
                        top: fieldRegion.rect.top - documentPanelScrollTop - topEdge + 8
                      }}
                      to={{
                        left: changeMarkerLeft,
                        top: changeRegion.rect.top - changePanelScrollTop - topEdge + 8
                      }}
                      bounds={{
                        width: 0,
                        height: changesPanel.rect.height
                      }}
                    />
                  )}
                  {changeRegion && (
                    <Line
                      key={`field-${changeRegion.id}`}
                      from={{
                        left: changeMarkerLeft,
                        top: Math.max(changeRegion.rect.top - changePanelScrollTop) - topEdge
                      }}
                      to={{
                        left: changeMarkerLeft,
                        top:
                          changeRegion.rect.top +
                          changeRegion.rect.height -
                          changePanelScrollTop -
                          topEdge
                      }}
                      color="#2276FC"
                      strokeWidth={2}
                    />
                  )}
                </>
              )
            })}
          </g>
        </svg>
      )}
    </div>
  )
}

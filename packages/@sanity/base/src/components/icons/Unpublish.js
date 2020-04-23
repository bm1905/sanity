/* eslint-disable react/jsx-filename-extension */

import React from 'react'

const strokeStyle = {
  vectorEffect: 'non-scaling-stroke'
}

const UnpublishIcon = () => (
  <svg
    viewBox="0 0 25 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid"
    width="1em"
    height="1em"
  >
    <path d="M5 19.5H20" stroke="currentColor" style={strokeStyle} />
    <path d="M12.5 16L12.5 4.99999" stroke="currentColor" style={strokeStyle} />
    <path d="M17.5 11L12.5 16L7.49998 11" stroke="currentColor" style={strokeStyle} />
  </svg>
)

export default UnpublishIcon
import React from 'react';

export interface KdsLiveAnnouncerProps {
  message?: string;
}

export function KdsLiveAnnouncer({ message }: KdsLiveAnnouncerProps) {
  return (
    <div
      role="status"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {message || ''}
    </div>
  );
}

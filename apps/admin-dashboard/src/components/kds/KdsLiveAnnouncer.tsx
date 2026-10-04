import React from 'react';

export interface KdsLiveAnnouncerProps {
  message?: string;
}

export function KdsLiveAnnouncer({ message }: KdsLiveAnnouncerProps) {
  return (
    <div
      role="status"
      aria-atomic="true"
      className="sr-only"
    >
      {message || ''}
    </div>
  );
}

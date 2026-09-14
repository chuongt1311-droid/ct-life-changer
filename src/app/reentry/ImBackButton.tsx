'use client';

import { useTransition } from 'react';
import { Icon } from '@/components/icons/Icon';
import { acknowledgeReentryAction } from './actions';

export function ImBackButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button className="btn btn-main" disabled={pending} onClick={() => startTransition(() => acknowledgeReentryAction(sessionId))}>
      <Icon name="start" />
      I&apos;m back
    </button>
  );
}

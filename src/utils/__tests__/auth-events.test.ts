import { decideAuthEventAction } from '@/utils/auth-events';

describe('decideAuthEventAction', () => {
  it('clears the user when there is no session', () => {
    expect(decideAuthEventAction('SIGNED_OUT', null, 'u1')).toBe('clear');
    expect(decideAuthEventAction('INITIAL_SESSION', undefined, null)).toBe('clear');
  });

  it('loads the profile for the first sign-in of a user', () => {
    expect(decideAuthEventAction('SIGNED_IN', 'u1', null)).toBe('load-profile');
    expect(decideAuthEventAction('INITIAL_SESSION', 'u1', null)).toBe('load-profile');
  });

  it('only updates the token when the token is refreshed for the loaded user', () => {
    expect(decideAuthEventAction('TOKEN_REFRESHED', 'u1', 'u1')).toBe('update-token');
  });

  it('ignores repeated sign-in events for the loaded user (e.g. app returns to foreground)', () => {
    expect(decideAuthEventAction('SIGNED_IN', 'u1', 'u1')).toBe('update-token');
    expect(decideAuthEventAction('INITIAL_SESSION', 'u1', 'u1')).toBe('update-token');
  });

  it('reloads the profile when the account really changes', () => {
    expect(decideAuthEventAction('TOKEN_REFRESHED', 'u2', 'u1')).toBe('load-profile');
    expect(decideAuthEventAction('SIGNED_IN', 'u2', 'u1')).toBe('load-profile');
    expect(decideAuthEventAction('USER_UPDATED', 'u1', 'u1')).toBe('load-profile');
  });

  it('a refresh storm loads the profile only once (the bug on devices with a wrong clock)', () => {
    let loadedUserId: string | null = null;
    let profileLoads = 0;
    let tokenOnlyUpdates = 0;

    const events = ['SIGNED_IN', ...Array.from({ length: 500 }, () => 'TOKEN_REFRESHED')];
    for (const event of events) {
      const action = decideAuthEventAction(event, 'u1', loadedUserId);
      if (action === 'load-profile') {
        loadedUserId = 'u1';
        profileLoads += 1;
      } else if (action === 'update-token') {
        tokenOnlyUpdates += 1;
      } else {
        loadedUserId = null;
      }
    }

    expect(profileLoads).toBe(1);
    expect(tokenOnlyUpdates).toBe(500);
  });

  it('loads the profile again after a sign-out and a new sign-in', () => {
    let loadedUserId: string | null = 'u1';

    expect(decideAuthEventAction('SIGNED_OUT', null, loadedUserId)).toBe('clear');
    loadedUserId = null;

    expect(decideAuthEventAction('SIGNED_IN', 'u1', loadedUserId)).toBe('load-profile');
  });
});

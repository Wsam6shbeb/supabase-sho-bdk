import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

describe('GuardedPressable', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ignores rapid repeated taps but accepts a later intentional tap', () => {
    const onPress = jest.fn();
    const screen = render(
      <GuardedPressable onPress={onPress}>
        <Text>اضغط</Text>
      </GuardedPressable>,
    );
    const button = screen.getByText('اضغط');

    fireEvent.press(button);
    fireEvent.press(button);
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(701);
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('does not allow another tap while an async action is still running', async () => {
    let finish!: () => void;
    const action = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onPress = jest.fn(() => action);
    const screen = render(
      <GuardedPressable onPress={onPress}>
        <Text>تنفيذ</Text>
      </GuardedPressable>,
    );
    const button = screen.getByText('تنفيذ');

    fireEvent.press(button);
    jest.advanceTimersByTime(701);
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);

    finish();
    await action;
  });
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { act } from 'react-test-renderer';
import renderer from 'react-test-renderer';
import MessageComposer from '../MessageComposer';

test('renders idle state (no text)', () => {
  let instance: renderer.ReactTestRenderer;
  act(() => {
    instance = renderer.create(
      <MessageComposer
        onSend={jest.fn()}
        isDarkMode={false}
        placeholder="Type a message…"
      />
    );
  });
  expect(instance!.toJSON()).toMatchSnapshot();
});

test('renders dark mode', () => {
  let instance: renderer.ReactTestRenderer;
  act(() => {
    instance = renderer.create(
      <MessageComposer
        onSend={jest.fn()}
        isDarkMode={true}
        placeholder="Type a message…"
      />
    );
  });
  expect(instance!.toJSON()).toMatchSnapshot();
});

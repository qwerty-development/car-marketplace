import React from 'react';
import renderer from 'react-test-renderer';
import MessageBubble from '../MessageBubble';
import { ChatMessage } from '@/types/chat';

const baseMessage: ChatMessage = {
  id: 1,
  conversation_id: 1,
  sender_id: 'user-abc',
  sender_role: 'user',
  body: 'Is the car still available?',
  media_url: null,
  is_read: false,
  read_at: null,
  created_at: '2024-01-01T12:00:00Z',
};

test('own message renders correctly', () => {
  const tree = renderer
    .create(<MessageBubble message={baseMessage} isOwn={true} isDarkMode={false} />)
    .toJSON();
  expect(tree).toMatchSnapshot();
});

test('received message renders correctly', () => {
  const tree = renderer
    .create(<MessageBubble message={baseMessage} isOwn={false} isDarkMode={true} />)
    .toJSON();
  expect(tree).toMatchSnapshot();
});

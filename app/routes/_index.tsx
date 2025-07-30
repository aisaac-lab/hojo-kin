import type { MetaFunction } from '@remix-run/node';
import { ChatInterface } from '~/components/ChatInterface';

export const meta: MetaFunction = () => {
  return [
    { title: '補助金検索システム - AI Assistant' },
    { name: 'description', content: 'AIアシスタントが最適な補助金・助成金を提案します' },
  ];
};

export default function Index() {
  return <ChatInterface />;
}
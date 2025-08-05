import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { AssistantService } from '~/services/assistant.service';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const threadId = url.searchParams.get('threadId');
  const userId = url.searchParams.get('userId');

  const assistantService = new AssistantService();

  try {
    if (threadId) {
      const thread = await assistantService.getThread(threadId);
      return json({ thread });
    }

    if (userId) {
      const threads = await assistantService.listThreads(userId);
      return json({ threads });
    }

    const threads = await assistantService.listThreads();
    return json({ threads });
  } catch (error) {
    console.error('Thread fetch error:', error);
    return json(
      { error: 'Failed to fetch thread(s)' },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { userId, metadata } = await request.json();

    const assistantService = new AssistantService();
    const thread = await assistantService.createThread(userId, metadata);

    return json({ thread, success: true });
  } catch (error) {
    console.error('Thread creation error:', error);
    return json(
      { error: 'Failed to create thread' },
      { status: 500 }
    );
  }
}
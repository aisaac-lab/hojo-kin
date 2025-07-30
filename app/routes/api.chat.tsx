import { json, type ActionFunctionArgs } from "@remix-run/node";
import { AssistantService } from "../services/assistant.server";
import type { ChatResponse } from "~/types/chat";

export async function action({ request }: ActionFunctionArgs) {
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { threadId, message, userId } = await request.json();

    if (!message) {
      return json({ error: "Message is required" }, { status: 400 });
    }

    const assistantService = new AssistantService();

    let currentThreadId = threadId;

    if (!currentThreadId) {
      const thread = await assistantService.createThread(userId);
      currentThreadId = thread.id;
    }

    await assistantService.addMessage(currentThreadId, message, "user");

    const additionalInstructions = `
      あなたは日本の補助金・助成金の専門アドバイザーです。
      ユーザーの質問に対して、File Searchツールを使用して関連する補助金情報を検索し、
      適切な補助金を提案してください。

      回答する際は：
      1. ユーザーのニーズに最も適した補助金を優先的に提案する
      2. 各補助金の概要、対象者、金額、申請期限を明確に説明する
      3. 申請に必要な要件や注意点も含める
      4. 必要に応じて複数の選択肢を提示する

      常に日本語で回答してください。
    `;

    const result = await assistantService.runAssistant(
      currentThreadId,
      additionalInstructions
    );

    // Get only the new assistant message(s) created in this run
    // OpenAI returns messages in reverse chronological order (newest first)
    let newAssistantMessage = null;
    
    // Find the first assistant message that's newer than the last one we saw
    for (const msg of result.messages.data) {
      if (msg.role === "assistant") {
        if (!result.lastAssistantMessageIdBefore || msg.id !== result.lastAssistantMessageIdBefore) {
          newAssistantMessage = msg;
          break;
        } else {
          // We've reached the last message from before, stop here
          break;
        }
      }
    }
    
    // Get the content of the new message
    const latestMessageContent = newAssistantMessage && newAssistantMessage.content[0].type === "text"
      ? newAssistantMessage.content[0].text.value 
      : "";
    

    const response: ChatResponse = {
      threadId: currentThreadId,
      messages: latestMessageContent ? [latestMessageContent] : [],
      success: true,
    };
    
    return json(response);
  } catch (error) {
    console.error("Chat error:", error);
    return json({ error: "Failed to process chat message" }, { status: 500 });
  }
}

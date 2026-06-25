export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type ModelProvider = {
  complete(messages: AgentMessage[]): Promise<string>;
};

export type OpenAICompatibleModelOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export class OpenAICompatibleModelProvider implements ModelProvider {
  constructor(private readonly options: OpenAICompatibleModelOptions) {}

  async complete(messages: AgentMessage[]) {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provider request failed: ${response.status} ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Provider response did not include message content");
    }

    return content;
  }
}

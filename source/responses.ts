// Helpers for reading an OpenAI Responses API response object.

export function outputText(response: any): string {
  const parts: string[] = [];
  for(const item of response?.output ?? []) {
    if(item.type !== "message") continue;
    for(const part of item.content ?? []) {
      if(part.type === "output_text") parts.push(part.text);
    }
  }
  return parts.join("");
}

export function functionCalls(response: any): Array<{ call_id: string, name: string, arguments: string }> {
  return (response?.output ?? []).filter((item: any) => item.type === "function_call");
}

export const weatherTool = {
  type: "function",
  name: "get_weather",
  description: "Get the current weather for a city.",
  parameters: {
    type: "object",
    properties: {
      location: { type: "string", description: "City name" },
    },
    required: ["location"],
    additionalProperties: false,
  },
};

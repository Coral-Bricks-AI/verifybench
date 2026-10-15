// Helpers for reading an Anthropic Messages API message.

export function messageText(message: any): string {
  return (message?.content ?? [])
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("");
}

export function toolUses(message: any): Array<{ id: string, name: string, input: any }> {
  return (message?.content ?? []).filter((block: any) => block.type === "tool_use");
}

export const weatherTool = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  input_schema: {
    type: "object",
    properties: {
      location: { type: "string", description: "City name" },
    },
    required: ["location"],
  },
};

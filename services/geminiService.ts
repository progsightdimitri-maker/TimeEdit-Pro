import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  // @ts-ignore
  return import.meta.env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || '';
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

export const generateDescription = async (
  project: string,
  startTime: string,
  endTime: string,
  date: string
): Promise<string> => {
  if (!apiKey) {
    console.warn("API Key is missing. Returning mock response for demo.");
    return `Worked on ${project} tasks`;
  }

  try {
    const prompt = `
      Generate a professional, concise time entry description (max 10 words) for a developer working on project "${project}".
      The work happened on ${date} between ${startTime} and ${endTime}.
      Just return the description text, nothing else.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || `Work on ${project}`;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `Update for ${project}`;
  }
};


import { GoogleGenAI, Type } from "@google/genai";
import { PhonicsLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generatePhonicsLevel = async (): Promise<PhonicsLevel | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Generate a simple, 3 or 4-letter CVC (consonant-vowel-consonant) or CVCC/CCVC English word suitable for a 5-year-old learning phonics. Provide a fun, magical description for a game, including an emoji.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: {
              type: Type.STRING,
              description: "The generated word in lowercase.",
            },
            description: {
              type: Type.STRING,
              description: "A fun, magical sentence using the word. e.g., Spell 'word' for the magical thing! 🧙",
            },
          },
          required: ["word", "description"],
        },
      },
    });

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);
    
    if (parsed.word && parsed.description) {
      const word = parsed.word.toLowerCase();
      const letters = word.toUpperCase().split('');
      return {
        type: 'phonics',
        word,
        letters,
        description: parsed.description,
      };
    }
    return null;
  } catch (error) {
    console.error("Error generating level with Gemini:", error);
    return null;
  }
};

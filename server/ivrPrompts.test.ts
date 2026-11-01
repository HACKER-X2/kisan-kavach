import { describe, expect, it } from "vitest";
import { defaultIvrLanguageForDistrict, getIvrPrompt, IVR_LANGUAGE_OPTIONS } from "../client/src/components/ivrPrompts";

describe("regional IVR prompts", () => {
  it("provides Hindi, Assamese, Marathi, and Bengali choices", () => {
    expect(IVR_LANGUAGE_OPTIONS.map((option) => option.value)).toEqual(["HINDI", "ASSAMESE", "MARATHI", "BENGALI"]);
  });

  it("uses the selected language while preserving the loss percentage and keypad confirmation", () => {
    for (const language of IVR_LANGUAGE_OPTIONS.map((option) => option.value)) {
      const prompt = getIvrPrompt(language, 19.5);
      expect(prompt).toContain("19.5%");
      expect(prompt).toContain("1");
    }
  });

  it("defaults Dhubri to Assamese and other districts to Hindi", () => {
    expect(defaultIvrLanguageForDistrict("Dhubri")).toBe("ASSAMESE");
    expect(defaultIvrLanguageForDistrict("Darbhanga")).toBe("HINDI");
  });
});

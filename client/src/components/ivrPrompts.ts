export const IVR_LANGUAGE_OPTIONS = [
  { value: "HINDI", label: "Hindi · हिन्दी" },
  { value: "ASSAMESE", label: "Assamese · অসমীয়া" },
  { value: "MARATHI", label: "Marathi · मराठी" },
  { value: "BENGALI", label: "Bengali · বাংলা" },
] as const;

export type IvrLanguage = (typeof IVR_LANGUAGE_OPTIONS)[number]["value"];

const promptTemplates: Record<IvrLanguage, (lossPercentage: number) => string> = {
  HINDI: (lossPercentage) => `नमस्कार किसान। किसान कवच में बाढ़ आकलन दर्ज है। आपके खेत में ${lossPercentage}% नुकसान का संकेत है। PMFBY दावा पुष्टि करने के लिए 1 दबाएँ।`,
  ASSAMESE: (lossPercentage) => `নমস্কাৰ কৃষক। কিষাণ কবচত বান মূল্যায়ন নথিভুক্ত হৈছে। আপোনাৰ খেতিত ${lossPercentage}% ক্ষতিৰ সংকেত আছে। PMFBY দাবী নিশ্চিত কৰিবলৈ 1 টিপক।`,
  MARATHI: (lossPercentage) => `नमस्कार शेतकरी. किसान कवचमध्ये पूर मूल्यांकन नोंदवले आहे. आपल्या शेतात ${lossPercentage}% नुकसानीचा अंदाज आहे. PMFBY दावा निश्चित करण्यासाठी 1 दाबा.`,
  BENGALI: (lossPercentage) => `নমস্কার কৃষক। কিষান কবচে বন্যা মূল্যায়ন নথিভুক্ত হয়েছে। আপনার জমিতে ${lossPercentage}% ক্ষতির ইঙ্গিত রয়েছে। PMFBY দাবি নিশ্চিত করতে 1 চাপুন।`,
};

export function getIvrPrompt(language: IvrLanguage, lossPercentage: number) {
  return promptTemplates[language](lossPercentage);
}

export function defaultIvrLanguageForDistrict(district: string): IvrLanguage {
  return district === "Dhubri" ? "ASSAMESE" : "HINDI";
}

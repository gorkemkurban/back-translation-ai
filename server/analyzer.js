const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeTranslations({ originalText, userTranslation, backTranslation, targetLanguage }) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
  // 1. Türkçe çeviri analizi
  const turkishAnalysis = await analyzeStep(
    model,
    `Orijinal ${targetLanguage} metninin Türkçe çevirisini analiz edin:\n\n` +
    `ORİJİNAL:\n${originalText}\n\nÇEVİRİ:\n${userTranslation}\n\n` +
    `- Terminoloji hatalarını belirtin\n` +
    `- Akademik dil uygunluğunu değerlendirin\n` +
    `- Önerilen iyileştirmeleri listeleyin`
  );

  // 2. Geri çeviri analizi
  const backTranslationAnalysis = await analyzeStep(
    model,
    `Türkçeden ${targetLanguage} geri çeviriyi analiz edin:\n\n` +
    `TÜRKÇE ORİJİNAL:\n${userTranslation}\n\n${targetLanguage} ÇEVİRİ:\n${backTranslation}\n\n` +
    `- Gramer hatalarını işaretleyin\n` +
    `- Anlam kaymalarını tespit edin`
  );

  // 3. Metin karşılaştırması
  const comparisonAnalysis = await analyzeStep(
    model,
    `İki ${targetLanguage} metni karşılaştırın:\n\n` +
    `ORİJİNAL METİN:\n${originalText}\n\nKULLANICI ÇEVİRİSİ:\n${backTranslation}\n\n` +
    `- Tutarlılık analizi yapın\n` +
    `- Kaybolan/güçlenen anlamları belirtin\n` +
    `- Akademik üslup farklarını vurgulayın`
  );

  return {
    turkishAnalysis,
    backTranslationAnalysis,
    comparisonAnalysis,
    overallScore: calculateScore(turkishAnalysis, backTranslationAnalysis)
  };
}

async function analyzeStep(model, prompt) {
  try {
    const result = await model.generateContent(prompt);
    return (await result.response.text())
      .replace(/```/g, '')
      .trim();
  } catch (error) {
    console.error("Analiz hatası:", error);
    return "Analiz yapılamadı";
  }
}

function calculateScore(...analyses) {
  // Basit bir puanlama mekanizması (gerçekte daha karmaşık olabilir)
  const positiveKeywords = ["başarılı", "doğru", "uygun", "güçlü"];
  const matches = analyses.join(" ").match(new RegExp(positiveKeywords.join("|"), "gi"));
  return matches ? Math.min(100, matches.length * 20) : 0;
}

module.exports = { analyzeTranslations };
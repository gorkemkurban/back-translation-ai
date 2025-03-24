require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Dil ve alan eşleme tablosu
const languageMap = {
  fr: { apiName: "French" },
  es: { apiName: "Spanish" }
};

const fieldMap = {
  medicine: {
    prompt: `Generate a 2-paragraph academic medical text in {LANGUAGE} about current advancements in {FIELD}. 
             Include specialized terminology and formal academic style.`,
    examples: {
      fr: "Les progrès récents en immunothérapie oncologique ont révolutionné...",
      es: "Los avances recientes en la terapia génica para enfermedades raras..."
    }
  },
  law: {
    prompt: `Generate a 2-paragraph legal text in {LANGUAGE} about international {FIELD} law. 
             Use precise legal terminology and formal structure.`,
    examples: {
      fr: "Le principe de non-ingérence en droit international public...",
      es: "La interpretación del artículo 38 del Estatuto de la Corte Internacional de Justicia..."
    }
  }
};

// Metin oluşturma endpoint'i
app.post("/generate-text", async (req, res) => {
  const { targetLanguage, field } = req.body;
  const langConfig = languageMap[targetLanguage] || languageMap.fr;
  const fieldConfig = fieldMap[field] || fieldMap.medicine;

  try {
    const prompt = fieldConfig.prompt
      .replace('{LANGUAGE}', langConfig.apiName)
      .replace('{FIELD}', field);

    const result = await model.generateContent(prompt);
    const text = (await result.response.text())
      .replace(/```/g, '')
      .replace(/"/g, '')
      .trim();

    res.json({ success: true, text });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Metin oluşturulamadı",
      fallback: fieldConfig.examples[targetLanguage] || fieldConfig.examples.fr
    });
  }
});

// Analiz endpoint'i
app.post("/analyze", async (req, res) => {
  try {
    const { originalText, userTranslation, backTranslation, targetLanguage, field } = req.body;
    const langName = languageMap[targetLanguage]?.apiName || targetLanguage;

    // 1. Türkçe çeviri analizi
    const turkishPrompt = `
      Analyze this academic translation from ${langName} to Turkish for a ${field} text:
      ORIGINAL: ${originalText}
      TRANSLATION: ${userTranslation}
      Provide detailed feedback on:
      1. Terminology accuracy
      2. Academic style
      3. Suggested improvements
      Respond in Turkish with bullet points.
    `;

    // 2. Geri çeviri analizi
    const backTranslationPrompt = `
      Evaluate this back-translation from Turkish to ${langName}:
      ORIGINAL TURKISH: ${userTranslation}
      BACK-TRANSLATION: ${backTranslation}
      Identify:
      1. Grammar errors
      2. Meaning distortions
      3. Style inconsistencies
      Respond in Turkish.
    `;

    // 3. Metin karşılaştırması
    const comparisonPrompt = `
      Compare these two ${langName} texts (original vs back-translated):
      ORIGINAL: ${originalText}
      BACK-TRANSLATED: ${backTranslation}
      Analyze:
      1. Semantic differences
      2. Terminology consistency
      3. Academic tone preservation
      Respond in Turkish.
    `;

    const [turkishAnalysis, backTranslationAnalysis, comparisonAnalysis] = await Promise.all([
      model.generateContent(turkishPrompt),
      model.generateContent(backTranslationPrompt),
      model.generateContent(comparisonPrompt)
    ]);

    const responses = await Promise.all([
      turkishAnalysis.response,
      backTranslationAnalysis.response,
      comparisonAnalysis.response
    ]);

    res.json({
      success: true,
      analysis: {
        turkishAnalysis: responses[0].text(),
        backTranslationAnalysis: responses[1].text(),
        comparisonAnalysis: responses[2].text(),
        score: calculateScore(responses.map(r => r.text()))
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

function calculateScore(analyses) {
  const positiveMatches = analyses.join(" ").match(/doğru|başarılı|uygun/g) || [];
  return Math.min(100, positiveMatches.length * 10);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} üzerinde çalışıyor`);
});
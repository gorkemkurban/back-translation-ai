require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

// API key kontrolü
if (!API_KEY) {
  console.error("❌ HATA: GEMINI_API_KEY bulunamadı!");
  console.log("📝 Çözüm: .env dosyasına GEMINI_API_KEY=your_key_here ekleyin");
  process.exit(1);
}

console.log("✅ API Key yüklendi:", API_KEY.substring(0, 10) + "...");

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Dil ve alan eşleme tablosu
const languageMap = {
  fr: { apiName: "French", nativeName: "Fransızca" },
  es: { apiName: "Spanish", nativeName: "İspanyolca" }
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

// Terminoloji çıkarma fonksiyonu
async function extractTerminology(text, language, field) {
  const langName = languageMap[language]?.apiName || language;
  const fieldName = field === 'medicine' ? 'tıp' : 'hukuk';
  
  const terminologyPrompt = `
    Aşağıdaki ${langName} dilindeki ${fieldName} alanı metninden önemli akademik/teknik terimleri çıkar.
    Sadece alana özel, teknik terimleri seç. Genel kelimeler dahil etme.
    Maksimum 8-10 terim seç ve JSON formatında döndür:
    
    Metin: ${text}
    
    Sadece şu JSON formatında yanıt ver, başka açıklama ekleme:
    {"terminology": [{"word": "terim", "translation": "türkçe_çeviri"}]}
  `;

  try {
    console.log("🔍 Terminoloji çıkarılıyor...");
    const result = await model.generateContent(terminologyPrompt);
    const response = await result.response.text();
    
    // JSON'u temizle ve parse et
    const cleanedResponse = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    console.log("📝 AI terminoloji yanıtı:", cleanedResponse);
    
    const terminology = JSON.parse(cleanedResponse);
    console.log("✅ Terminoloji başarıyla çıkarıldı:", terminology);
    
    return terminology;
  } catch (error) {
    console.error("❌ Terminoloji çıkarma hatası:", error.message);
    
    // Fallback terminoloji
    const fallbackTerms = {
      medicine: {
        fr: [
          { word: "immunothérapie", translation: "bağışıklık tedavisi" },
          { word: "oncologique", translation: "onkolojik" },
          { word: "pathologie", translation: "patoloji" },
          { word: "diagnostic", translation: "tanı" }
        ],
        es: [
          { word: "terapia génica", translation: "gen tedavisi" },
          { word: "patología", translation: "patoloji" },
          { word: "diagnóstico", translation: "tanı" },
          { word: "tratamiento", translation: "tedavi" }
        ]
      },
      law: {
        fr: [
          { word: "jurisprudence", translation: "içtihat" },
          { word: "non-ingérence", translation: "müdahalesizlik" },
          { word: "souveraineté", translation: "egemenlik" },
          { word: "tribunal", translation: "mahkeme" }
        ],
        es: [
          { word: "jurisprudencia", translation: "içtihat" },
          { word: "soberanía", translation: "egemenlik" },
          { word: "jurisdicción", translation: "yargı yetkisi" },
          { word: "derecho internacional", translation: "uluslararası hukuk" }
        ]
      }
    };
    
    return { 
      terminology: fallbackTerms[field]?.[language] || fallbackTerms.medicine.fr 
    };
  }
}

// Metin oluşturma endpoint'i (terminoloji ile birlikte)
app.post("/generate-text", async (req, res) => {
  console.log("📨 Generate-text isteği alındı:", req.body);
  
  const { targetLanguage, field } = req.body;
  const langConfig = languageMap[targetLanguage] || languageMap.fr;
  const fieldConfig = fieldMap[field] || fieldMap.medicine;

  try {
    const prompt = fieldConfig.prompt
      .replace('{LANGUAGE}', langConfig.apiName)
      .replace('{FIELD}', field);

    console.log("🔄 Gemini'ye gönderilen prompt:", prompt);

    const result = await model.generateContent(prompt);
    const text = (await result.response.text())
      .replace(/```/g, '')
      .replace(/"/g, '')
      .trim();

    console.log("✅ Metin başarıyla oluşturuldu");

    // Terminolojiyi çıkar
    const terminology = await extractTerminology(text, targetLanguage, field);

    console.log("✅ Başarılı yanıt hazırlandı");
    res.json({ 
      success: true, 
      text,
      terminology: terminology.terminology || []
    });

  } catch (error) {
    console.error("❌ Generate-text hatası:", error.message);
    console.error("📋 Hata detayı:", error);
    
    res.status(500).json({ 
      success: false,
      message: "Metin oluşturulamadı: " + error.message,
      fallback: fieldConfig.examples[targetLanguage] || fieldConfig.examples.fr,
      terminology: []
    });
  }
});

// Analiz endpoint'i
app.post("/analyze", async (req, res) => {
  console.log("📨 Analyze isteği alındı:", req.body);
  
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

    console.log("🔄 Analiz için 3 prompt gönderiliyor...");

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

    console.log("✅ Analiz başarıyla tamamlandı");

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
    console.error("❌ Analyze hatası:", error.message);
    console.error("📋 Hata detayı:", error);
    
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Bağımsız terminoloji çıkarma endpoint'i (isteğe bağlı)
app.post("/extract-terminology", async (req, res) => {
  console.log("📨 Extract-terminology isteği alındı:", req.body);
  
  try {
    const { text, language, field } = req.body;
    const terminology = await extractTerminology(text, language, field);
    
    res.json({
      success: true,
      terminology: terminology.terminology || []
    });
    
  } catch (error) {
    console.error("❌ Extract-terminology hatası:", error.message);
    res.status(500).json({ 
      success: false,
      message: error.message,
      terminology: []
    });
  }
});

function calculateScore(analyses) {
  const positiveMatches = analyses.join(" ").match(/doğru|başarılı|uygun/g) || [];
  return Math.min(100, positiveMatches.length * 10);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} üzerinde çalışıyor`);
  console.log("📡 Endpoints:");
  console.log("   POST /generate-text (terminoloji ile birlikte)");
  console.log("   POST /analyze");
  console.log("   POST /extract-terminology (bağımsız)");
});